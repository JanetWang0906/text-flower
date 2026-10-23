const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const base = process.env.ROSE_URL || 'http://127.0.0.1:8766/';
const out = process.env.FIREWORK_OUT || 'output/firework-head-tail-20261022';
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const report = { targets: [], packed: false, realDevice: false };
  try {
    for (const mini of [false, true]) {
      const label = mini ? 'minitool' : 'web';
      const page = await browser.newPage({ viewport: { width: 516, height: 848 } });
      const time = new Date('2026-10-22T00:00:00Z');
      await page.clock.install({ time }); await page.clock.pauseAt(time);
      await page.goto(new URL(mini ? 'minitool/index.html' : '', base).href);
      await page.evaluate(async mini => {
        window.s = mini ? studio : (await import(document.querySelector('script[type=module]').src)).studio;
        await s.ready; await s.gifts.ready; document.getElementById('gift-entry-dialog').close();
      }, mini);
      await page.check('[name=mode][value=manual]'); await page.check('[name=shape][value=firework]');
      const result = await page.evaluate(() => {
        const m = s.motion; m.seed = m.randomState = 123; m.burst({ x: 450, y: 500 }); s.status = 'playing';
        const metrics = { centerHeads: 0, dimHeads: 0, releaseSamples: 0, releaseStyleChanges: 0,
          skySamples: 0, maxSkyError: 0, maxSkyRotation: 0, maxReleaseExcess: 0,
          heldStyles: 0, changedStyles: 0, landedStyles: 0, orderStyleJump: 0, orderSamples: 0 };
        const snapshots = [], firstStyle = new Map();
        for (let frame = 0; frame < 60 * 60 && s.status !== 'complete'; frame++) {
          const phase = m.phase, before = m.nodes.map((p, i) => ({ ...p, scale: m.originals[i].scale, alpha: m.originals[i].alpha, angle: m.originals[i].angle }));
          // Release the next bloom only after the first has left its paths.
          if (frame === 240) s.mode = 'auto';
          s.tick(1 / 60);
          for (let i = 0; i < m.nodes.length; i++) {
            const p = m.nodes[i], g = m.originals[i], q = before[i], beam = m.beams[p.beam];
            if (!beam) continue;
            if (i === beam.end && !p.released && p.pathS >= 0 && p.pathS < 15) {
              metrics.centerHeads++; if (g.alpha < .99 || g.scale < 1) metrics.dimHeads++;
            }
            if (p.released && !q.released) {
              metrics.releaseSamples++;
              if (Math.abs(g.scale - q.scale) > 1e-8 || Math.abs(g.alpha - q.alpha) > 1e-8) metrics.releaseStyleChanges++;
              const distance = Math.hypot(p.x - q.x, p.y - q.y);
              // The exit must consume the remainder of this step, rather
              // than snapping to the endpoint and advancing a full step.
              if ([16, 17].includes(beam.rayIndex)) metrics.maxReleaseExcess = Math.max(metrics.maxReleaseExcess, distance - (p.pathS - q.pathS));
              firstStyle.set(i, { scale: g.scale, alpha: g.alpha });
            }
            if (p.released && ['burst', 'settle'].includes(m.phase)) {
              const style = firstStyle.get(i); metrics.heldStyles++;
              if (!style || Math.abs(g.scale - style.scale) > 1e-8 || Math.abs(g.alpha - style.alpha) > 1e-8) metrics.changedStyles++;
              if (p.landedAt !== undefined && g.scale < .8 && g.alpha < .8) metrics.landedStyles++;
            }
            if ([16, 17].includes(beam.rayIndex) && p.released && q.released && p.y < 900 && ['burst', 'settle'].includes(m.phase)) {
              const drag = Math.exp(-.27 / 60), vx = q.vx * drag, vy = q.vy * drag + p.gravity / 60;
              metrics.skySamples++;
              metrics.maxSkyError = Math.max(metrics.maxSkyError, Math.abs(p.vx - vx), Math.abs(p.vy - vy), Math.abs(p.x - q.x - vx / 60), Math.abs(p.y - q.y - vy / 60));
              metrics.maxSkyRotation = Math.max(metrics.maxSkyRotation, Math.abs(g.angle - q.angle));
            }
          }
          if (phase !== 'order' && m.phase === 'order') {
            for (let i = 0; i < m.nodes.length; i++) {
              const g = m.originals[i], q = before[i];
              metrics.orderStyleJump = Math.max(metrics.orderStyleJump, Math.abs(g.scale - q.scale), Math.abs(g.alpha - q.alpha));
            }
          }
          if (m.phase === 'order' && m.phaseTime > .1 && m.phaseTime < 1) {
            metrics.orderSamples++;
            const assertStyle = m.originals.some(g => g.alpha < .99 && g.scale < 1);
            if (!assertStyle) metrics.orderStyleJump = 1;
          }
          if ([5, 23, 59, 107, 359].includes(frame)) snapshots.push({ frame, state: m.save() });
        }
        return { metrics, snapshots, status: s.status, phase: m.phase, time: m.time, allLanded: m.nodes.every(p => p.landedAt !== undefined),
          supported: m.supported(), unsettled: m.nodes.map((p, i) => ({ i, y: p.y, r: p.radius, speed: Math.hypot(p.x - p.px, p.y - p.py), landedAt: p.landedAt })).filter(p => p.speed >= .7 || p.landedAt === undefined),
          exact: m.originals.every(g => g.alpha === 1 && Math.abs(g.scale - s.paragraphSize / s.size) < 1e-8 && Math.abs(g.x - g.source.finalX) < 1e-8 && Math.abs(g.y - g.source.finalY) < 1e-8) };
      });
      const snapshots = result.snapshots; delete result.snapshots;
      report.targets.push({ label, ...result }); console.log(label, result);
      fs.writeFileSync(out + '/trails-results.json', JSON.stringify(report, null, 2));
      for (const snap of snapshots) {
        await page.evaluate(state => { s.motion.restore(state); s.status = 'paused'; s.draw(); s.updateUI(); }, snap.state);
        await page.locator('#canvas').screenshot({ path: `${out}/${label}-trail-${snap.frame}.png` });
        if (snap.frame === 59) await page.screenshot({ path: `${out}/${label}-trail-page.png`, fullPage: true });
      }
      const m = result.metrics;
      assert.ok(m.centerHeads > 20); assert.equal(m.dimHeads, 0, 'heads are fully bright even next to the explosion center');
      assert.equal(m.releaseSamples, 293); assert.equal(m.releaseStyleChanges, 0, 'release preserves path text size and opacity');
      assert.ok(m.skySamples > 500); assert.ok(m.maxSkyError < 1e-6, 'upper rays follow gravity and drag without airborne collision kicks');
      assert.ok(m.maxSkyRotation < .11, 'rotation stays continuous at the upper arc and release');
      assert.ok(m.maxReleaseExcess < .05, 'no extra full physics step at the SVG exit');
      assert.ok(m.heldStyles > 1000); assert.equal(m.changedStyles, 0); assert.ok(m.landedStyles > 1000, 'small faint tails retain their style on the ground');
      assert.ok(m.orderStyleJump < 1e-8); assert.ok(m.orderSamples > 20, 'opacity and size unify gradually during paragraph assembly');
      assert.equal(result.status, 'complete'); assert.equal(result.exact, true);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
