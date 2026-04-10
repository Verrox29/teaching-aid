Pairagogie Export Mapping

Purpose

This file defines the current export mapping for the Pairagogie Excel export and related grades export.

This mapping is the source of truth for the current template version.

Rules:
- Do not scatter raw cell references across the codebase.
- Use one central mapping layer with semantic keys.
- Preserve template formatting, merged cells, formulas, colors, and layout.
- Do not overwrite formula cells unless explicitly stated.
- Rubric labels and maximum points come from the Excel template and are not editable from the UI.
- Rubric labels and max points only change if the template changes.

Current business fields

Use these business fields consistently:
- programme
- className
- subject
- season
- professorName
- sessionDate

Do not use "title" for this meaning.

Field meanings

- programme
  Example: M1 Luxury Fashion

- className
  Example: Class 1, Class LMM, Classe 3j2j, Classe 1 - 1s3s

- subject
  The course / module / subject name

- season
  Allowed values:
  - Fall
  - Spring

- professorName
  Teacher / professor full name

- sessionDate
  Date shown in the export

Workbook structure

The generated workbook must contain:
1. REPORT des notes par étudiant
2. One sheet per group:
   - Group 1
   - Group 2
   - etc.

Sheet: REPORT des notes par étudiant

Header mapping
- report.professorName -> C2
- report.sessionDate -> F2
- report.subject -> C3
- report.className -> E3
- report.season -> F3

Student report rows

Start at row 5.

For each student row:
- Column B -> student first name
- Column C -> student last name
- Column D -> group number
- Column E -> final group grade
- Column F -> final group comments

Rule
There must be one row per student.

All students belonging to the same group receive:
- the same final group grade
- the same final group comments

Group sheets

Each group must have one dedicated sheet.

Sheet name
Format:
- Group 1
- Group 2
- etc.

Header mapping
- group.programme -> B2
- group.className -> B3
- group.subject -> B4

Group title line
- group.titleLine -> B6

Format:
GROUP X - student list (First name-Last name)

Example:
GROUP 1 - student list (First name-Last name)

Student names
- group.studentNames -> B7:B16

Format:
First name Last name

Rule:
- Fill from B7 downward
- If fewer than 10 students, leave remaining cells blank

Scoring area

Fixed criteria labels from template
Do not overwrite:
- B19:B22
- B25:B32

Awarded scores
Write teacher-awarded scores into:
- C19:C22
- C25:C32

Fixed maximum points from template
Do not overwrite:
- D19:D22
- D25:D32

Formula cells
Keep these formulas from the template:
- D23 = subtotal for C19:C22
- D33 = subtotal for C25:C32
- D35 = final total

Do not replace these formula cells with hardcoded values.

Final grade source of truth
The final group grade is taken from:
- D35

This value must also be written into the report sheet for every student in the group:
- REPORT des notes par étudiant
- Column E

Comments

Final comments field
- group.comments -> B38

Note:
- this may be part of a merged zone in the template
- write the value into B38

Report propagation
The same final group comments must also be written into the report sheet for every student in the group:
- REPORT des notes par étudiant
- Column F

Data source rules

Exports must use final teacher-controlled saved data only.

Use:
- final criterion scores
- final total
- final comments / feedback
- saved session metadata
- saved group data
- saved student data

Do not use raw AI drafts as export source of truth.

Mapping architecture rule

The export implementation must use semantic keys, not scattered hardcoded cell references.

Preferred semantic keys include:

Report sheet
- report.professorName
- report.sessionDate
- report.subject
- report.className
- report.season
- report.studentRows

Group sheet
- group.programme
- group.className
- group.subject
- group.titleLine
- group.studentNames
- group.scores.block1
- group.scores.block2
- group.finalGrade
- group.comments

Validator requirements

Before activating a template/mapping or generating an export, validate:
- required sheets exist
- required cells/ranges exist
- required semantic keys exist in the mapping
- expected formula cells are present
- expected merged areas are usable where relevant

If invalid:
- fail clearly
- identify missing or broken mappings

Settings page requirements

The admin settings page for exports must later allow:
- upload/replace Excel template
- paste/edit mapping text or structured JSON
- validate template + mapping
- activate a template/mapping version

A full visual remapping tool is out of scope for now.

Notes / known constraints

- This mapping is for the current template version only
- If the template changes, rubric labels and maximum points may change with it
- The app should be designed so template replacement is manageable through versioned template + mapping
