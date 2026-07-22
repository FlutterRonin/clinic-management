'use client'

import { Suspense, useActionState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { resetPasswordAction } from './actions'
import { btnPrimary, inputClass, Field, Spinner } from '@/components/primitives'
import { IconCheck } from '@/components/icons'

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  )
}

function ResetForm() {
  const [state, formAction, pending] = useActionState(resetPasswordAction, null)
  const token = useSearchParams().get('token') ?? ''

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-sm animate-fade-up">
        <Link href="/" className="mb-8 flex w-fit items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-white">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-3.5" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
            </svg>
          </span>
          <span className="font-display text-xl font-semibold tracking-tight text-primary">matab</span>
        </Link>

        {state?.ok ? (
          <div className="rounded-xl border border-border bg-card p-6">
            <span className="flex size-9 items-center justify-center rounded-full bg-secondary">
              <IconCheck size={16} className="text-primary" />
            </span>
            <h1 className="mt-4 font-display text-xl font-semibold tracking-tight">Password updated</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Your new password is set. Sign in with it to get back to your clinic.
            </p>
            <Link href="/login" className={`${btnPrimary} mt-5 w-full`}>
              Sign in
            </Link>
          </div>
        ) : !token ? (
          <div className="rounded-xl border border-border bg-card p-6">
            <h1 className="font-display text-xl font-semibold tracking-tight">Invalid reset link</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              This link is missing its token — it may have been truncated by your email client.
            </p>
            <Link href="/forgot-password" className="mt-5 inline-block text-sm font-medium text-primary hover:underline">
              Request a new link
            </Link>
          </div>
        ) : (
          <>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Choose a new password</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              At least 8 characters. You&rsquo;ll sign in with it right after.
            </p>

            <form action={formAction} className="mt-8 flex flex-col gap-4">
              <input type="hidden" name="token" value={token} />
              <Field label="New password" htmlFor="password">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  placeholder="••••••••"
                  className={inputClass}
                />
              </Field>
              <Field label="Confirm password" htmlFor="confirm">
                <input
                  id="confirm"
                  name="confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  placeholder="••••••••"
                  className={inputClass}
                />
              </Field>

              {state && !state.ok && (
                <p className="rounded-lg border border-red/25 bg-red-soft px-3 py-2 text-sm text-red" role="alert">
                  {state.message}{' '}
                  <Link href="/forgot-password" className="font-medium text-primary hover:underline">
                    Request a new link
                  </Link>
                </p>
              )}

              <button type="submit" className={`${btnPrimary} mt-1 w-full`} disabled={pending}>
                {pending && <Spinner />}
                {pending ? 'Saving…' : 'Set new password'}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  )
}
