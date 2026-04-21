# Project State

## Product Goal

Teacher/admin web app to manage peer-to-peer sessions from student import to grading and export.

## Current Teacher/Admin Timeline

1. Pairagogie & students setup: session metadata lives here, `Subject` drives the session title, class language is stored on the session, intake/season is edited from the Step 1 header and mirrored in the shared Settings session-context window, and student import/update happens from the Step 1 setup flow and the shared Settings flow. New-session onboarding starts here and auto-opens the students setup modal once.
2. Group creation: the groups page handles group creation, resize, lock/unlock, public enrolment access, ignore/restore, membership changes, and student-work upload/download entry points.
3. AI scoring & feedback: the live evaluation workspace keeps presentation order visible, reads the shared session-wide student-work submissions, autosaves teacher notes, and uses per-group and batch AI support alongside manual scoring and roster adjustments.
4. Grille & grades export: exports stay template-driven, Pairagogie uses the shared workbook mapping, the global export/admin settings live in the sessions hub behind the shared password gate, the normal session page no longer surfaces that settings experience, and `/sessions` resumes into the last meaningful admin step/page.

The presentation order page still exists as the detailed ordering workflow, and the same session-wide submission data is also available from the Groups page and the Sessions hub through modal upload and download entry points.

## Completed Modules

- Sessions foundation
- Session creation
- Student import
- Group management
- Student self-selection
- Group lock / unlock
- Presentation order & upload
- AI scoring & feedback
- Branching AI admin settings (Module 1), including editable challenge-question validation settings
- Export architecture/module has been implemented and validated in Local mode against the real repo files, with internal debug preview support retained behind an admin gate for future use
- Session deletion with shared confirmation flow and cascade-backed removal
- Sessions hub student-work upload and download entry points with shared per-group modal uploads, 10-day submission retention, and a ZIP download path
- Sessions hub interactive retention badge and lock badge confirmation flow
- Shared admin header / shell
- Shared admin header / shell now owns the top-level session controls, timeline, and session-language badge

## Current Export / Template Rules

- Source of truth files:
  - `docs/export-mapping.md`
  - `templates/grille-pairagogie.xlsx`
- Use template-driven export
- Use one central semantic mapping layer
- Do not scatter hardcoded cell references
- Keep formulas, merged cells, and styling from template
- Rubric labels/max points come from template only
- Pairagogie export uses the real two-sheet workbook structure:
  - `REPORT des notes par étudiant`
  - cloned group sheets from `Fiche éval group 1`
- Pairagogie export keeps its internal debug preview logic available, but normal UI flows do not surface debug panels
- Pairagogie export dynamically extends the report sheet and group-sheet student area by copying template row styling when the data exceeds the visible base rows
- Step 1 is Pairagogie & students setup: session metadata stays there, `Subject` drives the session title, class language is stored on the session, intake/season remains a shared session context field exposed in Step 1 and the shared Settings flow, and student import/update opens in the floating setup modal from the session page
- Step 2 is Group creation: groups are managed on the groups page, including resize, lock/unlock, public enrolment access, ignore/restore, membership changes, and student-work upload/download entry points
- Step 3 is AI scoring & feedback: the evaluation workspace handles teacher scoring, notes, roster adjustments, batch AI support, per-group feedback workflows, and keeps presentation order visible during live review
- Step 4 is Grille & grades export: exports stay template-driven, use the current Pairagogie mapping layer, and the shared export/admin settings live in the sessions hub behind a password gate rather than inside a session page
- Session resume from `/sessions` uses the last meaningful admin step/page when available; otherwise it opens Pairagogie & students setup, with evaluation as the fallback once presentation order or uploads already exist
- Sessions hub student-work visibility is session-wide: the hub shows the latest expiry for current uploads, opens a modal with per-group expiry and per-file downloads, and offers a ZIP archive for downloading all current uploads
- Sessions hub group selection status is interactive in the hub: the badge opens a confirmation modal before locking or unlocking groups
- Session/business fields:
  - `programme`
  - `className`
  - `subject`
  - `season` as intake
  - `professorName`
  - `sessionDate`

## Confirmed Design / System Decisions

- UI language is interface-wide, persisted, and separate from the session/class language
- Course/class language stays on the session row and drives AI output only
- The sessions hub and session settings modal share the same UI-language control and state
- The admin UI uses a centralized translation layer for the teacher/admin workflow
- App-wide interaction feedback is centralized through a shared provider so meaningful async work uses the same global pending overlay and the same portal-backed modal shell
- Debug UI surfaces stay hidden in normal session/admin flows and are centrally gated so they can later be re-enabled for authenticated admins
- Docker-first local workflow
- GitHub is source of truth
- Supabase is planned production database target
- Local development DB remains Docker Postgres
- Dark/light mode exists
- Timeline should stay visible on admin pages
- Width/layout should be consistent across admin pages
- Shared admin header stays centralized across session admin pages and keeps only the top-level session controls plus the timeline bar
- The shared admin header is the persistent top bar for session admin pages
- Session context is edited from the shared Settings flow, and assignment brief editing also lives there
- The Step 1 header and the shared Settings session-context window both expose the same session intake/season field
- Teacher admin floating windows use a small modal stack so nested windows show a Back button while top-level windows opened from the page/header do not
- In the shared Settings flow, Pairagogie & students setup opens the students setup window, while Session context opens the edit-session-context window directly
- Global export/admin settings live in the sessions hub behind a password gate; session pages no longer surface that settings experience
- Sessions hub row actions are intentionally limited to student-work upload/download access and session deletion, while the group-lock state is exposed as a clickable hub badge with confirmation
- Session deletion uses one shared destructive confirmation flow from both the shared Settings modal and the sessions hub, and the backend deletes the session row so the existing cascade relations remove dependent data
- New-session onboarding starts from Step 1 and auto-opens the students setup modal once, then uses the shared admin controls afterward
- Session language is stored on the session row and is used by evaluation/AI behavior
- Student work uploads are session-wide, stored in `submissions`, surfaced from the Groups page and the Sessions hub, and reused by the order, evaluation, and export flows
- Student work retention is 10 days from the real upload timestamp when available, with request-time cleanup on the read paths that surface submissions
- Student work downloads reuse the same `submissions` data path: current uploads are fetched per group, and the hub can bundle all current uploads into a server-generated ZIP archive

## Known Issues / Items That Still Need Validation

- None currently tracked for the confirmed workflow.

## Next Recommended Action

- Continue incremental feature work in Local mode, keeping new decisions aligned with the confirmed workflow above.
