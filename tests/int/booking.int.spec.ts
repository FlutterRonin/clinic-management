import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import type { Payload } from 'payload'
import { getTestPayload, seedFixture, type Fixture } from './fixtures'

// Booking guard suite (spec §8.3 / §11-B). Verifies the overlap rule end-to-end
// through the collection hooks, plus the parallel-request race.

const iso = (h: number, m: number) => new Date(Date.UTC(2026, 5, 15, h, m)).toISOString()

describe('double-booking guard', () => {
  let payload: Payload
  let f: Fixture

  const book = (over: Record<string, unknown> = {}) =>
    payload.create({
      collection: 'appointments',
      overrideAccess: false,
      user: f.a.receptionist,
      data: {
        patient: f.a.patient.id,
        doctor: f.a.doctor.id,
        start: iso(10, 0),
        durationMins: 30,
        status: 'scheduled',
        ...over,
      } as never,
    })

  beforeAll(async () => {
    payload = await getTestPayload()
  })

  beforeEach(async () => {
    f = await seedFixture(payload)
  })

  it('allows a first booking', async () => {
    const appt = await book()
    expect(appt.id).toBeTruthy()
  })

  it('rejects an exact-overlap second booking', async () => {
    await book()
    await expect(book()).rejects.toThrow()
  })

  it('rejects a partial overlap', async () => {
    await book() // 10:00–10:30
    await expect(book({ start: iso(10, 15) })).rejects.toThrow() // 10:15–10:45
  })

  it('allows touching edges', async () => {
    await book({ start: iso(10, 0), durationMins: 15 }) // 10:00–10:15
    const next = await book({ start: iso(10, 15), durationMins: 15 }) // 10:15–10:30
    expect(next.id).toBeTruthy()
  })

  it('allows a different doctor at the same time', async () => {
    await book()
    const otherDoc = await payload.create({
      collection: 'users',
      overrideAccess: true,
      data: {
        name: 'Doctor A2',
        email: 'doc-a2@clinic.test',
        password: 'password123',
        role: 'doctor',
        tenant: f.a.tenant.id,
        active: true,
      },
    })
    const next = await book({ doctor: otherDoc.id })
    expect(next.id).toBeTruthy()
  })

  it('ignores a cancelled appointment when checking conflicts', async () => {
    const first = await book()
    await payload.update({
      collection: 'appointments',
      id: first.id,
      overrideAccess: true,
      data: { status: 'cancelled', cancellationReason: 'patient called off' },
    })
    const next = await book()
    expect(next.id).toBeTruthy()
  })

  it('lets an appointment reschedule onto its own slot', async () => {
    const appt = await book()
    const updated = await payload.update({
      collection: 'appointments',
      id: appt.id,
      overrideAccess: false,
      user: f.a.receptionist,
      data: { reason: 'same slot edit' },
    })
    expect(updated.reason).toBe('same slot edit')
  })

  it('rejects an illegal status transition', async () => {
    const appt = await book()
    await expect(
      payload.update({
        collection: 'appointments',
        id: appt.id,
        overrideAccess: false,
        user: f.a.receptionist,
        data: { status: 'completed' }, // scheduled → completed is illegal
      }),
    ).rejects.toThrow()
  })

  it('only one of two simultaneous identical bookings succeeds', async () => {
    const results = await Promise.allSettled([book(), book()])
    const fulfilled = results.filter((r) => r.status === 'fulfilled')
    const rejected = results.filter((r) => r.status === 'rejected')
    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)
  })
})
