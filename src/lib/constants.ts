// Shared, market-agnostic option lists. Currency and timezone are tenant-level
// settings with Pakistan defaults — nothing region-specific is hardcoded.

export const ROLES = ['superAdmin', 'owner', 'doctor', 'receptionist'] as const
export type Role = (typeof ROLES)[number]

export const TENANT_ROLES = ['owner', 'doctor', 'receptionist'] as const

export const APPOINTMENT_STATUSES = [
  'scheduled',
  'checked-in',
  'completed',
  'cancelled',
  'no-show',
] as const
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number]

// Legal status transitions (spec §8.4). Terminal states have no outgoing edges.
export const STATUS_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  scheduled: ['checked-in', 'cancelled', 'no-show'],
  'checked-in': ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  'no-show': [],
}

// Statuses that occupy a doctor's slot for conflict detection.
export const ACTIVE_STATUSES: AppointmentStatus[] = ['scheduled', 'checked-in']

export const GENDERS = ['male', 'female', 'other'] as const

// Doctor availability patterns (covers daily / alternate / weekly / on-call / surgeon).
export const AVAILABILITY_TYPES = [
  { label: 'Regular (set days & hours)', value: 'regular' },
  { label: 'On call', value: 'onCall' },
  { label: 'By appointment (e.g. surgeon)', value: 'byAppointment' },
] as const
export type AvailabilityType = (typeof AVAILABILITY_TYPES)[number]['value']

export const WEEKDAYS = [
  { label: 'Sun', value: 'sun' },
  { label: 'Mon', value: 'mon' },
  { label: 'Tue', value: 'tue' },
  { label: 'Wed', value: 'wed' },
  { label: 'Thu', value: 'thu' },
  { label: 'Fri', value: 'fri' },
  { label: 'Sat', value: 'sat' },
] as const
export const ALL_DAYS = WEEKDAYS.map((d) => d.value)

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const

// Curated currency list (a full ISO list is overkill). `code` feeds Intl.NumberFormat.
export const CURRENCIES = [
  { label: 'PKR — Pakistani Rupee', value: 'PKR' },
  { label: 'USD — US Dollar', value: 'USD' },
  { label: 'GBP — British Pound', value: 'GBP' },
  { label: 'AED — UAE Dirham', value: 'AED' },
  { label: 'SAR — Saudi Riyal', value: 'SAR' },
  { label: 'INR — Indian Rupee', value: 'INR' },
] as const

// Curated IANA timezone list (a full dropdown is overkill for the launch markets).
export const TIMEZONES = [
  { label: 'Asia/Karachi (PKT)', value: 'Asia/Karachi' },
  { label: 'Asia/Dubai (GST)', value: 'Asia/Dubai' },
  { label: 'Asia/Riyadh (AST)', value: 'Asia/Riyadh' },
  { label: 'Asia/Kolkata (IST)', value: 'Asia/Kolkata' },
  { label: 'Europe/London (GMT/BST)', value: 'Europe/London' },
  { label: 'America/New_York (ET)', value: 'America/New_York' },
] as const

export const DEFAULT_CURRENCY = 'PKR'
export const DEFAULT_TIMEZONE = 'Asia/Karachi'
export const DEFAULT_APPOINTMENT_DURATION = 15
export const DEFAULT_OPEN_TIME = '09:00'
export const DEFAULT_CLOSE_TIME = '21:00'

// Stable error codes — UI maps these to friendly messages (spec §9.1).
export const ERROR_CODES = {
  SLOT_TAKEN: 'SLOT_TAKEN',
  INVALID_TRANSITION: 'INVALID_TRANSITION',
  TENANT_SUSPENDED: 'TENANT_SUSPENDED',
  USER_INACTIVE: 'USER_INACTIVE',
  PLAN_LIMIT: 'PLAN_LIMIT',
  FORBIDDEN: 'FORBIDDEN',
  VALIDATION: 'VALIDATION',
} as const
