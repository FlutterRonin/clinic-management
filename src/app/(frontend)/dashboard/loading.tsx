// Dashboard skeleton — blocks match the final layout (no spinners, no shift).

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      {/* header */}
      <div className="mb-6 flex items-end justify-between gap-3">
        <div className="space-y-2">
          <div className="skeleton h-7 w-40" />
          <div className="skeleton h-4 w-28" />
        </div>
        <div className="skeleton h-10 w-44" />
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card-flat space-y-3 p-4">
            <div className="skeleton h-4 w-28" />
            <div className="skeleton h-8 w-14" />
          </div>
        ))}
      </div>

      {/* chart */}
      <div className="card-flat p-6">
        <div className="skeleton mb-4 h-5 w-56" />
        <div className="skeleton h-60 w-full" />
      </div>

      {/* up next list */}
      <div className="card-flat overflow-hidden">
        <div className="border-b px-4 py-3">
          <div className="skeleton h-5 w-32" />
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex h-11 items-center gap-4 px-4">
              <div className="skeleton h-4 w-12" />
              <div className="skeleton h-4 flex-1" />
              <div className="skeleton h-5 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
