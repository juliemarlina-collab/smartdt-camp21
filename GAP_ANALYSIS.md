# Smart DT Project — Gap Analysis

**Scope:** Full repository review of `smartdt-camp21` ("Smart DT Project"), a static, client-side-only Design Thinking / FYP learning platform used by students at a Malaysian polytechnic. Covers both engineering (architecture, security, code health, process) and product/pedagogical gaps.

**Method:** Static code review — direct file reads, greps, diffs, and git history inspection. No dynamic penetration testing or user research was performed; findings are based on what the shipped code does, not live traffic or user interviews.

## Summary Table

| # | Gap | Area | Priority | Effort |
|---|-----|------|----------|--------|
| 1 | No real authentication | Security | Critical | L |
| 2 | Unauthenticated PII webhook | Security | Critical | M–L |
| 3 | Quiz answer keys shipped in plaintext | Security | Critical | L |
| 4 | Unbounded photo upload into localStorage | Security | Critical | S–M |
| 5 | Split-brain localStorage schema | Architecture | High | M |
| 6 | ~700 lines of dead code in `js/smartdt.js` | Architecture | High | ✅ Fixed in this PR |
| 7 | Quiz/template logic duplicated 5x | Architecture | High | L |
| 8 | Dead gate-approval code paths | Architecture | High | ✅ Fixed in this PR |
| 9 | `projects.html` is an admitted placeholder | Product/UX | Medium | M–L |
| 10 | Non-functional "EN" language pill | Product/UX | Medium | S–L |
| 11 | No fallback for browser-only recording/transcription | Product/UX | Medium | S–M |
| 12 | ~100+ images hotlinked from a free image host | Product/UX | Medium | L |
| 13 | Broken asset reference in style-guide page | Product/UX | Medium | ✅ Fixed in this PR |
| 14 | Zero tests, CI, lint, `.gitignore` | Process | Low | M |
| 15 | Zero documentation | Process | Low | S |
| 16 | Uninformative commit history, no review process | Process | Low | S |
| 17 | No semantic versioning | Process | Low | S |

---

## Section 1 — Security & Data Integrity (Critical)

### 1. No real authentication
**What:** `setupAuth()` in `js/smartdt.js:209-220` handles both the registration and login forms identically — it reads whatever the visitor typed, saves it straight to `localStorage`, and redirects to the dashboard. There is no password field anywhere in the app, and login performs zero verification against any previously-stored identity.

**Why it matters:** On a shared polytechnic lab PC, or when a student switches devices, anyone can type any student's name, email, and registration number and immediately load (or silently overwrite) that identity's dashboard, quiz scores, and template answers. Two students working on different machines never see the same progress, and nothing stops one student from impersonating another for grading purposes. "Login" is really just a local device-profile form, not authentication.

**Recommended fix:** A genuine fix requires a real identity backend (e.g., Firebase Auth, Google Workspace/school SSO, or a lightweight custom auth API) — **Large**, and out of scope for a purely static site. Short-term, document this limitation clearly (e.g., in a new README) so instructors don't mistake it for real login, and consider labeling the flow "Set up this device" rather than "Login."

### 2. Unauthenticated PII webhook
**What:** `js/smartdt.js:32` hardcodes a Google Apps Script Web App URL, and `syncToGoogleSheets()` (`js/smartdt.js:48-91`) POSTs student PII (name, email, registration number, class, team, supervisor, quiz scores) to it on every registration, login, quiz submission, template save, and profile update, using `mode:'no-cors'`/`sendBeacon` fire-and-forget. The URL is visible to anyone who views the page source.

**Why it matters:** There is no auth token, shared secret, or rate limiting on this endpoint. Anyone who finds the URL (trivial via view-source) can script arbitrary POST requests directly into the instructor's grading spreadsheet — fabricating student records — or simply hammer the endpoint to exhaust the Apps Script execution quota, breaking sync for real students. This is also the *only* server-side record of student activity; there is no read/approval interface anywhere in the repo for instructors to consume it safely.

**Recommended fix:** Add a shared-secret parameter validated inside the Apps Script before it writes anything (**Medium**, quick mitigation); the durable fix is a proper authenticated backend with per-student write scoping (**Large**).

### 3. Quiz answer keys shipped in plaintext
**What:** Correct-answer indices are embedded directly in client-side JavaScript — both in the (currently dead, see #6) `quizSets` object in `js/smartdt.js:101-137`, and critically, in the *live* quiz logic duplicated inline inside each `phase01-empathy.html` through `phase05-test.html` page.

**Why it matters:** Any student can open browser devtools or view-source, read the `a:` (answer index) field for each question, and answer every quiz perfectly regardless of comprehension. The quiz gate that's meant to unlock templates only after demonstrating understanding provides no actual assurance.

**Recommended fix:** Requires server-side answer validation (submit answers, receive only a pass/fail + score back) — **Large**, needs a backend. No meaningful client-only mitigation exists; at best, obfuscation raises the bar slightly without closing the gap.

### 4. Unbounded photo upload into localStorage
**What:** The profile photo upload flow (`js/smartdt.js`, ~lines 826-864) reads a selected image file with `FileReader.readAsDataURL()` and stores the resulting base64 string directly under the `df_profile_photo` localStorage key, with no size limit, resizing, or compression.

**Why it matters:** A student uploading a multi-megabyte phone photo (base64-encoded, ~33% larger than the original) can push the origin close to or past the typical ~5–10MB `localStorage` quota shared with all other app data (quiz scores, template answers, phase completion state). Depending on the browser, this either throws an uncaught `QuotaExceededError` on the next `setItem` call anywhere in the app, or silently fails — either way, a student can lose in-progress work just by setting a profile picture.

**Recommended fix:** Resize/compress the image client-side via a `<canvas>` before storing (e.g., cap at ~200px, JPEG quality ≈0.6), and wrap all `localStorage.setItem` calls in try/catch with a user-facing "storage full" message instead of a silent or uncaught failure — **Small–Medium**.

---

## Section 2 — Architecture & Code Health (High)

### 5. Split-brain localStorage schema
**What:** Two divergent key namespaces exist: `df_*` (used by the shell pages — dashboard, profile, progress, login, registration, welcome, portfolio-completion) and `p0N_t*` (used by the phase pages). `syncPhaseCompletionKeys()` (`js/smartdt.js:168`) exists solely to reconcile the two after the fact.

**Why it matters:** Any new page or feature that forgets to call the bridge function will silently desync the dashboard's displayed progress percentage from the student's actual phase completion state, with no error surfaced anywhere — the two "sources of truth" for the same fact can simply disagree.

**Recommended fix:** Consolidate to a single canonical key namespace and document the schema (see #15) — **Medium**.

### 6. ~700 lines of dead code in `js/smartdt.js` — ✅ Fixed
**What:** Direct inspection confirmed that none of `phase01-empathy.html` through `phase05-test.html` contain a single `<script src="...">` tag — they never loaded `js/smartdt.js` or `js/smartdt-assets.js` at all. Yet `js/smartdt.js` contained `setupQuiz()`, `quizSets`, `formValues()`, `applyValues()`, `saveTemplateFrom()`, `restoreTemplates()`, `templateFilled()`, `updateTemplateStatuses()`, `setupForms()`, the audio-recording/auto-transcribe/POV-assembly/HMW-select logic, and `showSubmitSuccess()` — roughly lines 93–765, about 60% of the file's 1,133 lines — all targeting DOM elements (`#quizBox`, `[data-save]`, `[name="df_p02_t05_user"]`, etc.) that existed only in the phase HTML files, which never executed this script.

**Why it mattered:** This was exactly the kind of trap that produces silent regressions and wasted engineering time: a developer who "fixed" a quiz bug by editing `setupQuiz()`/`quizSets` in `smartdt.js` would have shipped a change that affected nothing in production, because the phase pages ran their own separate, duplicated inline copy of the same logic (see #7).

**Fix applied:** Removed the confirmed-dead code (option (a) below) rather than the larger consolidation (option (b)), since the latter is a bigger architectural change better done deliberately, not as part of a cleanup pass:
- (a) **Applied:** Deleted the dead code from `smartdt.js` after confirming — via direct grep across every HTML page in the repo, including `guide/` — that none of it was reachable anywhere. `js/smartdt.js` went from 1,133 to 508 lines. Verified with a headless-browser pass across all 8 pages that actually load this script (`welcome`, `registration`, `login`, `dashboard`, `profile`, `progress`, `projects`, `portfolio-completion`): zero JS runtime errors, and dashboard/progress/profile/portfolio rendering spot-checked to confirm identical behavior (progress %, phase cards, badges, profile fields all still populate correctly).
- (b) **Still recommended as a follow-up, not done here:** Wire the phase pages to actually load `smartdt.js`/`smartdt-assets.js` and delete the 5x duplicated inline scripts in favor of one shared engine — this is the fix for #7, and is a **Large**, deliberate architectural change the instructor should scope separately.

### 7. Quiz/template logic duplicated 5x
**What:** Direct consequence of #6 — each of the 5 phase pages carries its own independent inline copy of quiz rendering, scoring, and template save/restore logic instead of a single shared implementation.

**Why it matters:** Any change to quiz behavior, scoring thresholds, or template handling must currently be made identically in 5 separate places; drift between copies is only a matter of time.

**Recommended fix:** Same fix as #6(b) — centralize in the shared script. **Large**.

### 8. Dead gate-approval code paths — ✅ Fixed
**What:** `isGateApproved()`, `isGateApprovedByNum()`, `checkGateApproval()`, `pollGateApproval()`, and `setupGateGuard()` were all stubbed to always return success (`js/smartdt.js:791-801`), with the comment "Gate approval logic removed: no supervisor gate in this app." Dashboard rendering code (`js/smartdt.js:1033-1038`) also still built `#gateList` HTML for an element that existed on zero pages in the current app (confirmed via grep), and the unused `gateSubmitted()` function (`js/smartdt.js:1044`) was never called anywhere.

**Why it mattered:** Currently harmless (dead code, no user-facing effect), but a future maintainer reading `isGateApproved()` returning `true` unconditionally could reasonably — and wrongly — assume supervisor sign-off is enforced somewhere in the flow, or waste time debugging a "gate" feature that was deliberately retired.

**Fix applied:** Confirmed with the instructor that the supervisor-gate feature is intentionally retired, so the stub functions, `setupGateGuard()`, the dead `#gateList`-building block inside `renderProgress()`, and the unused `gateSubmitted()` function were all removed. **Small**.

---

## Section 3 — Product, UX & Pedagogy (Medium)

### 9. `projects.html` is an admitted placeholder
**What:** The page's own copy states: *"This page will collect your active project information, team evidence, files and portfolio links. For now, continue your work through the Learn phases."*

**Why it matters:** The bottom navigation promises a "Projects" hub, but students currently have nowhere in the app to attach their actual FYP artifacts (files, team evidence, external links) — a shipped, self-acknowledged gap between the nav's promise and the app's capability.

**Recommended fix:** Scope depends on ambition — a minimal version (fields for external links, e.g. to Google Drive) is **Medium**; real file storage/upload is **Large**.

### 10. Non-functional "EN" language pill
**What:** Every page header shows a `🌐 EN` pill (e.g. `welcome.html`, `dashboard.html`), but there is no i18n mechanism, translation files, or other-language content anywhere in the repo.

**Why it matters:** At a Malaysian polytechnic, a Malay-speaking student reasonably expects "EN" to be a working language switcher. Clicking it and having nothing happen is a small but real trust-eroding moment — a UI affordance for a feature that doesn't exist.

**Recommended fix:** Short-term, remove or visually de-emphasize the pill until it's functional (**Small**); longer-term, implement real i18n with a Bahasa Malaysia translation (**Large**).

### 11. No fallback for browser-only recording/transcription
**What:** Phase 01's audio recording (`MediaRecorder`) and auto-transcription (`SpeechRecognition`/`webkitSpeechRecognition`) are explicitly Chrome/Edge-desktop only — the app's own toast message says so directly ("Auto Transcribe requires Chrome or Edge on desktop"). Everywhere else, unsupported browsers just get that toast with no alternative.

**Why it matters:** BYOD students on Safari, iPadOS, or Firefox — common in a polytechnic lab/home setting — hit a dead end on this step with no manual text-entry alternative, likely skipping it and affecting downstream template/quiz completion for that phase.

**Recommended fix:** Add an always-available manual textarea fallback for transcription regardless of browser support. **Small–Medium**.

### 12. ~100+ images hotlinked from a free image host
**What:** `js/smartdt-assets.js` maps nearly all icons and images across the site to URLs on `iili.io`, a free, informal image-hosting service with no SLA — rather than storing assets in the repo.

**Why it matters:** A single outage, hotlink-throttling change, or shutdown of that free service (not uncommon for such hosts) would break imagery across the entire site simultaneously, with no warning and no control over remediation timeline.

**Recommended fix:** Download and self-host all assets under a repo `assets/` directory, repoint `js/smartdt-assets.js` to local paths, and audit licensing while doing so. **Large**.

### 13. Broken asset reference in the internal style-guide page — ✅ Fixed
**What:** `master-template-reference.html` referenced `assets/brand/logo-icon.svg`, which did not exist anywhere in the repo; the broken image was masked by an `onerror` handler so it failed silently.

**Why it mattered:** Low priority — this is an internal design-system reference page, not student-facing — but it was a small, easy-to-fix piece of rot.

**Fix applied:** Repointed the logo `<img>` to the same hosted logo URL every other page's header already uses (`https://iili.io/Cd3i8QV.png`), and removed the `onerror` mask. **Small**.

---

## Section 4 — Process & Repo Hygiene (Low)

### 14. Zero tests, CI, lint, or `.gitignore`
**What:** No test files, no test framework, no `package.json` to declare one, no `.github/workflows`, no linter/formatter config (`.eslintrc`, `.prettierrc`, `.stylelintrc`), no `.gitignore`.

**Why it matters:** Every change — including the fixes in this very PR — has no automated safety net. A typo in one phase page's inline `<script>` block silently breaks that page with no CI signal, caught only by manual QA if at all.

**Recommended fix:** Lightweight tooling is enough given the static nature of the app — a CDN-based ESLint/HTML validator pass plus a simple GitHub Actions workflow that runs it on every PR. **Medium**.

### 15. Zero documentation
**What:** No `README.md`, `LICENSE`, `CHANGELOG.md`, `CONTRIBUTING.md`, or architecture notes anywhere in the repo.

**Why it matters:** A new contributor or TA has no starting point for understanding the localStorage schema, the Google Sheets sync mechanism, or — critically — which script files are actually live versus dead (see #6). This exact ambiguity is what allowed the split-brain data model and ~700 lines of dead code to go unnoticed.

**Recommended fix:** Add a README covering the architecture, data model, and known gaps (can link to this document), plus a short CONTRIBUTING note describing the branch/PR workflow now being adopted. **Small**.

### 16. Uninformative commit history, no review process
**What:** All 42 prior commits are from a single author, all within one roughly 6-hour window (2026-07-03 23:23 → 2026-07-04 05:44), every message a generic "Add files via upload" (consistent with GitHub's web-UI file-upload flow rather than command-line `git` usage). No branches, pull requests, or reviews exist prior to this session.

**Why it matters:** There is no historical record of *why* decisions were made — e.g., why the supervisor-gate feature was stubbed out, or why `iili.io` was chosen for image hosting — which makes exactly this kind of gap analysis, and future debugging, needlessly harder.

**Recommended fix:** Adopt descriptive commit messages and PR-based review going forward — this session's branch/PR workflow models the target state. **Small**, process-only.

### 17. No semantic versioning
**What:** The only version marker in the codebase is `appVersion: 'v16-future-fix'`, embedded in the Google Sheets sync payload (`js/smartdt.js:53`) — not a real semantic version, and not tracked anywhere else.

**Why it matters:** Makes it impossible to correlate a bug report or a Google Sheets row with a specific known state of the code.

**Recommended fix:** Adopt real semantic versioning and a CHANGELOG. **Small**.

---

## Appendix A — Quick Wins Applied in This PR

Three narrowly-scoped, pre-verified-safe fixes were applied alongside this report:

1. **Fixed a live mobile bug.** The header's language pill and student avatar were invisible on screens ≤720px because the live stylesheet (`css/smartdt-shell-patch.css`) hid them via `display:none !important`. A newer, corrected version of this file — including an explicit "keep language, student initials and menu visible on every page" fix — had already been uploaded to the repository, but to the wrong path (`/smartdt-shell-patch.css` at the repo root, which no page actually loads). This PR moves that fix into the path every page references and removes the stray duplicate.
2. **Removed 4 stray junk files** (`css/1`, `js/1`, `guide/1`, `infographic/1`) — 1-byte artifacts left over from GitHub web-UI folder uploads.
3. **Removed 2 confirmed-dead CSS files** (`css/smartdt-layout-standard.css`, `css/smartdt-responsive-fix.css`) — verified via exhaustive grep to have zero references from any HTML `href=` attribute or JS-injected `<link>` tag anywhere in the codebase.
4. **Removed ~700 lines of dead code from `js/smartdt.js`** (gap #6/#7's cause, and #8): the unreachable quiz engine, template save/restore engine, recording/auto-transcribe/POV-assembly/HMW-select logic, and the stubbed-out supervisor-gate code paths (`isGateApproved()` and friends, the dead `#gateList` rendering block, the unused `gateSubmitted()`). Confirmed via grep that none of it was referenced by any live page, `js/smartdt.js` went from 1,133 to 508 lines, and a headless-browser pass across all 8 pages that load this script confirmed zero JS runtime errors with dashboard/progress/profile/portfolio rendering unchanged.
5. **Fixed the broken asset reference** in `master-template-reference.html` — repointed the logo `<img>` to the same hosted URL every other page's header uses.

## Appendix B — Recommended Roadmap (not in scope of this PR)

Items 1–4 and 7 above (authentication, the unauthenticated sync webhook, quiz answer exposure, the localStorage photo-quota risk, the split-brain schema, and consolidating the 5x-duplicated quiz/template logic into one shared engine) are **deliberately left untouched** by this PR. Each requires a product or security decision from the instructor/maintainer before any code should change — silently "fixing" them during a gap-analysis pass would risk making an architectural choice on the instructor's behalf. Recommended next step: review this document with the instructor and prioritize these items for a follow-up engineering effort.
