const roseBase = process.env.ROSE_URL || 'http://127.0.0.1:8765/';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const results = [];
  try {
    for (const mini of [false, true]) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.clock.install();
      if (mini) {
        await page.addInitScript(() => {
          window.fetch = () => { throw new Error('Offline geometry must not fetch'); };
          Intl.Segmenter = undefined; window.ResizeObserver = undefined;
        });
        await page.route('**/minitool/index.html', async route => {
          const response = await route.fetch();
          await route.fulfill({ response, headers: Object.assign({}, response.headers(), {
            'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'none'"
          }) });
        });
      }
      await page.goto(new URL('', roseBase).href + (mini ? 'minitool/index.html' : ''));
      await page.evaluate(async mini => {
        window.s = mini ? window.studio : (await import(document.querySelector('script[type=module][src]').src)).studio;
        await s.ready; const entry = document.getElementById('gift-entry-dialog'); if (entry) entry.close();
      }, mini);
      assert.equal(await page.evaluate(() => s.shape), 'rose');
      const originalText = await page.evaluate(() => s.text);
      await page.locator('#flower-color').evaluate(input => { input.value = '#c14e65'; input.dispatchEvent(new Event('input', { bubbles: true })); });
      await page.check('[name=shape][value=cake]');
      const birthdayText = await page.evaluate(() => s.text);
      assert.match(birthdayText, /^生日快乐！/);
      assert.equal(await page.inputValue('#message'), birthdayText);
      assert.deepEqual(await page.evaluate(() => ({ background: s.background.current.name, palette: s.paletteMode, phase: s.motion.phase })), { background: 'IMG_0046.JPG', palette: 'dark', phase: 'intro' });
      assert.deepEqual(await page.evaluate(() => ({ shape: s.shape, paths: s.paths.length, chains: s.motion.chains.length, colors: s.colors.length, count: s.motion.originals.length, sources: s.sources.length, text: s.text })), {
        shape: 'cake', paths: 4, chains: 4, colors: 4, count: 243, sources: 243, text: birthdayText
      });
      {
        const intro = await page.evaluate(() => { for (let i = 0; i < 180; i++) s.tick(1 / 120); s.draw(); return { phase: s.motion.phase, alpha: s.motion.originals.every(g => g.alpha === 1) }; });
        assert.equal(intro.phase, 'intro'); assert.equal(intro.alpha, true);
        await page.locator('#canvas').screenshot({ path: 'output/' + (mini ? 'minitool' : 'web') + '-cake-forming.png' });
        await page.evaluate(() => { for (let i = 0; i < 240; i++) s.tick(1 / 120); s.draw(); s.updateUI(); });
      }
      await page.screenshot({ path: 'output/' + (mini ? 'minitool' : 'web') + '-cake-initial.png', fullPage: true });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const tip = await page.evaluate(() => { const r = s.canvas.getBoundingClientRect(), g = s.motion.originals[0]; return { x: r.left + g.x * r.width / 900, y: r.top + g.y * r.height / 1200 }; });
      await page.mouse.move(tip.x, tip.y); await page.mouse.down();
      await page.mouse.move(tip.x + 60, tip.y - 50, { steps: 10 });
      await page.evaluate(() => { for (let i = 0; i < 90; i++) s.tick(1 / 120); });
      assert.equal(await page.evaluate(() => !!s.drag && s.drag.armed), true);
      await page.mouse.up();
      assert.deepEqual(await page.evaluate(() => ({ status: s.status, mode: s.mode, grip: s.motion.grip, allFree: s.motion.front === s.motion.nodes.length })), { status: 'playing', mode: 'manual', grip: null, allFree: false });
      await page.evaluate(() => { s.draw(); s.updateUI(); });
      await page.locator('#canvas').screenshot({ path: 'output/' + (mini ? 'minitool' : 'web') + '-cake-drag.png' });
      await page.click('#play');
      const paused = await page.evaluate(() => JSON.stringify(s.motion.save()));
      await page.clock.runFor(700);
      await page.check('[name=palette][value=dark]');
      assert.equal(await page.evaluate(() => JSON.stringify(s.motion.save())), paused);
      await page.check('[name=palette][value=light]');
      await page.click('#play');
      const finish = await page.evaluate(() => {
        const ids = s.motion.originals.map(g => g.source.id), activated = s.motion.chains.map(() => null);
        let landed = null, badColor = false;
        for (let i = 0; i < 120 * 90 && s.status !== 'complete'; i++) {
          const before = s.motion.phase; s.tick(1 / 120);
          s.motion.chains.forEach((c, index) => { if (c.feed > 0 && activated[index] === null) activated[index] = s.elapsed; });
          for (const g of s.motion.originals) if ((g.state === 'path' && g.blend !== 1) || (g.state === 'falling' && (g.blend !== 0 || g.scale !== 1))) badColor = true;
          if (before === 'settle' && s.motion.phase === 'order') landed = s.motion.supported();
        }
        s.draw(); s.updateUI();
        return { status: s.status, activated, landed, badColor, error: s.motion.maxError, ids, finalIds: s.motion.originals.map(g => g.source.id), finalPositions: s.motion.originals.every(g => Math.abs(g.x - g.source.finalX) < .001 && Math.abs(g.y - g.source.finalY) < .001) };
      });
      assert.equal(finish.status, 'complete'); assert.equal(finish.landed, true); assert.equal(finish.badColor, false); assert.equal(finish.finalPositions, true);
      assert.deepEqual(finish.finalIds, finish.ids); assert.ok(finish.error < .1);
      assert.ok(finish.activated.every((time, i) => time !== null && (!i || time > finish.activated[i - 1])));
      await page.locator('#canvas').screenshot({ path: 'output/' + (mini ? 'minitool' : 'web') + '-cake-letter.png' });
      // Color changes, edited text, and switching during playback retain settings.
      await page.locator('#cream-color').evaluate(input => { input.value = '#ed7892'; input.dispatchEvent(new Event('input', { bubbles: true })); });
      await page.check('[name=shape][value=rose]');
      assert.equal(await page.inputValue('#flower-color'), '#c14e65');
      assert.equal(await page.evaluate(() => s.text), originalText);
      await page.click('#play'); await page.evaluate(() => { for (let i = 0; i < 30; i++) s.tick(1 / 120); });
      await page.check('[name=shape][value=cake]');
      assert.equal(await page.inputValue('#cream-color'), '#ed7892');
      assert.equal(await page.evaluate(() => s.status), 'idle');
      assert.equal(await page.evaluate(() => s.motion.originals.length), 243);
      assert.equal(await page.evaluate(() => s.motion.phase), 'intro');
      // Reset replays entry; custom paper and custom words survive a round trip.
      await page.click('#reset'); assert.equal(await page.evaluate(() => s.motion.phase), 'intro');
      await page.click('[data-background="IMG_0003.jpg"]');
      await page.waitForFunction(() => s.background.current.name === 'IMG_0003.jpg');
      const customText = birthdayText.replace('生日快乐！', '小满，生日快乐！');
      assert.equal(await page.evaluate(text => { document.getElementById('message').value = text; return s.apply(text, s.size, s.paragraphSize, false, true); }, customText), true);
      await page.check('[name=shape][value=rose]'); await page.check('[name=shape][value=cake]');
      assert.equal(await page.evaluate(() => s.text), customText);
      assert.equal(await page.inputValue('#message'), customText);
      assert.equal(await page.evaluate(() => s.background.current.name), 'IMG_0003.jpg');
      // Cake must complete at the supported typography extremes as well.
      const sizes = [];
      for (const size of [12, 32]) {
        const result = await page.evaluate(size => {
          const r = s.range(size), text = '祝'.repeat(Math.floor((r.min + r.max) / 2));
          const applied = s.apply(text, size); s.mode = 'auto'; s.start();
          for (let i = 0; i < 120 * 90 && s.status !== 'complete'; i++) s.tick(1 / 120);
          return { size, applied, status: s.status, error: s.motion.maxError, sources: s.sources.length, glyphs: s.motion.originals.length };
        }, size);
        assert.equal(result.applied, true); assert.equal(result.status, 'complete'); assert.ok(result.error < .1); assert.equal(result.sources, result.glyphs); sizes.push(result);
      }
      await page.setViewportSize({ width: 320, height: 740 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.setViewportSize({ width: 1280, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(errors, []);
      delete finish.ids; delete finish.finalIds;
      results.push({ target: mini ? 'minitool' : 'web', finish, sizes, runtimeErrors: errors, viewportWidths: [320, 390, 1280], realDevice: false });
      console.log(results[results.length - 1]); await page.close();
    }
    fs.writeFileSync('output/shapes-results.json', JSON.stringify(results, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
