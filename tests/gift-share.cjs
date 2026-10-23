const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const base = process.env.ROSE_URL || 'http://127.0.0.1:8765/';
const out = 'output/gift-share-20261019';
fs.mkdirSync(out, { recursive: true });
const png = data => Buffer.from(data.split(',')[1], 'base64');
const imageFile = (data, name = '礼物二维码.png') => ({ name, mimeType: 'image/png', buffer: png(data) });

(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const report = { roundTrips: [], layouts: [], failures: [], checks: [], externalRequests: [], errors: [], realDevice: false };
  const check = (name, condition) => { assert.ok(condition, name); report.checks.push(name); };
  const boot = async (mini, options = {}) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true, offline: !!options.file });
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('request', request => { if (/^https?:/.test(request.url()) && !request.url().startsWith(base)) report.externalRequests.push(request.url()); });
    if (!mini) await page.addInitScript(() => localStorage.setItem('text-in-bloom-language', 'zh'));
    if (options.native) await page.addInitScript(() => {
      window.albumCalls = []; window.rejectAlbum = false;
      window.xhs = { miniTool: {
        writeTempFile: async ({ data }) => { window.albumCalls.push({ type: 'write', data }); return { filePath: 'tmp/gift.png' }; },
        saveImageToPhotosAlbum: async ({ filePath }) => { window.albumCalls.push({ type: 'album', filePath }); if (window.rejectAlbum) throw new Error('permission denied'); }
      } };
    });
    if (mini) await page.addInitScript(() => {
      window.fetch = () => { throw new Error('offline: fetch is unavailable'); };
      window.ResizeObserver = undefined;
    });
    await page.goto(options.file ? pathToFileURL(path.resolve('minitool/index.html')).href : new URL(mini ? 'minitool/index.html' : '', base).href);
    await page.evaluate(async mini => {
      window.s = mini ? window.studio : (await import(document.querySelector('script[type=module][src]').src)).studio;
      await s.ready; await s.gifts.ready;
    }, mini);
    assert.equal(await page.locator('#gift-entry-dialog').evaluate(dialog => dialog.open), true);
    return page;
  };
  const formed = page => page.evaluate(() => { for (let i = 0; i < 370; i++) s.tick(1 / 120); s.draw(); s.updateUI(); });
  const chooseFile = async (page, file) => {
    await page.evaluate(() => {
      window.giftInputSeen = false;
      document.getElementById('gift-file').addEventListener('change', () => { window.giftInputSeen = true; }, { once: true });
    });
    const chooser = page.waitForEvent('filechooser'); await page.click('#gift-open'); await (await chooser).setFiles(file);
    await page.waitForFunction(() => window.giftInputSeen && !s.gifts.busy);
  };
  const rawQR = (page, content) => page.evaluate(content => {
    qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
    const qr = qrcode(0, 'M'); qr.addData(content, 'Byte'); qr.make();
    const n = qr.getModuleCount(), unit = 6, canvas = document.createElement('canvas'); canvas.width = canvas.height = (n + 8) * unit;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = '#000';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) ctx.fillRect((x + 4) * unit, (y + 4) * unit, unit, unit);
    return canvas.toDataURL();
  }, content);
  try {
    const gifts = [];
    for (const mini of [false, true]) {
      const actor = await boot(mini), label = mini ? 'minitool' : 'web';
      if (!mini) await actor.screenshot({ path: `${out}/entry-mobile.png` });
      await actor.click('#gift-create'); await formed(actor);
      check(`${label} maker uses defaults`, await actor.evaluate(() => JSON.stringify(s.giftSettings()) === JSON.stringify(s.gifts.defaults)));
      for (const width of [320, 360, 390, 501, 900, 1280]) {
        await actor.setViewportSize({ width, height: 844 });
        const layout = await actor.evaluate(() => {
          const rect = id => { const r = document.getElementById(id).getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width }; };
          return { overflow: document.documentElement.scrollWidth > innerWidth, save: rect('save-image'), qr: rect('save-gift-qr'), entry: rect('gift-entry') };
        });
        assert.equal(layout.overflow, false);
        assert.ok(Math.abs(layout.save.y - layout.qr.y) < 1 && layout.save.right <= layout.qr.x && layout.qr.right <= width);
        assert.ok(layout.entry.right <= width);
        report.layouts.push({ label, width, ...layout });
      }
      await actor.setViewportSize({ width: 390, height: 844 });
      await actor.evaluate(() => { scrollTo(0, 0); s.resize(); });
      if (!mini) await actor.screenshot({ path: `${out}/maker-mobile.png`, fullPage: true });
      for (const shape of ['rose', 'cake', 'gift']) {
        await actor.check(`[name=shape][value=${shape}]`); await formed(actor);
        const paper = mini ? 'IMG_0003.jpg' : 'IMG_0045.JPG';
        await actor.click(`[data-background="${paper}"]`);
        await actor.waitForFunction(paper => s.background.current.name === paper, paper);
        const expected = await actor.evaluate(mini => {
          const text = '送给亲爱的你：🌷 e\u0301\n' + s.text;
          if (!s.apply(text, 20, 32, false, true, false)) throw new Error(document.getElementById('input-error').textContent);
          document.getElementById('message').value = text;
          s.speed = mini ? 3 : .5; s.introSpeed = mini ? .5 : 2; s.mode = mini ? 'auto' : 'manual';
          document.querySelector(`[name=mode][value=${s.mode}]`).checked = true;
          s.colors = s.shapeConfig.parts.map((_, i) => ['#a12f4c', '#557788', '#556b2f', '#d78922'][i]);
          s.ink = '#102234'; s.palettes[s.paletteMode] = s.colors.concat(s.ink); s.setPalette(s.paletteMode);
          s.updateShapeControls(); s.updateUI(); s.draw();
          return s.giftSettings();
        }, mini);
        await actor.context().setOffline(true);
        const requests = []; actor.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
        await actor.click('#save-gift-qr');
        await actor.locator('#gift-qr-dialog').waitFor();
        const data = await actor.locator('#gift-qr-image').getAttribute('src');
        assert.match(data, /^data:image\/png;base64,/);
        fs.writeFileSync(`${out}/${label}-${shape}-gift.png`, png(data));
        if (!mini) {
          const wait = actor.waitForEvent('download'); await actor.click('#gift-qr-save'); const download = await wait;
          assert.equal(download.suggestedFilename(), '字里花间-礼物二维码.png');
          await download.saveAs(`${out}/${shape}-download.png`);
          assert.deepEqual(fs.readFileSync(`${out}/${shape}-download.png`), png(data));
        } else {
          await actor.click('#gift-qr-save'); assert.match(await actor.locator('#gift-qr-status').innerText(), /长按/);
        }
        if (shape === 'cake' && !mini) await actor.screenshot({ path: `${out}/qr-preview-mobile.png` });
        await actor.click('#gift-qr-close');
        assert.equal(await actor.locator('#gift-qr-image').getAttribute('src'), null, 'preview releases PNG data');
        check(`${label}/${shape} generation and saving stay offline`, requests.length === 0);
        gifts.push({ mini, shape, data, expected });
        await actor.context().setOffline(false);
      }
      await actor.context().close();
    }
    // Fresh recipients import the saved PNG through the actual photo picker.
    // Cross-import between both implementations; mini-tool runs directly from disk.
    for (const gift of gifts) {
      const mini = !gift.mini, recipient = await boot(mini, { file: mini });
      await recipient.context().setOffline(true);
      const requests = []; recipient.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
      await chooseFile(recipient, imageFile(gift.data));
      assert.equal(await recipient.locator('#gift-entry-dialog').evaluate(dialog => dialog.open), false, await recipient.locator('#gift-entry-status').innerText());
      assert.deepEqual(await recipient.evaluate(() => s.giftSettings()), gift.expected);
      assert.equal(await recipient.locator('#speed').innerText(), `展开 ${gift.expected.a[1]}×`);
      assert.equal(await recipient.locator('[name=mode]:checked').inputValue(), gift.expected.a[0] ? 'manual' : 'auto');
      check(`cross import ${gift.mini ? 'mini' : 'web'} → ${mini ? 'mini file' : 'web'} ${gift.shape} without network`, requests.length === 0);
      await formed(recipient);
      const result = await recipient.evaluate(() => {
        const chars = s.motion.originals.map(g => g.ch).join('');
        s.start(); for (let i = 0; i < 120 * 100 && s.status !== 'complete'; i++) s.tick(1 / 120);
        s.draw(); s.updateUI(); return { status: s.status, chars, count: s.sources.length, error: s.motion.maxError };
      });
      assert.equal(result.status, 'complete'); assert.ok(result.error < .1);
      assert.equal(result.chars, gift.expected.t.replace(/[\r\n]/g, ''), 'all original text survives the full animation');
      report.roundTrips.push({ from: gift.mini ? 'minitool' : 'web', to: mini ? 'minitool-file-offline' : 'web-offline', shape: gift.shape, allSettingsEqual: true, ...result });
      await recipient.context().close();
    }

    const receiver = await boot(true, { file: true });
    await receiver.click('#gift-create'); await formed(receiver);
    const before = await receiver.evaluate(() => JSON.stringify({ settings: s.giftSettings(), motion: s.motion.save(), draft: document.getElementById('message').value }));
    await receiver.click('#gift-entry');
    const wrongs = [
      ['ordinary', 'https://example.com/gift', /不是/],
      ['version', 'ZLHJ:' + JSON.stringify({ ...gifts[0].expected, v: 2 }), /版本/],
      ['settings', 'ZLHJ:' + JSON.stringify({ ...gifts[0].expected, a: [0, 999, 1, 1] }), /不完整/],
      ['unfittable', 'ZLHJ:' + JSON.stringify({ ...gifts[0].expected, t: '一个字' }), /无法按原字号/],
      ['broken', 'ZLHJ:{"v":1,', /损坏/]
    ];
    for (const [name, text, pattern] of wrongs) {
      await chooseFile(receiver, imageFile(await rawQR(receiver, text), name + '.png'));
      assert.match(await receiver.locator('#gift-entry-status').innerText(), pattern);
      assert.equal(await receiver.evaluate(() => JSON.stringify({ settings: s.giftSettings(), motion: s.motion.save(), draft: document.getElementById('message').value })), before);
      assert.equal(await receiver.locator('#gift-open').isEnabled(), true);
      report.failures.push({ name, preserved: true, retryEnabled: true });
    }
    const blank = await receiver.evaluate(() => { const c = document.createElement('canvas'); c.width = c.height = 200; c.getContext('2d').fillRect(0, 0, 200, 200); return c.toDataURL(); });
    await chooseFile(receiver, imageFile(blank)); assert.match(await receiver.locator('#gift-entry-status').innerText(), /没有找到/);
    await chooseFile(receiver, { name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('not an image') });
    assert.match(await receiver.locator('#gift-entry-status').innerText(), /无法读取/);
    await receiver.evaluate(() => s.gifts.openPhoto({ size: 21 * 1024 * 1024, type: 'image/png' }));
    assert.match(await receiver.locator('#gift-entry-status').innerText(), /20 MB/);
    await chooseFile(receiver, imageFile(gifts[0].data));
    check('valid photo works after failed imports', !(await receiver.locator('#gift-entry-dialog').evaluate(d => d.open)));
    await formed(receiver);
    // A rotated, resized JPEG simulates an album photo or messaging compression.
    const photo = await receiver.evaluate(async data => {
      const image = new Image(); image.src = data; await image.decode();
      const c = document.createElement('canvas'); c.width = c.height = 1800;
      const ctx = c.getContext('2d'); ctx.fillStyle = '#eee'; ctx.fillRect(0, 0, 1800, 1800);
      ctx.translate(900, 900); ctx.rotate(Math.PI / 18);
      ctx.drawImage(image, -550, -630, 1100, 1260); return c.toDataURL('image/jpeg', .82);
    }, gifts[0].data);
    await receiver.click('#gift-entry');
    await chooseFile(receiver, { name: '相册照片.jpg', mimeType: 'image/jpeg', buffer: png(photo) });
    assert.deepEqual(await receiver.evaluate(() => s.giftSettings()), gifts[0].expected);
    check('rotated and compressed JPEG imports offline', !(await receiver.locator('#gift-entry-dialog').evaluate(d => d.open)));
    await formed(receiver);
    await receiver.click('#edit-toggle'); await receiver.locator('#message').fill('尚未应用的草稿');
    await receiver.click('#save-gift-qr'); assert.match(await receiver.locator('#save-status').innerText(), /尚未应用/);
    await receiver.evaluate(() => { document.getElementById('message').value = s.text; s.background.current = { ...s.background.current, selection: 'custom' }; });
    await receiver.click('#save-gift-qr'); assert.match(await receiver.locator('#save-status').innerText(), /自定义背景/);
    await receiver.context().close();

    const native = await boot(true, { file: true, native: true });
    await native.click('#gift-create');
    await native.evaluate(() => { window.rejectAlbum = true; });
    await native.click('#save-gift-qr'); await native.locator('#gift-qr-dialog').waitFor({ state: 'visible' }); await native.waitForFunction(() => !s.gifts.saving);
    assert.match(await native.locator('#gift-qr-status').innerText(), /保存失败/);
    assert.equal(await native.locator('#gift-qr-save').isEnabled(), true);
    await native.evaluate(() => { window.rejectAlbum = false; });
    await native.click('#gift-qr-save'); await native.waitForFunction(() => !s.gifts.saving);
    assert.match(await native.locator('#gift-qr-status').innerText(), /已保存到相册/);
    check('native save uses temp file then album and recovers from denial', await native.evaluate(() => albumCalls.length === 4 && albumCalls[1].filePath === 'tmp/gift.png' && albumCalls[3].filePath === 'tmp/gift.png' && albumCalls[0].data === document.getElementById('gift-qr-image').src));
    await native.context().close();
    assert.deepEqual(report.errors, []); assert.deepEqual(report.externalRequests, []);
    fs.writeFileSync(`${out}/results.json`, JSON.stringify(report, null, 2));
    console.log('GIFT SHARE PASS', JSON.stringify({ roundTrips: report.roundTrips.length, layouts: report.layouts.length, failures: report.failures.length, checks: report.checks.length, realDevice: false }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
