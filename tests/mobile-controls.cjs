// Browser layout evidence; WebKit emulation is not a physical iPhone/XHS test.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium, webkit } = require('playwright');
const base = process.env.ROSE_URL || 'http://127.0.0.1:8777/';
const out = path.resolve('output/mobile-controls-20261022'); fs.mkdirSync(out, { recursive: true });
(async () => {
  const report = { physicalDevice: false, xhsContainer: false, engines: [] };
  for (const engine of [
    { name: 'chromium', api: chromium, options: { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true } },
    { name: 'webkit', api: webkit, options: { headless: true } }
  ]) {
    const browser = await engine.api.launch(engine.options);
    try {
      const p = await browser.newPage({ viewport: { width: 402, height: 874 }, isMobile: true, hasTouch: true });
      const errors = []; p.on('pageerror', e => errors.push(e.message));
      await p.goto(new URL('minitool/index.html', base).href);
      await p.evaluate(async () => { await studio.ready; await studio.gifts.ready; document.getElementById('gift-entry-dialog').close(); });
      const layouts = [];
      for (const size of [12, 18, 24]) {
        const style = await p.addStyleTag({ content: '.shape-label,.shape-setting .segmented span,.playback-controls button,.playback-controls .mode-setting span{font-size:' + size + 'px!important}' });
        for (const width of [280, 320, 360, 390, 402, 430, 516, 874]) {
          await p.setViewportSize({ width, height: 874 });
          const state = await p.evaluate(() => {
            const rect = e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
            const elements = [...document.querySelectorAll('.shape-setting .segmented span,.shape-label,.playback-controls button,.mode-setting .segmented span')].filter(e => e.getBoundingClientRect().height);
            const glyphsFit = elements.every(e => {
              const r = e.getBoundingClientRect(), range = document.createRange(); range.selectNodeContents(e);
              return [...range.getClientRects()].every(t => t.left >= r.left - 1 && t.right <= r.right + 1 && t.top >= r.top - 1 && t.bottom <= r.bottom + 1);
            });
            const selectors = { label: '.shape-label', options: '.shape-setting .segmented', bloom: '#bloom', play: '#play', intro: '#intro-speed', speed: '#speed', mode: '.mode-setting' };
            const boxes = {}; Object.keys(selectors).forEach(key => { boxes[key] = rect(document.querySelector(selectors[key])); });
            return { width: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth, glyphsFit, boxes,
              visibleChoices: [...document.querySelectorAll('[name=shape]')].every(e => { const r = e.parentElement.getBoundingClientRect(); return r.width >= 44 && r.height >= 44 && r.left >= 0 && r.right <= innerWidth; }) };
          });
          assert.equal(state.overflow, false, JSON.stringify({ engine: engine.name, size, ...state }));
          assert.equal(state.glyphsFit, true, JSON.stringify({ engine: engine.name, size, ...state }));
          assert.equal(state.visibleChoices, true);
          if (size === 12 && width >= 320) {
            const r = state.boxes;
            assert.ok(Math.abs(r.label.y + r.label.height / 2 - r.options.y - r.options.height / 2) < 1, 'shape label and choices share row');
            assert.ok(Math.abs(r.bloom.x - r.intro.x) < 1 && Math.abs(r.bloom.width - r.intro.width) < 1);
            assert.ok(Math.abs(r.play.x - r.speed.x) < 1 && Math.abs(r.play.width - r.speed.width) < 1);
            assert.ok(Math.abs(r.intro.y - r.speed.y) < 1 && Math.abs(r.mode.y - r.speed.y) < 1);
          }
          layouts.push({ size, ...state });
        }
        await style.evaluate(e => e.remove());
      }
      await p.setViewportSize({ width: 402, height: 874 });
      await p.check('[name=shape][value=cake]');
      await p.locator('.shape-toolbar').screenshot({ path: path.join(out, engine.name + '-shape-row.png') });
      await p.locator('.toolbar').screenshot({ path: path.join(out, engine.name + '-playback.png') });
      await p.check('[name=shape][value=rose]');
      const before = await p.evaluate(() => [studio.introSpeed, studio.speed]);
      await p.tap('#intro-speed');
      assert.deepEqual(await p.evaluate(() => [studio.introSpeed, studio.speed]), [1.5, before[1]]);
      await p.tap('#speed');
      assert.deepEqual(await p.evaluate(() => [studio.introSpeed, studio.speed]), [1.5, 3]);
      assert.equal(await p.locator('#speed').innerText(), '展开 3×');
      await p.check('[name=mode][value=manual]'); assert.equal(await p.evaluate(() => studio.mode), 'manual');
      await p.check('[name=shape][value=firework]'); assert.equal(await p.locator('#intro-speed').isVisible(), false);
      assert.equal(await p.locator('[name=mode][value=manual]').getAttribute('aria-label'), '手动点击绽放');
      await p.check('[name=shape][value=cake]'); assert.equal(await p.locator('#intro-speed').isVisible(), true);
      assert.match(await p.locator('#intro-speed').innerText(), /成形/);
      assert.deepEqual(errors, []);
      report.engines.push({ name: engine.name, layouts, speedControlsIndependent: true, touchTaps: true, modesWork: true, fireworkVisibility: true, errors });
      console.log(engine.name, 'MOBILE CONTROLS PASS', layouts.length, 'size/width cases');
    } finally { await browser.close(); }
  }
  fs.writeFileSync(path.join(out, 'layout-results.json'), JSON.stringify(report, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
