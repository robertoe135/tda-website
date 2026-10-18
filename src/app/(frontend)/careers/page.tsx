import { RichText } from '@payloadcms/richtext-lexical/react'
import type { Metadata } from 'next'

import { ApplicationForm } from '@/components/ApplicationForm'
import { Breadcrumb } from '@/components/Breadcrumb'
import { formIssuedAt, MAX_CV_MB } from '@/lib/careers'
import { getSettings } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Careers — Tillotson Design Associates',
  description:
    'Apply to join Tillotson Design Associates, architectural lighting design, New York.',
  alternates: { canonical: '/careers' },
}

/** Careers text from Site settings, then the application form. */
export default async function CareersPage() {
  const settings = await getSettings()
  return (
    <div className="careers">
      <Breadcrumb trail={[{ href: '/contact', label: 'contact' }]} current="careers" />
      <h1 className="page-title page-title-large">Careers at TDA</h1>
      <div className="careers-grid">
        {settings.careersText && (
          <div className="contact-careers-text">
            <RichText data={settings.careersText} />
          </div>
        )}
        <ApplicationForm startedAt={formIssuedAt()} maxMb={MAX_CV_MB} />
      </div>
    </div>
  )
}
