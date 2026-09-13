'use client'

import { useActionState } from 'react'

import { updateAgentProfileAction, type AgentProfileResult } from '@/actions/agent'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Field, FormError, FormSuccess } from '@/components/shared/field'
import type { AgentRow, CityRow } from '@/types/database'

export function AgentProfileForm({
  agent,
  cities,
  serviceAreas,
}: {
  agent: AgentRow
  cities: CityRow[]
  serviceAreas: string[]
}) {
  const [state, formAction, isPending] = useActionState<AgentProfileResult | null, FormData>(
    updateAgentProfileAction,
    null,
  )

  return (
    <form action={formAction} className="space-y-4">
      <FormError message={state && !state.ok ? state.error : null} />
      <FormSuccess message={state?.ok ? state.message : null} />

      <Field name="headline" label="Headline" hint="A short line customers see, e.g. 'Fast, reliable errands around Calabar'.">
        {(props) => <Input {...props} name="headline" defaultValue={agent.headline ?? ''} maxLength={120} />}
      </Field>

      <Field name="bio" label="About you" hint="Optional">
        {(props) => <Textarea {...props} name="bio" rows={3} defaultValue={agent.bio ?? ''} />}
      </Field>

      <Field name="transportMode" label="How you get around">
        {(props) => (
          <Input {...props} name="transportMode" defaultValue={agent.transport_mode ?? ''} />
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="citySlug" label="City">
          {() => (
            <Select name="citySlug" defaultValue={cities[0]?.slug ?? 'calabar'}>
              <SelectTrigger id="field-citySlug">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {cities.map((city) => (
                  <SelectItem key={city.slug} value={city.slug}>
                    {city.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        <Field
          name="serviceAreas"
          label="Areas you serve"
          hint="Comma-separated, e.g. Marian, Calabar Municipal"
        >
          {(props) => (
            <Input {...props} name="serviceAreas" defaultValue={serviceAreas.join(', ')} />
          )}
        </Field>
      </div>

      <Button type="submit" loading={isPending}>
        Save changes
      </Button>
    </form>
  )
}
