const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium, webkit } = require('playwright');
const base = process.env.ROSE_URL || 'http://127.0.0.1:8777/';
const output = path.resolve('output/web-video-download-20261023'); fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const report = { scenes: [], recordings: [], layouts: [], errors: [], realDevice: false };
  async function page() {
    const p = await browser.newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
    p.on('pageerror', e => report.errors.push(e.message));
    await p.addInitScript(() => {
      localStorage.setItem('text-in-bloom-language', 'zh');
      window.publishCalls = []; window.xhs = { miniTool: {
        postNote: (...args) => { publishCalls.push(args); throw new Error('web must never publish'); },
        writeTempFile: () => { throw new Error('web must never write native files'); }
      } };
      window.liveURLs = new Set(); window.revokedURLs = [];
      const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
      URL.createObjectURL = blob => { const url = create(blob); liveURLs.add(url); return url; };
      URL.revokeObjectURL = url => { liveURLs.delete(url); revokedURLs.push(url); revoke(url); };
    });
    await p.goto(base);
    await p.evaluate(async () => { window.s = (await import(document.querySelector('script[type=module][src]').src)).studio; await s.ready; await s.gifts.ready; document.getElementById('gift-entry-dialog').close(); });
    return p;
  }
  try {
    const p = await page();
    assert.equal(await p.locator('#export-video').innerText(), '保存视频');
    await p.clock.install(); await p.clock.pauseAt(new Date());
    for (const shape of ['rose', 'cake', 'gift', 'firework']) {
      const r = await p.evaluate(shape => {
        s.selectShape(shape); s.mode = 'manual'; s.speed = 3; s.introSpeed = 1.5;
        document.getElementById('message').value = '未应用的草稿';
        const before = JSON.stringify({ motion: s.motion.save(), glyphs: s.motion.originals, settings: s.giftSettings() });
        const scene = s.createVideoScene(); let complete = false, seconds = 0;
        while (seconds < 120 && !complete) { seconds += 1 / 24; complete = scene.advance(1 / 24); }
        return { shape, complete, seconds, unchanged: before === JSON.stringify({ motion: s.motion.save(), glyphs: s.motion.originals, settings: s.giftSettings() }), draft: document.getElementById('message').value };
      }, shape);
      assert.ok(r.complete && r.unchanged); assert.equal(r.draft, '未应用的草稿'); report.scenes.push(r);
    }
    await p.close();

    // Record real MP4s, receive actual browser downloads, decode to their end,
    // and compare the last video frame against the complete letter canvas.
    for (const shape of ['rose', 'firework']) {
      const p = await page(); const popups = []; p.on('popup', popup => popups.push(popup.url()));
      await p.evaluate(shape => {
        s.selectShape(shape); s.motion.finish(); s.status = 'complete'; s.draw();
        document.getElementById('message').value = '保留这份未应用草稿';
      }, shape);
      const downloaded = p.waitForEvent('download', { timeout: 125000 });
      await p.click('#export-video');
      await p.evaluate(() => { window.recordedTracks = s.videoExport.stream.getTracks(); });
      const download = await downloaded, filename = download.suggestedFilename();
      assert.match(filename, /^字里花间-.+\.mp4$/);
      const file = path.join(output, shape + '-web.mp4'); await download.saveAs(file);
      const bytes = fs.readFileSync(file); assert.equal(bytes.toString('ascii', 4, 8), 'ftyp');
      assert.equal(await p.evaluate(() => recordedTracks.every(t => t.readyState === 'ended') && s.videoExport.stream === null), true);
      assert.deepEqual(await p.evaluate(() => publishCalls), []); assert.deepEqual(popups, []);
      assert.equal(await p.locator('#message').inputValue(), '保留这份未应用草稿');
      await p.waitForFunction(() => document.getElementById('video-preview').readyState >= 2);
      await p.evaluate(async () => { const v = document.getElementById('video-preview'); v.playbackRate = 4; await v.play(); });
      await p.waitForFunction(() => document.getElementById('video-preview').ended, null, { timeout: 40000 });
      const r = await p.evaluate(() => {
        const v = document.getElementById('video-preview'), c = document.createElement('canvas'); c.width = 720; c.height = 960;
        const ctx = c.getContext('2d'); ctx.drawImage(v, 0, 0);
        const a = ctx.getImageData(0, 0, 720, 960).data, b = s.videoExport.ctx.getImageData(0, 0, 720, 960).data;
        let difference = 0; for (let i = 0; i < a.length; i++) if (i % 4 !== 3) difference += Math.abs(a[i] - b[i]);
        return { width: v.videoWidth, height: v.videoHeight, duration: v.duration, type: s.videoExport.blob.type, finalFrameMeanError: difference / (720 * 960 * 3) };
      });
      assert.equal(r.width, 720); assert.equal(r.height, 960); assert.ok(r.duration > 5 && r.duration < 120); assert.ok(r.finalFrameMeanError < 8);
      const retryDownload = p.waitForEvent('download'); await p.click('#video-download');
      assert.deepEqual(fs.readFileSync(await (await retryDownload).path()), bytes, 'retry downloads the same MP4');
      await p.locator('#video-dialog').screenshot({ path: path.join(output, shape + '-download-dialog.png') });
      const previewURL = await p.evaluate(() => s.videoExport.url);
      await p.click('#video-close');
      assert.equal(await p.evaluate(url => !s.videoExport.blob && !s.videoExport.stream && !document.getElementById('video-preview').getAttribute('src') && revokedURLs.includes(url), previewURL), true);
      await p.evaluate(() => window.dispatchEvent(new Event('pagehide')));
      assert.equal(await p.evaluate(() => liveURLs.size), 0, 'navigation releases download URLs as well');
      report.recordings.push({ shape, filename, bytes: bytes.length, ...r, automaticDownload: true, repeatedDownload: true, noPublishCalls: true, cleanup: true });
      await p.close(); console.log('WEB MP4 DOWNLOAD PASS', shape, r);
    }

    const q = await page();
    for (const width of [320, 390, 516, 900, 1280]) {
      await q.setViewportSize({ width, height: 844 });
      const r = await q.evaluate(() => ({ width: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth,
        buttons: [...document.querySelectorAll('.save-actions button')].map(el => { const b = el.getBoundingClientRect(); return { text: el.textContent, left: b.left, right: b.right, top: b.top, height: b.height, fit: el.scrollWidth <= el.clientWidth }; }) }));
      assert.equal(r.overflow, false); assert.ok(r.buttons.every(b => b.fit && b.left >= 0 && b.right <= width && b.height >= 44 && Math.abs(b.top - r.buttons[0].top) < 1), JSON.stringify(r)); report.layouts.push(r);
    }
    await q.setViewportSize({ width: 390, height: 844 });
    for (const action of ['close', 'escape', 'background']) {
      await q.click('#export-video');
      await q.evaluate(() => { window.cancelTracks = s.videoExport.stream.getTracks(); });
      if (action === 'close') await q.click('#video-close');
      else if (action === 'escape') await q.keyboard.press('Escape');
      else await q.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
      await q.waitForFunction(() => !s.videoExport.recording && !s.videoExport.blob && cancelTracks.every(t => t.readyState === 'ended'));
      if (action === 'background') { assert.match(await q.locator('#video-status').innerText(), /后台而取消/); await q.click('#video-close'); }
      await q.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); });
    }
    await q.evaluate(() => { window.MediaRecorder = undefined; }); await q.click('#export-video');
    assert.match(await q.locator('#video-status').innerText(), /不支持 MP4/);
    assert.equal(await q.locator('#video-download').isVisible(), false); await q.click('#video-close');
    await q.screenshot({ path: path.join(output, 'web-mobile.png') }); await q.close();
    report.cancelCloseEscapeBackground = true; report.unsupportedFallback = true;

    const w = await webkit.launch({ headless: true });
    try {
      const p = await w.newPage({ viewport: { width: 402, height: 874 } }); p.on('pageerror', e => report.errors.push(e.message));
      await p.goto(base); await p.evaluate(async () => { const s = (await import(document.querySelector('script[type=module][src]').src)).studio; await s.ready; document.getElementById('gift-entry-dialog').close(); });
      await p.click('#export-video');
      report.webkit = await p.evaluate(() => ({ open: document.getElementById('video-dialog').open, status: document.getElementById('video-status').textContent, overflow: document.documentElement.scrollWidth > innerWidth }));
      assert.equal(report.webkit.open, true); assert.equal(report.webkit.overflow, false);
      await p.click('#video-close'); await p.close();
    } finally { await w.close(); }
    assert.deepEqual(report.errors, []);
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(report, null, 2)); console.log('WEB VIDEO DOWNLOAD PASS');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
