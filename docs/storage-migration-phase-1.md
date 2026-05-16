# Storage Migration Phase 1 (Safe, Reversible)

## Goal

Move large artifact payloads out of Postgres over time, while keeping Postgres as the metadata and lookup layer.

This phase is intentionally additive only. No runtime reads/writes are switched yet.

## Current Storage Inventory

### 1) Student work uploads (large binary payloads)

- DB table/field: `submissions.content` (`text`, base64 payload)
- Metadata in DB: `submissions.id`, `session_id`, `group_id`, `title`, `submitted_at`
- Main writers:
  - `src/app/api/sessions/[sessionId]/submissions/[groupId]/route.ts`
  - `src/app/sessions/[sessionId]/order/actions.ts`
- Main readers:
  - `src/app/api/sessions/[sessionId]/submissions/[groupId]/route.ts`
  - `src/app/api/sessions/[sessionId]/submissions/archive/route.ts`
  - `src/lib/evaluation/repository.ts`
  - `src/lib/exports/repository.ts`

### 2) Export template binaries (large binary payloads)

- DB table/field: `export_template_versions.content_base64` (`text`, base64 workbook)
- Metadata in DB: `version`, `file_name`, `checksum`, `is_active`, timestamps
- Main writers/readers:
  - `src/lib/exports/repository.ts`
  - `src/app/sessions/[sessionId]/exports/actions.ts`
  - `src/app/api/sessions/[sessionId]/exports/pairagogie/route.ts`

### 3) Generated/evaluation text and JSON content (non-binary but potentially large)

- `evaluations.teacher_notes`
- `evaluations.comments`
- `evaluations.final_feedback`
- `evaluations.ai_recommended_feedback` (jsonb)
- `evaluations.ai_recommended_questions` (jsonb)
- `evaluation_scores.feedback`

Current behavior relies on these fields in evaluation and export flows, so they remain in DB for now.

## Risks With Current Large-Artifact DB Storage

- Base64 inflates payload size and increases row/TOAST pressure.
- Upload/download and evaluation/export reads move large payloads through DB repeatedly.
- Artifact bytes and metadata are tightly coupled in the same row model.

## Phase 1 Decision (This Change)

Define the file-storage model and reference contract first, without changing behavior:

- Add typed artifact reference model.
- Add deterministic, sanitized repo-relative path builders for:
  - submission uploads
  - export templates
- Keep DB as source-of-truth metadata/lookup.
- Keep current blob fields unchanged for now.

## Why This Phase Is Reversible

- No schema changes.
- No read-path switches.
- No write-path switches.
- No backfill.
- Existing DB content and user-visible behavior remain intact.

## Next Phases (Not Implemented Here)

1. Add write-through to file storage for new artifacts (while retaining DB writes).
2. Add read adapter with DB fallback.
3. Backfill old DB artifact payloads.
4. Switch reads to file storage.
5. Deprecate old DB blob fields once stable.
