## What & why

## Security checklist
- [ ] New/changed routes use `defineRoute()` with the narrowest auth policy (route-coverage test passes)
- [ ] All input validated by a Zod schema; no raw SQL string building
- [ ] Object-level authorization: queries are scoped to the actor (no IDOR)
- [ ] No user-generated text in emails; no new third-party scripts (CSP)
- [ ] Personal data: minimal, covered by the privacy policy and the export/delete flows
- [ ] Tests added (benign + abusive cases for anything content-related)

## Migration
- [ ] None, or forward-only and backwards-compatible (expand → migrate → contract)
