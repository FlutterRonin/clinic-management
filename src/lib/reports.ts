// Dashboard aggregation — DB-side counts and ranges only, never load-all (the
// same discipline as a reports module that scales). Day boundaries are computed
// in the tenant's timezone so "today" matches what the clinic sees.

import type { Payload, Where } from 'payload'
import type { Appointment, Tenant } from '@/payload-types'
import { DEFAULT_TIMEZONE } from './constants'

/** Offset (tz - UTC) in ms at a given instant. */
export function tzOffsetMs(date: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const map: Record<string, number> = {}
  for (const p of dtf.formatToParts(date)) if (p.type !== 'literal') map[p.type] = Number(p.value)
  const asUTC = Date.UTC(map.year, map.month - 1, map.day, map.hour === 24 ? 0 : map.hour, map.minute, map.second)
  return asUTC - date.getTime()
}

/** Midnight (start of day) in tz for `today + dayOffset`, returned as a UTC Date. */
export function startOfDayInTz(tz: string, dayOffset = 0, now = new Date()): Date {
  const offset = tzOffsetMs(now, tz)
  const local = new Date(now.getTime() + offset)
  const startLocalAsUTC = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate() + dayOffset,
    0,
    0,
    0,
  )
  return new Date(startLocalAsUTC - offset)
}

const tzOf = (tenant: Tenant | null) => tenant?.settings?.timezone || DEFAULT_TIMEZONE

/** Convert a wall-clock date+time in `tz` (e.g. "2026-06-15" + "17:30") to a UTC Date. */
export function wallTimeToUTC(tz: string, dateStr: string, timeStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  const [hh, mm] = timeStr.split(':').map(Number)
  const guessUTC = Date.UTC(y, m - 1, d, hh, mm, 0)
  const offset = tzOffsetMs(new Date(guessUTC), tz)
  return new Date(guessUTC - offset)
}

type CountArgs = { tenant: { equals: string } } & Record<string, unknown>

export type DashboardData = {
  todayCount: number
  completedToday: number
  noShowsToday: number
  newPatients7d: number
  series: { label: string; count: number }[]
  upcoming: Appointment[]
}

export async function getDashboardData(
  payload: Payload,
  tenantID: string,
  tenant: Tenant | null,
): Promise<DashboardData> {
  const tz = tzOf(tenant)
  const todayStart = startOfDayInTz(tz, 0)
  const tomorrowStart = startOfDayInTz(tz, 1)
  const weekAgo = startOfDayInTz(tz, -6)

  const base: CountArgs = { tenant: { equals: tenantID } }
  const inToday = {
    start: { greater_than_equal: todayStart.toISOString(), less_than: tomorrowStart.toISOString() },
  }

  const count = (where: Record<string, unknown>) =>
    payload
      .count({ collection: 'appointments', where: { ...base, ...where } as Where, overrideAccess: true })
      .then((r) => r.totalDocs)

  const [todayCount, completedToday, noShowsToday, newPatients7d, upcomingRes] = await Promise.all([
    count(inToday),
    count({ ...inToday, status: { equals: 'completed' } }),
    count({ ...inToday, status: { equals: 'no-show' } }),
    payload
      .count({
        collection: 'patients',
        where: { tenant: { equals: tenantID }, createdAt: { greater_than_equal: weekAgo.toISOString() } },
        overrideAccess: true,
      })
      .then((r) => r.totalDocs),
    payload.find({
      collection: 'appointments',
      where: {
        ...base,
        start: { greater_than_equal: new Date().toISOString(), less_than: tomorrowStart.toISOString() },
        status: { in: ['scheduled', 'checked-in'] },
      },
      sort: 'start',
      limit: 8,
      depth: 1,
      overrideAccess: true,
    }),
  ])

  // 14-day series: one count per day.
  const days = Array.from({ length: 14 }, (_, i) => 13 - i)
  const series = await Promise.all(
    days.map(async (back) => {
      const dayStart = startOfDayInTz(tz, -back)
      const dayEnd = startOfDayInTz(tz, -back + 1)
      const c = await count({
        start: { greater_than_equal: dayStart.toISOString(), less_than: dayEnd.toISOString() },
      })
      const label = dayStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: tz })
      return { label, count: c }
    }),
  )

  return {
    todayCount,
    completedToday,
    noShowsToday,
    newPatients7d,
    series,
    upcoming: upcomingRes.docs as Appointment[],
  }
}
