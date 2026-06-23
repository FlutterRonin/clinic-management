// Audit trail writer (v3 spec §2.2). The audit log is append-only and written ONLY
// from server-side hooks via this helper — never from the REST API (collection access
// denies create/update/delete for everyone, superAdmin included).
//
// Deliberate trade-off: the audit write runs OUTSIDE the triggering operation's
// transaction (no `req` is threaded through) and is wrapped in try/catch. So if the
// audit insert fails, the business operation still succeeds — availability beats audit
// completeness at this scale (documented; spec §2.2, test 6). The flip side (a rolled-
// back op could leave an orphan audit row) is acceptable and rare.

import type { PayloadRequest } from 'payload'
import { getTenantID } from '@/access'
import type { AuditAction } from '@/lib/constants'

export type AuditEntry = {
  action: AuditAction
  targetCollection: string
  targetId: string
  summary: string
  meta?: Record<string, unknown>
  /** Override the tenant (e.g. tenant.suspended — the actor is a super admin with no tenant). */
  tenantID?: string | null
  /** Override the actor (defaults to req.user). */
  userID?: string | null
}

export async function logAudit(req: PayloadRequest, entry: AuditEntry): Promise<void> {
  try {
    const tenantID = entry.tenantID ?? getTenantID(req.user as never)
    const userID = entry.userID ?? (req.user?.id != null ? String(req.user.id) : null)
    // No attributable actor or clinic (seed / system / signup) ⇒ nothing to record.
    if (!tenantID || !userID) return

    await req.payload.create({
      collection: 'auditLogs',
      overrideAccess: true, // create is denied to everyone; this is the only writer
      data: {
        tenant: tenantID,
        user: userID,
        action: entry.action,
        targetCollection: entry.targetCollection,
        targetId: entry.targetId,
        summary: entry.summary,
        meta: entry.meta ?? undefined,
      } as never,
    })
  } catch (err) {
    // Never let an audit failure surface to the user or fail the operation.
    req.payload.logger?.error?.({ err, action: entry.action }, 'logAudit failed (non-fatal)')
  }
}
