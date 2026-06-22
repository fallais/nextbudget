<!--
Thanks for contributing to BanqueJS!
⚠️ Make sure no real bank/transaction data or .db files are included in this PR.
-->

## Summary
What does this PR change and why?

## Related issue
Closes #

## Checklist
- [ ] `npm run lint && npm run typecheck && npm test && npm run build` all pass
- [ ] No personal/financial data, DB dumps, or credentials committed
- [ ] Code/identifiers in English; UI text in French
- [ ] Schema changes done via TypeORM entities (`lib/db/entities.ts`); no migration files
- [ ] New API routes `export const runtime = 'nodejs'`
- [ ] Amounts handled as signed integer cents (formatted only at the UI edge)
