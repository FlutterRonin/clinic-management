// Double-booking guard — the flagship business logic (spec §8.3).
//
// Overlap rule: two appointments for the SAME tenant + SAME doctor conflict iff
//   existing.start < new.end && existing.end > new.start
// and the existing appointment still occupies the slot (scheduled or checked-in).
// Touching edges (10:00–10:15 then 10:15–10:30) do NOT conflict.
//
// The conflict query runs inside the request's MongoDB transaction (req is passed
// through from the hook) so a read + create are atomic — two simultaneous bookings
// for the same slot cannot both win.

import type { Payload, PayloadRequest } from 'payload'
import { ACTIVE_STATUSES } from './constants'

/** Pure overlap test — exported for unit tests. */
export function overlaps(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart < bEnd && aEnd > bStart
}

export function computeEnd(start: Date, durationMins: number): Date {
  return new Date(start.getTime() + durationMins * 60_000)
}

type ConflictArgs = {
  payload: Payload
  req?: PayloadRequest
  tenantID: string
  doctorID: string
  start: Date
  end: Date
  /** When rescheduling, exclude the appointment being edited. */
  excludeID?: string
}

/**
 * Returns the first conflicting appointment, or null if the slot is free.
 * Walk-ins are allowed to overlap (handled by the caller); this checks the
 * scheduled/checked-in occupancy of the doctor.
 */
export async function findConflict({
  payload,
  req,
  tenantID,
  doctorID,
  start,
  end,
  excludeID,
}: ConflictArgs) {
  const where: Record<string, unknown> = {
    tenant: { equals: tenantID },
    doctor: { equals: doctorID },
    status: { in: ACTIVE_STATUSES },
    // Range overlap: existing.start < new.end AND existing.end > new.start
    and: [{ start: { less_than: end.toISOString() } }, { end: { greater_than: start.toISOString() } }],
  }
  if (excludeID) where.id = { not_equals: excludeID }

  const result = await payload.find({
    collection: 'appointments',
    where: where as any,
    limit: 1,
    depth: 1,
    req,
    // Internal system query: tenant is already explicitly scoped in `where`, so we
    // bypass user access (the caller may be a seed/system op with no user).
    overrideAccess: true,
    pagination: false,
  })

  return result.docs[0] ?? null
}
