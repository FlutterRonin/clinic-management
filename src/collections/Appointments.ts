import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'
import { tenantScoped, denyAll, getTenantID } from '@/access'
import { forceTenant } from '@/hooks/tenant'
import { findConflict, computeEnd } from '@/lib/booking'
import { startOfDayInTz } from '@/lib/reports'
import { DEFAULT_TIMEZONE } from '@/lib/constants'
import {
  APPOINTMENT_STATUSES,
  STATUS_TRANSITIONS,
  ERROR_CODES,
  type AppointmentStatus,
} from '@/lib/constants'

const relID = (value: unknown): string | null => {
  if (!value) return null
  if (typeof value === 'string') return value
  if (typeof value === 'object' && 'id' in (value as Record<string, unknown>)) {
    return String((value as { id: string | number }).id)
  }
  return String(value)
}

export const Appointments: CollectionConfig = {
  slug: 'appointments',
  admin: { useAsTitle: 'reason', defaultColumns: ['start', 'patient', 'doctor', 'status'] },
  access: {
    read: tenantScoped,
    create: tenantScoped,
    update: tenantScoped,
    delete: denyAll, // history is the product — cancel, never delete
  },
  timestamps: true,
  hooks: {
    beforeValidate: [
      // Compute end, enforce status transitions, and run the double-booking guard
      // — all inside the request transaction so the read+write is atomic.
      async ({ data, req, operation, originalDoc }) => {
        if (!data) return data

        // --- end = start + durationMins ---
        const start = data.start ? new Date(data.start) : originalDoc?.start && new Date(originalDoc.start)
        const duration: number = data.durationMins ?? originalDoc?.durationMins
        if (start && duration) {
          data.end = computeEnd(start, duration).toISOString()
        }

        // --- status transition rules (spec §8.4) ---
        if (operation === 'update' && originalDoc && data.status && data.status !== originalDoc.status) {
          const from = originalDoc.status as AppointmentStatus
          const to = data.status as AppointmentStatus
          const legal = STATUS_TRANSITIONS[from] ?? []
          if (!legal.includes(to)) {
            throw new APIError(`Can't change ${from} to ${to}.`, 400, {
              code: ERROR_CODES.INVALID_TRANSITION,
            })
          }
          if (to === 'cancelled' && !data.cancellationReason && !originalDoc.cancellationReason) {
            throw new APIError('A cancellation reason is required.', 400, {
              code: ERROR_CODES.VALIDATION,
            })
          }
        }

        // --- double-booking guard ---
        // Only check when the appointment occupies a slot (scheduled/checked-in)
        // and is not a walk-in (walk-ins are allowed to overlap, spec §8.2).
        const status: AppointmentStatus = data.status ?? originalDoc?.status ?? 'scheduled'
        const occupies = status === 'scheduled' || status === 'checked-in'
        const isWalkIn = data.isWalkIn ?? originalDoc?.isWalkIn ?? false

        const doctorID = relID(data.doctor) ?? relID(originalDoc?.doctor)
        const tenantID =
          relID(data.tenant) ?? relID(originalDoc?.tenant) ?? getTenantID(req.user)
        const endDate = data.end ? new Date(data.end) : originalDoc?.end && new Date(originalDoc.end)

        if (occupies && !isWalkIn && start && endDate && doctorID && tenantID) {
          const conflict = await findConflict({
            payload: req.payload,
            req,
            tenantID,
            doctorID,
            start,
            end: endDate,
            excludeID: operation === 'update' ? String(originalDoc?.id) : undefined,
          })
          if (conflict) {
            const time = new Date(conflict.start).toISOString()
            throw new APIError(
              `That doctor already has an appointment overlapping this time (${time}). Pick another slot.`,
              409,
              { code: ERROR_CODES.SLOT_TAKEN },
            )
          }
        }

        return data
      },
    ],
    beforeChange: [
      forceTenant,
      ({ data, req, operation }) => {
        if (operation === 'create' && req.user) {
          data.createdBy = req.user.id
        }
        return data
      },
      // Walk-in token: first-come-first-serve sequence per clinic per day (T-01, T-02…).
      async ({ data, req, operation }) => {
        if (operation !== 'create' || !data.isWalkIn) return data
        const tenantID = data.tenant ? String(data.tenant) : null
        if (!tenantID) return data

        const tenant = await req.payload
          .findByID({ collection: 'tenants', id: tenantID, depth: 0, req })
          .catch(() => null)
        const tz = tenant?.settings?.timezone || DEFAULT_TIMEZONE
        const start = data.start ? new Date(data.start) : new Date()
        const dayStart = startOfDayInTz(tz, 0, start)
        const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000)

        const existing = await req.payload.count({
          collection: 'appointments',
          where: {
            tenant: { equals: tenantID },
            isWalkIn: { equals: true },
            start: { greater_than_equal: dayStart.toISOString(), less_than: dayEnd.toISOString() },
          },
          req,
        })
        data.tokenNumber = `T-${String(existing.totalDocs + 1).padStart(2, '0')}`
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
      name: 'patient',
      type: 'relationship',
      relationTo: 'patients',
      required: true,
      filterOptions: ({ user }) => {
        const tenantID = getTenantID(user as any)
        return tenantID ? { tenant: { equals: tenantID } } : true
      },
    },
    {
      name: 'doctor',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      filterOptions: ({ user }) => {
        const tenantID = getTenantID(user as any)
        const base: Record<string, unknown> = { role: { equals: 'doctor' }, active: { equals: true } }
        if (tenantID) base.tenant = { equals: tenantID }
        return base as any
      },
    },
    {
      name: 'start',
      type: 'date',
      required: true,
      admin: { date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'durationMins',
      type: 'number',
      required: true,
      min: 5,
      max: 120,
      label: 'Duration (minutes)',
    },
    {
      name: 'end',
      type: 'date',
      admin: { readOnly: true, hidden: true },
    },
    { name: 'reason', type: 'text' },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'scheduled',
      options: APPOINTMENT_STATUSES.map((s) => ({ label: s, value: s })),
    },
    { name: 'isWalkIn', type: 'checkbox', defaultValue: false, label: 'Walk-in' },
    {
      name: 'tokenNumber',
      type: 'text',
      label: 'Walk-in token',
      access: { update: () => false },
      admin: { readOnly: true, description: 'Auto-assigned per clinic per day for walk-ins.' },
    },
    {
      name: 'cancellationReason',
      type: 'text',
      admin: { condition: (data) => data?.status === 'cancelled' },
    },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
      access: { update: () => false },
      admin: { readOnly: true },
    },
  ],
  // The (tenant, doctor, start) lookup is served by the partial UNIQUE index
  // `uniq_active_slot` created in payload.config onInit (it also backstops the
  // booking race), so we don't declare a duplicate plain index here.
  indexes: [{ fields: ['tenant', 'start'] }],
}
