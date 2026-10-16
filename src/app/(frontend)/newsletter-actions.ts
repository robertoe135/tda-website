'use server'

import { type SignupResult, subscribe } from '@/lib/mailchimp'

export async function subscribeAction(_previous: SignupResult | null, form: FormData): Promise<SignupResult> {
  if (String(form.get('website') ?? '')) return { ok: true } // bots fill the hidden field
  return subscribe(String(form.get('email') ?? ''))
}
