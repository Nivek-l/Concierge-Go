'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { getAppUrl } from '@/lib/env'
import { logError, toUserMessage } from '@/lib/errors'
import { createClient } from '@/lib/supabase/server'
import { homeForRole } from '@/lib/supabase/middleware'
import {
  agentSignUpSchema,
  fieldErrorsFrom,
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from '@/lib/validations'
import { actionError, actionOk, type ActionResult } from '@/types/domain'
import type { UserRole } from '@/types/database'

/**
 * Authentication actions.
 *
 * The role travels in user metadata and is clamped by the database signup
 * trigger to customer or agent — becoming an admin through this path is
 * impossible.
 */

function readForm(formData: FormData) {
  return Object.fromEntries(formData.entries())
}

export type SignUpResult = ActionResult<{ email: string; needsConfirmation: boolean }>

export async function signUpAction(
  _prev: SignUpResult | null,
  formData: FormData,
): Promise<SignUpResult> {
  const raw = readForm(formData)
  const parsed = signUpSchema.safeParse({
    ...raw,
    acceptTerms: raw.acceptTerms === 'on' || raw.acceptTerms === 'true',
  })

  if (!parsed.success) {
    return actionError('Please check the details below.', {
      fieldErrors: fieldErrorsFrom(parsed.error),
    })
  }

  const input = parsed.data

  try {
    const supabase = await createClient()

    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        emailRedirectTo: `${getAppUrl()}/auth/callback`,
        data: {
          full_name: input.fullName,
          phone: input.phone,
          role: 'customer',
          city_slug: input.citySlug,
          default_area: input.area ?? '',
        },
      },
    })

    if (error) {
      if (error.message.toLowerCase().includes('already registered')) {
        return actionError('An account with that email already exists. Sign in instead.')
      }
      return actionError(error.message)
    }

    // With email confirmation enabled there is no session yet.
    const needsConfirmation = !data.session

    return actionOk(
      { email: input.email, needsConfirmation },
      needsConfirmation ? 'Check your email to confirm your account.' : 'Welcome to Concierge Go.',
    )
  } catch (error) {
    logError('auth.signUp', error)
    return actionError(toUserMessage(error, 'We could not create your account. Please try again.'))
  }
}

export async function agentSignUpAction(
  _prev: SignUpResult | null,
  formData: FormData,
): Promise<SignUpResult> {
  const raw = readForm(formData)
  const parsed = agentSignUpSchema.safeParse({
    ...raw,
    acceptTerms: raw.acceptTerms === 'on' || raw.acceptTerms === 'true',
  })

  if (!parsed.success) {
    return actionError('Please check the details below.', {
      fieldErrors: fieldErrorsFrom(parsed.error),
    })
  }

  const input = parsed.data

  try {
    const supabase = await createClient()

    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        emailRedirectTo: `${getAppUrl()}/auth/callback`,
        data: {
          full_name: input.fullName,
          phone: input.phone,
          role: 'agent',
          city_slug: input.citySlug,
          default_area: input.area ?? '',
          transport_mode: input.transportMode,
        },
      },
    })

    if (error) {
      if (error.message.toLowerCase().includes('already registered')) {
        return actionError('An account with that email already exists. Sign in instead.')
      }
      return actionError(error.message)
    }

    return actionOk(
      { email: input.email, needsConfirmation: !data.session },
      !data.session
        ? 'Check your email to confirm your account, then complete verification.'
        : 'Account created. Complete your verification to start receiving tasks.',
    )
  } catch (error) {
    logError('auth.agentSignUp', error)
    return actionError(toUserMessage(error, 'We could not create your account. Please try again.'))
  }
}

export type SignInResult = ActionResult<{ redirectTo: string }>

export async function signInAction(
  _prev: SignInResult | null,
  formData: FormData,
): Promise<SignInResult> {
  const parsed = signInSchema.safeParse(readForm(formData))

  if (!parsed.success) {
    return actionError('Enter your email and password.', {
      fieldErrors: fieldErrorsFrom(parsed.error),
    })
  }

  const nextParam = String(formData.get('next') ?? '')

  try {
    const supabase = await createClient()

    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    })

    if (error) {
      // Deliberately vague — never reveal whether the email exists.
      return actionError('That email and password combination is not correct.')
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_suspended')
      .eq('id', data.user.id)
      .maybeSingle()

    if (profile?.is_suspended) {
      await supabase.auth.signOut()
      return actionError(
        'This account is suspended. Contact Concierge Go operations to restore access.',
      )
    }

    // Only internal redirects — never bounce to an external URL.
    const safeNext = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : null
    const redirectTo = safeNext ?? homeForRole((profile?.role ?? 'customer') as UserRole)

    revalidatePath('/', 'layout')
    return actionOk({ redirectTo })
  } catch (error) {
    logError('auth.signIn', error)
    return actionError(toUserMessage(error, 'We could not sign you in. Please try again.'))
  }
}

export async function signOutAction() {
  try {
    const supabase = await createClient()
    await supabase.auth.signOut()
  } catch (error) {
    logError('auth.signOut', error)
  }
  revalidatePath('/', 'layout')
  redirect('/')
}

export type ForgotPasswordResult = ActionResult<{ sent: boolean }>

export async function forgotPasswordAction(
  _prev: ForgotPasswordResult | null,
  formData: FormData,
): Promise<ForgotPasswordResult> {
  const parsed = forgotPasswordSchema.safeParse(readForm(formData))

  if (!parsed.success) {
    return actionError('Enter a valid email address.', {
      fieldErrors: fieldErrorsFrom(parsed.error),
    })
  }

  try {
    const supabase = await createClient()
    await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${getAppUrl()}/auth/callback?next=/reset-password`,
    })
  } catch (error) {
    logError('auth.forgotPassword', error)
  }

  // Same response either way, so this cannot be used to enumerate accounts.
  return actionOk({ sent: true }, 'If an account exists for that email, a reset link is on its way.')
}

export type ResetPasswordResult = ActionResult<{ done: boolean }>

export async function resetPasswordAction(
  _prev: ResetPasswordResult | null,
  formData: FormData,
): Promise<ResetPasswordResult> {
  const parsed = resetPasswordSchema.safeParse(readForm(formData))

  if (!parsed.success) {
    return actionError('Please check the passwords below.', {
      fieldErrors: fieldErrorsFrom(parsed.error),
    })
  }

  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return actionError('This reset link has expired. Request a new one.')
    }

    const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
    if (error) return actionError(error.message)

    return actionOk({ done: true }, 'Your password has been updated.')
  } catch (error) {
    logError('auth.resetPassword', error)
    return actionError(toUserMessage(error, 'We could not update your password.'))
  }
}
