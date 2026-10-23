const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const origin = 'https://offline-tool.test';
const output = 'output/user-report-20261021';
fs.mkdirSync(output, { recursive: true });

// Check literal archive-relative paths, including the shared modules.
const html = fs.readFileSync('minitool/index.html', 'utf8');
const resources = Array.from(html.matchAll(/<(?:link|script)\b[^>]*(?:href|src)="([^"]+)"/g), m => m[1]);
for (const file of resources) {
  assert.doesNotMatch(file, /[?#]|^https?:|^\/|\.\.\//);
  assert.equal(fs.existsSync(path.join('minitool', file)), true, file);
}

(async () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'minitool-legacy-assets-'));
  execFileSync('python3', ['-c', 'import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])', 'zilihuajian-minitool-2.0.zip', fixture]);
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const report = { simulation: 'Literal archive filename lookup, with and without query normalization; actual XHS loader is unverified.', resources, cases: [], realDevice: false };
  try {
    for (const item of [
      { name: 'legacy-literal-path', directory: fixture, normalize: false, works: false },
      { name: 'legacy-normal-browser', directory: fixture, normalize: true, works: true },
      { name: 'current-literal-path', directory: path.resolve('minitool'), normalize: false, works: true }
    ]) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const blocked = [], errors = [];
      await page.clock.install();
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', async route => {
        const url = new URL(route.request().url());
        const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname).slice(1) + (item.normalize ? '' : url.search);
        const file = path.join(item.directory, relative);
        const headers = { 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'none'" };
        if (url.origin !== origin || !file.startsWith(item.directory + path.sep) || !fs.existsSync(file)) {
          blocked.push(relative); await route.fulfill({ status: 404, body: 'Missing literal package filename', headers }); return;
        }
        const types = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };
        await route.fulfill({ body: fs.readFileSync(file), contentType: types[path.extname(file).toLowerCase()] || 'application/octet-stream', headers });
      });
      await page.goto(origin + '/');
      if (item.works) await page.evaluate(async () => {
        await studio.ready;
        const entry = document.getElementById('gift-entry-dialog'); if (entry) entry.close();
        for (let i = 0; i < 370; i++) studio.tick(1 / 120); studio.draw(); studio.updateUI();
      });
      const state = await page.evaluate(() => ({ appStarted: !!(window.studio && window.studio.paths.length),
        cssApplied: getComputedStyle(document.querySelector('.segmented')).display === 'flex',
        canvasWidth: document.querySelector('canvas').getBoundingClientRect().width,
        loading: !document.getElementById('loading').hidden }));
      assert.equal(state.appStarted, item.works); assert.equal(state.cssApplied, item.works);
      if (item.works) { assert.deepEqual(blocked, []); assert.deepEqual(errors, []); assert.equal(state.loading, false); }
      else assert.ok(blocked.some(file => file.startsWith('style.css?')) && blocked.some(file => file.startsWith('app.js?')));
      await page.screenshot({ path: `${output}/${item.name}.png` });
      report.cases.push({ name: item.name, ...state, blocked, errors });
      await page.close();
    }
    fs.writeFileSync(`${output}/asset-results.json`, JSON.stringify(report, null, 2));
    console.log('OFFLINE ASSETS PASS', report.cases.map(item => ({ name: item.name, appStarted: item.appStarted, cssApplied: item.cssApplied })));
  } finally { await browser.close(); fs.rmSync(fixture, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
