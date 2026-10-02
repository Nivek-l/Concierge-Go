'use client'

import { useActionState } from 'react'

import {
  saveAgentBankAccountAction,
  type AgentBankAccountResult,
} from '@/actions/agent'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FormError, FormSuccess } from '@/components/shared/field'
import type { AgentBankAccountRow } from '@/types/database'
import type { PaystackBank } from '@/services/payouts/paystack'

export function AgentBankAccountForm({
  account,
  banks,
  payoutMode,
}: {
  account: AgentBankAccountRow | null
  banks: PaystackBank[]
  payoutMode: 'manual' | 'paystack'
}) {
  const [state, action, pending] = useActionState<AgentBankAccountResult | null, FormData>(
    saveAgentBankAccountAction,
    null,
  )

  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined

  return (
    <form action={action} className="space-y-4">
      <FormError message={state && !state.ok ? state.error : null} />
      <FormSuccess message={state?.ok ? state.message : null} />

      {account ? (
        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
          <p className="font-semibold">{account.account_name}</p>
          <p className="mt-1 text-muted-foreground">
            {account.bank_name} · ••••••{account.account_number.slice(-4)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {payoutMode === 'paystack' && account.recipient_active
              ? 'Ready for Paystack bank payouts.'
              : 'Verified for manual bank payouts.'}
          </p>
        </div>
      ) : null}

      <Field
        name="bankCode"
        label="Bank"
        required
        error={fieldErrors?.bankCode}
      >
        {(props) => (
          <select
            {...props}
            name="bankCode"
            defaultValue={account?.bank_code ?? ''}
            required
            disabled={banks.length === 0}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            onChange={(event) => {
              const form = event.currentTarget.form
              const option = event.currentTarget.selectedOptions[0]
              const bankName = form?.elements.namedItem('bankName') as HTMLInputElement | null
              if (bankName) bankName.value = option?.dataset.name ?? ''
            }}
          >
            <option value="">Choose a bank</option>
            {banks.map((bank) => (
              <option key={`${bank.code}-${bank.id}`} value={bank.code} data-name={bank.name}>
                {bank.name}
              </option>
            ))}
          </select>
        )}
      </Field>
      <input type="hidden" name="bankName" defaultValue={account?.bank_name ?? ''} />

      <Field
        name="accountNumber"
        label="Account number"
        required
        hint="The account name is checked with Paystack before it is saved."
        error={fieldErrors?.accountNumber}
      >
        {(props) => (
          <Input
            {...props}
            name="accountNumber"
            inputMode="numeric"
            autoComplete="off"
            pattern="[0-9]{10}"
            maxLength={10}
            defaultValue={account?.account_number ?? ''}
            required
          />
        )}
      </Field>

      {banks.length === 0 ? (
        <p className="text-sm text-destructive">
          The Nigerian bank list could not be loaded. Check the Paystack secret key and try again.
        </p>
      ) : null}

      <Button type="submit" loading={pending} disabled={banks.length === 0}>
        Verify and save account
      </Button>
    </form>
  )
}
