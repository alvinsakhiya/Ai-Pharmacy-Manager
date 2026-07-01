# Release notes — draft (not published)

> **This is a draft.** No GitHub release has been published and no new tag has
> been created. Publish only after explicit confirmation. See
> [GITHUB_REPO_SETUP.md](GITHUB_REPO_SETUP.md) for how to publish.

## v1.0.0 Final COM668 Demo Build

### Highlights

- Role-based pharmacy operations
- PostgreSQL runtime database
- Patient record and MDS/dosette workflow
- Inventory and batch/expiry tracking
- Stock intelligence with explainable review signals
- Encrypted backup archive support
- Audit logging and reports
- Docker Compose setup
- Demo database restore guide

### Setup

- `cp .env.example .env`, then `docker compose up --build`.
- `docker compose exec backend python manage.py migrate`
- `docker compose exec backend python manage.py seed_demo` (fictional demo data),
  or restore the demo database — see
  [DEMO_DATABASE_RESTORE.md](DEMO_DATABASE_RESTORE.md).
- Frontend: <http://localhost:5173> · Backend: <http://localhost:8000>

### Notes and honest limitations

- Uses fictional/synthetic demo data only. No NHS/NCRS integration, clinical
  diagnosis, clinical recommendations, automatic ordering/transfer/dispensing,
  guaranteed forecasts, or compliance claims.
- The stock intelligence is explainable, deterministic arithmetic
  (moving-average forecasting, FEFO expiry, deterministic MDS demand, additive
  review scoring, transfer-opportunity review, confidence labels); every output
  is advisory and requires human review.
- Patient identifier fields use application-level field encryption at rest (the
  server can decrypt for search/reports) — this is not end-to-end database
  encryption. Backup archives use AES-256-GCM.
- The Docker Compose setup is development-oriented; a production deployment needs
  a WSGI/ASGI server and a built static frontend (see
  [DEPLOYMENT.md](DEPLOYMENT.md)).
