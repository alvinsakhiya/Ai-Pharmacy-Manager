# GitHub Repository Setup

Reference for the GitHub presentation of this repository. The **About
description** and **topics** below have been applied to the repository. The
remaining items (homepage, licence, release) are intentionally left as noted.

## Current GitHub state

- **Repository:** `alvinsakhiya/Ai-Pharmacy-Manager`
- **Visibility:** private
- **Default branch:** `main`
- **About description:** applied (see below)
- **Topics:** applied (see below)
- **Homepage:** blank — no deployed URL (do not use `localhost`)
- **Licence:** none specified. The README states no public licence is specified,
  so GitHub shows no licence. Add one only if you choose to.
- **Releases:** none published

## About description (applied)

> Secure pharmacy operations system for stock control, MDS/dosette workflows,
> expiry review, audit logging, backup/restore, and explainable stock
> intelligence.

## Topics (applied)

```
django
react
typescript
postgresql
docker
vite
tailwindcss
django-rest-framework
pharmacy-management
inventory-management
healthcare-operations
stock-control
audit-log
backup-restore
```

## Applying or editing metadata

Applied with the GitHub CLI:

```bash
gh repo edit alvinsakhiya/Ai-Pharmacy-Manager \
  --description "Secure pharmacy operations system for stock control, MDS/dosette workflows, expiry review, audit logging, backup/restore, and explainable stock intelligence." \
  --add-topic django --add-topic react --add-topic typescript --add-topic postgresql \
  --add-topic docker --add-topic vite --add-topic tailwindcss --add-topic django-rest-framework \
  --add-topic pharmacy-management --add-topic inventory-management --add-topic healthcare-operations \
  --add-topic stock-control --add-topic audit-log --add-topic backup-restore
```

To edit manually in the GitHub UI: open the repository home page → click the
**gear icon** next to **About** (top-right) → set the **Description**, add the
**Topics**, and leave **Website** blank → **Save changes**.

## Website / homepage

Leave blank unless a real deployed URL exists. Do not use `localhost`.

## Licence

No public licence is specified for this repository, so GitHub shows no licence.
Do not invent one. To publish under a licence later, add a `LICENSE` file (e.g.
via GitHub's **Add file → Create new file → LICENSE** template) and GitHub will
detect it automatically.

## Release

No release is published, and none should be published without explicit
confirmation. A ready-to-paste **draft** is in
[RELEASE_NOTES_DRAFT.md](RELEASE_NOTES_DRAFT.md). Publishing a release (and any
new tag such as `v1.0.0`) is a manual, confirmed step:

- **GitHub UI:** **Releases → Draft a new release**, choose or create a tag,
  paste the draft notes, and publish.
- **CLI (only when confirmed):**
  `gh release create v1.0.0 --title "v1.0.0 Final COM668 Demo Build" --notes-file docs/RELEASE_NOTES_DRAFT.md`

## Packages

No packages are published. The Docker images are built locally by
`docker compose` and are not pushed to a registry, and nothing is published to
npm or PyPI. Only publish images/packages if you deliberately set up a registry
and release pipeline.

## Tags and history

Existing `module-*` and `phase-*` tags are present in the repository. Inspect
them (read-only) before any release:

```bash
git tag --list --sort=-creatordate
git log --oneline --decorate --graph --all --max-count=40
gh release list --repo alvinsakhiya/Ai-Pharmacy-Manager
```

Do **not** delete or rewrite existing tags without explicit approval.

## Repository files (already present)

- `README.md` — project overview and setup
- `docs/` — the documentation set (project map, file manifest, API endpoints,
  database schema, deployment, security & data protection, backup/restore, demo
  database restore, forecasting/intelligence, diagrams, this GitHub setup guide,
  and the release notes draft)
- `.env.example` — environment template
- `.github/workflows/` — CI (lint, type-check, tests) and E2E workflows
