import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import type { Payload } from 'payload'
import { getTestPayload, seedFixture, type Fixture } from './fixtures'

// Walk-in token numbers: first-come-first-serve sequence per clinic per day.

describe('walk-in tokens', () => {
  let payload: Payload
  let f: Fixture

  beforeAll(async () => {
    payload = await getTestPayload()
  })
  beforeEach(async () => {
    f = await seedFixture(payload)
  })

  const walkIn = (offsetMin: number) => {
    const start = new Date()
    start.setHours(11, 0 + offsetMin, 0, 0)
    return payload.create({
      collection: 'appointments',
      overrideAccess: false,
      user: f.a.receptionist,
      data: {
        patient: f.a.patient.id,
        doctor: f.a.doctor.id,
        start: start.toISOString(),
        durationMins: 15,
        status: 'checked-in',
        isWalkIn: true,
      } as never,
    })
  }

  it('assigns sequential tokens to walk-ins on the same day', async () => {
    const first = (await walkIn(1)) as { tokenNumber?: string }
    const second = (await walkIn(3)) as { tokenNumber?: string }
    expect(first.tokenNumber).toBe('T-01')
    expect(second.tokenNumber).toBe('T-02')
  })

  it('does not assign a token to a scheduled (non-walk-in) appointment', async () => {
    const start = new Date()
    start.setHours(13, 0, 0, 0)
    const appt = (await payload.create({
      collection: 'appointments',
      overrideAccess: false,
      user: f.a.receptionist,
      data: {
        patient: f.a.patient.id,
        doctor: f.a.doctor.id,
        start: start.toISOString(),
        durationMins: 15,
        status: 'scheduled',
      } as never,
    })) as { tokenNumber?: string }
    expect(appt.tokenNumber).toBeFalsy()
  })

  it('keeps walk-in tokens isolated per tenant', async () => {
    const a = (await walkIn(5)) as { tokenNumber?: string }
    // Clinic B's first walk-in should also start at T-01, not continue A's sequence.
    const startB = new Date()
    startB.setHours(11, 7, 0, 0)
    const b = (await payload.create({
      collection: 'appointments',
      overrideAccess: false,
      user: f.b.receptionist,
      data: {
        patient: f.b.patient.id,
        doctor: f.b.doctor.id,
        start: startB.toISOString(),
        durationMins: 15,
        status: 'checked-in',
        isWalkIn: true,
      } as never,
    })) as { tokenNumber?: string }
    expect(a.tokenNumber).toBe('T-01')
    expect(b.tokenNumber).toBe('T-01')
  })
})
