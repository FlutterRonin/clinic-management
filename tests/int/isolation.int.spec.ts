import { describe, it, expect, beforeAll } from 'vitest'
import type { Payload } from 'payload'
import { getTestPayload, seedFixture, type Fixture } from './fixtures'

// Tenant isolation suite (spec §11-A). The single most important guarantee in
// the product: a clinic can never see or touch another clinic's data.

describe('tenant isolation', () => {
  let payload: Payload
  let f: Fixture

  beforeAll(async () => {
    payload = await getTestPayload()
    f = await seedFixture(payload)
  })

  it('a user only finds patients in their own tenant', async () => {
    const res = await payload.find({
      collection: 'patients',
      overrideAccess: false,
      user: f.a.receptionist,
    })
    expect(res.docs.length).toBeGreaterThan(0)
    expect(res.docs.every((p) => String((p.tenant as any)?.id ?? p.tenant) === String(f.a.tenant.id))).toBe(true)
  })

  it("cannot findByID another tenant's patient", async () => {
    await expect(
      payload.findByID({
        collection: 'patients',
        id: f.b.patient.id,
        overrideAccess: false,
        user: f.a.receptionist,
      }),
    ).rejects.toThrow()
  })

  it('force-sets tenant to the actor when a foreign tenant is supplied', async () => {
    const appt = await payload.create({
      collection: 'appointments',
      overrideAccess: false,
      user: f.a.receptionist,
      data: {
        tenant: f.b.tenant.id as any, // attempt to plant into clinic B
        patient: f.a.patient.id,
        doctor: f.a.doctor.id,
        start: new Date(Date.UTC(2026, 5, 12, 5, 0)).toISOString(),
        durationMins: 15,
        status: 'scheduled',
      },
    })
    expect(String((appt.tenant as any)?.id ?? appt.tenant)).toBe(String(f.a.tenant.id))
  })

  it("cannot update another tenant's appointment", async () => {
    const apptB = await payload.create({
      collection: 'appointments',
      overrideAccess: true,
      data: {
        tenant: f.b.tenant.id,
        patient: f.b.patient.id,
        doctor: f.b.doctor.id,
        start: new Date(Date.UTC(2026, 5, 12, 6, 0)).toISOString(),
        durationMins: 15,
        status: 'scheduled',
      },
    })
    await expect(
      payload.update({
        collection: 'appointments',
        id: apptB.id,
        overrideAccess: false,
        user: f.a.receptionist,
        data: { reason: 'hijack attempt' },
      }),
    ).rejects.toThrow()
  })

  it('an owner cannot create a super admin', async () => {
    await expect(
      payload.create({
        collection: 'users',
        overrideAccess: false,
        user: f.a.owner,
        data: {
          name: 'Sneaky',
          email: 'sneaky@clinic.test',
          password: 'password123',
          role: 'superAdmin' as any,
        },
      }),
    ).rejects.toThrow()
  })

  it("an owner's new staff land in the owner's tenant even if another is supplied", async () => {
    const staff = await payload.create({
      collection: 'users',
      overrideAccess: false,
      user: f.a.owner,
      data: {
        name: 'New Nurse',
        email: 'nurse-a@clinic.test',
        password: 'password123',
        role: 'receptionist',
        tenant: f.b.tenant.id as any, // try to plant into clinic B
      },
    })
    expect(String((staff.tenant as any)?.id ?? staff.tenant)).toBe(String(f.a.tenant.id))
  })

  it('an owner can update their own clinic settings', async () => {
    const updated = await payload.update({
      collection: 'tenants',
      id: f.a.tenant.id,
      overrideAccess: false,
      user: f.a.owner,
      data: { phone: '03009998877' },
    })
    expect(updated.phone).toBe('03009998877')
  })

  it("an owner cannot update another clinic's settings", async () => {
    await expect(
      payload.update({
        collection: 'tenants',
        id: f.b.tenant.id,
        overrideAccess: false,
        user: f.a.owner,
        data: { phone: '03001112233' },
      }),
    ).rejects.toThrow()
  })

  it('an owner cannot change their clinic status (field-level)', async () => {
    const updated = await payload.update({
      collection: 'tenants',
      id: f.a.tenant.id,
      overrideAccess: false,
      user: f.a.owner,
      data: { status: 'suspended' as never },
    })
    // Field-level access silently strips the protected field — status unchanged.
    expect(updated.status).toBe('active')
  })

  it('a receptionist cannot change another user’s role', async () => {
    await expect(
      payload.update({
        collection: 'users',
        id: f.a.doctor.id,
        overrideAccess: false,
        user: f.a.receptionist,
        data: { role: 'owner' },
      }),
    ).rejects.toThrow()
  })
})
