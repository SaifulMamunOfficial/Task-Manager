# Task Manager

Monorepo. Full plan: [PLAN.md](PLAN.md).

```
apps/api      NestJS + Prisma + PostgreSQL (REST API, shared by web and mobile)
apps/web      Next.js web app
apps/mobile   Expo (React Native) app, NOT in npm workspaces (install separately)
packages/shared  Shared TypeScript: enums, visibility resolver, status transitions
```

## Local setup

1. Start Docker Desktop, then: `npm run db:up` (Postgres on port 55432, Redis, MinIO)
2. `npm install`
3. `npm run build:shared`
4. `cd apps/api; npx prisma migrate dev --name init` (creates tables)
5. `npm run db:seed` (admin account, Head Office, default positions, delegation matrix, visibility = DIRECT)
6. `npm run dev:api` (http://localhost:4000/api/health) and `npm run dev:web` (http://localhost:3000)
7. Mobile: `cd apps/mobile; npm install; npx expo start`

Admin login comes from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in `apps/api/.env`.
The admin must change the password on first login. Change `JWT_*` secrets before any real deployment.

## Status

Step 1 (foundation) done: schema, auth (access + rotating refresh tokens), admin APIs for units, positions,
secretariats, users with multiple positions, delegation matrix, visibility mode settings, audit log.
Step 2 done: task core API (create, multi-assign, accept, delegate, progress, submit, approve, send back, notes, in-app notifications, visibility-aware detail). 38 end-to-end checks pass.
Step 3 done: reminder engine (accept-pending + escalation, due soon, due today, overdue, stale, awaiting approval, daily digest, weekly giver digest). Admin can tune rules via /api/settings/reminders. Optional SMTP email.
Step 4 done: attachments (S3-compatible storage, multiple files per task brief and per comment, download streamed through the API with access checks, blocked executable types, 25MB limit).
Step 5 done: web task screens (My desk, Assigned by me, New task, Task detail with actions, progress, files, delegate, history, notes; Notifications).
Step 6 done: web Admin screens (overview, users with multiple positions, organization, delegation matrix, visibility mode, reminder rules, audit log) and forced password change.
Next: mobile app screens, push notifications.

## Coolify deployment (later)

Create resources: PostgreSQL, Redis, MinIO, `api` (Dockerfile or Nixpacks, run `prisma migrate deploy` on start), `web`.
Set the env vars from `.env.example` in Coolify, never commit real secrets.

## File storage note

Official MinIO Docker images are no longer published, so local dev uses a frozen `bitnamilegacy/minio` image
(no security updates, dev only). The API talks plain S3, so for production point `S3_*` env vars at any maintained
S3-compatible store (Coolify's S3 storage, Garage, SeaweedFS, or a cloud bucket). Do not expose the storage port publicly:
downloads go through the API, which checks permissions.
