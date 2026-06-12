// Maps server error codes to friendly UI messages (spec §9.1). Raw server text is
// never shown to the user; a cross-tenant resource's existence is never revealed.

import { ERROR_CODES } from './constants'

const MESSAGES: Record<string, string> = {
  [ERROR_CODES.SLOT_TAKEN]: 'That slot was just taken. Pick another time.',
  [ERROR_CODES.INVALID_TRANSITION]: "That status change isn't allowed.",
  [ERROR_CODES.TENANT_SUSPENDED]: "This clinic's account is suspended. Contact support.",
  [ERROR_CODES.USER_INACTIVE]: 'Your account has been deactivated. Contact your clinic owner.',
  [ERROR_CODES.FORBIDDEN]: "You don't have permission to do that.",
  [ERROR_CODES.VALIDATION]: 'Please check the form and try again.',
}

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string }

/** Extract a stable code + friendly message from a thrown Payload/API error. */
export function toActionError(err: unknown): { code: string; message: string } {
  const anyErr = err as { data?: { code?: string }; code?: string; message?: string }
  const code = anyErr?.data?.code || anyErr?.code || 'UNKNOWN'
  // Prefer a catalog message; fall back to the server message for validation,
  // otherwise a generic line.
  const message =
    MESSAGES[code] ||
    (typeof anyErr?.message === 'string' && code === 'UNKNOWN'
      ? anyErr.message
      : 'Something went wrong. Please try again.')
  return { code, message }
}

export function friendly(code: string): string {
  return MESSAGES[code] || 'Something went wrong. Please try again.'
}
