'use server'

import { type SignupResult, startSignup } from '@/lib/subscribe'

export async function subscribeAction(
  _previous: SignupResult | null,
  form: FormData,
): Promise<SignupResult> {
  if (String(form.get('website') ?? '')) return { ok: true } // bots fill the hidden field
  return startSignup(String(form.get('email') ?? ''))
}
