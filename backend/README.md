# Backend JS (Node.js)

This is a standalone Node.js backend (no C#) intended to replace the old `backend/` C# project.

## Endpoints

- `POST /api/account/register` body: `{ "Username": "..." }`
- `POST /api/account/login` body: `{ "Username": "..." }`
- `GET /api/capabilities` returns supported frontend modes and voice phrases
- `POST /api/messages` body: `[{ "SenderType": 0, "Content": "...", "CreatedAt": "2026-04-27T00:00:00Z" }]` (JWT required)
- `GET /api/conversation-history?limit=20` (JWT required)

## Database

SQLite (file-based) is used for storage.

- DB file default: `data/app.sqlite`
- Schema: `schema.sql`

Configured via `SQLITE_FILE` (relative to `backend/` or absolute path).

## Run (PowerShell)

```powershell
cd backend
copy .env.example .env
npm install
npm run dev
```

No MongoDB required.
