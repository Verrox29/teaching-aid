# Project State

## Product Goal

Teacher/admin web app to manage peer-to-peer sessions from student import to grading and export.

## Current Teacher/Admin Timeline

1. Pairagogie & students setup: session metadata lives here, `Subject` drives the session title, class language is stored on the session, and student import/update happens from the Step 1 setup flow.
2. Group creation: the groups page handles group creation, resize, lock/unlock, public enrolment access, ignore/restore, and membership changes.
3. AI scoring & feedback: the live evaluation workspace keeps presentation order visible, autosaves teacher notes, and uses per-group and batch AI support alongside manual scoring.
4. Grille & grades export: exports stay template-driven and the shared export/admin settings live in the sessions hub rather than inside a session page.

The presentation order & upload page still exists as part of the session workflow, but it is a separate page rather than a numbered step in the shared admin timeline.

## Completed Modules

- Sessions foundation
- Session creation
- Student import
- Group management
- Student self-selection
- Group lock / unlock
- Presentation order & upload
- AI scoring & feedback
- Branching AI admin settings (Module 1)
- Export architecture/module has been implemented and validated in Local mode against the real repo files, including a debug export preview for Pairagogie mapping review
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
- Pairagogie export includes a debug preview mode that writes semantic labels into mapped cells while keeping template formulas
- Pairagogie export dynamically extends the report sheet and group-sheet student area by copying template row styling when the data exceeds the visible base rows
- Step 1 is Pairagogie & students setup: session metadata stays there, `Subject` drives the session title, class language is stored on the session, and student import/update opens in the floating setup modal from the session page
- Step 2 is Group creation: groups are managed on the groups page, including resize, lock/unlock, public enrolment access, ignore/restore, and membership changes
- Step 3 is AI scoring & feedback: the evaluation workspace handles teacher scoring, notes, roster adjustments, batch AI support, and per-group feedback workflows
- Step 4 is Grille & grades export: exports stay template-driven, use the current Pairagogie mapping layer, and the shared export/admin settings live in the sessions hub behind a password gate rather than inside a session page
- Session resume from `/sessions` uses the last meaningful admin step/page when available; otherwise it opens Pairagogie & students setup, with evaluation as the fallback once presentation order or uploads already exist
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
- Docker-first local workflow
- GitHub is source of truth
- Supabase is planned production database target
- Local development DB remains Docker Postgres
- Dark/light mode exists
- Timeline should stay visible on admin pages
- Width/layout should be consistent across admin pages
- Shared admin header stays centralized across session admin pages and keeps only the top-level session controls plus the timeline bar
- Session context is edited from the shared Settings flow, and assignment brief editing also lives there
- Teacher admin floating windows use a small modal stack so nested windows show a Back button while top-level windows opened from the page/header do not
- In the shared Settings flow, Pairagogie & students setup opens the students setup window, while Session context opens the edit-session-context window directly
- Global export/admin settings live in the sessions hub behind a password gate; session pages no longer surface that settings experience
- New-session onboarding starts from Step 1 and auto-opens the students setup modal once, then uses the shared admin controls afterward
- Session language is stored on the session row and is used by evaluation/AI behavior

## Known Issues / Items That Still Need Validation

- File-dependent work was done in Worktree, so export module must be validated in Local mode against the actual repo files
- Future file-dependent tasks should prefer Local mode
- Export module should not be considered fully final until validated locally with the actual template and mapping files

## Next Recommended Action

- Start a new Local thread
- Validate/refine Module 6 exports using the actual repo files
- Then continue polish/final export behavior as needed
