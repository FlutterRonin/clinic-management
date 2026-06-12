import { describe, it, expect } from 'vitest'
import { overlaps, computeEnd } from '@/lib/booking'

// Pure overlap logic — the heart of the double-booking guard (spec §8.3).
// No database required, so this always runs.

const at = (h: number, m: number) => new Date(Date.UTC(2026, 5, 10, h, m))
const slot = (h: number, m: number, dur: number): [Date, Date] => {
  const s = at(h, m)
  return [s, computeEnd(s, dur)]
}

describe('overlap rule', () => {
  it('detects exact overlap', () => {
    const [as, ae] = slot(10, 0, 15)
    const [bs, be] = slot(10, 0, 15)
    expect(overlaps(as, ae, bs, be)).toBe(true)
  })

  it('detects partial overlap at the front', () => {
    const [as, ae] = slot(10, 0, 30) // 10:00–10:30
    const [bs, be] = slot(10, 15, 30) // 10:15–10:45
    expect(overlaps(as, ae, bs, be)).toBe(true)
  })

  it('detects partial overlap at the back', () => {
    const [as, ae] = slot(10, 15, 30) // 10:15–10:45
    const [bs, be] = slot(10, 0, 30) // 10:00–10:30
    expect(overlaps(as, ae, bs, be)).toBe(true)
  })

  it('detects containment', () => {
    const [as, ae] = slot(10, 0, 60) // 10:00–11:00
    const [bs, be] = slot(10, 20, 10) // 10:20–10:30
    expect(overlaps(as, ae, bs, be)).toBe(true)
  })

  it('treats touching edges as NO conflict', () => {
    const [as, ae] = slot(10, 0, 15) // 10:00–10:15
    const [bs, be] = slot(10, 15, 15) // 10:15–10:30
    expect(overlaps(as, ae, bs, be)).toBe(false)
  })

  it('treats fully separate slots as NO conflict', () => {
    const [as, ae] = slot(10, 0, 15)
    const [bs, be] = slot(11, 0, 15)
    expect(overlaps(as, ae, bs, be)).toBe(false)
  })

  it('computeEnd adds the duration in minutes', () => {
    expect(computeEnd(at(10, 0), 45).toISOString()).toBe(at(10, 45).toISOString())
  })
})
