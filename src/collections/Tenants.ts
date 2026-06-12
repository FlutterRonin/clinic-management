import type { CollectionConfig } from 'payload'
import { superAdminOnly, tenantSelfRead, getTenantID, isSuperAdmin, superAdminField } from '@/access'
import {
  CURRENCIES,
  TIMEZONES,
  DEFAULT_CURRENCY,
  DEFAULT_TIMEZONE,
  DEFAULT_APPOINTMENT_DURATION,
  DEFAULT_OPEN_TIME,
  DEFAULT_CLOSE_TIME,
} from '@/lib/constants'

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export const Tenants: CollectionConfig = {
  slug: 'tenants',
  labels: { singular: 'Clinic', plural: 'Clinics' },
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'city', 'status'] },
  access: {
    read: tenantSelfRead,
    create: superAdminOnly,
    // Owners may edit their own clinic's profile & settings. Sensitive fields
    // (status, slug) stay superAdmin-only via field-level access below.
    update: ({ req: { user } }) => {
      if (!user) return false
      if (isSuperAdmin(user)) return true
      if (user.role !== 'owner') return false
      const tenantID = getTenantID(user)
      if (!tenantID) return false
      return { id: { equals: tenantID } }
    },
    delete: superAdminOnly,
  },
  timestamps: true,
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      label: 'Clinic name',
    },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      index: true,
      access: { update: superAdminField },
      admin: { description: 'Auto-generated from the name; used for public URLs later.' },
      hooks: {
        beforeValidate: [
          ({ value, data }) => value || (data?.name ? slugify(data.name) : value),
        ],
      },
    },
    {
      name: 'phone',
      type: 'text',
      required: true,
      validate: (value: string | null | undefined) => {
        if (!value) return 'Phone is required.'
        // Generic, market-agnostic validation: digits and +, 7–15 chars.
        return /^\+?[0-9]{7,15}$/.test(value.replace(/[\s-]/g, ''))
          ? true
          : 'Enter a valid phone number (7–15 digits).'
      },
    },
    { name: 'address', type: 'textarea' },
    { name: 'city', type: 'text' },
    { name: 'country', type: 'text', defaultValue: 'Pakistan' },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      access: { update: superAdminField }, // owners can never suspend/unsuspend themselves
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Suspended', value: 'suspended' },
      ],
    },
    {
      name: 'settings',
      type: 'group',
      label: 'Settings',
      fields: [
        {
          name: 'appointmentDurationMins',
          type: 'number',
          required: true,
          defaultValue: DEFAULT_APPOINTMENT_DURATION,
          label: 'Default slot length (minutes)',
          min: 5,
          max: 120,
        },
        {
          name: 'openTime',
          type: 'text',
          required: true,
          defaultValue: DEFAULT_OPEN_TIME,
          label: 'Opening time (HH:mm)',
        },
        {
          name: 'closeTime',
          type: 'text',
          required: true,
          defaultValue: DEFAULT_CLOSE_TIME,
          label: 'Closing time (HH:mm)',
        },
        {
          name: 'currency',
          type: 'select',
          required: true,
          defaultValue: DEFAULT_CURRENCY,
          options: CURRENCIES.map((c) => ({ label: c.label, value: c.value })),
          admin: { description: 'Market-agnostic core — all amounts are formatted from this.' },
        },
        {
          name: 'timezone',
          type: 'select',
          required: true,
          defaultValue: DEFAULT_TIMEZONE,
          options: TIMEZONES.map((t) => ({ label: t.label, value: t.value })),
          admin: { description: 'All times are displayed in this timezone.' },
        },
      ],
    },
  ],
}
