'use server'

import { confirmSignup, type SignupResult } from '@/lib/subscribe'

export async function confirmAction(
  _previous: SignupResult | null,
  form: FormData,
): Promise<SignupResult> {
  return confirmSignup(String(form.get('t') ?? ''))
}
