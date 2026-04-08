# Local Workflow

## Working Rules

- Work on `codex/V1-development` unless explicitly told otherwise.
- Keep changes minimal and production-oriented.
- Do not over-engineer.
- Do not modify unrelated files.

## Local Setup

- Local testing is Docker-first.
- Production database target is Supabase Postgres.
- Local development database is PostgreSQL in Docker.
- Docker Desktop is installed.
- PostgreSQL runs in Docker.
- The app runs in Docker.
- Browser testing happens on `http://localhost:3000`.
- GitHub is the source of truth.
- Codex pushes changes first, then the developer pulls locally and tests.

## Database Strategy

- Keep the database layer PostgreSQL-compatible and portable between local Docker Postgres and Supabase Postgres.
- Prefer Drizzle + PostgreSQL-compatible SQL.
- Do not switch local development to Supabase unless explicitly requested.
- Avoid vendor-specific Supabase features unless explicitly requested.
- For production planning, assume Supabase will provide the production Postgres connection string.
- Supabase production connection strings may come from the direct or pooler options in the project dashboard.
- Keep secrets in env files or deployment env vars only.
- Do not hardcode production credentials.
- Supabase is only the planned production Postgres backend for now.
- Do not add Supabase Auth, Storage, Realtime, or Edge Functions unless explicitly requested.

## Task Output Expectations

Every task closeout should include:

- Summary
- Files changed
- Confirmation that push succeeded
- One exact local command block to run
- Expected URLs to test

## Command Guidance

- Use one command block only.
- Do not give multiple terminal alternatives.
- If schema changed, include the schema apply step.
- If only app code changed, skip unnecessary DB commands.
- If package files changed, include `npm install`.
- If production connection values are needed, say exactly which Supabase values are required.

## Preferred Local Flow

1. Pull the latest code from `origin/codex/V1-development`.
2. Install dependencies if `package.json` or `package-lock.json` changed.
3. Rebuild Docker if app code or dependencies changed.
4. Apply DB schema if schema changed.
5. Open the listed URLs and test in the browser.

## Safety Notes

- Commands should be written for the Mac terminal.
- Commands should assume the repo path is `~/Desktop/teaching-aid`.
- If push fails, state it clearly.
- If local environment state is uncertain, say what needs to be checked first.
- Do not claim testing was done unless it was actually run.
