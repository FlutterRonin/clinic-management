'use client'

import { Button } from '@/components/ui/button'
import { IconChevronLeft, IconChevronRight } from './icons'

/** Compact pager for client-side tables (staff, tenants). */
export function TablePager({
  page,
  totalPages,
  onChange,
}: {
  page: number
  totalPages: number
  onChange: (page: number) => void
}) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between border-t bg-muted/40 px-4 py-2.5">
      <span className="tabular text-xs text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      <div className="flex items-center gap-1.5">
        <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <IconChevronLeft />
          <span className="sr-only">Previous page</span>
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          <IconChevronRight />
          <span className="sr-only">Next page</span>
        </Button>
      </div>
    </div>
  )
}
