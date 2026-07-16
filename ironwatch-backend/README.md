# IronWatch Backend

A real, working backend for the IronWatch fleet & workshop dashboard:

- **Express** REST API
- **SQLite** (via `better-sqlite3`) — actual persistent database, survives restarts, one file on disk
- **JWT auth** with **bcrypt**-hashed passwords (no more hardcoded credentials in the browser)
- **Role-based access** — `admin` (read/write) vs `viewer` (read-only), enforced server-side
- Serves the dashboard's `public/index.html` on the same origin so there's nothing else to configure

This replaces the previous `server.js` stub in the repo (which had fake endpoints the frontend never
actually called) and the frontend's old approach (Claude-artifact `window.storage` for "persistence" +
credentials hardcoded in JavaScript, which meant they lived in every visitor's browser dev tools).

## 1. Install

```bash
npm install
```

## 2. Configure

```bash
cp .env.example .env
```

Edit `.env`:

- `JWT_SECRET` — set this to a long random string (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`)
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — the admin account created the first time the server runs
- `VIEWER_DEFAULT_PASSWORD` — the starting password for the demo viewer accounts (change these afterwards, see below)
- `CORS_ORIGIN` — only needed if you serve the frontend from a different origin than the API (see "Running" below)

## 3. Run

```bash
npm start
```

You'll see:

```
[db] seeded default IronWatch demo data
[db] seeded 5 user accounts (admin: "admin")
[static] serving frontend from ./public
IronWatch backend listening on http://localhost:5000
```

Open **http://localhost:5000** in your browser — that's the whole app (API + dashboard), one process, one port.
No CORS setup needed in this mode since the frontend is served by the same server.

The SQLite database file is created at `data/ironwatch.db` on first run and persists everything from then on.

### Running frontend and backend separately instead

If you'd rather serve `public/index.html` from somewhere else (a different static host, a different port,
opening it as a plain file, etc.), delete/move the `public` folder from this project and:

1. Set `CORS_ORIGIN` in `.env` to the exact origin your frontend is served from (comma-separated if more than one).
2. In the frontend's `<script>` block, update `API_BASE` to point at wherever this backend is running.

## Accounts

On first run the server seeds:

| Username | Role | Password (from `.env`) |
|---|---|---|
| `admin` (or your `ADMIN_USERNAME`) | admin — full read/write | `ADMIN_PASSWORD` |
| `p.fourie` | viewer — read only | `VIEWER_DEFAULT_PASSWORD` |
| `a.kekana` | viewer — read only | `VIEWER_DEFAULT_PASSWORD` |
| `t.ngcobo` | viewer — read only | `VIEWER_DEFAULT_PASSWORD` |
| `foreman.site.a` | viewer — read only | `VIEWER_DEFAULT_PASSWORD` |

These are **real, separate login accounts** stored (bcrypt-hashed) in the `users` table — distinct from the
"Logon Profiles" table you see inside the dashboard UI, which is just informational/display data admins can
edit freely, same as any other table in the app.

**Change the default passwords before giving anyone else access.** Either:

- Log in as admin and call `POST /api/auth/change-password` for your own account, or
- Use the admin-only user management endpoints below to reset/add/remove accounts.

## API reference

All endpoints are under `/api`. Authenticated endpoints expect `Authorization: Bearer <token>`.

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | none | Health check |
| POST | `/api/auth/login` | none | `{ username, password }` → `{ token, user }` |
| GET | `/api/auth/me` | any user | Current user info |
| POST | `/api/auth/change-password` | any user | `{ currentPassword, newPassword }` |
| GET | `/api/state` | any user | Full dashboard dataset (all tables) |
| PUT | `/api/state` | admin only | Replace the full dashboard dataset |
| GET | `/api/users` | admin only | List login accounts |
| POST | `/api/users` | admin only | Create a login account: `{ username, password, role, displayRole?, access? }` |
| PUT | `/api/users/:username/password` | admin only | Reset another user's password |
| DELETE | `/api/users/:username` | admin only | Remove a login account |

Login attempts are rate-limited (10 per 15 minutes per IP) to slow down brute-forcing.

## How the frontend talks to this

`public/index.html` (the dashboard) calls this API instead of the old fake `window.storage`:

- On login, it calls `POST /api/auth/login` and stores the returned JWT in memory for the session.
- On load, it calls `GET /api/state` to fetch all dashboard data from SQLite.
- Every edit (add/edit/delete a machine, operator, repair, etc.) debounces a `PUT /api/state` call that
  saves the whole dataset back — mirroring how the app already worked internally, just against a real
  server now instead of the browser sandbox.
- Viewer accounts can load data but the server rejects any write with `403 Forbidden`, regardless of what
  the browser UI does — the access control isn't just cosmetic anymore.

One behavior was intentionally turned off: the dashboard's demo "live simulation" that auto-generated fake
breakdown/repair feed events every 12 seconds is disabled by default now (in `initApp()`), since left on it
would keep writing placeholder events into your real database indefinitely. It's still in the code
(`pushLiveEvent()`) if you want to re-enable it.

## Deploying

This is a normal Node app — deploy it anywhere that runs Node (Render, Railway, Fly.io, a VPS, etc.):

1. Set real environment variables (especially `JWT_SECRET`, `ADMIN_PASSWORD`, `VIEWER_DEFAULT_PASSWORD`) —
   don't ship `.env` with defaults.
2. Make sure the `data/` directory is on persistent storage (some platforms wipe the filesystem on
   redeploy — check your host's docs for a persistent disk/volume).
3. If you keep `public/index.html`, everything is served from one origin and you're done. Otherwise set
   `CORS_ORIGIN` to your frontend's real URL.

## Project structure

```
ironwatch-backend/
  server.js                 entry point
  src/
    db/index.js              SQLite connection, schema, default-data seeding
    middleware/auth.js        JWT verification + admin-role guard
    routes/
      auth.routes.js          login, me, change-password
      users.routes.js         admin user management
      state.routes.js         get/replace full dashboard dataset
  public/
    index.html                 the dashboard frontend, wired to this API
  data/
    ironwatch.db               SQLite database file (created on first run)
  .env.example
```
