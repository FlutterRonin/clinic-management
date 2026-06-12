'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { btnPrimary, inputClass, textareaClass, Card, Field, Spinner } from './primitives'
import { AppSelect } from './AppSelect'
import { createPatient, updatePatient, findByPhone, type PatientHit } from '@/app/(frontend)/dashboard/patients/actions'
import { BLOOD_GROUPS } from '@/lib/constants'

export type PatientInitial = {
  name: string
  phone: string
  gender: string
  ageYears: string
  bloodGroup: string
  allergies: string
  notes: string
}

const EMPTY: PatientInitial = {
  name: '',
  phone: '',
  gender: 'male',
  ageYears: '',
  bloodGroup: '',
  allergies: '',
  notes: '',
}

export function PatientForm({
  patientId,
  initial,
}: {
  /** When set, the form edits this patient instead of creating one. */
  patientId?: string
  initial?: PatientInitial
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [dupes, setDupes] = useState<PatientHit[]>([])
  const [form, setForm] = useState<PatientInitial>(initial ?? EMPTY)
  const isEdit = Boolean(patientId)

  const set = (k: keyof PatientInitial, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const checkPhone = (phone: string) => {
    set('phone', phone)
    if (phone.trim().length < 5) return setDupes([])
    start(async () => {
      const hits = await findByPhone(phone)
      setDupes(hits.filter((h) => h.id !== patientId))
    })
  }

  const submit = () => {
    setError(null)
    start(async () => {
      const input = {
        name: form.name,
        phone: form.phone,
        gender: form.gender,
        ageYears: form.ageYears ? Number(form.ageYears) : undefined,
        bloodGroup: form.bloodGroup || undefined,
        allergies: form.allergies || undefined,
        notes: form.notes || undefined,
      }
      const res = patientId ? await updatePatient(patientId, input) : await createPatient(input)
      if (res.ok) {
        router.push(`/dashboard/patients/${res.data.id}`)
        router.refresh()
      } else setError(res.message)
    })
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-4 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name">
            <input className={inputClass} value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus={!isEdit} />
          </Field>
          <Field label="Phone">
            <input className={inputClass} value={form.phone} onChange={(e) => checkPhone(e.target.value)} inputMode="tel" />
          </Field>
        </div>
        {dupes.length > 0 && (
          <div className="rounded-md border border-amber/25 bg-amber-soft px-3 py-2 text-xs text-amber">
            {dupes.length} patient(s) already use this number:{' '}
            {dupes.map((d, i) => (
              <span key={d.id}>
                <a href={`/dashboard/patients/${d.id}`} className="font-medium underline">
                  {d.name}
                </a>
                {i < dupes.length - 1 ? ', ' : ''}
              </span>
            ))}
          </div>
        )}
        <div className="grid grid-cols-3 gap-4">
          <Field label="Gender">
            <AppSelect
              value={form.gender}
              onChange={(v) => set('gender', v)}
              options={[
                { value: 'male', label: 'Male' },
                { value: 'female', label: 'Female' },
                { value: 'other', label: 'Other' },
              ]}
            />
          </Field>
          <Field label="Age (years)">
            <input className={inputClass} inputMode="numeric" value={form.ageYears} onChange={(e) => set('ageYears', e.target.value)} />
          </Field>
          <Field label="Blood group">
            <AppSelect
              value={form.bloodGroup}
              onChange={(v) => set('bloodGroup', v)}
              placeholder="—"
              options={BLOOD_GROUPS.map((b) => ({ value: b, label: b }))}
            />
          </Field>
        </div>
        <Field label="Allergies (optional)" hint="Shown as a red banner on the patient's profile.">
          <textarea className={textareaClass} rows={2} value={form.allergies} onChange={(e) => set('allergies', e.target.value)} />
        </Field>
        <Field label="Notes (optional)">
          <textarea className={textareaClass} rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </div>

      <div className="flex items-center justify-between gap-3 border-t bg-muted/40 px-6 py-4">
        {error ? (
          <p className="text-sm text-red" role="alert">{error}</p>
        ) : (
          <span className="text-xs text-faint">
            {isEdit ? 'The MRN never changes.' : 'A patient number (MRN) is assigned automatically.'}
          </span>
        )}
        <button className={btnPrimary} disabled={pending || !form.name || !form.phone} onClick={submit}>
          {pending && <Spinner />}
          {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Register patient'}
        </button>
      </div>
    </Card>
  )
}
