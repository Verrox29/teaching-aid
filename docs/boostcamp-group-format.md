# BoostCamp Group CSV Format

## Purpose
This file defines the CSV format required to create/add groups in BoostCamp.

## Delimiter
Use comma `,`

## Columns
The CSV must contain exactly these columns, in this exact order:

1. nom
2. prenom
3. username
4. code_groupe
5. nom_groupe
6. operation

## Row rules
- one row per student
- `nom` = student's last name
- `prenom` = student's first name
- `username` = student's school email
- `code_groupe` and `nom_groupe` must have the exact same value
- `operation` must always be `AJOUT`

## Group naming rule
Use:
`{className} - Group {groupNumber}`

Examples:
- `Class 1 - Group 1`
- `Class LMM - Group 2`
- `Classe 3j2j - Group 3`

## Source of truth
Use the final teacher-managed group assignments stored in the app.

## Export rules
- export one row per assigned student
- do not export unassigned students