import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireDashboardSession, getPayloadClient } from '@/lib/auth'
import { getTenantID } from '@/access'
import { AllergyBanner, Card, StatusBadge, EmptyState, Avatar, btnPrimary, btnGhost } from '@/components/primitives'
import { IconChevronLeft, IconPhone, IconPlus } from '@/components/icons'
import { ageFromDOB, formatDateTime } from '@/lib/format'
import type { Appointment, Patient, User } from '@/payload-types'
import type { AppointmentStatus } from '@/lib/constants'

const HISTORY_PAGE_SIZE = 15

export default async function PatientProfile({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ hp?: string }>
}) {
  const { user, tenant } = await requireDashboardSession()
  const payload = await getPayloadClient()
  const tenantID = getTenantID(user)!
  const { id } = await params
  const hp = Math.max(1, Number((await searchParams).hp) || 1)

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

  // Belt-and-suspenders: never reveal another tenant's patient.
  if (String((patient.tenant as { id?: string })?.id ?? patient.tenant) !== String(tenantID)) {
    notFound()
  }

  const history = await payload.find({
    collection: 'appointments',
    where: { tenant: { equals: tenantID }, patient: { equals: id } },
    sort: '-start',
    limit: HISTORY_PAGE_SIZE,
    page: hp,
    depth: 1,
    overrideAccess: true,
  })
  const appts = history.docs as Appointment[]

  const age = patient.ageYears ?? (patient.dateOfBirth ? ageFromDOB(patient.dateOfBirth) : null)

  return (
    <div>
      <Link
        href="/dashboard/patients"
        className="inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-ink"
      >
        <IconChevronLeft size={14} />
        Patients
      </Link>

      <div className="mt-3 grid items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Patient info rail */}
        <Card className="sticky top-6 overflow-hidden">
          <div className="border-b bg-secondary/30 px-5 py-5 text-center">
            <span className="inline-flex">
              <Avatar name={patient.name} />
            </span>
            <h1 className="mt-2 text-lg font-semibold">{patient.name}</h1>
            <span className="tabular mt-1 inline-block rounded bg-card px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {patient.mrn}
            </span>
          </div>

          <dl className="divide-y divide-border text-sm">
            {[
              {
                label: 'Phone',
                value: (
                  <span className="tabular inline-flex items-center gap-1.5">
                    <IconPhone size={12} className="text-faint" />
                    {patient.phone}
                  </span>
                ),
              },
              { label: 'Gender', value: <span className="capitalize">{patient.gender}</span> },
              { label: 'Age', value: age != null ? `${age} years` : '—' },
              { label: 'Blood group', value: patient.bloodGroup || '—' },
              { label: 'Visits', value: history.totalDocs },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3 px-5 py-2.5">
                <dt className="text-xs font-medium text-muted-foreground">{row.label}</dt>
                <dd className="text-[13px] font-medium">{row.value}</dd>
              </div>
            ))}
          </dl>

          {patient.allergies && (
            <div className="border-t px-4 py-3">
              <AllergyBanner allergies={patient.allergies} />
            </div>
          )}
          {patient.notes && (
            <p className="border-t bg-canvas/70 px-5 py-3 text-[13px] leading-relaxed text-muted-foreground">
              {patient.notes}
            </p>
          )}

          <div className="flex gap-2 border-t p-4">
            <Link href={`/dashboard/patients/${patient.id}/edit`} className={`${btnGhost} flex-1`}>
              Edit
            </Link>
            <Link href="/dashboard/appointments/new" className={`${btnPrimary} flex-1`}>
              <IconPlus size={15} />
              Book
            </Link>
          </div>
        </Card>

        <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 className="text-sm font-semibold">Appointment history</h2>
          <span className="tabular text-xs text-faint">{history.totalDocs}</span>
        </div>
        {appts.length === 0 ? (
          <EmptyState
            message="No appointments yet."
            actionHref="/dashboard/appointments/new"
            actionLabel="Book one"
          />
        ) : (
          <ul className="divide-y divide-border">
            {appts.map((a) => (
              <li key={a.id} className="flex items-center gap-4 px-5 py-3 text-sm transition-colors hover:bg-canvas/60">
                <span className="tabular w-44 shrink-0 text-[13px] text-muted-foreground">
                  {formatDateTime(a.start, tenant)}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{(a.doctor as User)?.name}</span>
                  {a.reason && <span className="text-muted-foreground"> · {a.reason}</span>}
                </span>
                <StatusBadge status={a.status as AppointmentStatus} />
              </li>
            ))}
          </ul>
        )}
        {history.totalPages > 1 && (
          <div className="flex items-center justify-between border-t bg-muted/40 px-5 py-2.5 text-xs text-muted-foreground">
            <span className="tabular">
              Page {history.page} of {history.totalPages}
            </span>
            <div className="flex gap-3">
              {history.hasPrevPage && (
                <Link href={`/dashboard/patients/${id}?hp=${hp - 1}`} className="font-medium text-primary hover:underline">
                  ‹ Newer
                </Link>
              )}
              {history.hasNextPage && (
                <Link href={`/dashboard/patients/${id}?hp=${hp + 1}`} className="font-medium text-primary hover:underline">
                  Older ›
                </Link>
              )}
            </div>
          </div>
        )}
        </Card>
      </div>
    </div>
  )
}
