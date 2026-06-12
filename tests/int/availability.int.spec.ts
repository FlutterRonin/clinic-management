import { describe, it, expect } from 'vitest'
import { checkAvailability, weekdayInTz } from '@/lib/availability'

// Per-doctor availability logic (no DB).
const tz = 'UTC'
const start = new Date(Date.UTC(2026, 5, 15, 12, 0)) // noon
const end = new Date(Date.UTC(2026, 5, 15, 12, 15))
const today = weekdayInTz(start, tz)
const otherDay = today === 'mon' ? 'tue' : 'mon'

describe('doctor availability', () => {
  it('regular doctor is bookable inside window on an available day', () => {
    const r = checkAvailability(
      { availabilityType: 'regular', availableDays: [today], availableFrom: '09:00', availableTo: '17:00' },
      start,
      end,
      tz,
    )
    expect(r.bookable).toBe(true)
    expect(r.inFinder).toBe(true)
  })

  it('regular doctor is NOT bookable outside the window', () => {
    const r = checkAvailability(
      { availabilityType: 'regular', availableDays: [today], availableFrom: '14:00', availableTo: '16:00' },
      start,
      end,
      tz,
    )
    expect(r.bookable).toBe(false)
  })

  it('regular doctor is NOT bookable on an unavailable day', () => {
    const r = checkAvailability(
      { availabilityType: 'regular', availableDays: [otherDay], availableFrom: '09:00', availableTo: '17:00' },
      start,
      end,
      tz,
    )
    expect(r.bookable).toBe(false)
  })

  it('on-call doctor is bookable any time and appears in the finder', () => {
    const r = checkAvailability({ availabilityType: 'onCall' }, start, end, tz)
    expect(r.bookable).toBe(true)
    expect(r.inFinder).toBe(true)
    expect(r.tag).toBe('onCall')
  })

  it('by-appointment doctor is bookable but hidden from the finder', () => {
    const r = checkAvailability({ availabilityType: 'byAppointment' }, start, end, tz)
    expect(r.bookable).toBe(true)
    expect(r.inFinder).toBe(false)
    expect(r.tag).toBe('byAppointment')
  })
})
