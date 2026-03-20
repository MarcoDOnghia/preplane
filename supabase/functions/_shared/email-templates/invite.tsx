/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({ siteName, siteUrl, confirmationUrl }: InviteEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You've been invited to PrepLane</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>🚀 PrepLane</Text>
        <Heading style={h1}>You're invited!</Heading>
        <Text style={text}>
          Someone invited you to join{' '}
          <Link href={siteUrl} style={link}><strong>PrepLane</strong></Link>.
          Click below to accept and create your account.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Accept invitation
        </Button>
        <Text style={footer}>
          Wasn't expecting this? You can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '32px 28px' }
const brand = { fontSize: '18px', fontWeight: 'bold' as const, color: '#F97316', margin: '0 0 24px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1a1a1a', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#64748b', lineHeight: '1.6', margin: '0 0 20px' }
const link = { color: '#F97316', textDecoration: 'underline' }
const button = { backgroundColor: '#F97316', color: '#ffffff', fontSize: '14px', fontWeight: 'bold' as const, borderRadius: '12px', padding: '12px 24px', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#94a3b8', margin: '32px 0 0' }
