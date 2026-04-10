# Project State

## Product Goal

Teacher/admin web app to manage peer-to-peer sessions from student import to grading and export.

## Current Teacher/Admin Timeline

1. Student import
2. Group creation
3. Group enrolment
4. Presentation order & upload
5. Evaluation workspace
6. Grille & grades export

## Completed Modules

- Sessions foundation
- Session creation
- Student import
- Group management
- Student self-selection
- Group lock / unlock
- Presentation order & upload
- AI scoring & feedback
- Export architecture/module has been implemented and validated in Local mode against the real repo files, including a debug export preview for Pairagogie mapping review

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
- Step 5 is the live evaluation workspace: presentation order is visible there, teacher notes autosave, and AI recommendations are per group and advisory only
- Session/business fields:
  - `programme`
  - `className`
  - `subject`
  - `season`
  - `professorName`
  - `sessionDate`

## Confirmed Design / System Decisions

- App UI stays in English for now
- Translation later
- Docker-first local workflow
- GitHub is source of truth
- Supabase is planned production database target
- Local development DB remains Docker Postgres
- Dark/light mode exists
- Timeline should stay visible on admin pages
- Width/layout should be consistent across admin pages

## Known Issues / Items That Still Need Validation

- File-dependent work was done in Worktree, so export module must be validated in Local mode against the actual repo files
- Future file-dependent tasks should prefer Local mode
- Export module should not be considered fully final until validated locally with the actual template and mapping files

## Next Recommended Action

- Start a new Local thread
- Validate/refine Module 6 exports using the actual repo files
- Then continue polish/final export behavior as needed
