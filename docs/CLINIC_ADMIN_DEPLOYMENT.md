# Clinic administration deployment

## What this release adds

- Clinic profile, logo, contact details, colors and a unique URL slug.
- Clinic routes such as https://woundheal.ai/c/clinic-name/dashboard.
- Email destinations, regional defaults, clinical defaults and security-policy settings.
- Staff role changes, pending invitations, access revocation and password-reset emails.
- Protection against removing the final active clinic administrator.
- Audit records for clinic settings, integrations and membership changes.
- Email, SMS/WhatsApp, EHR/FHIR and AI integration metadata. Actual keys are never stored in browser fields.

## 1. Apply the database migration

In Supabase SQL Editor, run the complete file:

supabase/migrations/20260822050000_add_clinic_admin_foundations.sql

Run the whole file in one query. It depends on functions created earlier in the same migration.

## 2. Configure Vercel

Add these server environment variables for Production, Preview and Development:

- SUPABASE_URL: the project URL from Supabase Project Settings > API.
- SUPABASE_ANON_KEY: the public anon/publishable key from the same page.
- SUPABASE_SERVICE_ROLE_KEY: the secret service-role key. Never prefix this with VITE_ and never expose it in frontend code.

Redeploy after changing environment variables.

## 3. Configure Supabase authentication URLs

In Supabase Authentication > URL Configuration:

- Site URL: https://woundheal.ai
- Add redirect URL: https://woundheal.ai/**
- Keep http://localhost:5173/** only for local development.

This is required for invitations and password-reset links.

## 4. Set up a clinic

Sign in as a clinic administrator, open Clinic Settings, and save:

1. Profile and branding.
2. Email and alert destinations.
3. Security and clinical defaults.
4. Integration metadata.

Changing the slug changes the canonical clinic route. Existing role URLs still open and are automatically replaced with the clinic URL.

## 5. Add staff safely

Open Staff:

- Existing user: search their email, choose a role, then add them.
- New user: search their email, choose a role, and send an invitation.
- Invited users remain inactive. After they accept and their identity is verified, use Reactivate to grant clinic access.
- Revoke clinic access makes tenant-protected database requests fail immediately. It does not delete the person or their clinical history.
- Send password reset is restricted to accounts already linked to the clinic.

The database rejects any change that would leave the clinic without an active administrator.

## Integration secrets

The integration screen stores only endpoint/status/reference metadata. Put real secrets in Vercel environment variables for platform-wide services or Supabase Vault for future clinic-specific server integrations. Do not paste API keys into notes, endpoint fields, or any VITE_ variable.
