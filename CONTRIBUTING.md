# Contributing to LegacyLink

Thanks for taking the time to contribute! 🇨🇦

## Ground rules

- Be kind. We follow the [Code of Conduct](CODE_OF_CONDUCT.md).
- Keep PRs small and focused. One change per PR.
- All contributions are licensed under the project's [MIT License](LICENSE).

## Development setup

```bash
bun install
cp .env.example .env   # populate as described in the README
bun run dev
```

## Branching

- `main` — always deployable.
- Feature branches: `feat/<short-description>`.
- Fixes: `fix/<short-description>`.
- Docs: `docs/<short-description>`.

## Commit style

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(vault): add inactivity-based release condition
fix(auth): handle expired refresh tokens
docs(readme): clarify devnet setup
```

## Before opening a PR

- [ ] `bun run lint` passes
- [ ] `bun run build` succeeds
- [ ] New code has types (no `any` unless justified)
- [ ] UI changes include screenshots or a short recording
- [ ] DB changes ship as a SQL migration in `db/migrations/`
- [ ] Sensitive logic stays server-side (`*.server.ts` / `createServerFn`)
- [ ] RLS policies updated for any new tables

## Reporting bugs

Open a [GitHub issue](../../issues) with:

- What happened vs. what you expected
- Steps to reproduce
- Browser / OS / Node version
- Console + network logs if relevant

## Security issues

Please **do not** open a public issue for vulnerabilities. See [SECURITY.md](SECURITY.md).

## Reviewing & merging

- At least one maintainer approval is required.
- Squash-merge is the default to keep `main` history clean.

Thanks again — every PR makes LegacyLink better for Canadian families.
