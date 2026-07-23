# Dayroll

Daily todo list where unfinished tasks carry forward to the next day.

- Email/password accounts
- Private lists per user
- Share a list with emails (shared users can edit)
- Deployable on Render (Node + Postgres)

## Local development

1. Create a Postgres database and copy `.env.example` to `.env`
2. Install and run:

```bash
npm install
npm run dev:server   # API on http://localhost:3000
npm run dev          # UI on http://localhost:5173
```

## Deploy on Render

Use `render.yaml`, or create a Web Service + Postgres with:

- Build: `npm install && npm run build`
- Start: `npm start`
- Env: `DATABASE_URL`, `SESSION_SECRET`, `NODE_ENV=production`
