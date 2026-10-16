import { RichText } from '@payloadcms/richtext-lexical/react'
import type { Metadata } from 'next'

import { formatAddress, getSettings } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Contact — Tillotson Design Associates',
  description: 'Address, phone and email for Tillotson Design Associates, New York.',
  alternates: { canonical: '/contact' },
}

/** Contact details from Site settings in the admin. */
export default async function ContactPage() {
  const settings = await getSettings()
  const address = settings.address ? formatAddress(settings.address) : undefined
  const sameEmail = settings.generalEmail && settings.generalEmail === settings.pressEmail
  return (
    <div className="contact">
      <h1 className="page-title">Contact</h1>
      {settings.intro && <p className="contact-intro">{settings.intro}</p>}
      <dl className="contact-list">
        {address && address.lines.length > 0 && (
          <div>
            <dt>Address</dt>
            <dd>
              <address>
                {address.lines.map((l) => (
                  <span key={l} className="contact-line">
                    {l}
                  </span>
                ))}
              </address>
              {address.directions && (
                <a href={address.directions} rel="noopener" className="contact-action">
                  Get Directions →
                </a>
              )}
            </dd>
          </div>
        )}
        {settings.phone && (
          <div>
            <dt>Phone</dt>
            <dd>
              <a href={`tel:+1${settings.phone.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '')}`}>{settings.phone}</a>
            </dd>
          </div>
        )}
        {settings.generalEmail && (
          <div>
            <dt>{sameEmail ? 'General Information & Press Inquiries' : 'General Information'}</dt>
            <dd>
              <a href={`mailto:${settings.generalEmail}`}>{settings.generalEmail}</a>
            </dd>
          </div>
        )}
        {settings.pressEmail && !sameEmail && (
          <div>
            <dt>Press Inquiries</dt>
            <dd>
              <a href={`mailto:${settings.pressEmail}`}>{settings.pressEmail}</a>
            </dd>
          </div>
        )}
      </dl>
      {settings.careersText && (
        <section className="contact-careers" aria-labelledby="careers">
          <h2 id="careers" className="section-heading">
            Careers at TDA
          </h2>
          <div className="project-description">
            <RichText data={settings.careersText} />
          </div>
          {settings.careersLink && (
            <a href={settings.careersLink} rel="noopener" className="contact-action">
              Apply →
            </a>
          )}
        </section>
      )}
    </div>
  )
}
