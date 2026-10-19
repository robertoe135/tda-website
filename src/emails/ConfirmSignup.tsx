import React from 'react'
import { Body, Container, Head, Html, Img, Link, Preview, render, Section, Text } from 'react-email'

import { siteUrl } from '../lib/seo'

/** The email a newsletter sign-up receives: one link to confirm (lib/subscribe.ts). */

const FONT = "'DM Sans', Helvetica, Arial, sans-serif"
const text = (extra: React.CSSProperties = {}): React.CSSProperties => ({
  margin: 0,
  fontFamily: FONT,
  fontSize: 15,
  lineHeight: '24px',
  fontWeight: 300,
  color: '#000000',
  ...extra,
})

export function ConfirmSignupEmail({ link, site = siteUrl() }: { link: string; site?: string }) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Confirm your subscription to the Tillotson Design Associates newsletter.</Preview>
      <Body style={{ margin: 0, padding: '24px 0 40px', backgroundColor: '#ececea' }}>
        <Container style={{ width: '100%', maxWidth: 520, backgroundColor: '#ffffff' }}>
          <Section style={{ padding: '36px 40px 40px' }}>
            <Img
              src={`${site}/tda-logo-email.png`}
              alt="Tillotson Design Associates"
              width={87}
              height={36}
              style={{ display: 'block', height: 36, width: 'auto', border: 0 }}
            />
            <Text style={text({ marginTop: 32, fontSize: 22, lineHeight: '28px' })}>
              Confirm your subscription
            </Text>
            <Text style={text({ marginTop: 14 })}>
              Someone, hopefully you, asked to receive the Tillotson Design Associates newsletter at
              this address.
            </Text>
            <Section style={{ marginTop: 24 }}>
              <Link
                href={link}
                style={{
                  display: 'inline-block',
                  padding: '12px 22px',
                  backgroundColor: '#000000',
                  color: '#ffffff',
                  fontFamily: FONT,
                  fontSize: 14,
                  textDecoration: 'none',
                }}
              >
                Confirm subscription
              </Link>
            </Section>
            <Text
              style={text({ marginTop: 24, fontSize: 13, lineHeight: '20px', color: '#595959' })}
            >
              The link works for 7 days. If you didn’t sign up, ignore this email: nothing changes.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export async function renderConfirmEmail(link: string) {
  const element = <ConfirmSignupEmail link={link} />
  const [html, plain] = await Promise.all([render(element), render(element, { plainText: true })])
  return { html, text: plain }
}
