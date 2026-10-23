const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { chromium } = require('playwright');

const base = process.env.ROSE_URL || 'http://127.0.0.1:8765/';
const output = 'output/web-parity-20261016';
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const protectedFiles = () => {
  const files = [];
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file); else if (entry.isFile()) files.push(file);
    }
  };
  for (const dir of ['minitool-src', 'minitool', 'backups']) walk(dir);
  files.push(...fs.readdirSync('.').filter(file => file.endsWith('.zip')));
  return Object.fromEntries(files.sort().map(file => [file, hash(fs.readFileSync(file))]));
};

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const initialProtected = protectedFiles();
  if (process.env.PROTECTED_MANIFEST) {
    assert.deepEqual(initialProtected, JSON.parse(fs.readFileSync(process.env.PROTECTED_MANIFEST)), 'all mini-tool files match the pre-edit snapshot');
  }
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const results = { layouts: [], mobileStructure: [], exports: [], checks: [], errors: [] };
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  await page.addInitScript(() => localStorage.setItem('text-in-bloom-language', 'zh'));
  page.on('pageerror', error => results.errors.push(error.message));
  const check = (name, condition) => { assert.ok(condition, name); results.checks.push(name); };
  const setColor = (id, value) => page.locator('#' + id).evaluate((input, value) => {
    input.value = value; input.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
  const formed = () => page.evaluate(() => {
    for (let i = 0; i < 370; i++) s.tick(1 / 120);
    s.draw(); s.updateUI();
  });
  try {
    const time = new Date('2026-10-16T00:00:00Z');
    await page.clock.install({ time }); await page.clock.pauseAt(time);
    await page.goto(base);
    await page.evaluate(async () => { window.s = (await import(document.querySelector('script[type=module][src]').src)).studio; await s.ready; const entry = document.getElementById('gift-entry-dialog'); if (entry) entry.close(); });

    // Cover both responsive states with the form collapsed and expanded.
    for (const shape of ['rose', 'cake']) {
      await page.check(`[name=shape][value=${shape}]`); await formed();
      for (const width of [320, 360, 390, 501, 768, 899, 900, 1280, 1920]) {
        for (const editing of [false, true]) {
          await page.setViewportSize({ width, height: 844 });
          if (await page.locator('#text-form').isVisible() !== editing) await page.click('#edit-toggle');
          await page.evaluate(() => { scrollTo(0, 0); s.resize(); });
          const layout = await page.evaluate(() => {
            const rect = selector => {
              const r = document.querySelector(selector).getBoundingClientRect();
              return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
            };
            return {
              overflow: document.documentElement.scrollWidth > innerWidth,
              canvas: rect('#canvas'), heading: rect('.shape-toolbar'), controls: rect('.controls'),
              shape: rect('.shape-setting'), save: rect('#save-image'), qr: rect('#save-gift-qr'),
              font: rect('.font-setting'), paragraph: rect('.paragraph-setting'),
              actions: [...document.querySelectorAll('.actions button')].map(button => ({ id: button.id, ...rect('#' + button.id) })),
              order: ['.masthead', '.shape-toolbar', '.workspace', '.toolbar', '#text-form', '#mode-hint', '.background-setting', '.size-row', '.fit-row', '.color-setting', '.palette-setting'].filter(selector => !document.querySelector(selector).hidden).map(selector => ({ selector, ...rect(selector) }))
            };
          });
          assert.equal(layout.overflow, false, `${shape} ${width} editing=${editing} overflow`);
          assert.ok(Math.abs(layout.canvas.width / layout.canvas.height - .75) < .001);
          assert.ok(Math.abs(layout.save.y - layout.qr.y) < 1 && layout.save.right <= layout.qr.x, `save buttons share the row at ${width}`);
          assert.ok(Math.abs(layout.font.y - layout.paragraph.y) < 1, 'font sliders stay side by side');
          assert.ok(layout.actions.every(button => button.x >= 0 && button.right <= width && button.width >= 20 && button.height >= 40));
          if (width < 900) {
            for (let i = 1; i < layout.order.length; i++) assert.ok(layout.order[i].y >= layout.order[i - 1].bottom - 1, `narrow order ${JSON.stringify(layout.order)}`);
          } else {
            assert.ok(layout.controls.x > layout.canvas.right, 'desktop controls are beside the canvas');
            assert.ok(layout.canvas.bottom <= 844, 'desktop canvas fits window height');
          }
          results.layouts.push({ shape, width, editing, overflow: layout.overflow, canvas: layout.canvas, columns: width >= 900 ? 2 : 1 });
        }
      }
      await page.click('#edit-toggle');
      for (const width of [900, 1280, 1920]) {
        await page.setViewportSize({ width, height: 640 });
        await page.evaluate(() => { scrollTo(0, 0); s.resize(); });
        const r = await page.locator('#canvas').boundingBox();
        check(`${shape} canvas fits ${width}×640`, r.y + r.height < 640);
        await page.click('#edit-toggle'); await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
        const sticky = await page.locator('#canvas').boundingBox();
        check(`${shape} canvas stays visible while editing ${width}×640`, sticky.y >= 0 && sticky.y + sticky.height < 640);
        await page.click('#edit-toggle');
      }
      for (const [name, width, height] of [['mobile', 390, 844], ['desktop', 1280, 900]]) {
        await page.setViewportSize({ width, height });
        await page.evaluate(() => { scrollTo(0, 0); s.resize(); });
        await page.screenshot({ path: `${output}/${shape}-${name}.png`, fullPage: true });
      }
    }

    // Shared artwork and editing capabilities stay comparable. Video delivery
    // and the user-approved mini-tool toolbar have independent layouts.
    const mini = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await mini.clock.install({ time }); await mini.clock.pauseAt(time);
    await mini.goto(new URL('minitool/', base).href); await mini.evaluate(async () => { await studio.ready; const entry = document.getElementById('gift-entry-dialog'); if (entry) entry.close(); });
    await page.check('[name=shape][value=rose]');
    const controls = target => target.locator('button[id],input[id],textarea[id]').evaluateAll(elements => elements.filter(el => !el.closest('#video-dialog')).map(el => el.id));
    const miniControls = await controls(mini), webControls = await controls(page);
    check('web covers every mini-tool control', miniControls.every(id => webControls.includes(id)));
    check('web retains auto-fit and adds explicit download', ['auto-fit', 'export-download'].every(id => webControls.includes(id)));
    check('web downloads video and mini-tool keeps publishing', await page.locator('#video-download').count() === 1 && await mini.locator('#video-share').count() === 1);
    const dimensions = target => target.evaluate(() => {
      const origin = document.querySelector('.masthead').getBoundingClientRect().y;
      return Object.fromEntries(['.shape-toolbar', '.paper-wrap', '.stage-footer', '.actions', '.mode-setting', '#mode-hint', '.background-setting', '.font-setting', '.paragraph-setting'].map(selector => {
        const r = document.querySelector(selector).getBoundingClientRect();
        return [selector, { x: r.x, y: r.y - origin, width: r.width, height: r.height }];
      }));
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.check('[name=shape][value=rose]'); await page.evaluate(() => scrollTo(0, 0));
    const miniDimensions = await dimensions(mini), webDimensions = await dimensions(page);
    for (const key of ['x', 'width', 'height']) {
      assert.ok(Math.abs(webDimensions['.paper-wrap'][key] - miniDimensions['.paper-wrap'][key]) <= 1, `artwork ${key} matches mini-tool`);
    }
    for (const [target, layout] of Object.entries({web:webDimensions,minitool:miniDimensions})) {
      for (const [selector, r] of Object.entries(layout)) assert.ok(r.x >= 0 && r.x + r.width <= 390 && r.height > 0, `${target} ${selector} stays visible`);
    }
    results.mobileStructure.push({ width: 390, web: webDimensions, minitool: miniDimensions });
    await mini.close();

    await page.check('[name=shape][value=cake]'); await formed();
    const lightColors = ['#4c7900', '#ffc834', '#634600', '#d19d01'];
    for (const paper of ['IMG_0006.jpg', 'IMG_0003.jpg']) {
      await page.check('[name=palette][value=dark]');
      await page.waitForFunction(() => s.background.current.name === 'IMG_0046.JPG');
      const before = await page.evaluate(() => JSON.stringify(s.motion.save()));
      await page.click(`[data-background="${paper}"]`);
      await page.waitForFunction(name => s.background.current.name === name, paper);
      assert.deepEqual(await page.evaluate(() => s.colors), lightColors);
      await setColor('cream-color', '#123456'); await setColor('paragraph-color', '#112233');
      await page.click(`[data-background="${paper}"]`);
      await page.waitForFunction(() => s.colors[0] === '#4c7900');
      assert.deepEqual(await page.evaluate(() => s.colors), lightColors);
      assert.equal(await page.evaluate(() => s.ink), '#112233');
      assert.equal(await page.evaluate(() => JSON.stringify(s.motion.save())), before);
    }
    await setColor('cream-color', '#aabbcc');
    await page.check('[name=shape][value=rose]'); await page.check('[name=shape][value=cake]');
    assert.equal(await page.evaluate(() => s.colors[0]), '#aabbcc');
    check('light papers reset four cake colors, preserve ink/motion, and shape restoration retains custom colors', true);

    await formed();
    assert.deepEqual(await page.evaluate(() => s.guidePosition()), { x: 55, y: 740 });
    const guides = await page.evaluate(() => {
      const text = s.text, paragraphSize = s.paragraphSize;
      const checks = [];
      for (const size of [12, 20, 32]) {
        const r = s.range(size); s.apply('花'.repeat(Math.floor((r.min + r.max) / 2)), size);
        for (const label of ['拖动这里', '轻轻牵动文字', '松手，读这封信']) {
          const p = s.guidePosition(label); s.ctx.save(); s.ctx.font = '23px "Songti SC", "STSong", "Noto Serif CJK SC", SimSun, serif';
          const width = s.ctx.measureText(label).width; s.ctx.restore();
          const overlaps = s.motion.originals.filter(g => {
            const scale = g.scale || 1;
            const hw = (Math.abs(Math.cos(g.angle)) * g.w + Math.abs(Math.sin(g.angle)) * s.size) * scale / 2;
            const hh = (Math.abs(Math.sin(g.angle)) * g.w + Math.abs(Math.cos(g.angle)) * s.size) * scale / 2;
            return g.ch.trim() && g.x + hw >= p.x - 10 && g.x - hw <= p.x + width + 10 && g.y + hh >= p.y - 22 && g.y - hh <= p.y + 22;
          }).length;
          checks.push({ size, label, position: p, overlaps });
        }
      }
      s.apply(text, 20, paragraphSize, false, true, true);
      return checks;
    });
    check('guide avoids text at sizes 12/20/32', guides.every(guide => guide.overlaps === 0));
    results.guides = guides;

    // Empty/too-short/too-long submissions keep the last valid artwork and
    // show both the inline message and the mini-tool's explicit error dialog.
    await formed(); await page.click('#edit-toggle');
    const validText = await page.inputValue('#message');
    const artwork = await page.evaluate(() => JSON.stringify(s.motion.save()));
    for (const invalid of ['', '花', '花'.repeat(2001)]) {
      await page.fill('#message', invalid); await page.locator('#text-form').evaluate(form => form.requestSubmit());
      assert.equal(await page.locator('#notice-dialog').isVisible(), true);
      const error = await page.locator('#input-error').innerText(); assert.ok(error.length > 0);
      assert.equal(await page.locator('#notice-text').innerText(), error);
      assert.equal(await page.evaluate(() => JSON.stringify(s.motion.save())), artwork);
      await page.click('#notice-ok');
    }
    await page.fill('#message', validText); await page.locator('#text-form').evaluate(form => form.requestSubmit());
    assert.equal(await page.locator('#message').getAttribute('aria-invalid'), null);
    await page.click('#edit-toggle');
    check('invalid drafts show notice and inline error without replacing artwork; valid edit recovers', true);
    // The extra web control still chooses a workable size for a different length.
    await page.evaluate(() => { s.apply(s.text, 32, s.paragraphSize, false, true); });
    await page.click('#auto-fit');
    check('automatic font fitting remains usable', await page.evaluate(() => s.size >= 12 && s.size <= 32 && !document.getElementById('input-error').textContent));

    // Crop, keyboard/pointer adjustment, cancellation, malformed files and
    // custom-background memory are checked against a paused animation.
    await page.click('#play'); await page.clock.runFor(700); await page.click('#play');
    const pausedMotion = await page.evaluate(() => JSON.stringify(s.motion.save()));
    const imageFile = { name: 'wide.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="1600" height="900" fill="#ecdcc2"/><rect width="400" height="900" fill="#ddaaa0"/></svg>') };
    await page.locator('#background-file').setInputFiles(imageFile);
    await page.locator('#crop-dialog').waitFor({ state: 'visible' });
    await page.locator('#crop-zoom').evaluate(input => { input.value = '1.6'; input.dispatchEvent(new Event('input', { bubbles: true })); });
    const cropBefore = await page.evaluate(() => s.background.rect(s.background.pending));
    const cropRect = await page.locator('#crop-preview').boundingBox();
    await page.mouse.move(cropRect.x + cropRect.width / 2, cropRect.y + cropRect.height / 2); await page.mouse.down();
    await page.mouse.move(cropRect.x + cropRect.width / 2 + 30, cropRect.y + cropRect.height / 2 + 20); await page.mouse.up();
    await page.locator('#crop-preview').focus(); await page.keyboard.press('ArrowRight');
    const chosenCrop = await page.evaluate(() => s.background.rect(s.background.pending));
    assert.notDeepEqual(chosenCrop, cropBefore);
    await page.click('#crop-apply');
    assert.deepEqual(await page.evaluate(() => s.background.rect(s.background.current)), chosenCrop);
    assert.equal(await page.evaluate(() => JSON.stringify(s.motion.save())), pausedMotion);
    await page.locator('#background-file').setInputFiles(imageFile); await page.locator('#crop-dialog').waitFor({ state: 'visible' });
    await page.keyboard.press('Escape'); await page.locator('#crop-dialog').waitFor({ state: 'hidden' });
    assert.deepEqual(await page.evaluate(() => s.background.rect(s.background.current)), chosenCrop);
    await page.locator('#background-file').setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('not an image') });
    await page.waitForFunction(() => document.getElementById('background-error').textContent.length > 0);
    assert.deepEqual(await page.evaluate(() => s.background.rect(s.background.current)), chosenCrop);
    await page.check('[name=shape][value=rose]'); await page.check('[name=shape][value=cake]');
    assert.deepEqual(await page.evaluate(() => s.background.rect(s.background.current)), chosenCrop);
    check('upload crop, pointer/keyboard adjustment, cancel, invalid image and shape memory preserve the chosen paper', true);

    // Independent HD rendering covers intro, idle guide, paused rope and final
    // letter, for both shapes and both small/large screen pixel densities.
    for (const shape of ['rose', 'cake']) {
      await page.check(`[name=shape][value=${shape}]`);
      for (const phase of ['intro', 'idle', 'paused', 'complete']) {
        await page.evaluate(phase => {
          s.reset();
          if (phase !== 'intro') for (let i = 0; i < 370; i++) s.tick(1 / 120);
          if (phase === 'paused') { s.start(); for (let i = 0; i < 180; i++) s.tick(1 / 120); s.start(); }
          if (phase === 'complete') { s.motion.finish(); s.status = 'complete'; }
          s.resize(); s.draw(); s.updateUI();
        }, phase);
        const state = () => page.evaluate(() => JSON.stringify({ motion: s.motion.save(), status: s.status, elapsed: s.elapsed, size: s.size, canvas: [s.canvas.width, s.canvas.height], pixels: s.canvas.toDataURL() }));
        const beforeState = await state(), before = hash(beforeState);
        let downloads = 0; const onDownload = () => downloads++; page.on('download', onDownload);
        const guideCalls = await page.evaluate(() => {
          let calls = 0; const original = s.drawGuide; s.drawGuide = () => { calls++; };
          s.saveImage(); s.drawGuide = original; return calls;
        });
        assert.equal(guideCalls, 0, 'HD renderer excludes the whole guide layer');
        await page.waitForFunction(() => document.getElementById('export-image').naturalWidth === 1800);
        assert.equal(downloads, 0, 'save opens a preview before any download');
        assert.deepEqual(await page.locator('#export-image').evaluate(img => [img.naturalWidth, img.naturalHeight]), [1800, 2400]);
        const afterState = await state();
        if (hash(afterState) !== before) {
          const a = JSON.parse(beforeState), b = JSON.parse(afterState);
          console.error('HD export state changed', { shape, phase, beforeCanvas: a.canvas, afterCanvas: b.canvas,
            beforeElapsed: a.elapsed, afterElapsed: b.elapsed, motionChanged: JSON.stringify(a.motion) !== JSON.stringify(b.motion), pixelsChanged: a.pixels !== b.pixels });
        }
        assert.equal(hash(afterState), before, 'export does not alter live motion or canvas pixels');
        const png = await page.locator('#export-image').getAttribute('src');
        const waiting = page.waitForEvent('download'); await page.click('#export-download'); const file = await waiting;
        assert.equal(file.suggestedFilename(), `字里花间-${shape === 'rose' ? '玫瑰' : '蛋糕'}.png`);
        const filename = `${output}/${shape}-${phase}-hd.png`; await file.saveAs(filename);
        assert.equal(hash(fs.readFileSync(filename)), hash(Buffer.from(png.split(',')[1], 'base64')));
        assert.equal(hash(await state()), before);
        if (shape === 'cake' && phase === 'idle') await page.screenshot({ path: `${output}/hd-preview.png` });
        if (phase === 'intro' || phase === 'paused') await page.keyboard.press('Escape'); else await page.click('#export-close');
        await page.locator('#export-dialog').waitFor({ state: 'hidden' });
        assert.equal(await page.locator('#export-image').evaluate(img => img.hasAttribute('src')), false);
        assert.equal(await page.evaluate(() => s.exportFilename), null);
        page.off('download', onDownload);
        for (const width of [320, 360, 390, 900]) {
          await page.setViewportSize({ width, height: 844 });
          const buttons = await page.locator('.actions button').evaluateAll(buttons => buttons.map(button => ({
            id: button.id, clipped: button.scrollWidth > button.clientWidth + 1,
            right: button.getBoundingClientRect().right
          })));
          assert.ok(buttons.every(button => !button.clipped && button.right <= width), `${shape} ${phase} ${width}: ${JSON.stringify(buttons)}`);
        }
        results.exports.push({ shape, phase, width: 1800, height: 2400, unchanged: true, exactDownloadedBytes: true });
      }
    }
    await page.evaluate(() => { const original = s.exportImage; s.exportImage = () => { throw new Error('test render failure'); }; s.saveImage(); s.exportImage = original; });
    check('render failure restores save button and reports error', await page.locator('#save-image').isEnabled() && (await page.locator('#save-status').innerText()).length > 0);
    await page.click('#save-image');
    await page.evaluate(() => { window.originalClick = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = () => { throw new Error('test download failure'); }; });
    await page.click('#export-download');
    check('download failure allows retry and keeps the preview', await page.locator('#export-download').isEnabled() && await page.locator('#export-dialog').isVisible() && /下载失败/.test(await page.locator('#export-status').innerText()));
    await page.evaluate(() => { HTMLAnchorElement.prototype.click = window.originalClick; delete window.originalClick; });
    await page.click('#export-close');

    for (const dpr of [1, 3]) {
      const context = await browser.newContext({ viewport: { width: dpr === 1 ? 320 : 1280, height: 844 }, deviceScaleFactor: dpr });
      const target = await context.newPage(); await target.goto(base);
      const dimensions = await target.evaluate(async () => {
        const { studio } = await import(document.querySelector('script[type=module][src]').src); await studio.ready; const entry = document.getElementById('gift-entry-dialog'); if (entry) entry.close();
        const image = new Image(); image.src = studio.exportImage(); await image.decode();
        return [image.naturalWidth, image.naturalHeight];
      });
      assert.deepEqual(dimensions, [1800, 2400]); await context.close();
    }
    check('HD dimensions are independent of screen size and DPR', true);
    // Capture fresh pages so previous form focus and scroll anchoring cannot
    // affect the delivered full-page screenshots or the sticky desktop canvas.
    for (const [name, width, height] of [['mobile', 390, 844], ['desktop', 1280, 900], ['small-mobile', 320, 740]]) {
      const target = await browser.newPage({ viewport: { width, height } });
      await target.clock.install({ time }); await target.clock.pauseAt(time);
      target.on('pageerror', error => results.errors.push(error.message));
      await target.goto(base);
      await target.evaluate(async () => { window.s = (await import(document.querySelector('script[type=module][src]').src)).studio; await s.ready; const entry = document.getElementById('gift-entry-dialog'); if (entry) entry.close(); });
      for (const shape of ['rose', 'cake']) {
        await target.evaluate(shape => { s.selectShape(shape); for (let i = 0; i < 370; i++) s.tick(1 / 120); s.draw(); s.updateUI(); s.resize(); }, shape);
        await target.screenshot({ path: `${output}/${shape}-${name}.png`, fullPage: true });
      }
      await target.evaluate(() => s.choosePalette('light'));
      await target.waitForFunction(() => s.background.current.name === 'IMG_0003.jpg');
      await target.screenshot({ path: `${output}/cake-light-${name}.png`, fullPage: true });
      await target.close();
    }
    assert.deepEqual(results.errors, []);
    assert.deepEqual(protectedFiles(), initialProtected, 'protected sources, generated files, backups and ZIPs unchanged');
    results.protected = { files: Object.keys(initialProtected).length, unchanged: true, comparedToPreEdit: !!process.env.PROTECTED_MANIFEST, sha256: initialProtected };
    results.realDevice = false;
    fs.writeFileSync('output/web-parity-results-20261016.json', JSON.stringify(results, null, 2));
    console.log('WEB PARITY PASS', { layouts: results.layouts.length, checks: results.checks.length, exports: results.exports.length, protectedFiles: results.protected.files });
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
