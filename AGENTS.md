# AGENTS.md

## Working Rules

- Work only on branch `codex/V1-development` unless explicitly told otherwise.
- Keep changes minimal and production-oriented.
- Do not over-engineer.
- Do not modify unrelated files.

## Project Setup Facts

- App and DB are tested locally with Docker.
- Docker Desktop is installed.
- PostgreSQL runs in Docker.
- App runs in Docker.
- Local browser testing is done on `localhost:3000`.
- The developer pulls from GitHub locally after Codex pushes.

## Output Format For Every Task

Always end with:

- Summary
- Files changed
- Confirmation that push succeeded
- One exact local command block to run
- Expected URLs to test

## Command Block Policy

- Never output multiple alternative terminal blocks.
- Never assume the user should improvise.
- Prefer one command block only.
- If DB schema changed, include the schema apply step.
- If only app code changed, do not include unnecessary DB commands.

## Local Testing Policy

- Commands must be written for the user's Mac terminal.
- Commands must assume the repo is at `~/Desktop/teaching-aid`.
- Commands must assume branch `codex/V1-development`.
- Commands must be aligned to the current Docker-first workflow.

## Current Preferred Local Command Patterns

- Pull latest code from `origin/codex/V1-development`.
- Install dependencies if `package.json` or `package-lock.json` changed.
- Rebuild Docker app if app code or dependencies changed.
- Apply DB schema if schema changed.
- Then test in browser.

## Browser Test Policy

- Always list exact URLs to open after the local command block.

## Safety / Clarity

- If push fails, say so clearly.
- If a command is uncertain because environment state is unknown, say what must be checked first.
- Do not claim something was tested unless it actually was.
