// Smoke-test driver for the Smart DT Project static site.
// Run with: NODE_PATH=/opt/node22/lib/node_modules node .claude/skills/run/smoke.js
//
// Serves the repo, registers a student, and drives dashboard/progress/
// profile/portfolio-completion at a mobile viewport, checking for real
// JS errors and asserting the header language pill + avatar are visible
// (regression guard for the css/smartdt-shell-patch.css mobile bug).

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const PORT = process.env.SMOKE_PORT || 8791;
const BASE = `http://localhost:${PORT}`;
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const SHOT_DIR = path.join(__dirname, 'screenshots');
const REAL_JS_ERROR = /ReferenceError|TypeError|SyntaxError|is not defined|is not a function|Uncaught/;

function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    (function poll() {
      fetch(url).then(r => r.ok ? resolve() : retry()).catch(retry);
      function retry() {
        if (Date.now() > deadline) return reject(new Error('server did not come up in time'));
        setTimeout(poll, 300);
      }
    })();
  });
}

async function main() {
  fs.mkdirSync(SHOT_DIR, { recursive: true });

  const server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: REPO_ROOT, stdio: 'ignore' });
  await waitForServer(`${BASE}/welcome.html`, 15000);

  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(20000);

  const jsErrors = [];
  page.on('pageerror', e => jsErrors.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && REAL_JS_ERROR.test(m.text())) jsErrors.push(`console: ${m.text()}`); });

  let failed = false;
  const check = (label, cond) => {
    console.log(`${cond ? '[OK]' : '[FAIL]'} ${label}`);
    if (!cond) failed = true;
  };

  try {
    await page.goto(`${BASE}/registration.html`, { waitUntil: 'domcontentloaded' });
    await page.fill('input[name="df_student_name"]', 'Nur Aina Binti Ahmad');
    await page.fill('input[name="df_email"]', 'nuraina@example.com');
    await page.fill('input[name="df_reg_no"]', '01DTK23F1001');
    await page.fill('input[name="df_class"]', 'DTK5A');
    await page.fill('input[name="df_project_name"]', 'Smart Queue System');
    await page.fill('input[name="df_team"]', 'Team Innovate');
    await page.fill('input[name="df_supervisor"]', 'Ts. Dr. Rahman');
    await page.click('#registrationForm button[type="submit"]');
    await page.waitForURL('**/dashboard.html', { timeout: 20000 });

    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SHOT_DIR, 'dashboard-mobile.png') });
    check('header language pill visible on mobile (390px)', await page.isVisible('.pill.lang-pill'));
    check('header avatar visible on mobile (390px)', await page.isVisible('.avatar'));
    check('dashboard greets the registered student', (await page.$eval('.greeting-name', el => el.textContent)) === 'Nur Aina Binti Ahmad');

    await page.goto(`${BASE}/progress.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SHOT_DIR, 'progress-mobile.png') });
    check('progress page lists 5 phase cards', (await page.$eval('#phaseProgressList', el => el.children.length)) === 5);
    check('progress page renders the badge grid', (await page.$eval('#badgeGrid', el => el.children.length)) > 0);

    await page.goto(`${BASE}/profile.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SHOT_DIR, 'profile-mobile.png') });
    check('profile page shows the registered student name', (await page.$eval('.profile-name', el => el.textContent)) === 'Nur Aina Binti Ahmad');

    await page.goto(`${BASE}/portfolio-completion.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SHOT_DIR, 'portfolio-mobile.png') });
    check('portfolio summary renders', (await page.$eval('#portfolioSummary', el => el.children.length)) > 0);

    check('no real JS errors across the whole flow', jsErrors.length === 0);
    if (jsErrors.length) console.log(jsErrors);
  } finally {
    await browser.close();
    server.kill();
  }

  console.log(failed ? '\nSMOKE TEST: FAILED' : '\nSMOKE TEST: PASSED');
  process.exit(failed ? 1 : 0);
}

main();
