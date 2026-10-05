# Security policy

## Reporting a vulnerability

Email the address in [`/.well-known/security.txt`](https://your-domain.example/.well-known/security.txt)
(configured by `SECURITY_EMAIL`). Please include steps to reproduce and the impact you observed.

- We acknowledge reports within **3 working days** and aim to fix critical issues within **7 days**.
- Good-faith research that avoids privacy violations, data destruction and service disruption will
  not be pursued legally. Do not access other people's data, run denial-of-service tests, or
  social-engineer members or staff.
- We credit researchers who want to be credited.

## Supported versions

Only the latest `main` deployment is supported.

## Security architecture

See [`docs/BLUEPRINT.md` §7](docs/BLUEPRINT.md#7-security-architecture) for the full control list and
[`docs/OPERATIONS.md`](docs/OPERATIONS.md) for incident response.
