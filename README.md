# teaching-aid

Lightweight self-hosted web app skeleton for peer-to-peer classroom sessions.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- PostgreSQL
- Drizzle ORM
- Docker Compose
- ESLint + Prettier

## Quick start (local)

1. Copy env file:

   ```bash
   cp .env.example .env
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start Postgres in Docker:

   ```bash
   docker compose up -d db
   ```

4. Generate migrations (after schema changes):

   ```bash
   npm run db:generate
   ```

5. Run the app:

   ```bash
   npm run dev
   ```

6. Open http://localhost:3000.

## Run with Docker Compose

```bash
docker compose up --build
```

## Current route skeleton

- `/sessions`
- `/sessions/new`
- `/sessions/[sessionId]`
- `/sessions/[sessionId]/students`
- `/sessions/[sessionId]/groups`
- `/sessions/[sessionId]/order`
- `/sessions/[sessionId]/evaluation`
- `/sessions/[sessionId]/exports`
- `/s/[slug]`
- `/s/[slug]/join`

## Notes

- V1 intentionally has no full authentication system.
- Admin access is planned around a session-level access code.
- Structure is intentionally minimal and ready for modular growth.
