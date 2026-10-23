// The thumbnail is outside the QR square. Compare its entire original matrix,
// then decode actual saved PNG/JPEG images and import them in the web engine.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium, webkit } = require('playwright');
const base = process.env.ROSE_URL || 'http://127.0.0.1:8777/';
const out = path.resolve('output/mobile-controls-20261022');
fs.mkdirSync(out, { recursive: true });
(async () => {
  const report = { cases: [], realDevice: false, xhsContainer: false };
  for (const engine of [
    { name: 'chromium', api: chromium, options: { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true } },
    { name: 'webkit', api: webkit, options: { headless: true } }
  ]) {
    const browser = await engine.api.launch(engine.options);
    try {
      const p = await browser.newPage({ viewport: { width: 402, height: 874 } }), errors = [];
      p.on('pageerror', e => errors.push(e.message));
      await p.goto(new URL('minitool/index.html', base).href);
      await p.evaluate(async () => { await studio.ready; await studio.gifts.ready; document.getElementById('gift-entry-dialog').close(); });
      const files = [];
      for (const shape of ['rose', 'cake', 'gift', 'firework']) {
        const preserved = await p.evaluate(shape => {
          studio.selectShape(shape); document.getElementById('message').value = studio.text;
          const before = JSON.stringify({ motion: studio.motion.save(), glyphs: studio.motion.originals, status: studio.status });
          const c = studio.giftThumbnail(); c.width = c.height = 1;
          return before === JSON.stringify({ motion: studio.motion.save(), glyphs: studio.motion.originals, status: studio.status });
        }, shape);
        assert.equal(preserved, true, 'formed thumbnail never changes live animation');
        await p.click('#save-gift-qr'); await p.locator('#gift-qr-dialog').waitFor({ state: 'visible' });
        const result = await p.evaluate(async () => {
          const expected = GiftCodec.encode(studio.giftSettings());
          // Read the saved PNG as an album image. Waiting on load mirrors
          // openPhoto and avoids WebKit's preview-image decode timing.
          const source = document.getElementById('gift-qr-image').src;
          const image = await new Promise((resolve, reject) => {
            const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = source;
          });
          const d = studio.gifts.qrDetails, canvas = document.createElement('canvas');
          canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
          const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
          const a = ctx.getImageData(0, 0, d.qrSize, d.qrSize).data;
          const qr = qrcode(0, 'M'); qr.addData(expected, 'Byte'); qr.make();
          let exact = true, matrixMismatch;
          for (let y = 0; y < d.qrSize && exact; y++) for (let x = 0; x < d.qrSize; x++) {
            const row = Math.floor(y / 8) - 6, col = Math.floor(x / 8) - 6;
            const black = row >= 0 && col >= 0 && row < qr.getModuleCount() && col < qr.getModuleCount() && qr.isDark(row, col);
            const i = (y * d.qrSize + x) * 4, v = black ? 0 : 255;
            if (a[i] !== v || a[i + 1] !== v || a[i + 2] !== v || a[i + 3] !== 255) { exact = false; matrixMismatch = { x, y, expected: v, actual: Array.from(a.slice(i, i + 4)) }; break; }
          }
          const raw = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const full = jsQR(raw.data, raw.width, raw.height, { inversionAttempts: 'dontInvert' });
          // Exercise the same bounded resolution used by album imports.
          const sample = document.createElement('canvas'), scale = Math.min(1, 1400 / Math.max(canvas.width, canvas.height));
          sample.width = Math.round(canvas.width * scale); sample.height = Math.round(canvas.height * scale);
          const sc = sample.getContext('2d'); sc.drawImage(canvas, 0, 0, sample.width, sample.height);
          const pixels = sc.getImageData(0, 0, sample.width, sample.height);
          const resized = jsQR(pixels.data, pixels.width, pixels.height, { inversionAttempts: 'dontInvert' });
          return { exactMatrixAndQuietZone: exact, matrixMismatch, fullPNG: !!full && full.data === expected, albumResolution: !!resized && resized.data === expected,
            ...d, width: canvas.width, height: canvas.height, data: image.src, gift: studio.giftSettings() };
        });
        assert.equal(result.exactMatrixAndQuietZone, true, engine.name + ' ' + shape + ' ' + JSON.stringify(result.matrixMismatch));
        assert.equal(result.fullPNG, true); assert.equal(result.albumResolution, true); assert.equal(result.thumbnail, true);
        assert.equal(result.errorCorrection, 'M');
        fs.writeFileSync(path.join(out, engine.name + '-' + shape + '-gift.png'), Buffer.from(result.data.split(',')[1], 'base64'));
        files.push({ shape, data: result.data, gift: result.gift });
        const { data, gift, ...summary } = result; report.cases.push({ engine: engine.name, shape, preserved, ...summary });
        await p.click('#gift-qr-close');
      }
      // Dense payload still uses the original M-level maximum byte capacity.
      await p.evaluate(() => {
        studio.selectShape('firework'); let n = 0, gift = studio.giftSettings();
        while (GiftCodec.bytes('ZLHJ:' + JSON.stringify(Object.assign({}, gift, { t: '祝'.repeat(n + 1) }))) <= GiftCodec.MAX_BYTES) n++;
        const text = '祝'.repeat(n);
        if (!studio.apply(text, 20, 28, false, true, false)) throw new Error('test payload cannot apply');
        document.getElementById('message').value = text;
      });
      await p.click('#save-gift-qr'); await p.locator('#gift-qr-dialog').waitFor({ state: 'visible' });
      const dense = await p.evaluate(() => ({ bytes: GiftCodec.bytes(GiftCodec.encode(studio.giftSettings())), ...studio.gifts.qrDetails }));
      assert.ok(dense.bytes > 2300); assert.equal(dense.thumbnail, true); assert.equal(dense.errorCorrection, 'M');
      report.cases.push({ engine: engine.name, shape: 'dense-firework', ...dense, originalCapacityRetained: true });
      await p.click('#gift-qr-close');
      if (engine.name === 'chromium') {
        // Existing independent web implementation imports the new decorated
        // images without a protocol change, including the firework shape.
        const receiver = await browser.newPage();
        await receiver.goto(base);
        await receiver.evaluate(async () => { window.receiver = (await import(document.querySelector('script[type=module][src]').src)).studio; await receiver.ready; });
        for (const file of files) {
          await receiver.evaluate(async ({ data }) => {
            const image = new Image(); image.src = data; await image.decode();
            const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1800;
            const ctx = canvas.getContext('2d'); ctx.fillStyle = '#eee'; ctx.fillRect(0, 0, 1800, 1800);
            ctx.translate(900, 900); ctx.rotate(Math.PI / 36);
            const width = 1000, height = image.naturalHeight * width / image.naturalWidth;
            ctx.drawImage(image, -width / 2, -height / 2, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', .85);
            const binary = atob(dataUrl.split(',')[1]), bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
            receiver.gifts.showEntry();
            await receiver.gifts.openPhoto(new File([bytes], 'album-photo.jpg', { type: 'image/jpeg' }));
          }, file);
          assert.equal(await receiver.locator('#gift-entry-dialog').evaluate(d => d.open), false);
          assert.deepEqual(await receiver.evaluate(() => window.receiver.giftSettings()), file.gift);
        }
        report.crossImportRotatedJPEG = files.length; await receiver.close();
      }
      assert.deepEqual(errors, []); console.log(engine.name, 'GIFT THUMBNAIL PASS: 4 shapes, original matrix, full/resized PNG and >2300-byte payload');
    } finally { await browser.close(); }
  }
  fs.writeFileSync(path.join(out, 'thumbnail-results.json'), JSON.stringify(report, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
