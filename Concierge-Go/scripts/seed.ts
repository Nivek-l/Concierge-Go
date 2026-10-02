/**
 * Development seed script.
 *
 * Creates a small, clearly-labelled set of demo data so the app is usable
 * immediately after `supabase db push`: 3 customers, 3 agents (2 verified,
 * 1 pending), 8 tasks spanning most of the workflow, 3 quotes, a handful of
 * notifications, a payment, a review and one dispute.
 *
 * This uses the service-role client — it must never run against production,
 * and it re-runs safely: existing demo accounts (profiles.is_demo = true)
 * are deleted first, which cascades to everything derived from them.
 *
 * Usage:  npm run seed   (reads Supabase credentials from .env.local)
 */

import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv() // fall back to a plain .env if that's what's present

import { createClient } from '@supabase/supabase-js'
import { buildPaymentReference } from '../src/services/payments'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    '\nMissing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n' +
      'Add them to .env.local first (see .env.example), then re-run `npm run seed`.\n',
  )
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const DEMO_PASSWORD = process.env.SEED_PASSWORD ?? 'ConciergeGo!2026'
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'ops@conciergego.test'

type Role = 'customer' | 'agent' | 'admin'

async function resetDemoData() {
  console.log('→ Clearing previous demo accounts…')
  const { data: existing, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('is_demo', true)

  if (error) throw error

  for (const row of existing ?? []) {
    await supabase.auth.admin.deleteUser(row.id as string)
  }
  console.log(`  removed ${existing?.length ?? 0} previous demo account(s)`)
}

async function createAuthUser(params: {
  email: string
  fullName: string
  phone: string
  role: Role
  citySlug?: string
  area?: string
}) {
  const { data, error } = await supabase.auth.admin.createUser({
    email: params.email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: {
      role: params.role === 'admin' ? 'customer' : params.role,
      full_name: params.fullName,
      phone: params.phone,
      city_slug: params.citySlug ?? 'calabar',
      default_area: params.area,
    },
  })

  if (error) throw error
  const userId = data.user.id

  // The trigger only knows 'customer' | 'agent'; promote to admin here.
  const patch: Record<string, unknown> = { is_demo: true }
  if (params.role === 'admin') patch.role = 'admin'

  const { error: profileError } = await supabase.from('profiles').update(patch).eq('id', userId)
  if (profileError) throw profileError

  return userId
}

async function getCategoryId(slug: string) {
  const { data, error } = await supabase
    .from('task_categories')
    .select('id, typical_service_fee_kobo')
    .eq('slug', slug)
    .single()
  if (error) throw error
  return data as { id: string; typical_service_fee_kobo: number }
}

async function getCalabarId() {
  const { data, error } = await supabase.from('cities').select('id').eq('slug', 'calabar').single()
  if (error) throw error
  return data.id as string
}

async function main() {
  console.log('\nSeeding Concierge Go demo data\n')

  await resetDemoData()
  const calabarId = await getCalabarId()

  /* ------------------------------------------------------------------ */
  /* People                                                              */
  /* ------------------------------------------------------------------ */

  console.log('→ Creating admin…')
  const adminId = await createAuthUser({
    email: ADMIN_EMAIL,
    fullName: 'Amaka Effiong',
    phone: '08031110001',
    role: 'admin',
  })

  console.log('→ Creating customers…')
  const customerIds = await Promise.all([
    createAuthUser({
      email: 'bassey.customer@conciergego.ng',
      fullName: 'Bassey Okon',
      phone: '08031110002',
      role: 'customer',
      area: 'Marian',
    }),
    createAuthUser({
      email: 'ekaette.customer@conciergego.ng',
      fullName: 'Ekaette Udoh',
      phone: '08031110003',
      role: 'customer',
      area: 'State Housing',
    }),
    createAuthUser({
      email: 'chidi.customer@conciergego.ng',
      fullName: 'Chidi Nwosu',
      phone: '08031110004',
      role: 'customer',
      area: 'Calabar Municipal',
    }),
  ])
  const [customer1, customer2, customer3] = customerIds

  console.log('→ Creating agents…')
  const agentUserIds = await Promise.all([
    createAuthUser({
      email: 'ime.agent@conciergego.ng',
      fullName: 'Ime Bassey',
      phone: '08031110005',
      role: 'agent',
      area: 'Calabar Municipal',
    }),
    createAuthUser({
      email: 'grace.agent@conciergego.ng',
      fullName: 'Grace Etim',
      phone: '08031110006',
      role: 'agent',
      area: 'Marian',
    }),
    createAuthUser({
      email: 'sam.agent@conciergego.ng',
      fullName: 'Samuel Okoi',
      phone: '08031110007',
      role: 'agent',
      area: 'State Housing',
    }),
  ])

  const { data: agentRows, error: agentFetchError } = await supabase
    .from('agents')
    .select('id, profile_id')
    .in('profile_id', agentUserIds)
  if (agentFetchError) throw agentFetchError

  const agentIdByProfile = new Map(
    (agentRows ?? []).map((row) => [row.profile_id as string, row.id as string]),
  )
  const agent1 = agentIdByProfile.get(agentUserIds[0])!
  const agent2 = agentIdByProfile.get(agentUserIds[1])!
  const agent3 = agentIdByProfile.get(agentUserIds[2])!

  await supabase
    .from('agents')
    .update({
      headline: 'Fast, reliable errands around Calabar Municipal',
      bio: 'Three years running errands and handling documents across Calabar. Own a motorcycle.',
      transport_mode: 'Motorcycle',
      verification_status: 'verified',
      is_available: true,
      completed_tasks: 14,
    })
    .eq('id', agent1)

  await supabase
    .from('agents')
    .update({
      headline: 'Careful with documents and property visits',
      bio: 'Former front-desk officer. Good with paperwork and following up at government offices.',
      transport_mode: 'Keke napep',
      verification_status: 'verified',
      is_available: true,
      completed_tasks: 9,
    })
    .eq('id', agent2)

  await supabase
    .from('agents')
    .update({
      headline: null,
      bio: null,
      transport_mode: 'Car',
      verification_status: 'pending',
      is_available: false,
      completed_tasks: 0,
    })
    .eq('id', agent3)

  await supabase.from('agent_verifications').insert([
    {
      agent_id: agent1,
      status: 'verified',
      transport_mode: 'Motorcycle',
      availability: 'Weekdays 8am–7pm, some weekends',
      experience: 'Three years of errand and delivery work around Calabar.',
      consents_to_checks: true,
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
    },
    {
      agent_id: agent2,
      status: 'verified',
      transport_mode: 'Keke napep',
      availability: 'Every day, 9am–6pm',
      experience: 'Five years handling admin errands and document collection.',
      consents_to_checks: true,
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
    },
    {
      agent_id: agent3,
      status: 'pending',
      transport_mode: 'Car',
      availability: 'Weekends, and weekday evenings after 5pm',
      experience: 'New to Concierge Go — previously worked in customer service.',
      consents_to_checks: true,
    },
  ])

  /* ------------------------------------------------------------------ */
  /* Tasks                                                               */
  /* ------------------------------------------------------------------ */

  console.log('→ Creating tasks…')

  const docs = await getCategoryId('documents-administration')
  const shopping = await getCategoryId('shopping-sourcing')
  const errands = await getCategoryId('personal-errands')
  const business = await getCategoryId('business-tasks')
  const property = await getCategoryId('property-verification')

  function inDays(days: number) {
    const date = new Date()
    date.setDate(date.getDate() + days)
    return date.toISOString().slice(0, 10)
  }

  async function insertTask(input: {
    customerId: string
    categoryId: string
    title: string
    description: string
    locationArea: string
    locationAddress: string
    urgency?: 'standard' | 'priority' | 'urgent'
    requiresProof?: boolean
    preferredDate?: string
    budgetKobo?: number | null
  }) {
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        customer_id: input.customerId,
        category_id: input.categoryId,
        title: input.title,
        description: input.description,
        location_area: input.locationArea,
        location_address: input.locationAddress,
        city_id: calabarId,
        urgency: input.urgency ?? 'standard',
        requires_proof: input.requiresProof ?? true,
        preferred_date: input.preferredDate ?? inDays(2),
        budget_kobo: input.budgetKobo ?? null,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        is_demo: true,
      })
      .select('id, reference, title')
      .single()

    if (error) throw error
    return data as { id: string; reference: string; title: string }
  }

  async function createQuote(taskId: string, breakdown: {
    serviceFeeKobo: number
    transportFeeKobo: number
    platformFeeKobo: number
    agentPayoutKobo: number
    status?: 'sent' | 'accepted'
  }) {
    const { data, error } = await supabase
      .from('task_quotes')
      .insert({
        task_id: taskId,
        created_by: adminId,
        service_fee_kobo: breakdown.serviceFeeKobo,
        transport_fee_kobo: breakdown.transportFeeKobo,
        additional_fee_kobo: 0,
        platform_fee_kobo: breakdown.platformFeeKobo,
        agent_payout_kobo: breakdown.agentPayoutKobo,
        status: breakdown.status ?? 'sent',
        expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        ...(breakdown.status === 'accepted' ? { responded_at: new Date().toISOString() } : {}),
      })
      .select('id, total_kobo, agent_payout_kobo')
      .single()
    if (error) throw error
    return data as { id: string; total_kobo: number; agent_payout_kobo: number }
  }

  // 1. Just submitted, nothing else has happened.
  const task1 = await insertTask({
    customerId: customer1,
    categoryId: docs.id,
    title: 'Collect my certificate from UNICAL',
    description:
      'I need someone to collect my degree certificate from the UNICAL registrar and hold it safely until I can arrange pickup.',
    locationArea: 'Calabar Municipal',
    locationAddress: 'University of Calabar, Registrar\u2019s Office',
    urgency: 'standard',
  })

  // 2. Operations has started reviewing it.
  const task2 = await insertTask({
    customerId: customer1,
    categoryId: property.id,
    title: 'Verify a property before I rent it',
    description:
      'Please visit a 2-bedroom flat in State Housing and confirm it matches the photos, check for water and power, and take pictures.',
    locationArea: 'State Housing',
    locationAddress: '14 Ndidem Usang Iso Road area, State Housing',
    urgency: 'priority',
  })
  await supabase.from('tasks').update({ status: 'under_review', reviewed_at: new Date().toISOString() }).eq('id', task2.id)

  // 3. Quoted, awaiting the customer's decision.
  const task3 = await insertTask({
    customerId: customer2,
    categoryId: shopping.id,
    title: 'Buy and verify a phone at Watt Market',
    description:
      'I want to buy a specific phone model at Watt Market. Please confirm it is genuine and the price is fair before paying.',
    locationArea: 'Watt Market',
    locationAddress: 'Watt Market, Calabar',
    budgetKobo: 18000000,
  })
  await supabase.from('tasks').update({ status: 'under_review' }).eq('id', task3.id)
  const quote3 = await createQuote(task3.id, {
    serviceFeeKobo: 300000,
    transportFeeKobo: 100000,
    platformFeeKobo: 40000,
    agentPayoutKobo: 350000,
  })
  await supabase.from('tasks').update({ status: 'quoted', quoted_at: new Date().toISOString() }).eq('id', task3.id)

  // 4. Quote accepted, waiting on payment.
  const task4 = await insertTask({
    customerId: customer2,
    categoryId: docs.id,
    title: 'Submit my passport renewal application',
    description:
      'I have all documents ready. Please submit my passport renewal application at the Immigration office and get me a reference slip.',
    locationArea: 'Calabar Municipal',
    locationAddress: 'Nigeria Immigration Service, Calabar Office',
    urgency: 'priority',
  })
  await supabase.from('tasks').update({ status: 'under_review' }).eq('id', task4.id)
  const quote4 = await createQuote(task4.id, {
    serviceFeeKobo: 350000,
    transportFeeKobo: 100000,
    platformFeeKobo: 45000,
    agentPayoutKobo: 400000,
    status: 'accepted',
  })
  await supabase
    .from('tasks')
    .update({ status: 'awaiting_payment', quoted_at: new Date().toISOString() })
    .eq('id', task4.id)

  // 5. Paid, waiting for an agent to be assigned.
  const task5 = await insertTask({
    customerId: customer3,
    categoryId: errands.id,
    title: 'Pick up and drop off dry cleaning',
    description: 'Collect my dry cleaning from Marian Road and drop it at my house in Calabar Municipal.',
    locationArea: 'Marian',
    locationAddress: 'Marian Road Dry Cleaners',
  })
  const quote5 = await createQuote(task5.id, {
    serviceFeeKobo: 150000,
    transportFeeKobo: 150000,
    platformFeeKobo: 30000,
    agentPayoutKobo: 250000,
    status: 'accepted',
  })
  const payment5Ref = buildPaymentReference(task5.reference)
  await supabase.from('payments').insert({
    task_id: task5.id,
    quote_id: quote5.id,
    customer_id: customer3,
    provider: 'mock',
    reference: payment5Ref,
    amount_kobo: quote5.total_kobo,
    status: 'succeeded',
    paid_at: new Date().toISOString(),
  })
  await supabase.from('tasks').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', task5.id)

  // 6. Assigned and in progress.
  const task6 = await insertTask({
    customerId: customer1,
    categoryId: business.id,
    title: 'Deliver signed contracts to a client office',
    description: 'Pick up signed contract documents from my office and deliver them to a client in Calabar Municipal today.',
    locationArea: 'Calabar Municipal',
    locationAddress: '22 Mary Slessor Avenue',
    urgency: 'urgent',
  })
  const quote6 = await createQuote(task6.id, {
    serviceFeeKobo: 200000,
    transportFeeKobo: 120000,
    platformFeeKobo: 32000,
    agentPayoutKobo: 280000,
    status: 'accepted',
  })
  await supabase.from('payments').insert({
    task_id: task6.id,
    quote_id: quote6.id,
    customer_id: customer1,
    provider: 'mock',
    reference: buildPaymentReference(task6.reference),
    amount_kobo: quote6.total_kobo,
    status: 'succeeded',
    paid_at: new Date().toISOString(),
  })
  await supabase.from('tasks').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', task6.id)
  await supabase.from('task_assignments').insert({
    task_id: task6.id,
    agent_id: agent1,
    assigned_by: adminId,
    status: 'active',
    agent_payout_kobo: quote6.agent_payout_kobo,
    accepted_at: new Date().toISOString(),
  })
  await supabase.from('tasks').update({ status: 'in_progress', assigned_at: new Date().toISOString() }).eq('id', task6.id)
  await supabase.from('task_messages').insert([
    {
      task_id: task6.id,
      sender_id: customer1,
      sender_role: 'customer',
      body: 'The documents are with the front desk, ask for Blessing.',
    },
    {
      task_id: task6.id,
      sender_id: agentUserIds[0],
      sender_role: 'agent',
      body: 'Got it, on my way now.',
    },
  ])

  // 7. Completed, with proof and a review.
  const task7 = await insertTask({
    customerId: customer2,
    categoryId: errands.id,
    title: 'Buy foodstuff from the market',
    description: 'Buy a list of foodstuff from Watt Market and deliver to my house in State Housing.',
    locationArea: 'Watt Market',
    locationAddress: 'Watt Market, Calabar',
  })
  const quote7 = await createQuote(task7.id, {
    serviceFeeKobo: 150000,
    transportFeeKobo: 100000,
    platformFeeKobo: 25000,
    agentPayoutKobo: 220000,
    status: 'accepted',
  })
  await supabase.from('payments').insert({
    task_id: task7.id,
    quote_id: quote7.id,
    customer_id: customer2,
    provider: 'mock',
    reference: buildPaymentReference(task7.reference),
    amount_kobo: quote7.total_kobo,
    status: 'succeeded',
    paid_at: new Date().toISOString(),
  })
  await supabase.from('tasks').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', task7.id)
  await supabase.from('task_assignments').insert({
    task_id: task7.id,
    agent_id: agent2,
    assigned_by: adminId,
    status: 'completed',
    agent_payout_kobo: quote7.agent_payout_kobo,
    accepted_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
  })
  await supabase.from('task_proofs').insert({
    task_id: task7.id,
    agent_id: agent2,
    submitted_by: agentUserIds[1],
    proof_type: 'receipt',
    note: 'Bought everything on the list, receipt attached.',
  })
  await supabase
    .from('tasks')
    .update({ status: 'completed', assigned_at: new Date().toISOString(), completed_at: new Date().toISOString() })
    .eq('id', task7.id)
  await supabase.from('reviews').insert({
    task_id: task7.id,
    customer_id: customer2,
    agent_id: agent2,
    rating: 5,
    comment: 'Very fast and got exactly what I asked for.',
  })

  // 8. Completed, then disputed.
  const task8 = await insertTask({
    customerId: customer3,
    categoryId: docs.id,
    title: 'Submit a form at the local government office',
    description: 'Submit my completed form at the local government secretariat and get a stamped copy back.',
    locationArea: 'Calabar Municipal',
    locationAddress: 'Calabar Municipal Local Government Secretariat',
  })
  const quote8 = await createQuote(task8.id, {
    serviceFeeKobo: 200000,
    transportFeeKobo: 80000,
    platformFeeKobo: 28000,
    agentPayoutKobo: 240000,
    status: 'accepted',
  })
  await supabase.from('payments').insert({
    task_id: task8.id,
    quote_id: quote8.id,
    customer_id: customer3,
    provider: 'mock',
    reference: buildPaymentReference(task8.reference),
    amount_kobo: quote8.total_kobo,
    status: 'succeeded',
    paid_at: new Date().toISOString(),
  })
  await supabase.from('task_assignments').insert({
    task_id: task8.id,
    agent_id: agent1,
    assigned_by: adminId,
    status: 'active',
    agent_payout_kobo: quote8.agent_payout_kobo,
    accepted_at: new Date().toISOString(),
  })
  await supabase
    .from('tasks')
    .update({ status: 'awaiting_confirmation', paid_at: new Date().toISOString(), assigned_at: new Date().toISOString() })
    .eq('id', task8.id)
  await supabase.from('task_proofs').insert({
    task_id: task8.id,
    agent_id: agent1,
    submitted_by: agentUserIds[0],
    proof_type: 'text',
    note: 'Form submitted at the secretariat, was told the stamped copy will be ready in a week.',
  })
  await supabase.from('disputes').insert({
    task_id: task8.id,
    raised_by: customer3,
    reason: 'missing_proof',
    description: 'I was told I would get a stamped copy back immediately, but the agent has no proof of submission.',
    status: 'open',
  })
  await supabase.from('tasks').update({ status: 'disputed' }).eq('id', task8.id)

  /* ------------------------------------------------------------------ */
  /* Notifications                                                       */
  /* ------------------------------------------------------------------ */

  console.log('→ Creating notifications…')
  await supabase.from('notifications').insert([
    {
      profile_id: customer1,
      type: 'task_submitted',
      title: 'Your request has been received',
      body: `We have "${task1.title}" (${task1.reference}). Operations is reviewing it.`,
      task_id: task1.id,
      link: `/tasks/${task1.id}`,
    },
    {
      profile_id: customer2,
      type: 'quote_received',
      title: 'Your quote is ready',
      body: `A quote for "${task3.title}" is ready for your review.`,
      task_id: task3.id,
      link: `/tasks/${task3.id}`,
    },
    {
      profile_id: customer2,
      type: 'quote_accepted',
      title: 'Quote accepted — payment needed',
      body: `Pay to release "${task4.title}" to a Go Agent.`,
      task_id: task4.id,
      link: `/tasks/${task4.id}`,
    },
    {
      profile_id: customer1,
      type: 'agent_assigned',
      title: 'Your Go Agent has been assigned',
      body: `Ime Bassey is handling "${task6.title}".`,
      task_id: task6.id,
      link: `/tasks/${task6.id}`,
      read_at: new Date().toISOString(),
    },
    {
      profile_id: customer2,
      type: 'task_completed',
      title: 'Task completed',
      body: `"${task7.title}" is complete. Rate your Go Agent.`,
      task_id: task7.id,
      link: `/tasks/${task7.id}`,
      read_at: new Date().toISOString(),
    },
    {
      profile_id: customer3,
      type: 'dispute_created',
      title: 'Your report was received',
      body: `We are reviewing your report on "${task8.title}".`,
      task_id: task8.id,
      link: `/tasks/${task8.id}`,
    },
    {
      profile_id: agentUserIds[0],
      type: 'agent_assigned',
      title: 'New task assigned to you',
      body: `You have been assigned "${task6.title}".`,
      task_id: task6.id,
      link: `/agent/tasks/${task6.id}`,
    },
    {
      profile_id: agentUserIds[2],
      type: 'agent_verification_updated',
      title: 'Verification submitted',
      body: 'Your verification is under review. We will let you know once it is complete.',
      link: '/agent/verification',
    },
  ])

  console.log('\n✓ Seed complete.\n')
  console.log('Demo accounts (password for all: ' + DEMO_PASSWORD + ')')
  console.log('  Admin:     ' + ADMIN_EMAIL)
  console.log('  Customer:  bassey.customer@conciergego.ng')
  console.log('  Customer:  ekaette.customer@conciergego.ng')
  console.log('  Customer:  chidi.customer@conciergego.ng')
  console.log('  Agent:     ime.agent@conciergego.ng   (verified)')
  console.log('  Agent:     grace.agent@conciergego.ng (verified)')
  console.log('  Agent:     sam.agent@conciergego.ng   (pending verification)')
  console.log('')
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\nSeed failed:\n', error)
    process.exit(1)
  })
