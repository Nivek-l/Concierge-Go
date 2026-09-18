import { NextResponse } from 'next/server'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(4096),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const parsed = subscriptionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })

  const { error } = await supabase.from('push_subscriptions').upsert({
    profile_id: user.id,
    endpoint: parsed.data.endpoint,
    p256dh_key: parsed.data.keys.p256dh,
    auth_key: parsed.data.keys.auth,
    user_agent: request.headers.get('user-agent'),
  }, { onConflict: 'endpoint' })
  if (error) return NextResponse.json({ error: 'Could not save subscription' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const endpoint = new URL(request.url).searchParams.get('endpoint')
  if (!endpoint) return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 })
  const { error } = await supabase.from('push_subscriptions').delete().eq('profile_id', user.id).eq('endpoint', endpoint)
  if (error) return NextResponse.json({ error: 'Could not remove subscription' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
