# Security Policy

## Supported versions

LegacyLink is in active development on **Solana devnet**. Only the `main` branch receives security updates.

| Version | Supported |
| ------- | --------- |
| `main`  | ✅        |
| others  | ❌        |

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Instead, email **security@legacylink.app** (or open a private GitHub Security Advisory) with:

- A description of the issue and its potential impact
- Steps to reproduce (proof-of-concept welcome)
- Your name / handle for credit (optional)

We aim to:

- Acknowledge your report within **72 hours**
- Provide a remediation plan within **7 days**
- Ship a fix and credit you (if desired) once resolved

## Scope

In scope:

- Authentication, session, and RLS bypasses
- Custodial wallet key handling
- Server function authorization (`createServerFn` middleware)
- Webhook signature verification
- Smart-contract / Anchor program logic

Out of scope:

- Findings against third-party services (report to them directly)
- Social engineering, physical attacks, DoS volume tests
- Issues only reproducible with outdated dependencies

Thank you for helping keep Canadian families safe.
