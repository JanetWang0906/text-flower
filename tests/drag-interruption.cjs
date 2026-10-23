const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const base = process.env.ROSE_URL || 'http://127.0.0.1:8766/';
const output = 'output/user-report-20261021';
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const report = { cases: [], errors: [], realDevice: false };
  try {
    for (const mini of [false, true]) {
      const page = await browser.newPage({ viewport: { width: 516, height: 848 }, hasTouch: true });
      page.on('pageerror', error => report.errors.push(error.message));
      const time = new Date('2026-10-21T00:00:00Z');
      await page.clock.install({ time }); await page.clock.pauseAt(time);
      await page.goto(new URL(mini ? 'minitool/index.html' : '', base).href);
      await page.evaluate(async mini => {
        window.s = mini ? studio : (await import(document.querySelector('script[type=module][src]').src)).studio;
        await s.ready; document.getElementById('gift-entry-dialog').close();
      }, mini);
      const prepare = async (shape, playing) => {
        await page.evaluate(({ shape, playing }) => {
          s.selectShape(shape); s.reset(); s.mode = 'auto';
          for (let i = 0; i < 370; i++) s.tick(1 / 120);
          if (playing) { s.start(); for (let i = 0; i < 120; i++) s.tick(1 / 120); }
          s.draw(); s.updateUI();
        }, { shape, playing });
        await page.locator('#canvas').scrollIntoViewIfNeeded();
        return page.evaluate(() => {
          const r = s.canvas.getBoundingClientRect(), g = s.motion.originals[0];
          return { x: r.left + g.x * r.width / 900, y: r.top + g.y * r.height / 1200 };
        });
      };
      const drag = async point => {
        await page.mouse.move(point.x, point.y); await page.mouse.down();
        await page.mouse.move(point.x + 45, point.y - 35, { steps: 8 });
        assert.equal(await page.evaluate(() => !!s.drag && s.drag.previousStatus === s.status), true);
        await page.evaluate(() => { for (let i = 0; i < 50; i++) s.tick(1 / 120); });
      };
      for (const shape of ['rose', 'cake', 'gift']) {
        for (const event of ['pointercancel', 'lostpointercapture']) {
          await drag(await prepare(shape, true));
          const result = await page.evaluate(event => {
            const feed = s.motion.chains.map(c => c.feed);
            s.canvas.dispatchEvent(new PointerEvent(event, { pointerId: s.drag.id, bubbles: true }));
            for (let i = 0; i < 70; i++) s.tick(1 / 120);
            return { status: s.status, dragging: !!s.drag, returning: s.returning,
              progressing: s.motion.chains.some((c, i) => c.feed > feed[i]) };
          }, event);
          assert.deepEqual(result, { status: 'playing', dragging: false, returning: false, progressing: true });
          await page.mouse.up();
          report.cases.push({ target: mini ? 'minitool' : 'web', shape, event, ...result });
        }
        // Other fingers cannot end, cancel, or release capture for the owner.
        await drag(await prepare(shape, true));
        const owner = await page.evaluate(() => s.drag.id);
        for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
          assert.equal(await page.evaluate(({ event, owner }) => {
            s.canvas.dispatchEvent(new PointerEvent(event, { pointerId: owner + 100, bubbles: true }));
            return !!s.drag && s.drag.id === owner;
          }, { event, owner }), true);
        }
        await page.mouse.up();
        assert.equal(await page.evaluate(() => s.status), 'playing');
        report.cases.push({ target: mini ? 'minitool' : 'web', shape, secondPointerIgnored: true });
      }
      // An idle gesture that is cancelled still restores the original artwork.
      const point = await prepare('gift', false);
      const before = await page.evaluate(() => JSON.stringify(s.motion.save()));
      await drag(point);
      await page.evaluate(() => {
        s.canvas.dispatchEvent(new PointerEvent('pointercancel', { pointerId: s.drag.id, bubbles: true }));
        for (let i = 0; i < 70; i++) s.tick(1 / 120);
      });
      assert.equal(await page.evaluate(() => s.status), 'idle');
      assert.equal(await page.evaluate(() => JSON.stringify(s.motion.save())), before);
      await page.mouse.up();

      // A real touch cancellation exercises the browser's capture event sequence.
      const touch = await prepare('gift', true), cdp = await page.context().newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...touch, id: 1 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: touch.x + 50, y: touch.y - 30, id: 1 }] });
      assert.equal(await page.evaluate(() => !!s.drag), true);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      assert.deepEqual(await page.evaluate(() => [s.status, !!s.drag, s.returning]), ['playing', false, false]);
      report.cases.push({ target: mini ? 'minitool' : 'web', realBrowserTouchCancel: true, idleCancellationRestored: true });

      // Explicit pause and actual backgrounding must continue to pause playback.
      await page.click('#play'); assert.equal(await page.evaluate(() => s.status), 'paused');
      const frozen = await page.evaluate(() => JSON.stringify(s.motion.save()));
      await page.clock.runFor(500);
      assert.equal(await page.evaluate(() => JSON.stringify(s.motion.save())), frozen);
      await page.click('#play');
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        document.dispatchEvent(new Event('visibilitychange'));
        delete document.hidden;
      });
      assert.equal(await page.evaluate(() => s.status), 'paused');
      report.cases.push({ target: mini ? 'minitool' : 'web', explicitAndBackgroundPauseRetained: true });
      await page.close();
    }
    assert.deepEqual(report.errors, []);
    fs.writeFileSync(`${output}/drag-results.json`, JSON.stringify(report, null, 2));
    console.log('DRAG INTERRUPTION PASS', { cases: report.cases.length, errors: report.errors });
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
