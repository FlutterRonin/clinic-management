import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireDashboardSession, getPayloadClient } from '@/lib/auth'
import { getTenantID } from '@/access'
import { PatientForm } from '@/components/PatientForm'
import type { Patient } from '@/payload-types'

export default async function EditPatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireDashboardSession()
  const payload = await getPayloadClient()
  const tenantID = getTenantID(user)!
  const { id } = await params

  let patient: Patient
  try {
    patient = (await payload.findByID({
      collection: 'patients',
      id,
      depth: 0,
      overrideAccess: false,
      user,
    })) as Patient
  } catch {
    notFound()
  }
  if (String((patient.tenant as { id?: string })?.id ?? patient.tenant) !== String(tenantID)) {
    notFound()
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={`/dashboard/patients/${id}`}
        className="inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-ink"
      >
        ‹ {patient.name}
      </Link>
      <h1 className="mt-2 mb-6 text-[1.45rem] font-semibold">Edit patient</h1>
      <PatientForm
        patientId={id}
        initial={{
          name: patient.name,
          phone: patient.phone,
          gender: patient.gender,
          ageYears: patient.ageYears != null ? String(patient.ageYears) : '',
          bloodGroup: patient.bloodGroup ?? '',
          allergies: patient.allergies ?? '',
          notes: patient.notes ?? '',
        }}
      />
    </div>
  )
}
