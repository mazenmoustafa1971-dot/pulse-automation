# PULSE Security Incident Response Policy

Last updated: August 22, 2026

## What counts as an incident
Any of the following involving PULSE's systems (Railway app, Supabase database,
Shopify API credentials, or WhatsApp Cloud API credentials):
- Unauthorized access to the Supabase database or its service_role key
- Unauthorized access to a merchant's Shopify access token
- A leaked or exposed API key/secret (Shopify, Supabase, WhatsApp)
- Evidence of data exfiltration or tampering
- A vulnerability that could allow any of the above (e.g. an auth bypass)

## Immediate response (first 24 hours)
1. **Contain**: rotate the affected credential immediately.
   - Supabase keys: Project Settings -> API -> regenerate.
   - Shopify: revoke the app's access token for the affected shop(s) via the
     Partner Dashboard, or uninstall/reinstall to force a new token.
   - WhatsApp: regenerate the Cloud API access token in Meta Business Suite.
2. **Assess scope**: check Railway deploy logs and Supabase logs for the
   affected time window to determine which shops/customers were exposed.
3. **Stop the bleeding**: if the vulnerability is in PULSE's own code, deploy
   a fix before restoring full service.

## Notification (within 72 hours of confirming the incident)
- Notify every affected merchant by email at the address on their Shopify
  account, describing what happened, what data was involved, and what
  action was taken.
- If the incident involves EU/UK customer data and meets GDPR's breach
  notification threshold, notify the relevant supervisory authority within
  72 hours of becoming aware, per Article 33.

## Post-incident
- Document what happened, root cause, and the fix in this repo's commit
  history with a clear commit message.
- Add a regression check (test, assertion, or monitoring) so the same class
  of incident can't recur silently.

## Contact
Security concerns or suspected incidents: arkan.closerver@gmail.com
