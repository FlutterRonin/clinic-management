import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import type { Payload } from 'payload'
import { getTestPayload, seedFixture, type Fixture } from './fixtures'
import { requestPasswordReset, confirmPasswordReset } from '@/lib/passwordReset'
import { ERROR_CODES } from '@/lib/constants'
import type { SendEmailInput } from '@/lib/email'

// Backlog §1.3 — self-serve password reset. The lib is exercised directly with a
// captured sender (same injectable pattern as the digest suite); the server
// actions only add rate-limiting + form plumbing on top.

describe('backlog — password reset', () => {
  let payload: Payload
  let fixture: Fixture

  const sent: SendEmailInput[] = []
  const capture = async (input: SendEmailInput) => {
    sent.push(input)
    return { ok: true }
  }

  beforeAll(async () => {
    payload = await getTestPayload()
    fixture = await seedFixture(payload)
  })
  beforeEach(() => {
    sent.length = 0
  })

  /** Pull the token back out of the emailed link. */
  const tokenFromEmail = (): string => {
    const html = sent[0]?.html ?? ''
    const match = html.match(/reset-password\?token=([A-Za-z0-9%._-]+)/)
    expect(match, 'expected a reset link in the email').toBeTruthy()
    return decodeURIComponent(match![1]!)
  }

  async function rejectsWithCode(promise: Promise<unknown>, code: string) {
    let thrown: { data?: { code?: string }; code?: string } | undefined
    try {
      await promise
    } catch (e) {
      thrown = e as typeof thrown
    }
    expect(thrown, 'expected the operation to reject').toBeTruthy()
    expect(thrown?.data?.code ?? thrown?.code).toBe(code)
  }

  it('emails a working one-time reset link', async () => {
    const email = fixture.a.receptionist.email
    const summary = await requestPasswordReset(payload, email, capture)
    expect(summary.sent).toBe(true)
    expect(sent).toHaveLength(1)
    expect(sent[0]!.to).toBe(email)

    const token = tokenFromEmail()
    await confirmPasswordReset(payload, token, 'brand-new-pass-1')

    // Old password is dead, the new one signs in.
    await expect(
      payload.login({ collection: 'users', data: { email, password: 'password123' } }),
    ).rejects.toThrow()
    const ok = await payload.login({
      collection: 'users',
      data: { email, password: 'brand-new-pass-1' },
    })
    expect(ok.token).toBeTruthy()

    // Single-use: the same token cannot reset again.
    await rejectsWithCode(
      confirmPasswordReset(payload, token, 'another-pass-123'),
      ERROR_CODES.RESET_TOKEN_INVALID,
    )
  })

  it('stays quiet for an unknown email — no send, no throw', async () => {
    const summary = await requestPasswordReset(payload, 'nobody@nowhere.test', capture)
    expect(summary.sent).toBe(false)
    expect(sent).toHaveLength(0)
  })

  it('rejects a garbage token with RESET_TOKEN_INVALID', async () => {
    await rejectsWithCode(
      confirmPasswordReset(payload, 'not-a-real-token', 'whatever-pass-1'),
      ERROR_CODES.RESET_TOKEN_INVALID,
    )
  })

  it('rejects a short new password with VALIDATION before touching the token', async () => {
    await requestPasswordReset(payload, fixture.b.owner.email, capture)
    const token = tokenFromEmail()

    await rejectsWithCode(confirmPasswordReset(payload, token, 'short'), ERROR_CODES.VALIDATION)

    // The token survived the failed attempt and still works.
    await confirmPasswordReset(payload, token, 'long-enough-pass-1')
    const ok = await payload.login({
      collection: 'users',
      data: { email: fixture.b.owner.email, password: 'long-enough-pass-1' },
    })
    expect(ok.token).toBeTruthy()
  })
})
