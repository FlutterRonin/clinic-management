import React from 'react'
import { requireDashboardSession } from '@/lib/auth'
import { Sidebar } from '@/components/Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, tenant } = await requireDashboardSession()

  // Existing sessions of a suspended clinic see a stop screen (spec §8.5).
  if (tenant?.status === 'suspended') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-canvas px-4 text-center">
        <div className="font-display text-xl font-semibold text-primary">matab</div>
        <h1 className="text-lg font-semibold">This clinic&apos;s account is suspended</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Please contact support to reactivate your clinic.
        </p>
      </main>
    )
  }

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar
        clinicName={tenant?.name ?? 'Clinic'}
        userName={user.name}
        role={user.role}
      />
      <main className="flex-1 overflow-x-hidden px-4 pt-6 pb-24 sm:px-6 md:pb-8">
        <div className="mx-auto max-w-7xl animate-fade-up">{children}</div>
      </main>
    </div>
  )
}
