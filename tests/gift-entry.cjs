const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const base = process.env.ROSE_URL || 'http://127.0.0.1:8766/';
const out = 'output/gift-entry-startup-20261022';
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const report = { targets: [], errors: [], packed: false, realDevice: false };
  try {
    for (const mini of [false, true]) {
      const label = mini ? 'minitool' : 'web', context = await browser.newContext({ viewport: { width: 516, height: 848 } });
      const page = await context.newPage(); page.on('pageerror', error => report.errors.push(error.message));
      let release;
      let gate = new Promise(resolve => { release = resolve; });
      await page.route(/\/IMG_[^/?]+(?:\?.*)?$/, async route => { await gate; await route.continue(); });
      const setup = async reload => {
        if (reload) await page.reload({ waitUntil: 'domcontentloaded' });
        else await page.goto(new URL(mini ? 'minitool/index.html' : '', base).href, { waitUntil: 'domcontentloaded' });
        await page.locator('#gift-entry-dialog').waitFor({ state: 'visible' });
        await page.evaluate(async mini => {
          window.s = mini ? studio : (await import(document.querySelector('script[type=module]').src)).studio;
          window.restores = 0;
          const restore = s.restoreGift.bind(s); s.restoreGift = async data => { restores++; return restore(data); };
        }, mini);
        const pending = await page.evaluate(() => ({ status: s.status, defaults: !!s.gifts.defaults, create: document.getElementById('gift-create').disabled, open: document.getElementById('gift-open').disabled }));
        assert.equal(pending.status, 'loading'); assert.equal(pending.defaults, false);
        assert.equal(pending.create, false); assert.equal(pending.open, false);
        return pending;
      };
      const initial = await setup(false);
      await page.screenshot({ path: `${out}/${label}-entry-initial.png` });
      await page.click('#gift-create', { timeout: 1500 });
      assert.equal(await page.locator('#gift-entry-dialog').evaluate(dialog => dialog.open), false, 'early create accepts the choice before images finish');
      assert.equal(await page.evaluate(() => s.gifts.busy && s.status === 'loading' && restores === 0), true);
      // The original initialization already creates the default gift. Do not
      // reapply it later and overwrite an editor draft typed while loading.
      await page.locator('#message').evaluate(input => { input.value = '加载时写下的心意'; });
      release();
      await page.waitForFunction(() => !!s.gifts.defaults && !s.gifts.busy);
      assert.equal(await page.evaluate(() => restores), 0);
      assert.equal(await page.locator('#message').inputValue(), '加载时写下的心意');
      await page.click('#gift-entry'); await page.click('#gift-create');
      await page.waitForFunction(() => !s.gifts.busy);
      assert.equal(await page.evaluate(() => restores), 1, 'later create still restores the captured defaults');
      assert.equal(await page.evaluate(() => JSON.stringify(s.giftSettings()) === JSON.stringify(s.gifts.defaults)), true);

      gate = new Promise(resolve => { release = resolve; });
      const refreshed = await setup(true);
      const cancelled = page.waitForEvent('filechooser', { timeout: 1500 });
      await page.click('#gift-open', { timeout: 1500 }); await (await cancelled).setFiles([]);
      assert.equal(await page.locator('#gift-open').isEnabled(), true, 'cancelling the picker never locks the entry');
      const invalid = page.waitForEvent('filechooser', { timeout: 1500 });
      await page.click('#gift-open');
      await (await invalid).setFiles({ name: '无效文件.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image') });
      await page.waitForFunction(() => !s.gifts.busy && /请选择/.test(document.getElementById('gift-entry-status').textContent));
      assert.equal(await page.evaluate(() => s.status === 'loading' && !s.gifts.defaults), true, 'file validation does not wait for background images');
      assert.equal(await page.locator('#gift-create').isEnabled(), true);

      const payload = await page.evaluate(() => {
        const gift = GiftCodec.validate({ v: 1, s: 0, t: document.getElementById('message').value,
          c: ['#d35159', '#4b8b3d'], i: '#34312e', p: 'light', f: 20, l: 28,
          a: [1, 2, 1, 1], b: [GiftCodec.PAPERS.indexOf('IMG_0006.jpg'), 1, .5, .5] });
        qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8']; const qr = qrcode(0, 'M'); qr.addData(GiftCodec.encode(gift), 'Byte'); qr.make();
        const n = qr.getModuleCount(), unit = 6, canvas = document.createElement('canvas'); canvas.width = canvas.height = (n + 8) * unit;
        const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = '#000';
        for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) ctx.fillRect((x + 4) * unit, (y + 4) * unit, unit, unit);
        return { gift, png: canvas.toDataURL() };
      });
      const selected = page.waitForEvent('filechooser', { timeout: 1500 });
      await page.click('#gift-open');
      await (await selected).setFiles({ name: '礼物.png', mimeType: 'image/png', buffer: Buffer.from(payload.png.split(',')[1], 'base64') });
      await page.waitForFunction(() => s.gifts.busy);
      assert.equal(await page.evaluate(() => restores), 0, 'QR settings cannot apply before the engine is ready');
      release(); await page.waitForFunction(() => !s.gifts.busy && !document.getElementById('gift-entry-dialog').open);
      assert.deepEqual(await page.evaluate(() => s.giftSettings()), payload.gift);
      assert.equal(await page.evaluate(() => restores), 1, 'an early photo is imported exactly once');
      report.targets.push({ label, initial, refreshed, createImmediately: true, pickerImmediately: true, cancelRecovered: true, earlyValidation: true, earlyQRImport: true, draftPreserved: true });
      console.log(label, 'ENTRY STARTUP PASS'); await context.close();
    }
    assert.deepEqual(report.errors, []);
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(report, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
