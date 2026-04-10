# Pairagogie Export Mapping

Version: `v1`

This document is the source of truth for the current template-driven Pairagogie export.
It replaces the older hardcoded mapping approach and is designed to stay stable across
local Docker Postgres and production Supabase Postgres.

## Rules

- Do not scatter raw cell references across the codebase.
- Use one central mapping layer with semantic keys.
- Preserve template formatting, merged cells, formulas, colors, and layout.
- Do not overwrite formula cells unless explicitly stated.
- Rubric labels and maximum points come from the Excel template and are not editable from the UI.
- Rubric labels and max points only change if the template changes.

## Business fields

Use these session fields consistently:

- `programme`
- `className`
- `subject`
- `season`
- `professorName`
- `sessionDate`

Do not use `title` for these meanings.

## Template

- File: `templates/grille-pairagogie.xlsx`
- Sheet: `Pairagogie`

Template notes:
- `A1:F1` is merged.
- `B3:C3`, `E3:F3`, `B4:C4`, `E4:F4`, `B5:C5`, and `E5:F5` are merged.
- `B7:C7`, `E7:F7`, `B8:C8`, `E8:F8`, and `B9:F9` are merged.
- `A10:F10`, `B34:F34`, `B36:F37`, and `B39:F41` are merged.

## Semantic mapping

### Session fields

- `session.programme` -> `B3:C3`
- `session.className` -> `E3:F3`
- `session.subject` -> `B4:C4`
- `session.season` -> `E4:F4`
- `session.professorName` -> `B5:C5`
- `session.sessionDate` -> `E5:F5`

### Group fields

- `group.name` -> `B7:C7`
- `group.presentationOrder` -> `E7:F7`
- `group.submissionTitle` -> `B8:C8`
- `group.memberCount` -> `E8:F8`
- `group.members` -> `B9:F9`

### Rubric fields

- `rubric.totalScore` -> `C32`
- `rubric.teacherNotes` -> `B35:F35`
- `rubric.finalFeedback` -> `B36:F37`
- `rubric.challengeQuestions` -> `B39:F41`

### Rubric table

- Header row: `11`
- Start row: `12`
- Max rows: `20`
- Columns:
  - label -> `A`
  - maxScore -> `B`
  - score -> `C`
  - feedback -> `D`
  - aiDraft -> `E`

## Validation requirements

Before activating a template/mapping or generating an export, validate:

- required sheet exists
- required semantic keys exist in the mapping
- required cells/ranges exist in the template
- expected formula cells are present
- expected merged areas are usable where relevant
- the workbook labels still match the template:
  - `Pairagogie Evaluation`
  - `Programme`
  - `Class name`
  - `Subject`
  - `Season`
  - `Professor`
  - `Session date`
  - `Group`
  - `Presentation order`
  - `Submission`
  - `Member count`
  - `Members`
  - `Rubric`
  - `Criterion`
  - `Max`
  - `Score`
  - `Teacher feedback`
  - `AI draft`
  - `Total score`
  - `Teacher notes`
  - `Final feedback`
  - `Challenge questions`
- the total score cell remains a formula:
  - `C32 = SUM(C12:C31)`

If invalid:

- fail clearly
- identify missing or broken mapping entries

## Data source rules

Exports must use final teacher-controlled saved data only.

Use:

- final criterion scores
- final total
- final comments / feedback
- saved session metadata
- saved group data
- saved student data

Do not use raw AI drafts as export source of truth.

## Settings page requirements

The admin settings page for exports must support:

- upload / replace Excel template
- paste / edit mapping text or structured JSON
- validate template + mapping
- activate a template / mapping version

A visual remapping tool is out of scope for now.

## Notes

- This mapping is for the current template version only.
- If the template changes, rubric labels and maximum points may change with it.
- The app should stay versioned so template replacement remains manageable.
- A debug export preview mode may write semantic labels into mapped cells for visual verification.
