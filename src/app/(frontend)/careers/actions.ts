'use server'

import { headers } from 'next/headers'

import { type ApplicationResult, submitApplication } from '@/lib/careers'
import { getPayloadClient } from '@/lib/projects'

export async function applyAction(_previous: ApplicationResult | null, form: FormData): Promise<ApplicationResult> {
  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown'
  return submitApplication(await getPayloadClient(), form, ip)
}
