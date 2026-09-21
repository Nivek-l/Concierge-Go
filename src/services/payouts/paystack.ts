import 'server-only'

import { requireServerEnv } from '@/lib/env'
import { AppError, logError } from '@/lib/errors'

const PAYSTACK_BASE_URL = 'https://api.paystack.co'

interface PaystackResponse<T> {
  status: boolean
  message: string
  data: T
}

export interface PaystackBank {
  id: number
  name: string
  slug: string
  code: string
  active: boolean
  country: string
  currency: string
  type: string
}

interface ResolvedAccount {
  account_number: string
  account_name: string
  bank_id: number
}

interface TransferRecipient {
  active: boolean
  name: string
  recipient_code: string
  type: string
  currency: string
  details?: {
    account_number?: string
    account_name?: string
    bank_code?: string
    bank_name?: string
  }
}

export interface PaystackTransfer {
  amount: number
  currency: string
  reference: string
  status: string
  transfer_code: string
  transferred_at?: string | null
  failures?: string | null
}

async function paystackTransferFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const secretKey = requireServerEnv('PAYSTACK_SECRET_KEY')
  const response = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  })

  const payload = (await response.json().catch(() => null)) as PaystackResponse<T> | null
  if (!response.ok || !payload?.status || payload.data == null) {
    const providerMessage = payload?.message || `Paystack returned HTTP ${response.status}`
    logError('paystack.transferRequest', new Error(providerMessage), { path })
    throw new AppError(
      'Paystack could not process this bank transfer. Check the bank details and your transfer balance, then try again.',
      { code: 'paystack_transfer_failed' },
    )
  }

  return payload.data
}

export async function listNigerianBanks(): Promise<PaystackBank[]> {
  try {
    const banks = await paystackTransferFetch<PaystackBank[]>(
      '/bank?country=nigeria&currency=NGN&perPage=100',
    )
    return banks
      .filter((bank) => bank.active && bank.code)
      .sort((a, b) => a.name.localeCompare(b.name))
  } catch (error) {
    logError('paystack.listBanks', error)
    return []
  }
}

export async function resolveNigerianBankAccount(accountNumber: string, bankCode: string) {
  return paystackTransferFetch<ResolvedAccount>(
    `/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
  )
}

export async function createPaystackTransferRecipient(input: {
  name: string
  accountNumber: string
  bankCode: string
  description: string
}) {
  return paystackTransferFetch<TransferRecipient>('/transferrecipient', {
    method: 'POST',
    body: JSON.stringify({
      type: 'nuban',
      name: input.name,
      account_number: input.accountNumber,
      bank_code: input.bankCode,
      currency: 'NGN',
      description: input.description,
    }),
  })
}

export async function initiatePaystackTransfer(input: {
  amountKobo: number
  recipientCode: string
  reference: string
  reason: string
}) {
  return paystackTransferFetch<PaystackTransfer>('/transfer', {
    method: 'POST',
    body: JSON.stringify({
      source: 'balance',
      amount: input.amountKobo,
      recipient: input.recipientCode,
      reference: input.reference,
      reason: input.reason,
      currency: 'NGN',
    }),
  })
}

export async function finalizePaystackTransfer(transferCode: string, otp: string) {
  return paystackTransferFetch<PaystackTransfer>('/transfer/finalize_transfer', {
    method: 'POST',
    body: JSON.stringify({ transfer_code: transferCode, otp }),
  })
}
