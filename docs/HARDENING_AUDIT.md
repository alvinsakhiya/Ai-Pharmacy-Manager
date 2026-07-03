# Hardening Audit

**Audit date:** 2026-07-03  
**Repository commit:** `c36da4f` (`c36da4f15506886c0d5152fdb1293a8c7c957e3d`)  
**Scope:** full repository — Django settings, authentication, RBAC/scoping, API serializers, frontend, Docker/deployment, backups/encryption, tests/dependencies, and documentation.  
**Data policy:** synthetic/demo data only; no real patient data.

## Method

A structured multi-lens review was run across the nine areas above against the code at the commit named. Each `blocker`/`high` finding was then independently re-checked against the actual source to confirm it is real and correctly rated (over-stated findings were downgraded or dropped). Every finding below cites a concrete `file:line`. This audit is read-only; no code was changed in this phase.

## Severity legend

| Severity | Meaning |
| --- | --- |
| **blocker** | Must be fixed before any public deployment. |
| **high** | Serious weakness for a public (synthetic-data) demo. |
| **medium** | Should be fixed as part of hardening. |
| **low** | Minor; fix opportunistically. |
| **informational** | Recorded for awareness / future work. |

## Summary

**77 findings** — blocker: 0, high: 2, medium: 27, low: 26, informational: 22.

The project has a strong security foundation (see **Strengths**). There are **no blockers**. The two high-severity items are a fail-open server entrypoint default and demo-account guidance, both safe to fix. Most remaining items are production-deployment hardening and documentation accuracy, tracked through the later phases of this work.

## Strengths (already implemented well)

- **Production fail-fast:** `prod.py` raises `ImproperlyConfigured` if `DJANGO_SECRET_KEY`, `PATIENT_FIELD_KEY`, or `PATIENT_INDEX_KEY` is unset, blank, **or left at the committed dev default** — pasting the dev fallbacks into production cannot pass.
- **Encrypted backups:** AES-256-GCM authenticated encryption; key from env, never logged/serialised; wrong key / corrupt file rejected before any destructive restore step; admin-only restore with typed `RESTORE` confirmation and a pre-restore safety backup; user rows and password hashes excluded.
- **Field encryption:** patient identifiers and note bodies use Fernet application-level encryption at rest with an HMAC blind index for search; production requires real keys.
- **Deny-by-default API:** DRF configured with session auth only (CSRF-enforced) and `IsAuthenticated` globally; RBAC via role capabilities plus tenant scoping; a scoped login throttle and a CSRF bootstrap endpoint.
- **Hardened env helpers:** `env_bool` treats a present-but-empty value as the default (a blank var cannot silently disable `BACKUP_ENCRYPTION_REQUIRED`); `BACKUP_ROOT` uses `or` so an empty value cannot resolve to the working directory.
- **Small attack surface:** the Django admin is not routed; no media is URL-served (no `MEDIA_URL`/`static()` helper, no `FileField`); secure `HttpOnly`+`SameSite=Lax` cookies, and production forces secure cookies + HSTS + SSL redirect.
- **PostgreSQL everywhere:** runtime, deployment, and the test suite run on PostgreSQL; SQLite appears only as an optional isolated test override.

## High findings (2)

### [Settings & configuration] WSGI/ASGI entrypoints default to dev settings (fail-open), bypassing all prod guards · **verified**

- **Where:** `backend/config/wsgi.py:5`
- **Finding:** backend/config/wsgi.py:5 and backend/config/asgi.py:5 use os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev"). A gunicorn/uvicorn deployment that forgets to export DJANGO_SETTINGS_MODULE silently boots dev.py, which unconditionally sets DEBUG=True (dev.py:3) and inherits the committed fallbacks SECRET_KEY="unsafe-development-key" (base.py:29) and the published dev Fernet key PATIENT_FIELD_KEY_DEV_DEFAULT (base.py:32-33). Every fail-fast guard lives only in prod.py (lines 9-16), so none of them fire. The system fails open on the most likely misconfiguration.
- **Recommendation:** Make the server entrypoints fail safe: default wsgi.py/asgi.py to "config.settings.prod" (or raise if DJANGO_SETTINGS_MODULE is unset), keeping the dev default only in manage.py. This is safe today because manage.py sets the env var before runserver imports config.wsgi, and .env.example line 4 already sets DJANGO_SETTINGS_MODULE=config.settings.dev for docker-compose.
- **Fix:** Safe to fix now

### [Documentation] Docs publish a shared global-admin demo password but the production/public-demo checklist never says to rotate or disable demo accounts · **verified**

- **Where:** `README.md:151`
- **Finding:** README.md:151, docs/DEMO_DATABASE_RESTORE.md:122, docs/demo-evidence.md:21 and docs/demo-script.md:35 all publish the shared password `DemoPass!2026` for five accounts including `admin@demo.local` (global admin, can restore/delete backups, create users). The demo-restore flow (docs/DEMO_DATABASE_RESTORE.md) loads these users from the SQL dump with that password. docs/DEPLOYMENT.md's 'Production checklist' (lines 103-123) covers keys, TLS, hosts and backups but contains no step to change the demo password, deactivate demo accounts, or reseed with a per-deployment password before exposing the app publicly. seed_demo is dev-gated (`--force` required when DEBUG=False, backend/apps/core/management/commands/seed_demo.py:414), which helps, but the pg_dump restore path bypasses that gate entirely.
- **Recommendation:** Add an explicit checklist item to docs/DEPLOYMENT.md (and a warning in docs/DEMO_DATABASE_RESTORE.md): before any internet-reachable deployment, rotate or deactivate all @demo.local accounts (or make the seed password env-configurable). The existing '> Demo-only credentials — do not use in production' note is not an actionable instruction.
- **Fix:** Safe to fix now

## Medium findings (27)

### [Settings & configuration] No LOGGING configuration; with DEBUG=False errors and security events vanish

- **Where:** `backend/config/settings/base.py:1`
- **Finding:** There is no LOGGING dict anywhere in backend/config/settings/ (verified by grep across base.py/dev.py/prod.py and the apps tree). Django's default logging routes django/django.security records to a console handler filtered by RequireDebugTrue and to AdminEmailHandler filtered by RequireDebugFalse. Since ADMINS is not set, running with prod.py (DEBUG=False) means unhandled 500 tracebacks, DisallowedHost warnings, and django.security.* events are dropped silently — no operational or security visibility for a public demo.
- **Recommendation:** Add an explicit LOGGING config in base.py (or prod.py) with a console StreamHandler (no require_debug_true filter) for the "django" and "django.security" loggers at INFO/WARNING, so container stdout captures errors and security warnings.
- **Fix:** Safe to fix now

### [Settings & configuration] Default BACKUP_ROOT places database backups inside MEDIA_ROOT

- **Where:** `backend/config/settings/base.py:125`
- **Finding:** BACKUP_ROOT defaults to MEDIA_ROOT/"backups" (base.py:125), and apps/backups/services.py:69 has a parallel fallback to Path(BASE_DIR)/"media"/"backups". Backups contain full database dumps including patient fields. Today nothing serves media (no MEDIA_URL, no static() helper in config/urls.py, no FileField/ImageField anywhere — verified by grep), so there is no current exposure; but /media is the conventional directory a reverse proxy is pointed at, so the first nginx block that serves media in a public deployment would make backup archives downloadable. Mitigated by BACKUP_ENCRYPTION_REQUIRED defaulting True in prod (prod.py:20).
- **Recommendation:** Move the default backup location outside MEDIA_ROOT (e.g. BASE_DIR/"backups" or a /var/lib path) and keep the two fallbacks (settings and services.py) in sync; consider requiring an explicit BACKUP_ROOT in prod.
- **Fix:** Safe to fix now

### [Authentication & accounts] must_change_password is never enforced server-side; flagged users can use the API indefinitely

- **Where:** `backend/apps/accounts/models.py:43`
- **Finding:** The flag is set (models.py:43 default True; user_views.py:138 on admin reset; serializers.py:117 on create), cleared on password change (views.py:117), and surfaced in payloads (views.py:36) — but a grep of the whole backend shows no middleware or DRF permission class that ever checks it. Enforcement exists only client-side (frontend/src/app/ProtectedRoute.tsx:25 and frontend/src/app/AppRouter.tsx:54 redirect to /change-password). A user with must_change_password=True who calls the API directly (curl/Postman) can exercise every endpoint their role allows, forever, on the admin-issued temporary password. LoginView (views.py:64-80) also logs such users in with a full session and full permissions payload.
- **Recommendation:** Add a DRF permission class (or middleware) applied via DEFAULT_PERMISSION_CLASSES that returns 403 for authenticated users with must_change_password=True on all endpoints except an allow-list (auth/login, auth/logout, auth/me, auth/password/change, auth/csrf). Add tests mirroring test_auth_api.py that a flagged user gets 403 on e.g. /api/patients/ and 200 on /api/auth/password/change/.
- **Fix:** Safe to fix now

### [Authentication & accounts] Login throttle is bypassable via spoofed X-Forwarded-For and is per-process (LocMem cache)

- **Where:** `backend/config/settings/base.py:143`
- **Finding:** LoginView uses ScopedRateThrottle scope 'login' at 10/min (views.py:61-62, base.py:143-145). Two verified weaknesses: (1) DRF's SimpleRateThrottle.get_ident uses the client-supplied X-Forwarded-For header verbatim when NUM_PROXIES is unset (verified in .venv rest_framework/throttling.py:23-40, and no NUM_PROXIES setting exists anywhere in the repo) — an attacker rotating XFF values gets a fresh throttle bucket per value, fully bypassing brute-force protection when the app is reachable directly or behind a proxy that appends rather than overwrites XFF; (2) no CACHES setting is defined anywhere, so throttle counters live in the default LocMemCache — per-process and reset on restart, so under a multi-worker server the effective rate is 10/min x workers and counters vanish on redeploy.
- **Recommendation:** At public-demo deploy time: set REST_FRAMEWORK NUM_PROXIES to match the proxy topology (and have the proxy overwrite X-Forwarded-For), and configure a shared cache backend (Redis or database) for throttling. Consider account-keyed lockout (e.g., django-axes) in addition to IP throttling.
- **Fix:** Deployment-dependent / future work

### [Authentication & accounts] validate_password() called without the user argument — UserAttributeSimilarityValidator is a silent no-op

- **Where:** `backend/apps/accounts/serializers.py:22`
- **Finding:** All three password-accepting serializers call validate_password(value) with no user: PasswordChangeSerializer (serializers.py:21-23), UserCreateSerializer (serializers.py:64-66), PasswordResetSerializer (serializers.py:147-149). AUTH_PASSWORD_VALIDATORS includes UserAttributeSimilarityValidator (base.py:104-109), which does nothing when user is None. Concretely, a user can set their password to their own email address or full name (passes MinimumLength, Common and Numeric validators) and the similarity check never fires.
- **Recommendation:** Pass the user: validate_password(value, user=self.context['request'].user) for password change; for admin reset, pass the target user via serializer context; for create, pass a transient User(email=..., full_name=...) built from the submitted attrs. Add a test that new_password == user.email is rejected.
- **Fix:** Safe to fix now

### [API & serializers] ReviewRecord assigned_to accepts any user ID system-wide and echoes their email (cross-tenant email enumeration)

- **Where:** `backend/apps/reviews/serializers.py:37`
- **Finding:** ReviewRecordSerializer includes writable 'assigned_to' in fields (line 37) with no explicit field declaration, so ModelSerializer auto-generates a PrimaryKeyRelatedField over User._default_manager (ALL users, all pharmacies/groups). validate() (lines 56-92) scope-checks only patient and dosette_cycle, never assigned_to; the update path (backend/apps/reviews/services.py:15, UPDATE_ALLOWED_FIELDS includes 'assigned_to') adds no check either. The serializer then exposes 'assigned_to_email' (lines 20-24, source='assigned_to.email'). A pharmacist holding REVIEW_MANAGE (backend/apps/tenancy/permissions.py:106-107, pharmacy-scoped role) can POST/PATCH a review in their own pharmacy with assigned_to=<sequential integer> and read back the email address of any user in any other pharmacy or group from the response, and can also assign work items to users outside their tenant.
- **Recommendation:** Restrict the queryset (declare assigned_to = PrimaryKeyRelatedField(queryset=...) limited via users_visible_to(request.user) in __init__/validate), or add a validate() check that assigned_to holds an active membership in the patient's pharmacy, returning the same 'outside your review scope' error used for patient/cycle.
- **Fix:** Safe to fix now

### [API & serializers] Dosette cycle dates/frequency/reference remain editable after the cycle is prepared, checked, collected, completed, or cancelled

- **Where:** `backend/apps/blister/serializers.py:299`
- **Finding:** DosetteCycleSerializer correctly makes status, stock_deducted, deducted_at, prepared_at, checked_at read-only, but validate() (line 299) has no status-based edit guard — it only checks end_date>=start_date and reference uniqueness. DosetteCycleDetailView.update (backend/apps/blister/views.py:272-293) calls serializer.save() directly, and the model (backend/apps/blister/models.py:148) has no save-time guard. So a PATCH can rewrite reference, frequency, start_date and end_date on a cycle in CHECKED/COLLECTED/COMPLETED/CANCELLED state, or after stock_deducted=True (making the recorded deduction quantities inconsistent with the new frequency/date range), and on period-linked cycles it can desync cycle dates from the parent DosettePeriod. This contrasts with the reviews app, which blocks all edits on terminal records (backend/apps/reviews/services.py:18-22).
- **Recommendation:** Mirror the reviews pattern: in DosetteCycleSerializer.validate (or a blister service), reject edits when self.instance.status is in CLOSED_CYCLE_STATUSES (already defined at line 24) or when stock_deducted is True; optionally restrict period-linked cycles to note-level edits only.
- **Fix:** Safe to fix now

### [Frontend] No production serving path for the SPA: only artifact is a Vite dev-server container

- **Where:** `frontend/Dockerfile:12`
- **Finding:** frontend/Dockerfile ends with CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"] (line 12) and docker-compose.yml runs the same dev command with port 5173 published. There is no production image, no nginx/static config, and no SPA history-fallback or /api reverse-proxy config anywhere in the repo — docs/DEPLOYMENT.md lines 94-96 and 119 only *describe* building dist/ and serving it behind a reverse proxy. If the existing container were ever exposed publicly, the Vite dev server would serve unminified source and dev endpoints (e.g. /@fs source access, HMR websocket). This is documented as development-oriented, so it is not a blocker for the repo as-is, but it is the largest frontend gap before any public demo: the secure path exists only as prose, not as a buildable artifact.
- **Recommendation:** Add a production multi-stage Dockerfile (node build stage -> nginx serving frontend/dist) with an nginx config that (a) falls back to index.html for SPA routes and (b) proxies /api (and only /api) to the backend, matching the relative-URL default in frontend/src/lib/api.ts. Reference it from DEPLOYMENT.md so the checklist item is executable.
- **Fix:** Safe to fix now

### [Frontend] No global 401 handling: expired session leaves user on protected screens instead of redirecting to login

- **Where:** `frontend/src/lib/apiClient.ts:30`
- **Finding:** The only 401/403-aware code in the frontend is authApi.getMe (frontend/src/auth/authApi.ts:44), which runs once at bootstrap and after password change. requestJson (frontend/src/lib/apiClient.ts:30) throws a generic ApiError for every non-ok status, the QueryClient (frontend/src/lib/queryClient.ts:3) has no global error handler, and no feature code inspects error.status (verified by grep: zero matches for status === 401/403 outside authApi). If the Django session expires or is invalidated mid-use, the app does NOT crash — screens render curated error states with a Retry button (e.g. InventoryScreen.tsx:519-534, UsersScreen.tsx:175-191, whose copy even says 'your session ... may need refreshing') — but the user is never redirected to /login and AuthContext keeps the stale user object, so ProtectedRoute continues to render protected chrome. Retry can never succeed.
- **Recommendation:** Add a QueryCache/MutationCache onError (or a check in requestJson) that, on ApiError.status === 401, clears the auth user (setUser(null) via a callback or a re-run of getMe) so ProtectedRoute redirects to /login with the return-location state it already supports.
- **Fix:** Safe to fix now

### [Frontend] React Query cache is not cleared on logout/login, so a subsequent user on the same browser can briefly see the previous user's data

- **Where:** `frontend/src/auth/AuthContext.tsx:118`
- **Finding:** logout (frontend/src/auth/AuthContext.tsx:118-121) only calls the API and setUser(null); neither logout nor login calls queryClient.clear()/removeQueries. The QueryClient is a module singleton (frontend/src/lib/queryClient.ts:3) and QueryClientProvider (frontend/src/App.tsx:11) never unmounts, and query keys are not user-scoped (e.g. ["dashboard", "alerts"] in DashboardScreen.tsx:194, ["notifications", "work-queue"]). With React Query's stale-while-revalidate default, logging out and logging in as a different demo user on the same browser renders the previous user's cached, differently-scoped data instantly while the refetch is in flight. For a public demo where viewers switch between demo roles on one machine, this is a real (if transient) cross-account data exposure in the UI. Also minor: logout does not catch fetch failures, so a network error during logout leaves the user visually signed in (Sidebar.tsx:103-106 awaits it before navigating).
- **Recommendation:** Call queryClient.clear() in logout (and after a successful login) — the queryClient singleton is importable from AuthContext. Optionally wrap authApi.logout() in try/finally so local sign-out always completes.
- **Fix:** Safe to fix now

### [Frontend] Cross-origin VITE_API_BASE_URL silently breaks CSRF (and session) — same-site deployment is an undocumented hard requirement

- **Where:** `frontend/src/lib/api.ts:30`
- **Finding:** apiFetch attaches X-CSRFToken by reading the csrftoken cookie from document.cookie (frontend/src/lib/api.ts:12-34). document.cookie only exposes cookies for the SPA's own origin, so if VITE_API_BASE_URL (line 1) is pointed at a different domain (e.g. SPA on a CDN, API on api.example.com), the csrftoken cookie set by the API is unreadable, the header is never sent, and every POST/PUT/DELETE fails with 403; Django's default SameSite=Lax session cookie would additionally not be sent on cross-site fetches. This currently works in CI e2e only because localhost ports share a cookie jar (VITE_API_BASE_URL=http://localhost:8000 in .github/workflows/e2e.yml:73). Neither .env.example (line 32) nor docs/DEPLOYMENT.md (line 75) mentions that VITE_API_BASE_URL is effectively restricted to same-origin/same-host deployments.
- **Recommendation:** Document that the production SPA must be served same-origin with the API behind one reverse proxy (the relative /api default), and that VITE_API_BASE_URL is only for same-host setups. If cross-origin is ever needed, have /api/auth/csrf/ return the token in the response body and store it in memory instead of reading document.cookie.
- **Fix:** Safe to fix now

### [Frontend] No top-level React ErrorBoundary — any uncaught render error yields a permanent blank page

- **Where:** `frontend/src/main.tsx:7`
- **Finding:** main.tsx renders <App /> directly into #root with no error boundary, and grep confirms no ErrorBoundary/componentDidCatch anywhere in frontend/src. Query/mutation errors are well handled (they never throw during render), but any unexpected render-time error (e.g. an API payload shape change hitting an unguarded .map/.toLocaleString, as in UsersScreen.tsx:154 summary rendering) unmounts the whole tree, leaving a white screen with no recovery path — the worst possible failure mode in front of a public demo audience. Raw stack traces are not shown (production React error output is minified), so this is availability/polish, not information disclosure.
- **Recommendation:** Wrap <App /> (or the AppShell outlet) in a small ErrorBoundary that shows a branded 'Something went wrong — reload' screen, consistent with the existing EmptyState pattern.
- **Fix:** Safe to fix now

### [Docker & deployment] No production application server exists anywhere in the project (gunicorn/uvicorn absent)

- **Where:** `backend/pyproject.toml:10`
- **Finding:** docs/DEPLOYMENT.md:118 requires 'Run the backend under a production WSGI/ASGI server (not runserver)' before public deployment, but backend/pyproject.toml dependencies (lines 10-18) contain no gunicorn, uvicorn, or any WSGI/ASGI server, and there is no 'prod' optional-dependency group. backend/Dockerfile:17 hard-codes CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"] and docker-compose.yml:18 repeats it. There is no image, dependency, or command in the repo capable of serving the app in production; the documented checklist item cannot be executed from what is committed. Django's runserver is explicitly unsupported for production (single-threaded dev server, no hardening).
- **Recommendation:** Add gunicorn (e.g. 'gunicorn>=23,<24') to dependencies or a [project.optional-dependencies].prod group, and provide a production CMD (e.g. 'gunicorn config.wsgi:application --bind 0.0.0.0:8000') — either as a separate prod Dockerfile target/stage or a compose override — so the documented production path is actually buildable.
- **Fix:** Safe to fix now

### [Docker & deployment] No .dockerignore: backend image bakes in 239MB host .venv, caches, and real backup archives

- **Where:** `backend/Dockerfile:13`
- **Finding:** No .dockerignore exists at /Users/alvinsakhiya/Project, /Users/alvinsakhiya/Project/backend, or /Users/alvinsakhiya/Project/frontend (verified with ls). backend/Dockerfile:13 'COPY . .' therefore copies the entire 254MB context into the image, including: backend/.venv (239MB macOS python3.14 virtualenv, useless in the linux python:3.13 image), .mypy_cache/.pytest_cache/.ruff_cache, and — most importantly — backend/media/backups/jmw-pharmacy-group/group-1-*.zip, which are real application backup archives (verified present). Dev backups may be unencrypted (BACKUP_ENCRYPTION_REQUIRED=False in .env.example:25), so pushing or sharing this image ships data snapshots inside an image layer. These files are git-ignored (.gitignore lines 11, 25) but Docker does not read .gitignore.
- **Recommendation:** Add backend/.dockerignore excluding .venv/, __pycache__/, *.pyc, .mypy_cache/, .pytest_cache/, .ruff_cache/, media/, staticfiles/, tests fixtures as appropriate, and .env*. This is a pure win: smaller context, faster builds, no data in image layers.
- **Fix:** Safe to fix now

### [Docker & deployment] No .dockerignore: frontend 'COPY . .' copies 209MB host node_modules over the npm ci install

- **Where:** `frontend/Dockerfile:8`
- **Finding:** frontend/Dockerfile runs 'RUN npm ci' (line 6, installing linux binaries) then 'COPY . .' (line 8) with no .dockerignore, so the host's 209MB darwin-arm64 node_modules is sent in the 212MB build context and merged over /app/node_modules in the image, along with dist/, playwright-report/, and test-results/. The compose named volume frontend_node_modules (docker-compose.yml:37) masks /app/node_modules at runtime, but Docker seeds an empty named volume from the image's directory contents on first use — i.e. from the darwin-contaminated merge. Because COPY merges rather than replaces, the linux binaries from npm ci usually survive alongside, so it often works by luck, but it bloats every build and can produce platform-mismatch failures (esbuild/rollup native packages) if the merge order changes.
- **Recommendation:** Add frontend/.dockerignore excluding node_modules/, dist/, .vite/, playwright-report/, test-results/, blob-report/, and .env*.
- **Fix:** Safe to fix now

### [Docker & deployment] Both application containers run as root

- **Where:** `backend/Dockerfile:17`
- **Finding:** Neither backend/Dockerfile nor frontend/Dockerfile declares a USER; both processes (runserver on port 8000, Vite dev server on 5173) run as root inside their containers. Combined with the bind mounts of the full source tree (docker-compose.yml:23 and :36), a compromise of either dev server gives root-in-container with write access to the host-mounted source. Acceptable for a local synthetic-data prototype; not acceptable for a public demo.
- **Recommendation:** For the future production image, create and switch to a non-root user (adduser --system app && USER app) and chown /app. Doing it in the current dev images can break bind-mount write permissions on Linux hosts (media/backups writes), so bundle it with the prod Dockerfile work rather than patching the dev image now.
- **Fix:** Deployment-dependent / future work

### [Docker & deployment] Default Postgres password 'pharmacy' silently applied via ${POSTGRES_PASSWORD:-pharmacy} fallback

- **Where:** `docker-compose.yml:7`
- **Finding:** docker-compose.yml:7 sets POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-pharmacy} and line 21 interpolates the same fallback into DATABASE_URL, so if the variable is ever unset the stack silently runs with a known trivial credential; .env.example:8 ships the same value as the documented default. Exposure is well mitigated today: the db service publishes no host ports (confirmed — only backend 8000 and frontend 5173 are published) and DEPLOYMENT.md:19-20 documents this. The risk is that the ':-pharmacy' fallback carries the weak credential invisibly into any future deployment where someone forgets to override it.
- **Recommendation:** Remove the fallback for the password only (use ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set} or plain ${POSTGRES_PASSWORD}) so compose fails loudly instead of defaulting; keep the DB name/user defaults. Safe now because the documented setup already requires creating .env from .env.example (backend's env_file: .env makes .env mandatory anyway).
- **Fix:** Safe to fix now

### [Backup & data protection] Restore path performs no integrity check on unencrypted archives and never verifies the recorded checksum

- **Where:** `backend/apps/backups/services.py:332`
- **Finding:** restore_backup (services.py:149-184) reads the archive via _read_archive_bytes (services.py:330-334), which falls back to treating any file without the AIPMB1 magic header as a plain zip. Two consequences: (1) even when BACKUP_ENCRYPTION_REQUIRED=True and run.encrypted=True, a plaintext .zip swapped into BACKUP_ROOT (whose manifest.json copies the group id/slug) restores without any authentication — GCM integrity only protects files that still carry the magic header; (2) BackupRun.checksum (sha256 of the file, written at services.py:293) is never re-verified before restore, so silent corruption or substitution of an unencrypted archive is undetected. Attack requires filesystem write access to BACKUP_ROOT, so it is a defense-in-depth gap rather than a remote hole.
- **Recommendation:** In restore_backup, before _read_manifest: (a) if run.checksum is set, recompute _sha256_file(archive_path) and refuse on mismatch; (b) refuse unencrypted payloads when encryption.encryption_required() is True or when run.encrypted is True but encryption.is_encrypted_payload() is False.
- **Fix:** Safe to fix now

### [Backup & data protection] Malformed BACKUP_ENCRYPTION_KEY silently downgrades to an unencrypted backup when encryption is not required

- **Where:** `backend/apps/backups/services.py:249`
- **Finding:** _write_backup_archive decides with encrypt_archive = encryption.encryption_available(); encryption_available() (encryption.py:82-87) swallows BackupKeyError and returns False for a key that is present but malformed (bad base64 / wrong length). With BACKUP_ENCRYPTION_REQUIRED=False (the base default, dev.py), a typo'd key therefore produces an UNENCRYPTED archive containing decrypted patient data, and the warning at services.py:256-260 misleadingly says the key 'is not set'. In prod the guard at prod.py:20 (REQUIRED=True) refuses the backup, but the error text at services.py:251-254 also says 'not configured' rather than 'malformed'.
- **Recommendation:** In _write_backup_archive call encryption._load_key() directly: raise BackupError on BackupKeyError (configured-but-invalid key must never fall back to plaintext), and only take the unencrypted path when the key is genuinely absent. Distinguish 'missing' vs 'malformed' in the error/warning text.
- **Fix:** Safe to fix now

### [Backup & data protection] Pharmacist membership with no pharmacy can target ANY group's backup schedule and runs

- **Where:** `backend/apps/backups/views.py:48`
- **Finding:** _group_from_request (views.py:43-56) returns the pharmacist's own group only when membership.pharmacy_id is not None. A PHARMACIST membership with pharmacy=None (a misconfiguration the Membership model permits) falls through to the arbitrary-group path: get_object_or_404(Group.objects.all(), pk=group_id), granting schedule read/write, backup creation and run listing for any tenant. This contradicts apps/tenancy/policy.py resolve_scope (policy.py:61-64), which maps a pharmacist without a pharmacy to EMPTY_SCOPE (no access). Admin reaching any group is by design (resolve_scope is_global). Restore/delete are unaffected (admin-only).
- **Recommendation:** In _group_from_request, raise PermissionDenied for PHARMACIST memberships whose pharmacy_id is None instead of falling through to the group-parameter path, matching resolve_scope semantics.
- **Fix:** Safe to fix now

### [Tests & dependencies] Login throttling is implemented but has zero test coverage

- **Where:** `backend/apps/accounts/views.py:61`
- **Finding:** LoginView uses ScopedRateThrottle with throttle_scope='login' (backend/apps/accounts/views.py:61-62) and the E2E workflow even overrides LOGIN_THROTTLE_RATE=1000/min (.github/workflows/e2e.yml:34) to avoid tripping it, proving the control is live. However, `grep -rn throttle backend/apps --include='*test*.py'` returns nothing: backend/apps/accounts/test_auth_api.py covers login success/failure/inactive/logout/CSRF/password-change (lines 102-315) but never asserts a 429 after repeated failed logins. A brute-force protection control for a public demo has no regression test, so a settings or DRF upgrade could silently disable it.
- **Recommendation:** Add a test in backend/apps/accounts/test_auth_api.py that lowers the login throttle rate via settings override, posts repeated bad credentials, and asserts HTTP 429 (and that a subsequent valid login is also throttled within the window).
- **Fix:** Safe to fix now

### [Tests & dependencies] Backup delete endpoint (destructive, admin-only) is completely untested

- **Where:** `backend/apps/backups/views.py:116`
- **Finding:** BackupDeleteView is wired at DELETE /api/backups/runs/<pk>/ (backend/apps/backups/urls.py:16) and deletes the archive via delete_backup(). Grep for 'delete' across backend/apps/backups/tests/ matches only a comment in test_backup_encryption.py:182 — there is no test for the success path, the non-admin 403 (it calls _require_backup_admin at views.py:118), the 404 case, or on-disk file removal. Every other backup endpoint (schedule, list, run-now, restore) is well tested; this is the one destructive endpoint with zero coverage.
- **Recommendation:** Add tests in backend/apps/backups/tests/test_backup_api.py: admin can delete a run (record gone, archive file removed from BACKUP_ROOT), pharmacist/dispenser get 403, unknown pk gets 404.
- **Fix:** Safe to fix now

### [Tests & dependencies] Backend has no dependency lockfile; Docker/CI resolve version ranges at build time

- **Where:** `backend/pyproject.toml:10`
- **Finding:** backend/pyproject.toml declares bounded ranges (e.g. 'Django>=5.2,<6.0', 'cryptography>=43,<46') but there is no uv.lock/requirements.txt/constraints file anywhere in the repo (verified by ls of / and /backend). backend/Dockerfile runs 'pip install --no-cache-dir .' and ci.yml runs 'pip install -e ".[dev]"', so every image build and CI run can resolve different dependency versions. The frontend does this correctly (package-lock.json, lockfileVersion 3, npm ci in CI); the backend has no equivalent, so the demo image is not reproducible and a bad upstream release lands silently.
- **Recommendation:** Generate and commit a lock (e.g. 'pip-compile pyproject.toml' or 'uv lock' producing requirements.lock) and install from it in backend/Dockerfile and .github/workflows/ci.yml, keeping pyproject ranges as the source spec.
- **Fix:** Safe to fix now

### [Tests & dependencies] No production WSGI server dependency despite prod settings and DEPLOYMENT.md referencing gunicorn/uvicorn

- **Where:** `backend/pyproject.toml:20`
- **Finding:** docs/DEPLOYMENT.md:25 states a hardened deployment must replace runserver with 'gunicorn/uvicorn' behind a TLS proxy, and docs/FILE_MANIFEST.md:66 describes config/wsgi.py as the entrypoint for 'Production WSGI server (e.g. gunicorn)'. backend/config/settings/prod.py exists, but pyproject.toml declares no gunicorn/uvicorn anywhere (deps lines 10-18, only a 'dev' extra at lines 20-28), and no whitenoise/static strategy for the 'collectstatic' step DEPLOYMENT.md:98/120 requires. The documented production path cannot be executed from the declared dependency set.
- **Recommendation:** Add a [project.optional-dependencies] 'prod' extra with gunicorn (and whitenoise if Django is to serve admin static), and reference it from the DEPLOYMENT.md checklist. Do not change the dev compose flow.
- **Fix:** Safe to fix now

### [Documentation] DEPLOYMENT.md overstates the DJANGO_SECRET_KEY fail-fast: the shipped .env.example placeholder bypasses the prod guard

- **Where:** `docs/DEPLOYMENT.md:55`
- **Finding:** docs/DEPLOYMENT.md:55 claims DJANGO_SECRET_KEY 'prod refuses to start if unset/left at default'. The guard in backend/config/settings/prod.py:9 only refuses {None, "", "unsafe-development-key"} (the base.py:29 default). But the documented setup path is `cp .env.example .env`, and .env.example line 1 ships `DJANGO_SECRET_KEY=change-me-for-local-development` — a publicly known value that PASSES the prod guard. A deployer following README/DEPLOYMENT who forgets to replace it would run a public demo with a known signing key (session/cookie forgery). PATIENT_FIELD_KEY and PATIENT_INDEX_KEY do not have this problem because .env.example omits them, so the refused dev defaults apply.
- **Recommendation:** Add "change-me-for-local-development" to the refused set in backend/config/settings/prod.py (one-line change), and reword the DEPLOYMENT.md table note to 'prod refuses the dev defaults, but you must still replace the .env.example placeholder'.
- **Fix:** Safe to fix now

### [Documentation] demo-evidence.md 'Test Evidence' backend commands cannot work: the backend container has no ruff/mypy/pytest

- **Where:** `docs/demo-evidence.md:120`
- **Finding:** docs/demo-evidence.md:120-126 instructs `docker compose exec backend ruff check .`, `ruff format --check .`, `mypy .`, and `pytest`. The backend image (backend/Dockerfile: `pip install --no-cache-dir .`) installs only runtime dependencies; ruff/mypy/pytest live in the `[dev]` extra (backend/pyproject.toml:20-28), so all four commands fail with 'command not found' inside the container. README.md:206-221 and docs/INSTALLATION.md section 8 document the correct paths (compose only for the migration check; lint/type/test from a host venv), so demo-evidence.md contradicts the rest of the docs. Only `makemigrations --check` works via compose.
- **Recommendation:** Replace the compose-exec lint/type/test commands in demo-evidence.md with the venv-based commands used in README/INSTALLATION (or document `pip install -e ".[dev]"` inside the container first).
- **Fix:** Safe to fix now

### [Documentation] API_ENDPOINTS.md contradicts itself on the endpoint count and contains leftover first-person working notes

- **Where:** `docs/API_ENDPOINTS.md:186`
- **Finding:** Line 10 states 'There are **107 endpoints** in total' (the tables do contain 107 rows; 85 unique URL paths when PUT/PATCH rows are collapsed). The Notes paragraph at line 186 states 'Total: 71 method+path endpoints (58 unique URL patterns)' — contradicting both the header and the actual tables. The same paragraph is an unedited analysis dump including first-person phrasing ('I collapsed PUT+PATCH on RetrieveUpdateAPIView rows into "PUT/PATCH"'), which reads as pasted working notes rather than documentation.
- **Recommendation:** Rewrite the Notes section in third person, delete the stale 71/58 totals (or recompute them to match the 107-row tables), and keep only the genuinely useful permission-model explanation.
- **Fix:** Safe to fix now

## Low findings (26)

### [Settings & configuration] Prod does not fail fast on missing DATABASE_URL and does not require TLS to the database

- **Where:** `backend/config/settings/base.py:95`
- **Finding:** DATABASES uses dj_database_url.config with a hard-coded default of postgresql://pharmacy:pharmacy@localhost:5432/pharmacy (base.py:96-99). prod.py guards SECRET_KEY and the two patient keys but not DATABASE_URL, so a prod boot with the variable unset silently targets localhost with weak default credentials instead of failing. There is also no ssl_require/sslmode enforcement for a networked/managed database.
- **Recommendation:** In prod.py, raise ImproperlyConfigured when DATABASE_URL is unset (mirroring the existing key guards), and pass ssl_require=True (or sslmode in the URL) when the demo database is not co-located.
- **Fix:** Safe to fix now

### [Settings & configuration] No global API throttling beyond the login scope

- **Where:** `backend/config/settings/base.py:143`
- **Finding:** REST_FRAMEWORK defines DEFAULT_THROTTLE_RATES only for the "login" scope (base.py:143-145) and no DEFAULT_THROTTLE_CLASSES. All other endpoints (patients, backups run/restore, reports, etc.) are unthrottled. They do require authentication (IsAuthenticated default, base.py:140-142), so this is abuse-resistance for a public demo rather than an access-control gap — e.g. an authenticated demo user can hammer expensive endpoints like backup runs or report generation without limit.
- **Recommendation:** Add UserRateThrottle (and AnonRateThrottle) with generous rates (e.g. user 1000/hour, anon 100/hour) to DEFAULT_THROTTLE_CLASSES before public exposure; keep the tighter login scope.
- **Fix:** Safe to fix now

### [Settings & configuration] .env.example is out of sync with the settings the code actually reads

- **Where:** `.env.example:17`
- **Finding:** .env.example line 17 documents FIELD_ENCRYPTION_KEY as "Reserved for a later phase", but no code reads that variable; the code reads PATIENT_FIELD_KEY (base.py:33) and PATIENT_INDEX_KEY (base.py:36), and prod.py:12-16 hard-fails when they are unset — yet neither appears in .env.example. LOGIN_THROTTLE_RATE (base.py:144) and APP_VERSION (base.py:133) are also undocumented. Anyone building a prod env file from the template will hit ImproperlyConfigured with no template guidance.
- **Recommendation:** Replace the stale FIELD_ENCRYPTION_KEY entry with commented PATIENT_FIELD_KEY= and PATIENT_INDEX_KEY= entries (with generation instructions), and add LOGIN_THROTTLE_RATE.
- **Fix:** Safe to fix now

### [Authentication & accounts] Hardcoded shared demo password grants full-admin control with no rotation or override mechanism

- **Where:** `backend/apps/core/management/commands/seed_demo.py:30`
- **Finding:** DEMO_PASSWORD = "DemoPass!2026" is a repo constant (also published in README.md:151 and OWN_COMPUTER_SETUP_GUIDE.md), shared across all five demo accounts including admin@demo.local, which is seeded with the ADMIN role (seed_demo.py:395, 709) — ADMIN passes every can() check (tenancy/permissions.py:143-144), including USER_DELETE, USER_RESET_PASSWORD and USER_ASSIGN_ROLE. Accounts are seeded with must_change_password=False (seed_demo.py:460). On any public deployment, a visitor can log in as admin, change the other demo accounts' passwords (locking out everyone else), delete users, or destroy demo data; recovery requires manually running reset_demo_data with a confirmation token. There is no env-var override for the password and no automated reset.
- **Recommendation:** Before any public demo: allow DEMO_PASSWORD to be overridden via environment variable (keeping the constant as dev default), decide whether the public demo really exposes the ADMIN account or only PHARMACIST/DISPENSER, add guards preventing demo accounts from changing each other's passwords / being deleted (or make the demo read-mostly), and schedule reset_demo_data periodically.
- **Fix:** Safe to fix now

### [Authentication & accounts] No throttling on password change or admin password reset endpoints

- **Where:** `backend/apps/accounts/views.py:98`
- **Finding:** Only the login view is throttled. PasswordChangeView (views.py:98-126) verifies old_password with no rate limit, so an attacker holding a hijacked session cookie can brute-force the account's current password (an oracle that would let them fully take over the account rather than just ride the session). UserResetPasswordView (user_views.py:127-147) is likewise unthrottled.
- **Recommendation:** Add ScopedRateThrottle scopes (e.g., 'password-change') to both endpoints, keyed on the authenticated user.
- **Fix:** Safe to fix now

### [Authentication & accounts] Login POST is exempt from CSRF (login-CSRF possible)

- **Where:** `backend/apps/accounts/views.py:59`
- **Finding:** DRF wraps APIView dispatch in csrf_exempt and SessionAuthentication only enforces CSRF for already-session-authenticated requests, so the anonymous POST /api/auth/login/ performs no CSRF check (the test suite confirms CSRF only for the authenticated password-change flow, test_auth_api.py:315-338). A cross-site attacker can silently log a victim's browser into an attacker-known account (login CSRF). Impact is modest in this app but nonzero for a public demo with shared, published credentials.
- **Recommendation:** Enforce CSRF on the login view explicitly (e.g., run rest_framework.authentication.CSRFCheck / a csrf_protect-decorated dispatch), which is cheap since the SPA already fetches /api/auth/csrf/ first.
- **Fix:** Safe to fix now

### [RBAC & tenant scoping] Object-level permission checks are disabled (no-op) because _target_in_scope cannot resolve nested tenant relations

- **Where:** `backend/apps/tenancy/policy.py:80`
- **Finding:** _target_in_scope only resolves direct `pharmacy_id`/`group_id` attributes (policy.py:80-88). Models whose tenant field is nested (DosetteCycle/DosettePeriod/PatientMedication/ReviewRecord use tenant_pharmacy_id_field = "patient__pharmacy") return False from the object check even when in scope, so views work around it by overriding check_object_permissions to a no-op: blister/views.py:78-79, 118-119, 158-159; reviews/views.py:84-85; catalogue/views.py:112-113. Today this fails CLOSED because every one of those views fetches objects through scoped querysets (patients_for + .scoped.for_user), so there is no live IDOR. But the second enforcement layer that require().has_object_permission is supposed to provide is dead code on exactly the models holding patient data, and any future view that fetches one of these objects outside a scoped queryset will have no object-level backstop.
- **Recommendation:** Make _target_in_scope fall back to a queryset probe when the model declares a tenant field, e.g. `type(target).scoped.for_user(user).filter(pk=target.pk).exists()`, then delete the no-op check_object_permissions overrides so the DRF object check is real again.
- **Fix:** Safe to fix now

### [RBAC & tenant scoping] backups _group_from_request: pharmacist branch falls through to attacker-controlled group param if pharmacy_id is ever null

- **Where:** `backend/apps/backups/views.py:45`
- **Finding:** `if membership.role == Role.PHARMACIST and membership.pharmacy_id is not None: return membership.pharmacy.group` (backups/views.py:45-46) — when the condition fails, a PHARMACIST falls through to `group_id = request.query_params.get("group") or request.data.get("group")` resolved via unscoped `get_object_or_404(Group.objects.all(), pk=group_id)` (lines 48-50), granting schedule read/write, run listing, and run-now for ANY group. This is only unreachable because the DB CheckConstraint membership_scope_matches_role (tenancy/models.py:90-115) forbids a PHARMACIST with null pharmacy; the view itself does not enforce it. Restore/delete are separately gated to ADMIN via _require_backup_admin (lines 36-40, 101, 118), which is correct.
- **Recommendation:** In _group_from_request, raise PermissionDenied for a PHARMACIST whose membership has no pharmacy instead of falling through to the request-supplied group. One-line defense-in-depth change.
- **Fix:** Safe to fix now

### [RBAC & tenant scoping] Analytics resolves pharmacy/group IDs unscoped before the scope check, allowing cross-tenant ID enumeration via differentiated errors

- **Where:** `backend/apps/analytics/views.py:123`
- **Finding:** _pharmacy_from_id / _group_from_id use unscoped `Pharmacy.objects.get` / `Group.objects.get` (analytics/views.py:123-136); TransferSuggestionDismissView fetches the suggestion unscoped by pk (lines 222-236); ForecastDetailView fetches the run unscoped (lines 248-262). The scope check happens afterwards in the services (services.py:889, 938, 1022, 1128, 1153) or inline (views.py:264), so there is NO data leak or unauthorized action — but the error text differs: "Pharmacy is invalid" (does not exist) vs "This pharmacy is outside your forecasting scope" (exists, other tenant). Any authenticated member can enumerate which pharmacy/group/forecast-run/suggestion IDs exist across all tenants.
- **Recommendation:** Return an identical 404/'invalid' response for both not-found and out-of-scope, e.g. resolve the object through a scope-filtered queryset first (Pharmacy.scoped.for_user(user)) and only then run the capability check.
- **Fix:** Safe to fix now

### [API & serializers] BackupRun serializer exposes raw exception text (error_message) and server archive path (file) to API clients

- **Where:** `backend/apps/backups/serializers.py:52`
- **Finding:** BackupRunSerializer exposes 'error_message' (line 52) and 'file' (line 48). error_message is populated by a blanket 'except Exception' in create_backup (backend/apps/backups/services.py:110-113) via _safe_error which returns str(exc)[:300] verbatim (services.py:484-485) — an OSError or database error there embeds absolute filesystem paths or connection details into the API response served by BackupRunListView (backend/apps/backups/views.py:78-86). 'file' is a server-relative archive path. Exposure is limited to authenticated admin/pharmacist backup operators, so impact for the public demo is low, but it is a genuine internals leak into a client-facing serializer.
- **Recommendation:** Store a generic sanitized message (e.g. exception class name only) in error_message and log the full traceback server-side; consider omitting 'file' from the API payload or replacing it with the basename.
- **Fix:** Safe to fix now

### [API & serializers] ReceiveStockSerializer allows creating already-expired batches by back-dating received_at

- **Where:** `backend/apps/inventory/serializers.py:110`
- **Finding:** ReceiveStockSerializer.validate only checks expiry_date < received_at (line 110), and received_at is fully client-controlled with no bounds (line 73). Posting received_at=2020-01-01 with expiry_date=2020-06-01 creates an expired StockBatch that then participates in FEFO stock preview/deduction. The sibling CatalogueStockIntakeSerializer correctly rejects past expiry ('expiry_date < date.today()', line 147-150), so the two intake paths enforce inconsistent rules.
- **Recommendation:** Add the same 'expiry cannot be in the past' check to ReceiveStockSerializer.validate (and optionally cap received_at at today) to match CatalogueStockIntakeSerializer.
- **Fix:** Safe to fix now

### [Frontend] Default React Query retries (3x with backoff) applied to non-retryable 4xx failures

- **Where:** `frontend/src/lib/queryClient.ts:3`
- **Finding:** new QueryClient() with no defaultOptions means every failed query — including deterministic 401/403/404 ApiErrors from requestJson — is retried 3 times with exponential backoff before the error state renders. On an expired session this delays the (already non-redirecting) error UI by several seconds and multiplies dead requests against the backend, which matters under the login-throttled, audited demo backend.
- **Recommendation:** Set defaultOptions.queries.retry to a function that skips retries when error instanceof ApiError && error.status < 500 (e.g. retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2).
- **Fix:** Safe to fix now

### [Docker & deployment] Backend and frontend ports published on all host interfaces

- **Where:** `docker-compose.yml:25`
- **Finding:** Ports '8000:8000' (line 25) and '5173:5173' (line 39) bind to 0.0.0.0 on the host, so the Django dev server and Vite dev server are reachable from the local network, not just the developer's machine. Partially mitigated by DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1 (.env.example:3) rejecting other Host headers, but Vite has no such check.
- **Recommendation:** Bind to loopback for local development: '127.0.0.1:8000:8000' and '127.0.0.1:5173:5173'.
- **Fix:** Safe to fix now

### [Docker & deployment] No restart policy on any service

- **Where:** `docker-compose.yml:2`
- **Finding:** None of db, backend, or frontend declares a restart policy, so a crashed container stays down until manually restarted. Fine for a laptop dev loop; inadequate for an unattended public demo box.
- **Recommendation:** Add 'restart: unless-stopped' to all three services in whatever compose file backs the public demo (or to this one — it is harmless in dev).
- **Fix:** Safe to fix now

### [Docker & deployment] No healthchecks for backend/frontend; frontend depends_on backend is ordering-only

- **Where:** `docker-compose.yml:40`
- **Finding:** Only db has a healthcheck (pg_isready, lines 10-14, correctly consumed by backend's depends_on condition: service_healthy at lines 26-28 — good). The backend exposes a health endpoint (/api/health/, per docs/DEPLOYMENT.md:18) but no compose healthcheck uses it, and frontend's depends_on: backend (lines 40-41) has no condition, so it only orders container start, not readiness.
- **Recommendation:** Add a backend healthcheck hitting /api/health/ (e.g. python -c urllib probe, since curl is absent from python:3.13-slim) and change frontend's depends_on to condition: service_healthy.
- **Fix:** Safe to fix now

### [Docker & deployment] collectstatic story is documentation-only; no whitenoise and no static-serving path in any image

- **Where:** `backend/Dockerfile:17`
- **Finding:** STATIC_ROOT is configured (backend/config/settings/base.py:121) and docs/DEPLOYMENT.md:97-98,120 correctly instruct running collectstatic on deploy, but nothing in the repo can serve the collected files: pyproject.toml has no whitenoise, the Dockerfile never runs collectstatic, and no reverse-proxy/nginx config exists. Django admin and DRF browsable-API assets would 404 under DEBUG=False with the current artifacts. Consistent with the documented dev orientation, but it means the production checklist item is not executable from the repo.
- **Recommendation:** When building the prod image, either add whitenoise (simplest for a single-container demo) with a RUN python manage.py collectstatic --noinput layer, or ship the reverse-proxy config that serves STATIC_ROOT. Belongs with the prod Dockerfile work.
- **Fix:** Deployment-dependent / future work

### [Backup & data protection] Decryption/zip errors after the manifest check surface as HTTP 500 instead of a clean 400

- **Where:** `backend/apps/backups/services.py:172`
- **Finding:** Only the first read (_read_manifest, services.py:161-164) is wrapped in `except encryption.BackupEncryptionError`. The second read, _read_backup_data at services.py:172, is not; if the file is corrupted/replaced between the two reads, BackupDecryptionError propagates uncaught (it is not a BackupError subclass, so BackupRestoreView's handlers at views.py:109-112 miss it) and returns a 500. Same for zipfile.BadZipFile from a truncated plain file in _open_zip, and IntegrityError during deserialize (e.g. a Medication referencing a catalogue product deleted since backup — skipped by RESTORE_SKIP_MODELS, never recreated). Data is never lost: these occur before or inside transaction.atomic() and the pre-restore backup already exists.
- **Recommendation:** Wrap the _read_backup_data call and the deserialize loop with handlers translating BackupEncryptionError / zipfile.BadZipFile / IntegrityError into BackupError so the API returns a 400 with a clear message.
- **Fix:** Safe to fix now

### [Backup & data protection] No audit event for backup create/restore/delete, and restore rewrites the audit trail from the snapshot

- **Where:** `backend/apps/backups/services.py:442`
- **Finding:** The backups app never calls the audit recorder (no `record(...)`/AuditEvent creation anywhere in apps/backups). Restore additionally deletes all AuditEvent rows for the group (services.py:442) and replaces them with the backup snapshot, so audit events recorded between backup and restore survive only inside the pre-restore archive; there is also no persisted event saying who performed the restore (the pre-restore BackupRun.created_by is the only attribution). BackupDeleteView (views.py:116-121) leaves no trace at all once run.delete() removes the row.
- **Recommendation:** Emit AuditEvents for backup created / restored / deleted (after commit, so the restore event survives the data replacement), and consider excluding the current audit trail from deletion or appending a restore marker event.
- **Fix:** Safe to fix now

### [Tests & dependencies] Backup group-override and superintendent/stock-employee denial paths untested

- **Where:** `backend/apps/backups/views.py:48`
- **Finding:** _group_from_request (views.py:43-56) accepts an arbitrary 'group' query/body param; the code is safe today because the pharmacist branch (views.py:45-46) short-circuits before the param is read and only ADMIN/PHARMACIST pass _require_backup_operator (views.py:29-33). But no test exercises a pharmacist sending ?group=<other-group> (test_backup_list_is_group_scoped_for_pharmacist at tests/test_backup_api.py:307 sends no group param), and the only role-denial test is for dispenser (test_backup_api.py:324); superintendent and stock-employee denial (they are excluded by the operator check) is untested. A refactor reordering _group_from_request would leak cross-group backups (which contain patient data) with no failing test.
- **Recommendation:** Add tests: pharmacist requesting /api/backups/runs/?group=<group_two.id> still only sees group_one runs; superintendent and stock-employee get 403 on schedule and run-now endpoints.
- **Fix:** Safe to fix now

### [Tests & dependencies] Catalogue product endpoints have no authentication/permission-denial tests

- **Where:** `backend/apps/catalogue/test_catalogue_product_api.py:81`
- **Finding:** CatalogueProductListView/DetailView require Action.MEDICATION_VIEW (backend/apps/catalogue/views.py:24 and :52), but test_catalogue_product_api.py contains only four search/label tests, all running as a logged-in user (force_login at line 77). No test asserts 403 for an unauthenticated client or for a user without MEDICATION_VIEW — the only backend API test module with no negative auth case. This is reference data (low sensitivity), hence low severity, but the permission wiring is unguarded by tests.
- **Recommendation:** Add two tests: unauthenticated GET /api/catalogue/products/ returns 403, and a membership-less (or denied-role) user returns 403.
- **Fix:** Safe to fix now

### [Tests & dependencies] Build tooling (vite, @vitejs/plugin-react) declared as runtime dependencies

- **Where:** `frontend/package.json:22`
- **Finding:** frontend/package.json lists 'vite' (line 22) and '@vitejs/plugin-react' (line 16) under "dependencies" instead of "devDependencies", alongside genuine runtime deps (react, react-router-dom, @tanstack/react-query). They are build-time tools; nothing in dist/ needs them at runtime. Harmless for this project (private: true, static build), but it distorts any production 'npm ci --omit=dev' install and dependency-audit surface.
- **Recommendation:** Move 'vite' and '@vitejs/plugin-react' to devDependencies and regenerate package-lock.json. No code change needed.
- **Fix:** Safe to fix now

### [Tests & dependencies] No LICENSE file and no license/author metadata in either package manifest

- **Where:** `backend/pyproject.toml:5`
- **Finding:** The repo root has no LICENSE file (verified by ls), backend/pyproject.toml [project] (lines 5-9) has name/version/description but no 'license', 'authors', or 'readme' keys, and frontend/package.json has no 'license' field (acceptable for private:true but still undeclared). For a public demo repository, the reuse terms of the code are legally undefined.
- **Recommendation:** Add a LICENSE file at the repo root and matching 'license' metadata in pyproject.toml [project] and package.json.
- **Fix:** Safe to fix now

### [Documentation] phase2-acceptance.md 'Current Verification Summary' test counts are stale versus the current tree

- **Where:** `docs/phase2-acceptance.md:47`
- **Finding:** Lines 47-48 claim 'Backend PostgreSQL: 589 passing cases' and 'Frontend: 237 tests across 36 files' under a heading titled 'Current'. The current tree collects 762 backend tests (`pytest --collect-only` → '762 tests collected') and has 50 frontend test files with 386 it/test blocks. Unlike phase1-acceptance.md (which pins its 221/79 counts to commit 1e3bb97 and a CI run id), these numbers carry no commit reference. The 'Playwright E2E: 23/23' claim (line 49, also docs/demo-script.md:119) does still match the 23 tests in frontend/e2e/.
- **Recommendation:** Pin the summary to the tag/commit it was measured at (e.g. 'as of module-14-...') or refresh the numbers; avoid the word 'Current' for unpinned counts.
- **Fix:** Safe to fix now

### [Documentation] INSTALLATION.md no-Docker backend path references 'docker db on host port 5433' but the db service publishes no host port

- **Where:** `docs/INSTALLATION.md:113`
- **Finding:** Section 6 says the simplest way to get PostgreSQL is `docker compose up db` and to 'Point DATABASE_URL at your PostgreSQL (example: the docker db on host port 5433...)'. docker-compose.yml defines no `ports:` mapping for the db service (correctly documented everywhere else as 'not published to the host by default', e.g. README.md:123, docs/DEPLOYMENT.md:19, docs/DEMO_DATABASE_RESTORE.md:153). As written, a host-run backend cannot reach that container, and the 5433 example has no source in the repo.
- **Recommendation:** Document the missing step: add a `docker-compose.override.yml` snippet publishing `"5433:5432"` on the db service (which then explains the 5433 example), or drop the 5433 reference.
- **Fix:** Safe to fix now

### [Documentation] 'Audit metadata is designed to remain PII-free' conflicts with the schema/security docs (staff email, IP, user agent stored in plaintext)

- **Where:** `docs/demo-evidence.md:104`
- **Finding:** docs/demo-evidence.md:104 ('Audit metadata is designed to remain PII-free and operational') and docs/phase2-acceptance.md:66 make an unqualified PII-free claim. docs/DATABASE_SCHEMA.md:81 explicitly labels AuditEvent as 'PII (plaintext, not encrypted): actor_email, ip_address, user_agent', and docs/SECURITY_AND_DATA_PROTECTION.md:143 says 'Audit metadata stores staff email, IP, and user agent (plaintext)'. The honest docs are right; the evidence docs overstate.
- **Recommendation:** Reword both claims to 'patient-PII-free' / 'free of patient-identifying data', matching the schema and security documents.
- **Fix:** Safe to fix now

### [Documentation] .env.example omits the two production-required patient keys and carries a stale 'Phase 0 scaffold' comment on an unused key

- **Where:** `.env.example:17`
- **Finding:** README.md:190-192 and the docs/DEPLOYMENT.md checklist (lines 108-109) require setting PATIENT_FIELD_KEY and PATIENT_INDEX_KEY in production, but .env.example contains no entry (not even commented) for either, so a deployer editing the template has no anchor for them; the prod fail-fast (backend/config/settings/prod.py:12-16) mitigates but only at startup. Meanwhile .env.example line 16-17 documents FIELD_ENCRYPTION_KEY as 'Reserved for a later phase; not used by the Phase 0 scaffold' — stale phase-0 wording for a key DEPLOYMENT.md:75 confirms is unused, and its name invites confusion with the actually-required PATIENT_FIELD_KEY.
- **Recommendation:** Add commented placeholders for PATIENT_FIELD_KEY / PATIENT_INDEX_KEY (with 'required in production' notes) to .env.example, and either delete FIELD_ENCRYPTION_KEY or update its comment to 'reserved, not read by any settings module'.
- **Fix:** Safe to fix now

## Informational findings (22)

### [Settings & configuration] Backup encryption requirement in prod is env-toggleable off

- **Where:** `backend/config/settings/prod.py:20`
- **Finding:** prod.py:20 sets BACKUP_ENCRYPTION_REQUIRED = env_bool("BACKUP_ENCRYPTION_REQUIRED", True), so a single env var (BACKUP_ENCRYPTION_REQUIRED=False) disables the encrypted-backup requirement in production. The comment documents this as intentional ("unless explicitly disabled"), and the env_bool empty-string guard prevents accidental disabling — recording it as a deliberate escape hatch on patient-data protection.
- **Recommendation:** For a real public deployment, consider hard-coding True in prod.py or emitting a prominent startup warning when it is disabled.
- **Fix:** Deployment-dependent / future work

### [Settings & configuration] SECURE_PROXY_SSL_HEADER trusted unconditionally in prod

- **Where:** `backend/config/settings/prod.py:26`
- **Finding:** prod.py:26 sets SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https"). This is correct behind a proxy that always overwrites X-Forwarded-Proto, but if the app container were ever exposed directly (or the proxy passes the header through), a client sending X-Forwarded-Proto: https bypasses SECURE_SSL_REDIRECT (prod.py:27). Standard Django caveat, worth documenting in the deploy runbook.
- **Recommendation:** Document in docs/DEPLOYMENT.md that the fronting proxy must strip/set X-Forwarded-Proto and that the backend must not be directly reachable.
- **Fix:** Deployment-dependent / future work

### [Settings & configuration] Security headers rely implicitly on Django 5.2 defaults; CSRF cookie readable by JS with credentialed CORS

- **Where:** `backend/config/settings/base.py:150`
- **Finding:** Clickjacking/nosniff/referrer posture is default-driven: XFrameOptionsMiddleware is installed (base.py:72) relying on Django's default X_FRAME_OPTIONS="DENY"; SECURE_REFERRER_POLICY ("same-origin") and SECURE_CROSS_ORIGIN_OPENER_POLICY ("same-origin") are implicit; SECURE_CONTENT_TYPE_NOSNIFF is explicitly re-set to its default in prod.py:22 (Django >=5.2 pinned in backend/pyproject.toml:12, so all defaults are secure). Separately, CSRF_COOKIE_HTTPONLY=False (base.py:155) is the standard SPA double-submit pattern but has no explanatory comment, and CORS_ALLOW_CREDENTIALS=True (base.py:150) means any origin added to CORS_ALLOWED_ORIGINS gains fully credentialed API access.
- **Recommendation:** No code change needed; add a short comment on CSRF_COOKIE_HTTPONLY explaining the SPA rationale, and keep CORS_ALLOWED_ORIGINS strictly limited to the demo frontend origin.
- **Fix:** Safe to fix now

### [Settings & configuration] django.contrib.admin installed but never routed

- **Where:** `backend/config/settings/base.py:41`
- **Finding:** django.contrib.admin is in INSTALLED_APPS (base.py:41) but config/urls.py registers no admin URL — the admin is unreachable, which is good attack-surface reduction for a public demo, though the app (and its staticfiles needs) are dead weight. Relatedly, there is no static-serving story for prod (no whitenoise dependency in pyproject.toml), which only matters if admin or other server-rendered pages are ever enabled.
- **Recommendation:** Either remove django.contrib.admin from INSTALLED_APPS for the API-only backend, or if the admin is wanted later, route it under a non-default path with staff-only access and add whitenoise for static assets.
- **Fix:** Safe to fix now

### [Authentication & accounts] LOGIN_FAILED audit stores the attempted identifier verbatim

- **Where:** `backend/apps/audit/signals.py:35`
- **Finding:** audit_login_failed records credentials['username'/'email'] into AuditEvent.metadata in plaintext (signals.py:35-41). If a user accidentally types their password into the email field, that secret is persisted in the audit table (the existing assert_password_not_stored tests only cover the wrong-password case, not field-swap). This is a common, accepted trade-off but worth recording.
- **Recommendation:** Consider truncating/normalising the stored identifier or documenting the trade-off; do not log values that fail basic email-shape validation.
- **Fix:** Safe to fix now

### [Authentication & accounts] User profile PATCH is the only user mutation without an audit event

- **Where:** `backend/apps/accounts/user_views.py:75`
- **Finding:** UserDetailView.patch (user_views.py:75-80, full_name only) writes no AuditEvent, while create/delete/deactivate/reset-password/reassign-membership all do. Minor inconsistency in an otherwise complete auth audit trail.
- **Recommendation:** Record a USER_UPDATED-style audit event on PATCH for consistency.
- **Fix:** Safe to fix now

### [RBAC & tenant scoping] PHARMACIST (pharmacy-scoped role) holds group-wide backup powers by design

- **Where:** `backend/apps/backups/views.py:29`
- **Finding:** _require_backup_operator (backups/views.py:29-33) admits ADMIN and PHARMACIST; the pharmacist is then mapped to their pharmacy's whole GROUP (line 45-46), so a single-pharmacy pharmacist can view/edit the group backup schedule (BackupScheduleView.get/put, lines 59-75), list group backup runs (line 78-86), and trigger group-wide backups (line 89-96) covering sibling pharmacies they otherwise cannot see. Deliberate (restore/delete stay ADMIN-only), but it is the one place a pharmacy-scoped role acts at group scope.
- **Recommendation:** Record as an accepted design decision for the public demo, or restrict schedule edit/run-now to ADMIN (and later SUPERINTENDENT) if group-level control should not sit with a pharmacy-scoped role.
- **Fix:** Deployment-dependent / future work

### [RBAC & tenant scoping] PickingListView uses the unscoped default manager instead of the scoped manager

- **Where:** `backend/apps/blister/views.py:613`
- **Finding:** PickingListView.get queries `PatientMedication.objects.filter(patient=patient, is_active=True)` (blister/views.py:613) while the sibling StockPreviewView uses `PatientMedication.scoped.for_user(request.user)` (line 681). Not exploitable — `patient` is fetched via patients_for(request.user) (line 590) so the rows are necessarily in scope — but it breaks the codebase convention that patient-data queries always go through the scoped manager.
- **Recommendation:** Switch to PatientMedication.scoped.for_user(request.user).filter(patient=patient, is_active=True) for consistency and to keep grep-based scoping audits clean.
- **Fix:** Safe to fix now

### [RBAC & tenant scoping] SUPERINTENDENT holds AUDIT_VIEW capability but the audit selector returns an empty queryset for them

- **Where:** `backend/apps/audit/selectors.py:24`
- **Finding:** ROLE_CAPABILITIES grants SUPERINTENDENT Action.AUDIT_VIEW (tenancy/permissions.py:76), and the /me payload advertises audit.view=true (accounts/views.py:47), but audit_events_for returns queryset.none() for superintendents with an in-code comment deferring group-scoped, patient-safe audit visibility (audit/selectors.py, final branch). Fails closed — correct direction — but the capability map and actual behavior disagree, which can look like a bug in the demo UI.
- **Recommendation:** Keep the fail-closed behavior; either drop AUDIT_VIEW from SUPERINTENDENT until the patient-action allowlist exists, or implement the allowlisted group-scoped audit feed. Document whichever is chosen.
- **Fix:** Deployment-dependent / future work

### [RBAC & tenant scoping] Pharmacist can reset passwords of and deactivate peer pharmacists in the same pharmacy (lateral takeover within pharmacy is by design)

- **Where:** `backend/apps/accounts/user_views.py:127`
- **Finding:** UserResetPasswordView/UserDeactivateView are gated by require(USER_RESET_PASSWORD)/require(USER_DEACTIVATE) which PHARMACIST holds, and users_visible_to (accounts/selectors.py:6-16) exposes all pharmacy-scoped members of the pharmacist's own pharmacy — including other PHARMACISTs. Scope is otherwise tight: admins are invisible to pharmacists (admin memberships have null pharmacy), role assignment is capped at PHARMACIST/DISPENSER within own pharmacy (accounts/serializers.py:263-271), delete is ADMIN-only, and self-targeting is blocked (user_views.py:84, 108, 155). Reset also forces must_change_password=True (line 138). This matches the declared capability model but means any pharmacist can take over a peer pharmacist account.
- **Recommendation:** Accept and document for the demo, or restrict pharmacist-initiated reset/deactivate to DISPENSER targets if peer-pharmacist takeover is undesirable.
- **Fix:** Deployment-dependent / future work

### [API & serializers] Analytics model serializers declare no read_only_fields and rely on output-only usage

- **Where:** `backend/apps/analytics/serializers.py:36`
- **Finding:** ForecastItemSerializer, ForecastRunSerializer and TransferSuggestionSerializer are ModelSerializers with no Meta.read_only_fields, so model fields such as 'status', 'confidence', 'horizon_days' would be client-writable if these serializers were ever bound to request data. Today this is safe: verified all write paths go through ForecastGenerateSerializer / TransferSuggestionGenerateSerializer plus scope-checked services (backend/apps/analytics/services.py:889, 1022, 1128, 1153; state transition guarded at 1158-1160), and the three serializers are only ever instantiated with model instances for output (backend/apps/analytics/views.py). Recording as future-proofing, not a current defect.
- **Recommendation:** Add 'read_only_fields = fields' to the Meta of these output-only serializers so a future ListCreate/Update wiring cannot silently make status or metrics client-writable.
- **Fix:** Safe to fix now

### [Frontend] /catalogue route (MedicationsScreen) is unreachable from navigation

- **Where:** `frontend/src/app/AppRouter.tsx:91`
- **Finding:** AppRouter defines /catalogue gated by medication.view (AppRouter.tsx:91-97), but navConfig.ts has no corresponding NAV_ITEMS entry and no other component links to "/catalogue" (grep: the only match is the route definition). Every other permission-gated route has a matching nav item with identical requiredAnyOf sets. The screen is still correctly permission-protected, so this is discoverability/dead-route hygiene, not a security gap.
- **Recommendation:** Either add a 'Medications' nav item under Inventory with requiredAnyOf: ["medication.view"], or remove the route if the catalogue is only meant to be reached through CatalogueProductSelect embedded flows. Product decision required.
- **Fix:** Deployment-dependent / future work

### [Docker & deployment] Base images pinned to major-version tags only (no minor/digest pinning)

- **Where:** `docker-compose.yml:3`
- **Finding:** postgres:17-alpine (docker-compose.yml:3), python:3.13-slim (backend/Dockerfile:1), node:22-alpine (frontend/Dockerfile:1). This is reasonable hygiene — no 'latest' anywhere — but builds are not fully reproducible: a new minor/patch release of any base image changes what a rebuild produces.
- **Recommendation:** For the graded/demo artifact this is fine. If reproducibility matters later, pin to a digest (image@sha256:...) or at least minor versions, and let a bot (Renovate/Dependabot) bump them.
- **Fix:** Safe to fix now

### [Docker & deployment] Dependency-caching layer installs a partial copy of the project itself into site-packages

- **Where:** `backend/Dockerfile:11`
- **Finding:** Lines 8-11 copy only pyproject.toml and config/ then run 'pip install .', which installs the project package (with only the 'config' package present at that layer — [tool.setuptools.packages.find] includes config* and apps*, and apps/ is not yet copied) into site-packages purely to get the dependencies. At runtime Django runs from /app so the stale site-packages copy of 'config' is shadowed and harmless, but it is a latent import-shadowing trap and defeats layer caching whenever config/ changes.
- **Recommendation:** Install dependencies without installing the project: e.g. 'pip install --no-cache-dir $(python -c ...)' via a requirements export, or pip install with a constraints/requirements.txt generated from pyproject, or simply 'pip install --no-cache-dir .' after the full COPY and accept the cache loss. Cheapest fix: copy only pyproject.toml and use 'pip install --no-cache-dir .[dev]' with a dummy empty package, or move to 'dependency-groups' + pip 25's --group flag.
- **Fix:** Safe to fix now

### [Backup & data protection] No key-rotation support for either backup key or patient field keys

- **Where:** `backend/apps/patients/crypto.py:22`
- **Finding:** Backup archives carry a format version in the magic header (AIPMB1) but no key identifier, and there is a single BACKUP_ENCRYPTION_KEY; rotating it makes all prior .zip.enc archives unrestorable with the new config. Patient fields use a single Fernet key (crypto.py:22-27) rather than MultiFernet, so PATIENT_FIELD_KEY rotation would require an offline re-encrypt migration; PATIENT_INDEX_KEY rotation invalidates every stored last_name_index.
- **Recommendation:** Future work: accept a list of backup keys for decrypt (try-newest-first), use cryptography.fernet.MultiFernet for patient fields, and add a management command to re-encrypt rows and rebuild blind indexes.
- **Fix:** Deployment-dependent / future work

### [Backup & data protection] ORM filters on EncryptedTextField silently match nothing (footgun, currently unused)

- **Where:** `backend/apps/patients/fields.py:16`
- **Finding:** EncryptedTextField.get_prep_value (fields.py:16-20) encrypts with a fresh Fernet nonce, so e.g. Patient.objects.filter(first_name="X") compares a new ciphertext to the stored one and always returns an empty queryset with no error. Verified no production code does this today — patient search uses the plaintext patient_reference plus last_name_index=blind_index(search) (apps/patients/views.py:58) — but nothing prevents a future contributor from writing such a filter.
- **Recommendation:** Override get_lookup on the encrypted field classes to raise NotSupportedError for anything other than isnull, so bad filters fail loudly instead of returning empty results.
- **Fix:** Deployment-dependent / future work

### [Backup & data protection] Backups retain staff email addresses via PatientNote.author_email despite user-FK nulling

- **Where:** `backend/apps/patients/models.py:111`
- **Finding:** USER_REFERENCE_FIELDS nulls patients.patientnote author (services.py:43-52), but PatientNote.author_email is a plain CharField (models.py:111) and is serialized into data.json, so archives contain staff emails (not patient PII, no password hashes — the User model is never serialized, consistent with the manifest excludes list at services.py:318-327). Inside encrypted archives this is fine; in dev unencrypted .zip archives it is plaintext.
- **Recommendation:** Record the design decision (attribution kept via email by intent) in docs/BACKUP_AND_RESTORE.md, or add author_email to a redaction list if attribution is not needed in archives.
- **Fix:** Safe to fix now

### [Tests & dependencies] psycopg[binary] wheels used; fine for demo, not the recommended production variant

- **Where:** `backend/pyproject.toml:16`
- **Finding:** Dependency 'psycopg[binary]>=3.2,<4.0' (pyproject.toml:16) installs the pre-built binary wheels, which the psycopg project documents as convenient for development but recommends replacing with the source/c build in production. Correct choice for this synthetic-data demo; recording it so it is revisited if the stack ever hardens. All other pins are sane bounded ranges on well-maintained packages (Django 5.2 LTS, DRF 3.15, cryptography 43-45); nothing deprecated or known-vulnerable was found in either manifest, and the resolved lockfile versions (react 19.2.7, vite 8.0.16, vitest 4.1.9, playwright 1.61.0, typescript 6.0.3) all satisfy their declared ranges.
- **Recommendation:** No action now. Note in DEPLOYMENT.md that a hardened deployment should evaluate psycopg[c] or a system libpq build.
- **Fix:** Deployment-dependent / future work

### [Documentation] 'Secure web application' / 'Secure pharmacy operations system' slightly oversells a self-declared non-hardened prototype

- **Where:** `README.md:3`
- **Finding:** README.md:3 opens with 'A secure web application...' and docs/GITHUB_REPO_SETUP.md:21 uses 'Secure pharmacy operations system' as the applied GitHub About description, while README.md:270-272 and docs/SECURITY_AND_DATA_PROTECTION.md honestly state it is 'a prototype, not a production-hardened system'. All the specific security claims (encryption at rest, RBAC, audit) are accurate and verified; only the leading adjective is stronger than the docs' own caveats.
- **Recommendation:** Consider 'security-focused academic prototype' or similar in the README opening line and About description; no other change needed.
- **Fix:** Safe to fix now

### [Documentation] mypy invocation differs between README/INSTALLATION (mypy apps) and CI/evidence docs (mypy .)

- **Where:** `README.md:219`
- **Finding:** README.md:219 and docs/INSTALLATION.md:158 tell developers to run `mypy apps`, while .github/workflows/ci.yml:44, docs/demo-evidence.md:123, docs/demo-script.md:130 and both phase-acceptance docs use `mypy .`. `mypy .` additionally checks config/ and backend/tests/, so a developer following the README does not reproduce the CI gate exactly.
- **Recommendation:** Standardise on `mypy .` (the CI command) in README and INSTALLATION.
- **Fix:** Safe to fix now

### [Documentation] FILE_MANIFEST references a 'known recurring bug note' that exists nowhere in the repository

- **Where:** `docs/FILE_MANIFEST.md:74`
- **Finding:** The frontend/src/lib/ row's note says 'smartSearch getLabel must be field-derived per known recurring bug note.' No such note exists in the repository (it lives in the author's private assistant memory), so for any repo reader this is a dangling reference to an inaccessible document.
- **Recommendation:** Either inline the one-sentence constraint ('getLabel values must come from getFields or picking a suggestion empties the list') as a code comment in frontend/src/lib and reference that, or drop the phrase 'per known recurring bug note'.
- **Fix:** Safe to fix now

### [Documentation] Untracked local-only docs (AT3_*.md, docs/AT3_DATA_FLOW.md, OWN_COMPUTER_SETUP_GUIDE.*) are clean of developer-tool wording

- **Where:** `AT3_DEMO_CHECKLIST.md:106`
- **Finding:** These local-only files were checked for developer-tool / assistant wording since they may be committed later. A scan across all seven untracked files returned a single innocuous hit — a reference to keeping the mouse pointer still while presenting (AT3_DEMO_CHECKLIST.md:106) — not tooling wording. They remain untracked (`git status: ??`), so nothing in them affects the tracked documentation set today.
- **Recommendation:** No change needed; re-run the same wording check if these files are ever committed.
- **Fix:** Deployment-dependent / future work

## Remediation plan (by phase)

This audit is Phase 0. Fixes are sequenced through subsequent phases, each a small reviewed commit:

- **Phase 1 — Production settings:** fail-safe `wsgi/asgi` default, explicit `LOGGING`, `X_FRAME_OPTIONS`/referrer-policy, session lifetime, `DATABASE_URL` guard, move `BACKUP_ROOT` out of `MEDIA_ROOT`, `.env.example` sync.
- **Phase 2 — Deployment:** Oracle/free-VM guide, reverse proxy (HTTPS-only), firewall, `docker-compose.prod.yml`, deploy scripts.
- **Phase 3 — Backups:** confirm/strengthen encryption coverage (checksum verification, clean 400s, delete-endpoint tests).
- **Phase 4 — RBAC & scope:** object-level scope checks, backups group-scope guard, analytics scoped ID resolution, cross-tenant denial tests.
- **Phase 5 — Frontend:** global 401 handling, error boundary, query-cache clear on logout, production SPA serving path.
- **Phase 6 — Docker & deps:** `.dockerignore`, gunicorn + WhiteNoise, non-root, healthchecks, production run command.
- **Phase 7 — Observability:** logging/health guidance, deployment checklist.
- **Phase 8 — Docs:** correct stale claims/counts, demo-account rotation guidance, industry hardening report.
