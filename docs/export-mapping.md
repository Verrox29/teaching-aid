# Pairagogie Export Mapping

Version: `v2`
Template version: `v1`

This document is the source of truth for the current Pairagogie Excel export.
The mapping is centralized in one structured definition and is validated against
the real workbook before activation or download.

## Files audited

- `templates/grille-pairagogie.xlsx`
- `templates/manually-filled-reference-workbook.xlsx`
- latest local debug workbook provided for review

## Audit result

The current tracked template is a two-sheet workbook:

- report sheet: `REPORT des notes par étudiant`
- group template sheet: `Fiche éval group 1`

The previous `v1` single-sheet `Pairagogie` mapping was not aligned with the
actual workbook and has been replaced.

The manually filled reference workbook confirmed the business semantics, but it
does not match the current template row-for-row:

- the current template keeps the report sheet layout
- the current template keeps the group-sheet header layout
- the current template places rubric content at rows `18-38`
- the manually filled reference workbook uses the same semantics but its filled
  group sheets are shifted two rows earlier in the rubric/comment area

For exports, the real template file remains the source of truth for layout and
coordinates. The reference workbook is used only to confirm intended field
placement and data meaning.

## Rules

- Use the real Excel template workbook as the base workbook.
- Do not recreate workbook structure from scratch.
- Keep sheet order, merges, formulas, column widths, row heights, and template styling.
- Do not scatter raw coordinates across the codebase.
- Use one central semantic mapping definition, one validator, and one renderer.
- Rubric labels and max points come from the template only.
- Final exports use final teacher-controlled saved data only.

## Business fields

Use these session fields consistently:

- `programme`
- `className`
- `subject`
- `season`
- `professorName`
- `sessionDate`

## Mapping structure

The active mapping is centralized as:

- `reportSheet`
- `groupSheet`
- `templateVersion`
- `version`

Supported selector shapes in the mapping:

- fixed cell
- merged-cell origin
- repeated vertical range
- per-student table rows
- formula cell expectation
- anchor label expectation

## Report sheet mapping

Sheet: `REPORT des notes par étudiant`

Expected merged ranges:

- `C2:D2`
- `C3:D3`

Session/report fields:

- `report.professorName` -> `C2:D2`
- `report.sessionDate` -> `F2`
- `report.subject + report.programme` -> `C3:D3`
- `report.className` -> `E3`
- `report.season` -> `F3`

Per-student rows:

- start row: `5`
- max rows: `954`
- columns:
  - `firstName` -> `B`
  - `lastName` -> `C`
  - `groupName` -> `D`
  - `totalScore` -> `E`
  - `remarks` -> `F`

Expected anchors:

- `B1 = MERCI DE REPORTER TOUTES LES NOTES DE CHAQUE ETUDIANT SUR CE FICHIER`
- `B2 = INTERVENANT ( Prénom, Nom):`
- `E2 = DATE soutenance:`
- `B3 = Intitulé COURS et Programme :`
- `B4 = Prénom étudiant`
- `C4 = Nom Etudiant`
- `D4 = Numéro de groupe`
- `E4 = Note /20`
- `F4 = remarques`

## Group sheet mapping

Template sheet: `Fiche éval group 1`

Expected merged ranges:

- `B1:E1`
- `B2:E2`
- `B3:E3`
- `B4:E4`
- `B38:E38`

Session/group fields:

- `group.programme` -> `B2:E2`
- `group.className` -> `B3:E3`
- `group.subject` -> `B4:E4`
- `group.titleLine` -> `B6`
- `group.studentNames[]` -> `B7:B15`

Important note:

- `group.titleLine` is validated and shown in debug mode
- normal export preserves the template title line text

Rubric score inputs:

- block 1 scores -> `C19:C22`
- block 1 subtotal formula -> `D23 = SUM(C19:C22)`
- block 1 max total label -> `E23 = /7`
- block 2 scores -> `C25:C32`
- block 2 subtotal formula -> `D33 = SUM(C25:C32)`
- block 2 max total label -> `E33 = /13`
- final score formula -> `D35 = SUM(C19:C32)`
- final max total label -> `E35 = /20`

Comments:

- `group.comments` -> `B38:E38`

Expected anchors:

- `B1 = EVALUATION  COMPETENCES (PAIRAGOGIE)`
- `B6 = GROUPE 1 - liste des étudiants (Prénom-Nom)`
- `C6 = Présence (OUI/NON)`
- `B18 = 1 - Support de présentation`
- `B24 = 2- Soutenance orale, réponse aux questions & évaluation par les pairs`
- `B37 = COMMENTAIRES (OBLIGATOIRES pour feed back étudiants)`
- `E23 = /7`
- `E33 = /13`
- `E35 = /20`

## Render rules

- Keep the report sheet as the first sheet.
- Clone the real group template sheet once per group.
- Use the template’s rubric labels and max-score labels as-is.
- Only write score inputs into the mapped score cells.
- Keep subtotal and total formulas intact while updating cached values.
- Write comments only into the mapped comments merge origin.

## Debug export rules

The debug workbook preserves the template layout and writes semantic labels into
mapped destinations for manual review.

Examples:

- `report.professorName`
- `report.sessionDate`
- `report.subject + report.programme`
- `report.students[1].firstName`
- `report.students[1].groupName`
- `group.programme`
- `group.className`
- `group.subject`
- `group.titleLine`
- `group.studentNames[1]`
- `group.scores.block1[1]`
- `group.scores.block2[1]`
- `group.totalScore`
- `group.comments`

To preserve template fidelity:

- rubric labels are not overwritten in debug mode
- max-score cells are not overwritten in debug mode
- formula cells remain formulas in debug mode
- total-score debug text is written to a nearby score cell instead of the formula cell

## Validation requirements

Before activation or export, validate:

- report sheet exists
- group template sheet exists
- required merged ranges exist
- expected anchor labels still match
- required formula cells still match the template formulas
- report row capacity still exists
- group comment row still exists

If invalid:

- fail clearly
- identify the missing or mismatched sheet, label, merge, or formula

## Settings page requirements

The admin export settings page must continue to support:

- upload / replace Excel template
- paste / edit structured mapping JSON
- validate template + mapping
- activate a template / mapping version

A visual remapping tool is still out of scope.
