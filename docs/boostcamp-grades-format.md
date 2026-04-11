# BoostCamp Grades CSV Format

## Purpose
This file defines the required CSV export format for BoostCamp grades import.

## Columns
The CSV must contain exactly these columns, in this exact order:

1. Adresse de courriel
2. Note
3. Commentaire

## Row rules
- one row per student
- use the student's school email as the unique identifier
- Note must contain the final teacher-approved grade
- Commentaire must contain the final teacher-approved feedback/comment
- students in the same group may receive the same grade and the same comment

## Source of truth
The export must use final teacher-controlled saved data only.
Do not use raw AI draft content as the final export source.

## Notes
- Commentaire may be long and may contain multiline text
- Keep CSV generation compatible with standard spreadsheet import