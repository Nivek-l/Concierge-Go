'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

import { createDraftTaskAction, finalizeTaskAction, type FinalizeTaskResult } from '@/actions/task-draft'
import { TIME_SLOTS, URGENCY_META } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { CityRow, TaskCategoryRow, TaskUrgency } from '@/types/database'
import type { AiTaskDraft } from '@/services/ai/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Field, FormError } from '@/components/shared/field'
import { FileUploader, type UploadedFileMeta } from '@/components/shared/file-uploader'
import { toast } from '@/components/ui/sonner'

const URGENCIES: TaskUrgency[] = ['standard', 'priority', 'urgent']
const AI_TASK_DRAFT_STORAGE_KEY = 'concierge-go:ai-task-draft'

export function NewTaskForm({
  categories,
  cities,
  defaultPhone,
}: {
  categories: TaskCategoryRow[]
  cities: CityRow[]
  defaultPhone: string | null
}) {
  const router = useRouter()
  const [draftTaskId, setDraftTaskId] = useState<string | null>(null)
  const [initialDraft, setInitialDraft] = useState<AiTaskDraft | null>(null)
  const [draftHydrated, setDraftHydrated] = useState(false)
  const [draftError, setDraftError] = useState(false)
  const [attachments, setAttachments] = useState<UploadedFileMeta[]>([])
  const [urgency, setUrgency] = useState<TaskUrgency>('standard')
  const [destinationRequired, setDestinationRequired] = useState(false)
  const [state, formAction, isPending] = useActionState<FinalizeTaskResult | null, FormData>(
    finalizeTaskAction,
    null,
  )


  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(AI_TASK_DRAFT_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as AiTaskDraft
        setInitialDraft(parsed)
        setUrgency(parsed.urgency ?? 'standard')
        setDestinationRequired(Boolean(parsed.destinationRequired))
        sessionStorage.removeItem(AI_TASK_DRAFT_STORAGE_KEY)
      }
    } catch {
      sessionStorage.removeItem(AI_TASK_DRAFT_STORAGE_KEY)
    } finally {
      setDraftHydrated(true)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    createDraftTaskAction().then((result) => {
      if (cancelled) return
      if (result.ok) setDraftTaskId(result.data.taskId)
      else setDraftError(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (state?.ok) {
      toast.success('Your request has been received.')
      router.push(`/tasks/${state.data.taskId}`)
    }
  }, [state, router])

  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined

  if (!draftHydrated) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Preparing your request…
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-8">
      <input type="hidden" name="draftTaskId" value={draftTaskId ?? ''} />
      <input type="hidden" name="attachments" value={JSON.stringify(attachments)} />

      <FormError message={state && !state.ok ? state.error : null} />
      {draftError ? (
        <FormError message="We could not prepare your request. You can still fill this in, but try refreshing if attachments fail to upload." />
      ) : null}

      {initialDraft ? (
        <div className="rounded-xl border border-primary/25 bg-primary-subtle/40 p-4">
          <p className="text-sm font-semibold">AI draft loaded</p>
          <p className="mt-1 text-xs text-muted-foreground">
            We filled this form from your chat. Review every detail, correct anything that is missing, then submit when you are happy with it.
          </p>
          {initialDraft.missingFields.length > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Still to confirm: {initialDraft.missingFields.join(' · ')}
            </p>
          ) : null}
        </div>
      ) : null}

      <section className="space-y-4">
        <Field
          name="title"
          label="What do you need done?"
          required
          hint="Describe it in your own words — Concierge Go will review and categorize it."
          error={fieldErrors?.title}
        >
          {(props) => (
            <Input
              {...props}
              name="title"
              placeholder="e.g. Collect my certificate from UNICAL and bring it to me"
              defaultValue={initialDraft?.title ?? undefined}
              required
            />
          )}
        </Field>

        <Field
          name="description"
          label="Tell us the details"
          required
          hint="Where, what document or item, any deadlines, who to contact on-site — the more detail, the more accurate your quote."
          error={fieldErrors?.description}
        >
          {(props) => (
            <Textarea
              {...props}
              name="description"
              rows={5}
              placeholder="I need someone to collect my certificate from the school and bring it to me. The registrar's office is..."
              defaultValue={initialDraft?.description ?? undefined}
              required
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="categorySlug" label="Category" required error={fieldErrors?.categorySlug}>
            {() => (
              <Select name="categorySlug" defaultValue={categories.some((category) => category.slug === initialDraft?.categorySlug) ? initialDraft?.categorySlug : categories[0]?.slug}>
                <SelectTrigger id="field-categorySlug">
                  <SelectValue placeholder="Choose a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.slug} value={category.slug}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>

          <Field name="citySlug" label="City" required error={fieldErrors?.citySlug}>
            {() => (
              <Select name="citySlug" defaultValue={cities.some((city) => city.slug === initialDraft?.citySlug) ? initialDraft?.citySlug : (cities[0]?.slug ?? 'calabar')}>
                <SelectTrigger id="field-citySlug">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {cities.map((city) => (
                    <SelectItem key={city.slug} value={city.slug} disabled={!city.is_live}>
                      {city.name}
                      {!city.is_live ? ' (coming soon)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
        </div>
      </section>

      <section className="space-y-4 border-t pt-6">
        <h2 className="text-sm font-semibold">Where the task happens</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            name="locationAddress"
            label="Address"
            required
            error={fieldErrors?.locationAddress}
          >
            {(props) => (
              <Input {...props} name="locationAddress" placeholder="e.g. Registrar's office, UNICAL" defaultValue={initialDraft?.locationAddress ?? undefined} required />
            )}
          </Field>
          <Field name="locationArea" label="Area" hint="e.g. Marian, Calabar Municipal">
            {(props) => <Input {...props} name="locationArea" placeholder="Area" defaultValue={initialDraft?.locationArea ?? undefined} />}
          </Field>
        </div>
        <Field name="locationLandmark" label="Landmark" hint="Anything that helps an agent find the spot.">
          {(props) => <Input {...props} name="locationLandmark" placeholder="Nearest landmark" defaultValue={initialDraft?.locationLandmark ?? undefined} />}
        </Field>

        <div className="flex items-start gap-2.5">
          <Checkbox
            id="destinationRequired"
            name="destinationRequired"
            checked={destinationRequired}
            onCheckedChange={(checked) => setDestinationRequired(checked === true)}
          />
          <label htmlFor="destinationRequired" className="text-sm text-muted-foreground">
            This task involves delivering something to a second location
          </label>
        </div>

        {destinationRequired ? (
          <div className="grid gap-4 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2">
            <Field
              name="destinationAddress"
              label="Destination address"
              required
              error={fieldErrors?.destinationAddress}
            >
              {(props) => <Input {...props} name="destinationAddress" placeholder="Where should it be delivered?" defaultValue={initialDraft?.destinationAddress ?? undefined} />}
            </Field>
            <Field name="destinationArea" label="Destination area">
              {(props) => <Input {...props} name="destinationArea" placeholder="Area" defaultValue={initialDraft?.destinationArea ?? undefined} />}
            </Field>
          </div>
        ) : null}
      </section>

      <section className="space-y-4 border-t pt-6">
        <h2 className="text-sm font-semibold">Timing & urgency</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="preferredDate" label="Preferred date">
            {(props) => <Input {...props} name="preferredDate" type="date" defaultValue={initialDraft?.preferredDate ?? undefined} />}
          </Field>
          <Field name="preferredTimeSlot" label="Preferred time">
            {() => (
              <Select name="preferredTimeSlot" defaultValue={initialDraft?.preferredTimeSlot ?? undefined}>
                <SelectTrigger id="field-preferredTimeSlot">
                  <SelectValue placeholder="Any time" />
                </SelectTrigger>
                <SelectContent>
                  {TIME_SLOTS.map((slot) => (
                    <SelectItem key={slot} value={slot}>
                      {slot}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-medium">Urgency</span>
          <input type="hidden" name="urgency" value={urgency} />
          <div className="grid gap-2.5 sm:grid-cols-3">
            {URGENCIES.map((level) => {
              const meta = URGENCY_META[level]
              const active = urgency === level
              return (
                <button
                  type="button"
                  key={level}
                  onClick={() => setUrgency(level)}
                  className={cn(
                    'rounded-lg border p-3 text-left transition-colors',
                    active ? 'border-primary bg-primary-subtle' : 'hover:border-primary/40',
                  )}
                >
                  <p className="text-sm font-semibold">{meta.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground text-pretty">
                    {meta.description}
                  </p>
                </button>
              )
            })}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            We review urgent requests immediately, but timing always depends on agent
            availability — we&apos;ll confirm before you pay.
          </p>
        </div>
      </section>

      <section className="space-y-4 border-t pt-6">
        <h2 className="text-sm font-semibold">A little more</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            name="contactPhone"
            label="Contact phone for this task"
            hint={defaultPhone ? `Defaults to ${defaultPhone}` : undefined}
          >
            {(props) => <Input {...props} name="contactPhone" type="tel" placeholder={defaultPhone ?? '0803 123 4567'} />}
          </Field>
          <Field name="budgetNaira" label="Your budget" hint="Optional — helps us quote accurately.">
            {(props) => <Input {...props} name="budgetNaira" type="number" min="0" step="100" placeholder="₦" defaultValue={initialDraft?.budgetNaira ?? undefined} />}
          </Field>
        </div>

        <Field name="additionalInstructions" label="Additional instructions">
          {(props) => (
            <Textarea {...props} name="additionalInstructions" rows={3} placeholder="Anything else the agent should know" defaultValue={initialDraft?.additionalInstructions ?? undefined} />
          )}
        </Field>

        <div>
          <span className="mb-1.5 block text-sm font-medium">
            Attachments <span className="text-xs font-normal text-muted-foreground">Optional</span>
          </span>
          {draftTaskId ? (
            <FileUploader
              kind="attachment"
              entityId={draftTaskId}
              value={attachments}
              onChange={setAttachments}
              multiple
              label="Attach a photo or document"
            />
          ) : (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Preparing attachment upload…
            </p>
          )}
        </div>
      </section>

      <Button type="submit" size="lg" className="w-full sm:w-auto" loading={isPending}>
        Submit request
      </Button>
    </form>
  )
}
