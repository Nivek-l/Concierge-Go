import 'server-only'

import { logError } from '@/lib/errors'
import { createClient } from '@/lib/supabase/server'
import type { AgentBankAccountRow, AgentPayoutRow, PayoutStatus } from '@/types/database'

export interface PayoutLedgerEntry extends AgentPayoutRow {
  task_reference: string
  task_title: string
  agent_name: string
  service_charge_kobo: number
  concierge_share_kobo: number
  bank_account: AgentBankAccountRow | null
}

export interface PayoutLedgerSummary {
  pendingKobo: number
  approvedKobo: number
  paidKobo: number
  heldKobo: number
  entries: PayoutLedgerEntry[]
}

const emptyLedger = (): PayoutLedgerSummary => ({
  pendingKobo: 0,
  approvedKobo: 0,
  paidKobo: 0,
  heldKobo: 0,
  entries: [],
})

export async function getPayoutLedger(options?: {
  agentId?: string
  status?: PayoutStatus | 'all'
  limit?: number
}): Promise<PayoutLedgerSummary> {
  try {
    const supabase = await createClient()
    let query = supabase
      .from('agent_payouts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(options?.limit ?? 100)

    if (options?.agentId) query = query.eq('agent_id', options.agentId)
    if (options?.status && options.status !== 'all') query = query.eq('status', options.status)

    const [entriesResult, summaryResult] = await Promise.all([
      query,
      supabase.rpc('payout_ledger_summary', { p_agent_id: options?.agentId ?? null }),
    ])
    const { data, error } = entriesResult
    if (error) throw error
    if (summaryResult.error) throw summaryResult.error

    const payouts = (data ?? []) as AgentPayoutRow[]
    const totals = (summaryResult.data ?? {}) as Record<string, number>
    const result = emptyLedger()
    result.pendingKobo = totals.pending_kobo ?? 0
    result.approvedKobo = totals.approved_kobo ?? 0
    result.paidKobo = totals.paid_kobo ?? 0
    result.heldKobo = totals.held_kobo ?? 0
    if (payouts.length === 0) return result

    const taskIds = Array.from(new Set(payouts.map((payout) => payout.task_id)))
    const agentIds = Array.from(new Set(payouts.map((payout) => payout.agent_id)))

    const [tasksResult, agentsResult, bankAccountsResult] = await Promise.all([
      supabase.from('tasks').select('id, reference, title').in('id', taskIds),
      supabase.from('agents').select('id, profile_id').in('id', agentIds),
      supabase.from('agent_bank_accounts').select('*').in('agent_id', agentIds),
    ])

    const tasks = new Map(
      ((tasksResult.data ?? []) as Array<{ id: string; reference: string; title: string }>).map(
        (task) => [task.id, task],
      ),
    )

    const agentProfiles = (agentsResult.data ?? []) as Array<{ id: string; profile_id: string }>
    const profileIds = agentProfiles.map((agent) => agent.profile_id)
    const { data: profiles } = profileIds.length
      ? await supabase.from('profiles').select('id, full_name').in('id', profileIds)
      : { data: [] }
    const nameByProfile = new Map(
      ((profiles ?? []) as Array<{ id: string; full_name: string }>).map((profile) => [
        profile.id,
        profile.full_name,
      ]),
    )
    const nameByAgent = new Map(
      agentProfiles.map((agent) => [agent.id, nameByProfile.get(agent.profile_id) ?? 'Go Agent']),
    )
    const bankByAgent = new Map(
      ((bankAccountsResult.data ?? []) as AgentBankAccountRow[]).map((account) => [
        account.agent_id,
        account,
      ]),
    )

    result.entries = payouts.map((payout) => {
      const task = tasks.get(payout.task_id)
      const serviceChargeKobo = Math.round(payout.amount_kobo / 0.6)
      return {
        ...payout,
        task_reference: task?.reference ?? '',
        task_title: task?.title ?? 'Task',
        agent_name: nameByAgent.get(payout.agent_id) ?? 'Go Agent',
        service_charge_kobo: serviceChargeKobo,
        concierge_share_kobo: serviceChargeKobo - payout.amount_kobo,
        bank_account: bankByAgent.get(payout.agent_id) ?? null,
      }
    })

    return result
  } catch (error) {
    logError('payouts.getLedger', error, options)
    return emptyLedger()
  }
}

export async function getAgentBankAccount(agentId: string): Promise<AgentBankAccountRow | null> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('agent_bank_accounts')
      .select('*')
      .eq('agent_id', agentId)
      .maybeSingle<AgentBankAccountRow>()
    if (error) throw error
    return data ?? null
  } catch (error) {
    logError('payouts.getAgentBankAccount', error, { agentId })
    return null
  }
}
