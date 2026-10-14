# Security policy

## Supported versions

| Version | Supported |
| --- | --- |
| 1.x (latest release) | ✅ |
| Older versions | ❌ Please update first |

## Reporting a vulnerability

**Do not open a public issue for a security problem.**

Report it privately through GitHub: go to the
[Security tab → Report a vulnerability](https://github.com/LouziAmine/ScanReceipt/security/advisories/new).
Only the maintainers can read the report.

Please include:
- the affected version and platform (Android, iOS, version);
- what an attacker could do, and the steps to reproduce it;
- a proof of concept if you have one.

What happens next:
- we acknowledge your report within **7 days**;
- we keep you updated while we investigate;
- once a fix is released, we publish an advisory and credit you, unless you prefer to stay anonymous.

## Scope

ScanReceipt has no server: everything runs on the phone. Relevant issues include, for example:
- data leaving the device without the person's action;
- access to receipts or photos by another app;
- a crafted backup ZIP or image that corrupts data or runs code;
- CSV or PDF exports that can harm the person who opens them;
- secrets or signing keys exposed in the repository or the CI.

Out of scope: issues that need a rooted or jailbroken device, or physical access to an unlocked phone.
