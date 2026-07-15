# IRONWATCH — Workshop Command Dashboard

A single self-contained web app (`index.html`) — no build step, no server, no dependencies to install.

**Admin login (full edit access):** `admin` / `workshop2026`
**Viewer login (read-only):** any username from the Logon Profiles page (e.g. `p.fourie`) / `view2026`

## Editing data
Every category — machines, operators, mechanics, repairs, parts, purchase history, warehouse bays, logon accounts, and the live feeds — supports add, edit, and delete, but **only when signed in as `admin`**. Anyone signed in with a non-admin logon profile sees the same live dashboard but with all add/edit/delete controls hidden, and any attempt to trigger them (e.g. via browser devtools) is blocked with a message explaining they're on a view-only account.

This role check happens in the browser, which is fine for an internal demo/prototype but is not real security — anyone determined enough could bypass client-side checks by editing the page's code. For a system you'd actually deploy company-wide, admin permissions need to be enforced server-side (see "Turning this into a real, persistent, multi-user system" below).

---

## Host it in 2 minutes (free, no code changes needed)

Pick any one of these. All of them just need `index.html` uploaded.

### Option A — Netlify (easiest)
1. Go to https://app.netlify.com/drop
2. Drag the `index.html` file (or this whole folder) into the browser window
3. You get a live URL instantly (e.g. `random-name.netlify.app`)
4. Optional: create a free Netlify account to set a custom subdomain or connect your own domain

### Option B — Vercel
1. Go to https://vercel.com/new
2. Import this folder (or drag-and-drop on the dashboard)
3. Deploy — you get a live URL

### Option C — GitHub Pages (good if you already use GitHub)
1. Create a new GitHub repo, upload `index.html`
2. Repo Settings → Pages → set source to the `main` branch, root folder
3. Your site goes live at `https://yourusername.github.io/reponame`

### Option D — Your own web server / hosting provider (cPanel, etc.)
Just upload `index.html` into your site's `public_html` (or equivalent) root via FTP/SFTP or your host's file manager. No configuration needed — it's a static file.

### Option E — Your own domain
Once deployed on any of the above, add your custom domain in that platform's domain settings and point your DNS (usually a CNAME or A record) as instructed by the platform.

---

## Important: what changes once it's hosted outside Claude.ai

This app was built inside Claude.ai, which gave it a special `window.storage` API for saving data between visits. **That API does not exist once you host this file elsewhere** — the app is written to fail gracefully (it just falls back to the default login every time), but here's what that means practically:

- **Login always works with `admin` / `workshop2026`** — but if you try to change the password, that change won't be remembered after a refresh, because there's nowhere to save it.
- **No other data is being saved externally.** All the machines, repairs, parts, feeds, etc. are hardcoded sample/mock data defined directly in the code (search for `const machines = [...]` etc.) — it resets every time the page reloads. It is not pulling from any real system yet.
- **This is a front-end demo, not a production system.** There's no real authentication, no database, and no real GPS/telematics/ERP connection. It's meant to show you the exact look, feel, and navigation of the tool so we can decide what's worth building for real.

## Turning this into a real, persistent, multi-user system

To get actual live data, real accounts, and information that saves and updates for everyone, this needs a backend. That means:

1. **A database** (e.g. Postgres/Supabase, Firebase) to store machines, repairs, parts, profiles, and real login accounts with proper password hashing
2. **A backend API** for the dashboard to talk to (this could be built with something like Next.js + Supabase, or a Python/Node backend)
3. **Real data connections** — telematics (Cat Product Link, Trimble, Komtrax, etc.) for GPS/hours, and your parts/ERP system for live parts ETA
4. **Proper authentication** (e.g. Auth0, Supabase Auth, or your company's SSO) instead of the demo login

If you want, tell me:
- Which of the above hosting options you'd like to use
- What telematics and parts/ERP systems your workshop actually runs

...and I can help you build out that backend layer, or point you toward the right tools (e.g. Claude Code, which is much better suited than this chat interface for building and iterating on a full-stack app with a real database).
