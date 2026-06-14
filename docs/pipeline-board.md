# Dispensing Pipeline Board

A store-wide view of every job moving through the pharmacy — from a new request to
collected/delivered — so staff can see and act on the whole operation at a glance.
Inspired by a real dispensing queue (screenshots 13–17 in the
[screenshot study](screenshot-inventory.md)) but implemented originally in our own
design language. **Simulated data only — no NHS/EPS, no external systems.**

- Frontend: [`frontend/src/pages/Pipeline.jsx`](../frontend/src/pages/Pipeline.jsx) at `/pipeline`.
- Backend: [`backend/apps/workflow/`](../backend/apps/workflow) → `GET /api/workflow-jobs/board/` and actions.

---

## Purpose

Each **WorkflowJob** is one unit of work for a patient — a prescription, a dosette
pack, or a stock issue. Jobs span all patients, grouped into status columns with
per-column counts, so a dispenser can pick up the next job and a pharmacist can see
what needs their attention, without browsing patient lists.

A job shows: patient name + DOB + ID, job type, priority, due date (with an overdue
flag), assigned staff, current status, issue notes, and an **AI suggestion**.

## Status lifecycle

```
New → Picking required → Picking in progress → Picked → Accuracy check → Ready → Collected / Delivered
                                                                              ▲
        (any active status) ───────────────► Issue found ──────────────► (back into the flow)
```

Only **valid** steps are allowed (enforced server-side in
`apps/workflow/models.py::VALID_NEXT`). An issue can be raised from any active
status; resolving an issue routes the job back into the flow. `Collected` is
terminal.

## Role permissions

Mirrored in the UI and **enforced by the API** (`apps/workflow/models.py` role rules):

| Action | Administrator | Pharmacist | Dispenser |
|---|---|---|---|
| View board / job / history | ✅ | ✅ | ✅ |
| Move New → Picking → Picked | ✅ | ✅ | ✅ |
| Raise an issue | ✅ | ✅ | ✅ |
| **Accuracy check (→ Ready)** | ✅ | ✅ | ❌ |
| **Resolve an issue** | ✅ | ✅ | ❌ |
| Mark Collected | ✅ | ✅ | ✅ |
| Assign a job | ✅ | ❌ | ❌ |
| Create / edit / delete a job | ✅ (all) · create also ✅ pharmacist | create ✅ | ❌ |

The accuracy-check sign-off and issue resolution are **pharmacist-only** — a
dispenser can pick and raise issues but cannot sign off the check. Every change is
written to the immutable audit log and to the job's status history.

## API

| Method | Endpoint | Notes |
|---|---|---|
| GET | `/api/workflow-jobs/board/` | Jobs grouped into status columns + counts + AI summary. Filters: `status`, `job_type`, `priority`, `assigned_to`, `mine=1`, `q`, `include_collected=1`. Collected excluded by default. |
| GET | `/api/workflow-jobs/` | Flat list (same filters). |
| POST | `/api/workflow-jobs/` | Create (admin/pharmacist). `status` defaults to `new`. |
| POST | `/api/workflow-jobs/{id}/transition/` | `{to_status, note}` — validated (graph + role). |
| POST | `/api/workflow-jobs/{id}/raise-issue/` | `{note}` — any staff. |
| POST | `/api/workflow-jobs/{id}/resolve-issue/` | `{to_status, note}` — pharmacist/admin. |
| POST | `/api/workflow-jobs/{id}/assign/` | `{assigned_to}` — admin only. |
| GET | `/api/workflow-jobs/{id}/history/` | Status-change history. |

## AI recommendation logic

[`apps/workflow/ai.py`](../backend/apps/workflow/ai.py) — heuristic, **explainable**
decision support. It never changes a job automatically; staff always act. Each
suggestion carries a **reason**, a **confidence score**, a **suggested action**, a
**severity**, and the **linked job id**. The most important suggestion per job is
shown; the board also returns an AI summary (counts of overdue / needs-pharmacist /
stock-warnings / due-soon).

Signals (highest severity wins):

| Signal | Severity | Conf. | Suggested action |
|---|---|---|---|
| Overdue (due date passed) | danger | 0.95 | `expedite` |
| Issue raised | danger | 0.92 | `resolve_issue` |
| A required medicine at/under reorder level | danger | 0.80 | `order_stock` |
| Earliest in-date batch expires before due (FEFO) | warning | 0.78 | `use_alternative_batch` |
| Awaiting accuracy check | warning | 0.90 | `pharmacist_accuracy_check` |
| Due within 2 days | info | 0.82 | `prepare_soon` |

This reuses the explainable style of the forecasting engine and ties into existing
stock/expiry/FEFO data.

## Accessibility

- **Button-driven movement** (no drag-drop dependency) — every status move is a
  keyboard-focusable button; controls have ARIA labels.
- Status and priority are shown by **icon + text**, never colour alone; overdue
  cards add a text "Overdue Nd" plus a ring.
- Filters, search, modals (focus-trapped) and columns are all keyboard-operable;
  the board is a labelled list/region structure for screen readers.
- Horizontal-scrolling columns work on mobile; cards reflow.

## Testing

Backend ([`apps/workflow/tests.py`](../backend/apps/workflow/tests.py), run with
`docker compose exec backend pytest apps/workflow/`):

- board groups jobs by status and hides collected by default;
- all roles can view the board;
- dispenser can start picking and mark picked;
- **accuracy check is pharmacist-only** (dispenser → Ready returns 403; pharmacist 200);
- invalid transitions rejected (New → Ready is 400);
- admin can complete the full pipeline;
- **assign is admin-only** (dispenser/pharmacist 403);
- dispenser raises an issue, pharmacist resolves (dispenser resolve 403);
- create-job role rules; status history records transitions;
- AI flags overdue jobs and the board AI summary counts them.

Frontend: `npm run lint`, `npm test`, `npm run build`. The board was verified live
(admin transition updates counts; dispenser sees "Awaiting pharmacist" and no
Resolve button; sidebar hides Patients/Dosette for dispenser).

## Seeding

`python manage.py seed` (or `--flush`) populates ~80 workflow jobs derived from
dosette cycles plus a spread of prescription and stock-issue jobs, with mixed
statuses, priorities and due dates so the board and its AI prompts look live.
