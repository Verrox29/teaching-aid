# Project State

## Product Goal

Teacher/admin web app to manage peer-to-peer sessions from student import to grading and export.

## Current Teacher/Admin Timeline

1. Pairagogie & students setup
2. Group creation & enrolment
3. Presentation order & upload
4. AI scoring & feedback
5. Grille & grades export

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
- Step 1 is Pairagogie & students setup: session metadata stays there, `Subject` drives the session title, class language is stored on the session, and student import/update opens in the floating modal from the session page
- Step 2 is group creation & enrolment: group creation and enrolment are unified on one page, with enrolment status shown at the top
- Step 3 is presentation order & upload: presentation order and uploaded work live together in the same workflow
- Step 4 is the live evaluation workspace: presentation order is visible there, teacher notes autosave, and AI recommendations are per group and advisory only
- Step 5 is Grille & grades export: exports stay template-driven, use the current Pairagogie mapping layer, and the shared export/admin settings live in the sessions hub rather than inside a session page
- Session resume from `/sessions` uses the last meaningful admin step/page when available, otherwise it opens Pairagogie & students setup
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
