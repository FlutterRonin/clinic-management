// Generic, reusable tenant hooks shared by every business collection.
//
// "Set it, don't trust it": on create, a non-superAdmin's `tenant` is force-set
// from req.user — whatever the client sent is overwritten. On update, `tenant`
// is immutable for non-superAdmins (records never move between clinics).

import type { CollectionBeforeChangeHook } from 'payload'
import { APIError } from 'payload'
import { getTenantID, isSuperAdmin } from '@/access'

export const forceTenant: CollectionBeforeChangeHook = ({ data, req, operation, originalDoc }) => {
  const user = req.user
  if (!user) return data

  if (isSuperAdmin(user)) {
    // SuperAdmin may set tenant explicitly; nothing forced.
    return data
  }

  const tenantID = getTenantID(user)
  if (!tenantID) {
    throw new APIError('You are not attached to a clinic.', 403)
  }

  if (operation === 'create') {
    data.tenant = tenantID
  }

  if (operation === 'update') {
    const currentTenant = originalDoc ? getTenantID(originalDoc as any) : null
    // Ignore client-sent tenant on update; keep the original.
    if (data.tenant !== undefined && String(data.tenant) !== String(currentTenant)) {
      throw new APIError('A record cannot be moved between clinics.', 403)
    }
    data.tenant = currentTenant
  }

  return data
}
