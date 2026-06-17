import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'
import { tenantScoped, denyAll, visitsWriteAccess, getTenantID } from '@/access'
import { forceTenant } from '@/hooks/tenant'
import {
  ERROR_CODES,
  PRESCRIPTION_FREQUENCIES,
  VISIT_ALLOWED_APPOINTMENT_STATUSES,
  type AppointmentStatus,
} from '@/lib/constants'

/** Normalise a relationship value (id | populated doc) to its id string. */
const relID = (value: unknown): string | null => {
  if (!value) return null
  if (typeof value === 'string') return value
  if (typeof value === 'object' && 'id' in (value as Record<string, unknown>)) {
    return String((value as { id: string | number }).id)
  }
  return String(value)
}

/**
 * Visits — a completed consultation (v2 spec §2.1). One appointment = max one visit.
 * The clinical record: symptoms, diagnosis, vitals, prescription rows and follow-up.
 * `patient`/`doctor` are denormalised from the appointment (it never moves/deletes,
 * so there's no drift risk and patient-timeline queries stay simple).
 */
export const Visits: CollectionConfig = {
  slug: 'visits',
  admin: { useAsTitle: 'diagnosis', defaultColumns: ['visitDate', 'patient', 'doctor', 'diagnosis'] },
  access: {
    read: tenantScoped,
    create: visitsWriteAccess,
    update: visitsWriteAccess,
    delete: denyAll, // clinical history is the product — never hard-delete
  },
  timestamps: true,
  hooks: {
    beforeValidate: [
      async ({ data, req, operation }) => {
        if (!data) return data
        if (operation !== 'create') return data

        const appointmentID = relID(data.appointment)
        if (!appointmentID) {
          throw new APIError('A visit must be linked to an appointment.', 400, {
            code: ERROR_CODES.VALIDATION,
          })
        }

        const appt = await req.payload
          .findByID({ collection: 'appointments', id: appointmentID, depth: 0, req, overrideAccess: true })
          .catch(() => null)
        if (!appt) {
          throw new APIError('The appointment could not be found.', 400, {
            code: ERROR_CODES.VALIDATION,
          })
        }

        // Same-tenant guard — a visit can never attach to another clinic's appointment.
        const intendedTenant = relID(data.tenant) ?? getTenantID(req.user)
        if (intendedTenant && String(relID(appt.tenant)) !== String(intendedTenant)) {
          throw new APIError('That appointment belongs to another clinic.', 403, {
            code: ERROR_CODES.FORBIDDEN,
          })
        }

        // The patient must be checked in (or already completed) before a visit.
        if (!VISIT_ALLOWED_APPOINTMENT_STATUSES.includes(appt.status as AppointmentStatus)) {
          throw new APIError('Check the patient in before recording a visit.', 400, {
            code: ERROR_CODES.INVALID_APPOINTMENT_STATE,
          })
        }

        // One visit per appointment (friendly guard; a unique index backstops it).
        const existing = await req.payload.count({
          collection: 'visits',
          where: { appointment: { equals: appointmentID } },
          req,
          overrideAccess: true,
        })
        if (existing.totalDocs > 0) {
          throw new APIError('A visit has already been recorded for this appointment.', 409, {
            code: ERROR_CODES.VISIT_EXISTS,
          })
        }

        // Denormalise from the appointment; default the visit date to now.
        data.patient = relID(appt.patient)
        data.doctor = relID(appt.doctor)
        if (!data.visitDate) data.visitDate = new Date().toISOString()

        return data
      },
    ],
    beforeChange: [
      forceTenant,
      ({ data, req, operation }) => {
        if (operation === 'create' && req.user) data.createdBy = req.user.id
        return data
      },
    ],
    afterChange: [
      // Closing the consult in one action: a checked-in appointment becomes completed
      // the moment its visit is recorded (saves the front desk a manual step).
      async ({ doc, req, operation }) => {
        if (operation !== 'create') return
        const appointmentID = relID(doc.appointment)
        if (!appointmentID) return
        const appt = await req.payload
          .findByID({ collection: 'appointments', id: appointmentID, depth: 0, req, overrideAccess: true })
          .catch(() => null)
        if (appt?.status === 'checked-in') {
          await req.payload
            .update({
              collection: 'appointments',
              id: appointmentID,
              data: { status: 'completed' },
              req,
              overrideAccess: true,
            })
            .catch(() => {})
        }
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
      name: 'appointment',
      type: 'relationship',
      relationTo: 'appointments',
      required: true,
      access: { update: () => false }, // immutable link
      filterOptions: ({ user }) => {
        const tenantID = getTenantID(user as never)
        const base: Record<string, unknown> = { status: { in: VISIT_ALLOWED_APPOINTMENT_STATUSES } }
        if (tenantID) base.tenant = { equals: tenantID }
        return base as never
      },
    },
    // Auto-copied from the appointment in beforeValidate; immutable afterwards.
    { name: 'patient', type: 'relationship', relationTo: 'patients', required: true, access: { update: () => false } },
    { name: 'doctor', type: 'relationship', relationTo: 'users', required: true, access: { update: () => false } },
    {
      name: 'visitDate',
      type: 'date',
      required: true,
      admin: { date: { pickerAppearance: 'dayAndTime' } },
    },
    { name: 'symptoms', type: 'textarea' },
    { name: 'diagnosis', type: 'text' },
    { name: 'notes', type: 'textarea', admin: { description: 'Visible to all clinic staff.' } },
    {
      name: 'vitals',
      type: 'group',
      fields: [
        { name: 'bpSystolic', type: 'number', min: 40, max: 300, label: 'BP systolic' },
        { name: 'bpDiastolic', type: 'number', min: 40, max: 300, label: 'BP diastolic' },
        { name: 'temperatureC', type: 'number', min: 30, max: 45, label: 'Temperature (°C)' },
        { name: 'weightKg', type: 'number', min: 0.5, max: 500, label: 'Weight (kg)' },
        { name: 'pulse', type: 'number', min: 20, max: 250, label: 'Pulse (bpm)' },
      ],
    },
    {
      name: 'prescription',
      type: 'array',
      labels: { singular: 'Medicine', plural: 'Medicines' },
      fields: [
        { name: 'medicine', type: 'text', required: true },
        { name: 'dosage', type: 'text', admin: { placeholder: 'e.g. 500mg', width: '33%' } },
        {
          name: 'frequency',
          type: 'select',
          options: PRESCRIPTION_FREQUENCIES.map((f) => ({ label: f.label, value: f.value })),
        },
        {
          name: 'frequencyNote',
          type: 'text',
          admin: { condition: (_data, sibling) => sibling?.frequency === 'other' },
        },
        { name: 'durationDays', type: 'number', min: 0, label: 'Duration (days)' },
        { name: 'instructions', type: 'text', admin: { placeholder: 'e.g. after meals' } },
      ],
    },
    { name: 'followUpDate', type: 'date', admin: { date: { pickerAppearance: 'dayOnly' } } },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
      access: { update: () => false },
      admin: { readOnly: true },
    },
  ],
  indexes: [
    { fields: ['tenant', 'patient', 'visitDate'] },
    { fields: ['tenant', 'appointment'], unique: true },
  ],
}
