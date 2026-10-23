const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { chromium } = require('playwright');
const { SHAPES } = require('../shared/shapes.js');
const base = process.env.ROSE_URL || 'http://127.0.0.1:8766/';
const out = 'output/gift-shape-20261021';
fs.mkdirSync(out, { recursive: true });
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const zipHashes = (directory = '.') => {
  const result = {};
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    if (['node_modules', '.git'].includes(item.name)) continue;
    const file = directory + '/' + item.name;
    if (item.isDirectory()) Object.assign(result, zipHashes(file));
    else if (item.name.endsWith('.zip')) result[file.replace(/^\.\//, '')] = hash(fs.readFileSync(file));
  }
  return result;
};
const zipManifest = `${out}/zip-before.json`;
const previousZIPs = fs.existsSync(zipManifest) ? JSON.parse(fs.readFileSync(zipManifest)) : zipHashes();

// The single shared geometry must retain every curve from the supplied SVG.
const original = fs.readFileSync('礼物/gift2 [转换].svg', 'utf8').replace(/<\?xml[^]*?\?>\s*/, '').trim();
assert.equal(SHAPES.gift.svg, original);
assert.equal(fs.readFileSync('shared/shapes.js', 'utf8'), fs.readFileSync('minitool/shared/shapes.js', 'utf8'));
for (const file of ['minitool-src/gift-codec.js', 'minitool/gift-codec.js']) {
  assert.equal(fs.readFileSync('gift-codec.js', 'utf8'), fs.readFileSync(file, 'utf8'));
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const report = { sourceSVG: '礼物/gift2 [转换].svg', sharedGeometry: true, targets: [], packed: false, realDevice: false };
  try {
    for (const mini of [false, true]) {
      const label = mini ? 'minitool' : 'web';
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const errors = [], requests = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => { if (/^https?:/.test(request.url()) && !request.url().startsWith(base)) requests.push(request.url()); });
      const time = new Date('2026-10-21T00:00:00Z');
      await page.clock.install({ time }); await page.clock.pauseAt(time);
      if (mini) {
        await page.addInitScript(() => {
          window.fetch = () => { throw new Error('offline SVG must not fetch'); };
          window.ResizeObserver = undefined; Intl.Segmenter = undefined;
        });
      }
      await page.goto(new URL(mini ? 'minitool/index.html' : '', base).href);
      await page.evaluate(async mini => {
        window.s = mini ? window.studio : (await import(document.querySelector('script[type=module][src]').src)).studio;
        await s.ready; await s.gifts.ready; document.getElementById('gift-entry-dialog').close();
      }, mini);
      // Keep a same-origin canvas for HD export; file:// and QR imports are
      // separately covered by gift-share.cjs. All runtime actions are offline.
      await page.context().setOffline(true);
      await page.check('[name=shape][value=gift]');
      const initial = await page.evaluate(() => ({ shape: s.shape, paths: s.paths.length, chains: s.motion.chains.length,
        colors: s.colors, text: s.text, count: s.sources.length, phase: s.motion.phase, size: s.size,
        lengths: s.paths.map(p => p.length), points: s.paths.map(p => p.points) }));
      assert.equal(initial.shape, 'gift'); assert.equal(initial.paths, 3); assert.equal(initial.chains, 3);
      assert.equal(initial.text, SHAPES.gift.defaultText); assert.equal(initial.phase, 'intro');
      assert.deepEqual(initial.colors, ['#f6bfd2', '#ffb4c0', '#ffda94']);
      const adaptation = await page.evaluate(() => {
        const config = window.TextShapes.SHAPES.gift;
        const original = window.TextShapes.samplePaths(config.svg, { parts: config.parts.map(part => Object.assign({}, part, { offsetY: 0 })) });
        return { order: s.motion.chains.map(c => c.curve.colorIndex),
          offsets: s.paths.map((p, i) => p.points[0].y - original[i][0].y) };
      });
      assert.deepEqual(adaptation.order, [2, 1, 0], 'bow → lid/ribbon → box');
      adaptation.offsets.forEach((offset, i) => assert.ok(Math.abs(offset - [14, 0, -24][i]) < 1e-8));
      const geometryHash = hash(JSON.stringify(initial.points)); delete initial.points;
      if (report.targets.length) assert.equal(geometryHash, report.targets[0].geometryHash);
      await page.evaluate(() => { for (let i = 0; i < 180; i++) s.tick(1 / 120); s.draw(); s.updateUI(); });
      assert.equal(await page.evaluate(() => s.motion.phase), 'intro');
      await page.locator('#canvas').screenshot({ path: `${out}/${label}-forming.png` });
      const formed = await page.evaluate(() => {
        for (let i = 0; i < 200; i++) s.tick(1 / 120); s.draw(); s.updateUI();
        return { phase: s.motion.phase, text: s.motion.originals.map(g => g.ch).join(''),
          finite: s.motion.originals.every(g => Number.isFinite(g.x) && Number.isFinite(g.y) && g.x > 40 && g.x < 860 && g.y > 40 && g.y < 1160) };
      });
      assert.equal(formed.phase, 'rope'); assert.equal(formed.finite, true);
      assert.equal(formed.text, initial.text.replace(/[\r\n]/g, ''));
      const guide = await page.evaluate(() => {
        const tip = s.motion.originals[0], start = s.paths[2].points[0], p = s.guidePosition();
        s.ctx.save(); s.ctx.font = '23px "Songti SC", "STSong", "Noto Serif CJK SC", SimSun, serif';
        const width = s.ctx.measureText('拖动这里').width; s.ctx.restore();
        const overlaps = s.motion.originals.filter(g => {
          const hw = (Math.abs(Math.cos(g.angle)) * g.w + Math.abs(Math.sin(g.angle)) * s.size) / 2;
          const hh = (Math.abs(Math.sin(g.angle)) * g.w + Math.abs(Math.cos(g.angle)) * s.size) / 2;
          return g.ch.trim() && g.x + hw >= p.x - 10 && g.x - hw <= p.x + width + 10 && g.y + hh >= p.y - 22 && g.y - hh <= p.y + 22;
        }).length;
        return { color: tip.color, distance: Math.hypot(tip.x - start.x, tip.y - start.y), position: p, overlaps };
      });
      assert.equal(guide.color, 2); assert.ok(guide.distance < 25); assert.equal(guide.overlaps, 0);
      await page.screenshot({ path: `${out}/${label}-dark.png`, fullPage: true });
      assert.match(await page.locator('#mode-hint').innerText(), /礼物/);
      assert.doesNotMatch(await page.locator('#stage-label').innerText(), /玫瑰|蛋糕/);

      // Use actual pointer input at the gift's own first glyph and grip.
      const tip = await page.evaluate(() => { const r = s.canvas.getBoundingClientRect(), g = s.motion.originals[0]; return { x: r.x + g.x * r.width / 900, y: r.y + g.y * r.height / 1200 }; });
      await page.mouse.move(tip.x, tip.y); await page.mouse.down();
      await page.mouse.move(tip.x + 55, tip.y - 40, { steps: 10 });
      await page.evaluate(() => { for (let i = 0; i < 80; i++) s.tick(1 / 120); });
      assert.equal(await page.evaluate(() => !!s.drag && s.drag.armed), true);
      await page.mouse.up();
      assert.deepEqual(await page.evaluate(() => [s.status, s.mode, s.motion.grip]), ['playing', 'manual', null]);
      await page.evaluate(() => { s.draw(); s.updateUI(); });
      await page.locator('#canvas').screenshot({ path: `${out}/${label}-drag.png` });
      await page.click('#play');
      const paused = await page.evaluate(() => JSON.stringify(s.motion.save()));
      await page.clock.runFor(800);
      await page.check('[name=palette][value=light]');
      await page.waitForFunction(() => s.background.current.name === 'IMG_0003.jpg');
      assert.equal(await page.evaluate(() => JSON.stringify(s.motion.save())), paused);
      const lightColors = ['#e1b860', '#f2c10d', '#75aadb'];
      assert.deepEqual(await page.evaluate(() => s.colors), lightColors);
      for (const action of ['IMG_0006.jpg', 'IMG_0003.jpg', 'palette']) {
        await page.locator('#gift-box-color').evaluate(input => { input.value = '#123456'; input.dispatchEvent(new Event('input', { bubbles: true })); });
        if (action === 'palette') {
          await page.check('[name=palette][value=dark]');
          await page.check('[name=palette][value=light]');
        }
        else {
          await page.click(`[data-background="${action}"]`);
          await page.waitForFunction(name => s.background.current.name === name, action);
        }
        await page.waitForFunction(() => s.colors[0] === '#e1b860');
        assert.deepEqual(await page.evaluate(() => s.colors), lightColors);
        assert.equal(await page.evaluate(() => JSON.stringify(s.motion.save())), paused, action + ' preserves motion');
      }
      await page.screenshot({ path: `${out}/${label}-light.png`, fullPage: true });
      await page.click('#play');
      const finish = await page.evaluate(() => {
        let landed = false, badColor = false; const activated = s.motion.chains.map(() => null);
        for (let i = 0; i < 120 * 100 && s.status !== 'complete'; i++) {
          const before = s.motion.phase; s.tick(1 / 120);
          s.motion.chains.forEach((c, index) => { if (c.feed > 0 && activated[index] === null) activated[index] = s.elapsed; });
          for (const g of s.motion.originals) if ((g.state === 'path' && g.blend !== 1) || (g.state === 'falling' && (g.blend !== 0 || g.scale !== 1))) badColor = true;
          if (before === 'settle' && s.motion.phase === 'order') landed = s.motion.supported();
        }
        s.draw(); s.updateUI();
        return { status: s.status, landed, badColor, activated, error: s.motion.maxError,
          sourceIds: s.motion.originals.map(g => g.source.id), count: s.sources.length,
          finalPositions: s.motion.originals.every(g => Math.abs(g.x - g.source.finalX) < .001 && Math.abs(g.y - g.source.finalY) < .001) };
      });
      assert.equal(finish.status, 'complete'); assert.equal(finish.landed, true); assert.equal(finish.badColor, false);
      assert.equal(finish.count, initial.count); assert.equal(new Set(finish.sourceIds).size, initial.count);
      assert.equal(finish.finalPositions, true); assert.ok(finish.error < .1);
      assert.ok(finish.activated.every((t, i, a) => t !== null && (!i || t > a[i - 1])));
      await page.locator('#canvas').screenshot({ path: `${out}/${label}-letter.png` });

      // Palette, text and paper survive shape round trips and reset.
      const customText = initial.text.replace('小小的礼物', '特别的礼物');
      assert.equal(await page.evaluate(text => { document.getElementById('message').value = text; return s.apply(text, s.size); }, customText), true);
      await page.click('[data-background="IMG_0003.jpg"]');
      await page.waitForFunction(() => s.background.current.name === 'IMG_0003.jpg');
      await page.locator('#gift-box-color').evaluate(input => { input.value = '#bc4278'; input.dispatchEvent(new Event('input', { bubbles: true })); });
      await page.check('[name=shape][value=rose]'); await page.check('[name=shape][value=cake]'); await page.check('[name=shape][value=gift]');
      assert.equal(await page.evaluate(() => s.text), customText);
      assert.equal(await page.inputValue('#gift-box-color'), '#bc4278');
      assert.equal(await page.evaluate(() => s.background.current.name), 'IMG_0003.jpg');
      await page.click('#reset'); assert.equal(await page.evaluate(() => s.motion.phase), 'intro');
      await page.evaluate(() => { for (let i = 0; i < 370; i++) s.tick(1 / 120); s.draw(); s.updateUI(); });

      const beforeExport = await page.evaluate(() => JSON.stringify({ motion: s.motion.save(), settings: s.giftSettings() }));
      await page.click('#save-image');
      const png = await page.locator('#export-image').getAttribute('src');
      const bytes = Buffer.from(png.split(',')[1], 'base64');
      assert.equal(bytes.readUInt32BE(16), 1800); assert.equal(bytes.readUInt32BE(20), 2400);
      fs.writeFileSync(`${out}/${label}-hd.png`, bytes);
      await page.click('#export-close');
      assert.equal(await page.evaluate(() => JSON.stringify({ motion: s.motion.save(), settings: s.giftSettings() })), beforeExport);
      const layouts = [];
      for (const width of [320, 360, 390, 900, 1280]) {
        await page.setViewportSize({ width, height: 844 });
        const layout = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth,
          visibleColors: Array.from(document.querySelectorAll('.color-setting .color-control')).every(el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }) }));
        assert.equal(layout.overflow, false); assert.equal(layout.visibleColors, true); layouts.push({ width, ...layout });
      }
      await page.screenshot({ path: `${out}/${label}-desktop.png`, fullPage: true });
      const extremes = [];
      for (const size of [12, 32]) {
        const result = await page.evaluate(size => {
          const range = s.range(size), text = '愿'.repeat(Math.floor((range.min + range.max) / 2));
          const applied = s.apply(text, size); s.mode = 'auto'; s.start();
          for (let i = 0; i < 120 * 100 && s.status !== 'complete'; i++) s.tick(1 / 120);
          return { size, applied, count: s.sources.length, status: s.status, error: s.motion.maxError };
        }, size);
        assert.equal(result.applied, true); assert.equal(result.status, 'complete'); assert.ok(result.error < .1); extremes.push(result);
      }
      assert.deepEqual(errors, []); assert.deepEqual(requests, []);
      delete finish.sourceIds;
      report.targets.push({ label, initial, geometryHash, adaptation, guide, lightColors, actualPointerDrag: true, finish, export: [1800, 2400], layouts, extremes, errors, externalRequests: requests });
      console.log(label, { paths: initial.paths, count: initial.count, finish: finish.status, error: finish.error, extremes });
      await page.close();
    }
    assert.deepEqual(zipHashes(), previousZIPs, 'all historical ZIPs unchanged; no new ZIP');
    report.existingZIPsUnchanged = true;
    fs.writeFileSync(`${out}/results.json`, JSON.stringify(report, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
