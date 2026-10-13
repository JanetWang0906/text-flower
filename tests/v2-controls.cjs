const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const results = [], featureSets = [];
  const webOnly = process.argv.includes('--web-only');
  try {
    for (const mini of webOnly ? [false] : [false, true]) {
      const page = await browser.newPage({ viewport: { width: 501, height: 848 }, acceptDownloads: true });
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      const time = new Date('2026-10-06T00:00:00Z');
      await page.clock.install({ time }); await page.clock.pauseAt(time);
      if (mini) {
        await page.addInitScript(() => {
          window.fetch = () => { throw new Error('offline fetch'); };
          window.ResizeObserver = undefined; Intl.Segmenter = undefined;
          window.albumCalls = []; window.rejectSave = false;
          window.xhs = { miniTool: {
            writeTempFile: async ({ data }) => { window.albumCalls.push({ type: 'temp', data }); return { filePath: 'tmp/artwork.png' }; },
            saveImageToPhotosAlbum: async ({ filePath }) => { if (window.rejectSave) throw { errMsg: 'permission denied' }; window.albumCalls.push({ type: 'album', filePath }); }
          } };
        });
        await page.route('**/minitool/index.html', async route => {
          const response = await route.fetch();
          await route.fulfill({ response, headers: Object.assign({}, response.headers(), {
            'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'none'"
          }) });
        });
      }
      await page.goto('http://127.0.0.1:8765/' + (mini ? 'minitool/index.html' : '?v=2.0-color-20261006'));
      await page.evaluate(async mini => { window.s = mini ? window.studio : (await import('/app.js?v=2.0-color-20261006')).studio; await s.ready; }, mini);
      // Compare artwork features. The mini-tool's browser fallback has an
      // image-preview close button; web saves through its download flow.
      featureSets.push(await page.locator('button[id],input[id],textarea[id]').evaluateAll(elements => elements.filter(el => !el.id.startsWith('crop-') && !el.id.startsWith('notice-') && !el.closest('#export-dialog')).map(el => el.id)));
      assert.equal(await page.locator('[name=mode]').count(), 2);
      assert.equal(await page.evaluate(() => s.motion.phase), 'intro');
      await page.click('#intro-speed'); assert.equal(await page.evaluate(() => s.introSpeed), 1.5);
      assert.equal(await page.evaluate(() => s.speed), 2);
      await page.click('#speed'); assert.equal(await page.evaluate(() => s.speed), 3);
      assert.equal(await page.evaluate(() => s.introSpeed), 1.5);
      await page.clock.runFor(500);
      const introProgress = await page.evaluate(() => s.motion.phaseTime);
      assert.ok(introProgress > .70 && introProgress < .80, `intro speed independent: ${introProgress}`);
      await page.click('#bloom'); assert.equal(await page.evaluate(() => s.motion.phaseTime), 0);
      assert.equal(await page.evaluate(() => s.shape), 'rose');
      await page.check('[name=shape][value=cake]');
      assert.match(await page.locator('#bloom').innerText(), /成形/);
      assert.match(await page.locator('#intro-speed').getAttribute('aria-label'), /成形速度 1.5/);
      const text = await page.evaluate(() => s.text);
      await page.click('#bloom');
      assert.deepEqual(await page.evaluate(() => [s.shape, s.paths.length, s.colors.length, s.text]), ['cake', 4, 4, text]);
      await page.clock.runFor(2100); assert.equal(await page.evaluate(() => s.motion.phase), 'rope');
      const before = await page.evaluate(() => JSON.stringify(s.motion.save()));
      await page.check('[name=palette][value=light]');
      await page.waitForFunction(() => s.background.current.name === 'IMG_0003.jpg');
      assert.equal(await page.evaluate(() => JSON.stringify(s.motion.save())), before, 'palette never resets animation');
      const lightColors = mini ? ['#4c7900', '#ffc834', '#634600', '#d19d01'] : ['#fe8f9f', '#c2a6f0', '#88bbf9', '#ffc76d'];
      assert.deepEqual(await page.evaluate(() => [s.paletteMode, s.colors, s.background.current.name]), ['light', lightColors, 'IMG_0003.jpg']);
      if (mini) {
        // Light paper selection restores the requested four colors, including
        // changing/reselecting paper while already in a customized light mode.
        for (const paper of ['IMG_0006.jpg', 'IMG_0003.jpg']) {
          await page.check('[name=palette][value=dark]');
          await page.waitForFunction(() => s.background.current.name === 'IMG_0046.JPG');
          const motion = await page.evaluate(() => JSON.stringify(s.motion.save()));
          await page.click('[data-background="' + paper + '"]');
          await page.waitForFunction(name => s.background.current.name === name, paper);
          assert.deepEqual(await page.evaluate(() => [s.paletteMode, s.colors]), ['light', lightColors]);
          await page.locator('#cream-color').evaluate(input => { input.value = '#123456'; input.dispatchEvent(new Event('input', { bubbles: true })); });
          await page.locator('#paragraph-color').evaluate(input => { input.value = '#112233'; input.dispatchEvent(new Event('input', { bubbles: true })); });
          await page.click('[data-background="' + paper + '"]');
          await page.waitForFunction(() => s.colors[0] === '#4c7900');
          assert.deepEqual(await page.evaluate(() => s.colors), lightColors);
          assert.equal(await page.evaluate(() => s.ink), '#112233', 'paper selection only restores the four cake colors');
          assert.equal(await page.evaluate(() => JSON.stringify(s.motion.save())), motion, 'paper selection never resets animation');
          const uiColors = await page.locator('.color-setting input[type=color]').evaluateAll(inputs => inputs.map(input => input.value));
          assert.deepEqual(uiColors, lightColors);
        }
        await page.click('#reset-colors');
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      const guide = await page.evaluate(() => {
        const p = s.guidePosition(), r = s.canvas.getBoundingClientRect();
        s.ctx.save(); s.ctx.font = '23px "Songti SC", "STSong", "Noto Serif CJK SC", SimSun, serif';
        const width = s.ctx.measureText('拖动这里').width; s.ctx.restore();
        const overlaps = s.motion.originals.filter(g => {
          const hw = (Math.abs(Math.cos(g.angle))*g.w + Math.abs(Math.sin(g.angle))*s.size)/2;
          const hh = (Math.abs(Math.sin(g.angle))*g.w + Math.abs(Math.cos(g.angle))*s.size)/2;
          return g.ch.trim() && g.x+hw >= p.x-10 && g.x-hw <= p.x+width+10 && g.y+hh >= p.y-22 && g.y-hh <= p.y+22;
        }).length;
        return { position: p, center: { x: r.x+(p.x+width/2)*r.width/900, y: r.y+p.y*r.height/1200 }, overlaps };
      });
      assert.equal(guide.overlaps, 0); assert.deepEqual(guide.position, { x: 55, y: mini ? 740 : 610 });
      if (!mini) { assert.ok(Math.abs(guide.center.x-67) < 10); assert.ok(Math.abs(guide.center.y-438) < 15); }
      await page.evaluate(() => { s.draw(); s.updateUI(); window.scrollTo(0, 0); });
      await page.screenshot({ path: 'output/' + (mini ? 'minitool' : 'web') + '-v2-light.png', fullPage: true });
      await page.check('[name=palette][value=dark]');
      await page.waitForFunction(() => s.background.current.name === 'IMG_0046.JPG');
      await page.evaluate(() => { window.scrollTo(0, 0); s.draw(); });
      await page.screenshot({ path: 'output/' + (mini ? 'minitool' : 'web') + '-v2-dark.png', fullPage: true });
      // The correct palette-specific user colors survive a rose/cake roundtrip.
      await page.check('[name=palette][value=light]');
      await page.locator('#cream-color').evaluate(input => { input.value = '#b34e70'; input.dispatchEvent(new Event('input', { bubbles: true })); });
      await page.check('[name=shape][value=rose]'); await page.check('[name=shape][value=cake]');
      assert.equal(await page.evaluate(() => s.colors[0]), '#b34e70');
      assert.equal(await page.evaluate(() => s.background.current.name), 'IMG_0003.jpg');
      // Both actions retain the cake. Expansion speed affects real RAF playback.
      await page.click('#play'); assert.equal(await page.evaluate(() => s.motion.phase), 'rope');
      const atStart = await page.evaluate(() => s.elapsed);
      await page.clock.runFor(500);
      assert.ok(await page.evaluate(start => s.elapsed-start > 1.40 && s.elapsed-start < 1.60, atStart));
      await page.click('#play'); assert.equal(await page.evaluate(() => s.status), 'paused');
      const paused = await page.evaluate(() => JSON.stringify(s.motion.save()));
      await page.clock.runFor(500); assert.equal(await page.evaluate(() => JSON.stringify(s.motion.save())), paused);
      await page.click('#bloom'); assert.deepEqual(await page.evaluate(() => [s.shape, s.motion.phase, s.paths.length]), ['cake', 'intro', 4]);
      await page.clock.runFor(2200);
      if (mini) {
        await page.click('#save-image');
        assert.equal(await page.evaluate(() => albumCalls.length), 2);
        assert.deepEqual(await page.evaluate(() => albumCalls[1]), { type: 'album', filePath: 'tmp/artwork.png' });
        assert.match(await page.evaluate(() => albumCalls[0].data), /^data:image\/png;base64,/);
        await page.clock.runFor(2200);
        await page.evaluate(() => { window.rejectSave = true; });
        await page.click('#save-image'); assert.match(await page.locator('#save-image').innerText(), /保存失败/);
        await page.clock.runFor(2300);
        assert.equal(await page.locator('#save-image').isEnabled(), true);
        assert.equal(await page.evaluate(() => !!s.saveGuard), false);
      } else {
        const download = page.waitForEvent('download'); await page.click('#save-image');
        const file = await download; assert.equal(file.suggestedFilename(), '字里花间-蛋糕.png');
        await file.saveAs('output/web-v2-export.png');
      }
      const widths = [320, 390, 501, 1280];
      for (const width of widths) {
        await page.setViewportSize({ width, height: 848 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `overflow ${width}`);
        const bounds = await page.locator('.actions button,.toolbar-options button').evaluateAll(buttons => buttons.map(button => { const r=button.getBoundingClientRect(); return { id:button.id,left:r.left,right:r.right,width:r.width,height:r.height }; }));
        // Mini-tool retains its original compact action row. Web uses paired controls.
        assert.ok(bounds.every(r => r.left >= 0 && r.right <= width && r.width >= (mini ? 20 : 39) && r.height >= 40), JSON.stringify({ mini,width,bounds }));
      }
      assert.deepEqual(errors, []); results.push({ target: mini ? 'minitool' : 'web', introProgress, guide, widths, errors, realDevice: false });
      await page.close();
    }
    if (!webOnly) assert.ok(featureSets[1].every(id => featureSets[0].includes(id)), 'web includes every mini-tool editing/playback/export control');
    const offline = fs.readFileSync('minitool/app.js', 'utf8');
    assert.doesNotMatch(offline, /\.download\s*=|\bfetch\s*\(|^import\s|^export\s/m);
    fs.writeFileSync('output/' + (webOnly ? 'web-v2-color-results.json' : 'v2-controls-results.json'), JSON.stringify(results, null, 2));
    console.log('V2 CONTROLS PASS', JSON.stringify(results, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
