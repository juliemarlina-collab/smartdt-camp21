---
name: run
description: "Launch and drive the Smart DT Project app (this repo) to see a change working. Use when asked to run, start, serve, or screenshot this static site, or to confirm a change works in the real app rather than just by reading the code. Covers: starting the static file server, creating a local student session (there is no real backend auth), and driving pages with a headless browser to check rendering and console errors."
---

# Running Smart DT Project

This is a **static site — no build step, no `package.json`, no bundler**.
Every `.html` file at the repo root and in `guide/` is served as-is.
State lives entirely in the browser's `localStorage`; there is no
backend to start.

## 1. Serve it

```bash
cd <repo-root>
nohup python3 -m http.server 8791 > /tmp/httpserver.log 2>&1 &
disown
timeout 15 bash -c 'until curl -sf http://localhost:8791/welcome.html >/dev/null; do sleep 0.5; done'
```

Use `nohup ... & disown`, not a bare `&` — a plain backgrounded process
can get reaped when the shell tool call that launched it ends, and the
next `curl`/navigation will silently fail against a dead server.

**Stop:** `pkill -f "http.server 8791"`. Do this before relaunching on
the same port or you'll hit `EADDRINUSE` (or just silently talk to the
old process).

## 2. "Log in" (there is no real auth)

`login.html` and `registration.html` don't check credentials against
anything — submitting either form just saves whatever you typed into
`localStorage` under `df_*` keys and redirects to `dashboard.html`.
The fastest way to get a populated session for testing is to fill and
submit the registration form via the browser driver below; don't try
to seed `localStorage` by hand unless you specifically need to test an
edge case, since the real submit handler is part of what you're
verifying.

Minimum fields registration needs: `df_student_name`, `df_email`,
`df_reg_no`, `df_class`. `df_project_name`, `df_team`, `df_supervisor`
are optional but make the dashboard/profile/portfolio pages more
representative of real use.

To test phase-completion/progress states without re-doing five phases
of quizzes and templates by hand, you can seed those specific keys
directly after registering, e.g. `df_submitted_phase01` / `p01_completed`
= `'true'`, `df_quiz_phase01` / `p01_quiz_score` = `'4'` (or `'4/5'` —
see `syncPhaseCompletionKeys()` in `js/smartdt.js` for the two historical
key schemes that get reconciled on load).

## 3. Drive it

No `chromium-cli` in this environment — use Playwright directly.
Chromium is pre-installed at `/opt/pw-browsers/chromium`, and the
`playwright` npm package is installed globally, not in this repo (no
`package.json`), so **you must set `NODE_PATH`**:

```bash
NODE_PATH=/opt/node22/lib/node_modules node your_script.js
```

A ready-to-run smoke script is committed at `.claude/skills/run/smoke.js`.
It serves as both a working example and a real regression check: it
registers a student, loads the dashboard at a **mobile viewport
(390×844)**, and asserts the header's language pill and avatar are
visible — this is the exact bug (`css/smartdt-shell-patch.css` hiding
them via `display:none !important` on screens ≤720px) that was fixed
in this repo's history, so it doubles as a regression guard. It also
hits progress/profile/portfolio-completion and checks for real JS
errors.

```bash
NODE_PATH=/opt/node22/lib/node_modules node .claude/skills/run/smoke.js
```

Screenshots land in `.claude/skills/run/screenshots/` (gitignored —
inspect them, don't commit them).

## Gotchas

- **Use `waitUntil: 'domcontentloaded'`, never `'networkidle'` or the
  default `'load'`.** This app hotlinks Google Fonts and ~100 images
  from `iili.io`. In a sandboxed/proxied environment those requests
  can hang or get `ERR_TUNNEL_CONNECTION_FAILED`/`ERR_CONNECTION_RESET`
  instead of failing fast, and `networkidle`/`load` will wait for them
  forever. `domcontentloaded` doesn't wait on them.
- **Filter console errors for real JS problems.** Expect to see
  `Failed to load resource: net::ERR_TUNNEL_CONNECTION_FAILED` /
  `ERR_CONNECTION_RESET` / stray `404`s from the same hotlinked
  externals — that's network noise, not an app bug. Only treat
  `pageerror` events or console text matching
  `ReferenceError|TypeError|SyntaxError|is not defined|is not a function|Uncaught`
  as real failures.
- **Set navigation timeout to 20s, not the 10s (Playwright) default.**
  The first navigation after a cold browser launch in this environment
  has occasionally taken >10s with no app-side cause; one-off slow
  first-loads are an environment quirk, not a regression.
- **Only 8 of the site's pages load `js/smartdt.js`**: `welcome`,
  `registration`, `login`, `dashboard`, `profile`, `progress`,
  `projects`, `portfolio-completion`. The five `phase01..05-*.html`
  pages are fully self-contained (their own inline `<style>`/`<script>`,
  own quiz/template logic) and never load that shared script — don't
  expect changes to `js/smartdt.js` to affect them.
