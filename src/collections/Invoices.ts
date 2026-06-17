import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'
import { tenantScoped, denyAll, getTenantID, isSuperAdmin, superAdminOrOwnerField } from '@/access'
import { forceTenant } from '@/hooks/tenant'
import {
  ERROR_CODES,
  PAYMENT_METHODS,
  INVOICE_STATUSES,
  DEFAULT_CURRENCY,
  type InvoiceStatus,
} from '@/lib/constants'

const relID = (value: unknown): string | null => {
  if (!value) return null
  if (typeof value === 'string') return value
  if (typeof value === 'object' && 'id' in (value as Record<string, unknown>)) {
    return String((value as { id: string | number }).id)
  }
  return String(value)
}

/** Round to 2 dp to keep money math free of float dust. */
const money = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100

type LineItem = { description?: string; quantity?: number; unitAmount?: number; amount?: number }
type Payment = { amount?: number; method?: string; receivedAt?: string; receivedBy?: unknown }

/** Stable signature of the billable line items, for the post-payment lock check. */
const lineSignature = (items: LineItem[] | undefined): string =>
  JSON.stringify((items ?? []).map((l) => [l.description ?? '', Number(l.quantity ?? 0), Number(l.unitAmount ?? 0)]))

/**
 * Invoices — billing for a visit (v2 spec §2.2). Totals, paid, balance and status
 * are ALWAYS derived in the hook (client values are ignored), mirroring the
 * Distribution Tracker Invoices pattern. Currency is snapshotted at create time so
 * a later clinic-currency change never rewrites historical amounts.
 */
export const Invoices: CollectionConfig = {
  slug: 'invoices',
  admin: {
    useAsTitle: 'invoiceNumber',
    defaultColumns: ['invoiceNumber', 'patient', 'totalAmount', 'paymentStatus'],
  },
  access: {
    read: tenantScoped,
    create: tenantScoped, // reception bills — that's their job
    update: tenantScoped, // payments by anyone; voiding is owner-only (field-level)
    delete: denyAll,
  },
  timestamps: true,
  hooks: {
    beforeChange: [
      forceTenant,
      async ({ data, req, operation, originalDoc }) => {
        if (!data) return data

        // --- void guard: a voided invoice is frozen (superAdmin may still correct) ---
        if (operation === 'update' && originalDoc?.voided === true && !isSuperAdmin(req.user)) {
          throw new APIError("This invoice has been voided and can't be changed.", 403, {
            code: ERROR_CODES.INVOICE_VOIDED,
          })
        }
        if (data.voided === true && !data.voidReason && !originalDoc?.voidReason) {
          throw new APIError('A reason is required to void an invoice.', 400, {
            code: ERROR_CODES.VALIDATION,
          })
        }

        // --- create-time stamps: number, currency snapshot, creator, patient ---
        if (operation === 'create') {
          const tenantID = data.tenant ? String(data.tenant) : getTenantID(req.user)
          if (!tenantID) {
            throw new APIError('Cannot create an invoice without a clinic.', 400, {
              code: ERROR_CODES.VALIDATION,
            })
          }
          const tenant = await req.payload
            .findByID({ collection: 'tenants', id: tenantID, depth: 0, req, overrideAccess: true })
            .catch(() => null)
          data.currency = tenant?.settings?.currency || DEFAULT_CURRENCY

          const existing = await req.payload.count({
            collection: 'invoices',
            where: { tenant: { equals: tenantID } },
            req,
            overrideAccess: true,
          })
          data.invoiceNumber = `INV-${String(existing.totalDocs + 1).padStart(4, '0')}`

          if (req.user) data.createdBy = req.user.id

          // Pull the patient from the linked visit when not supplied directly.
          if (!data.patient && data.visit) {
            const visit = await req.payload
              .findByID({ collection: 'visits', id: relID(data.visit)!, depth: 0, req, overrideAccess: true })
              .catch(() => null)
            if (visit) data.patient = relID(visit.patient)
          }
        }

        // --- line items: lock after a payment, then (re)compute amounts + total ---
        if (operation === 'update' && data.lineItems !== undefined) {
          const hadPayments = ((originalDoc?.payments as Payment[] | undefined)?.length ?? 0) > 0
          if (hadPayments && lineSignature(data.lineItems as LineItem[]) !== lineSignature(originalDoc?.lineItems as LineItem[])) {
            throw new APIError(
              "Line items can't be changed after a payment. Void the invoice and create a new one.",
              403,
              { code: ERROR_CODES.INVOICE_LOCKED },
            )
          }
        }

        const lines = (data.lineItems ?? originalDoc?.lineItems ?? []) as LineItem[]
        let total = 0
        for (const li of lines) {
          const qty = Number(li.quantity ?? 1)
          const unit = Number(li.unitAmount ?? 0)
          li.amount = money(qty * unit)
          total += li.amount
        }
        data.lineItems = lines
        data.totalAmount = money(total)

        // --- payments: default receivedAt/receivedBy, then sum ---
        const pays = (data.payments ?? originalDoc?.payments ?? []) as Payment[]
        let paid = 0
        for (const p of pays) {
          if (!p.receivedAt) p.receivedAt = new Date().toISOString()
          if (!p.receivedBy && req.user) p.receivedBy = req.user.id
          paid += Number(p.amount ?? 0)
        }
        data.payments = pays
        data.amountPaid = money(paid)
        data.balanceDue = money(data.totalAmount - data.amountPaid)

        // --- overpayment guard ---
        if (data.amountPaid > data.totalAmount + 1e-9) {
          throw new APIError(
            `Payment exceeds the remaining balance (${data.totalAmount}).`,
            400,
            { code: ERROR_CODES.PAYMENT_EXCEEDS_BALANCE },
          )
        }

        // --- derived status (never client-set) ---
        let status: InvoiceStatus = 'unpaid'
        if (data.amountPaid > 0) status = data.balanceDue <= 0 ? 'paid' : 'partial'
        data.paymentStatus = status

        return data
      },
    ],
  },
  fields: [
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      index: true,
      access: { update: () => false },
    },
    {
      name: 'invoiceNumber',
      type: 'text',
      label: 'Invoice number',
      access: { update: () => false },
      admin: { readOnly: true, description: 'Auto-assigned per clinic (INV-0001).' },
    },
    {
      name: 'visit',
      type: 'relationship',
      relationTo: 'visits',
      access: { update: () => false },
      filterOptions: ({ user }) => {
        const tenantID = getTenantID(user as never)
        return tenantID ? ({ tenant: { equals: tenantID } } as never) : true
      },
    },
    { name: 'patient', type: 'relationship', relationTo: 'patients', required: true },
    {
      name: 'currency',
      type: 'text',
      access: { update: () => false },
      admin: { readOnly: true, description: 'Snapshotted from the clinic at create time.' },
    },
    {
      name: 'lineItems',
      type: 'array',
      minRows: 1,
      required: true,
      labels: { singular: 'Line item', plural: 'Line items' },
      fields: [
        { name: 'description', type: 'text', required: true },
        { name: 'quantity', type: 'number', required: true, defaultValue: 1, min: 1 },
        { name: 'unitAmount', type: 'number', required: true, min: 0, label: 'Unit amount' },
        {
          name: 'amount',
          type: 'number',
          access: { update: () => false },
          admin: { readOnly: true, description: 'quantity × unit amount.' },
        },
      ],
    },
    {
      name: 'totalAmount',
      type: 'number',
      access: { update: () => false },
      admin: { readOnly: true },
    },
    {
      name: 'payments',
      type: 'array',
      labels: { singular: 'Payment', plural: 'Payments' },
      fields: [
        {
          name: 'amount',
          type: 'number',
          required: true,
          min: 0,
          validate: (value: number | null | undefined) =>
            value != null && value > 0 ? true : 'A payment must be greater than zero.',
        },
        {
          name: 'method',
          type: 'select',
          required: true,
          defaultValue: 'cash',
          options: PAYMENT_METHODS.map((m) => ({ label: m.label, value: m.value })),
        },
        { name: 'receivedAt', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
        {
          name: 'receivedBy',
          type: 'relationship',
          relationTo: 'users',
          access: { update: () => false },
          admin: { readOnly: true },
        },
      ],
    },
    {
      name: 'amountPaid',
      type: 'number',
      access: { update: () => false },
      admin: { readOnly: true },
    },
    {
      name: 'balanceDue',
      type: 'number',
      access: { update: () => false },
      admin: { readOnly: true },
    },
    {
      name: 'paymentStatus',
      type: 'select',
      options: INVOICE_STATUSES.map((s) => ({ label: s, value: s })),
      access: { update: () => false },
      admin: { readOnly: true },
    },
    {
      name: 'voided',
      type: 'checkbox',
      defaultValue: false,
      access: { update: superAdminOrOwnerField }, // only owner/superAdmin may void
    },
    {
      name: 'voidReason',
      type: 'text',
      admin: { condition: (data) => data?.voided === true },
    },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
      access: { update: () => false },
      admin: { readOnly: true },
    },
  ],
  indexes: [
    { fields: ['tenant', 'paymentStatus'] },
    { fields: ['tenant', 'createdAt'] },
  ],
}
