import type { CollectionConfig } from 'payload'
import { auditReadAccess, denyAll, isSuperAdmin } from '@/access'
import { AUDIT_ACTIONS } from '@/lib/constants'

/**
 * Audit log (v3 spec §2.2) — an append-only record of sensitive actions.
 *
 * Immutability IS the feature: create/update/delete are denied to EVERY role,
 * super admin included. The only writer is the `logAudit` helper, which uses
 * overrideAccess from inside server-side hooks. Read is owner + super admin only.
 */
export const AuditLogs: CollectionConfig = {
  slug: 'auditLogs',
  labels: { singular: 'Audit log', plural: 'Audit logs' },
  admin: {
    useAsTitle: 'summary',
    defaultColumns: ['createdAt', 'action', 'summary', 'tenant'],
    // Only super admins reach the Payload admin panel at all.
    hidden: ({ user }) => !isSuperAdmin(user as never),
  },
  access: {
    read: auditReadAccess,
    create: denyAll, // written only via logAudit (overrideAccess); never over REST
    update: denyAll, // append-only — entries are never edited
    delete: denyAll, // …or deleted (retention purge is a backlog item)
  },
  timestamps: true,
  fields: [
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true, index: true },
    { name: 'user', type: 'relationship', relationTo: 'users', required: true },
    {
      name: 'action',
      type: 'select',
      required: true,
      options: AUDIT_ACTIONS.map((a) => ({ label: a.label, value: a.value })),
    },
    { name: 'targetCollection', type: 'text', required: true },
    { name: 'targetId', type: 'text', required: true },
    {
      name: 'summary',
      type: 'text',
      required: true,
      admin: { description: 'Human-readable, e.g. "Cancelled Bilal Ahmed\'s 5:30 pm appointment".' },
    },
    {
      name: 'meta',
      type: 'json',
      admin: { description: 'Small structured context (old/new role, amount…). Never a full doc snapshot.' },
    },
  ],
  indexes: [{ fields: ['tenant', 'createdAt'] }],
}
