import Link from 'next/link'
import { requireDashboardSession } from '@/lib/auth'
import { PatientForm } from '@/components/PatientForm'

export default async function NewPatientPage() {
  await requireDashboardSession()
  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/dashboard/patients"
        className="inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-ink"
      >
        ‹ Patients
      </Link>
      <h1 className="mt-2 mb-6 text-[1.45rem] font-semibold">New patient</h1>
      <PatientForm />
    </div>
  )
}
