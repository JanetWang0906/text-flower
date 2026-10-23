// Development evidence only. A browser/mock SDK cannot validate the XHS
// container, real album permissions, or Android/iOS encoder availability.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const base = process.env.ROSE_URL || 'http://127.0.0.1:8777/';
const output = path.resolve('output/video-export-20261022');
fs.mkdirSync(output, { recursive: true });
const report = { environment: 'Desktop Chrome with restricted CSP and mock miniTool bridge', realDevice: false, platformSimulator: false, packed: false, recordings: [], checks: [] };

(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const errors = [];
  async function page() {
    const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
    p.on('pageerror', error => errors.push(error.message));
    await p.route('**/minitool/index.html', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, headers: Object.assign({}, response.headers(), {
        'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self'; connect-src 'none'; worker-src 'none'; object-src 'none'"
      }) });
    });
    await p.goto(new URL('minitool/index.html', base).href);
    await p.evaluate(async () => { await studio.ready; document.getElementById('gift-entry-dialog').close(); });
    return p;
  }
  try {
    const p = await page();
    // Full replay must finish for all four engines, without changing the
    // live glyphs or the pending editor draft. Exercise manual mode too.
    await p.clock.install();
    for (const shape of ['rose', 'cake', 'gift', 'firework']) {
      const state = await p.evaluate(shape => {
        studio.selectShape(shape); studio.mode = 'manual';
        document.getElementById('message').value = '尚未应用的草稿';
        const before = JSON.stringify({ motion: studio.motion.save(), glyphs: studio.motion.originals });
        const scene = studio.createVideoScene(); let seconds = 0;
        const canvas = document.createElement('canvas'); canvas.width = 720; canvas.height = 960;
        const context = canvas.getContext('2d');
        while (seconds < 120) { seconds += 1 / 24; if (scene.advance(1 / 24)) break; }
        scene.render(context, 720, 960);
        return { shape, seconds, complete: seconds < 120,
          unchanged: before === JSON.stringify({ motion: studio.motion.save(), glyphs: studio.motion.originals }),
          draft: document.getElementById('message').value };
      }, shape);
      assert.equal(state.complete, true, shape + ' replay completes');
      assert.equal(state.unchanged, true); assert.equal(state.draft, '尚未应用的草稿');
      report.checks.push(state);
    }
    // Actual MP4 encoding, native-path playback, and explicit publish action.
    // Mock accepts only the exact documented argument shape.
    await p.close();
    for (const shape of ['rose', 'firework']) {
      const p = await page();
      await p.exposeFunction('saveTestVideo', data => {
        assert.match(data, /^data:video\/mp4(?:;[^,]+)?,/);
        const bytes = Buffer.from(data.slice(data.indexOf(',') + 1), 'base64');
        assert.equal(bytes.toString('ascii', 4, 8), 'ftyp', 'real MP4, never renamed WebM');
        fs.writeFileSync(path.join(output, shape + '-sample.mp4'), bytes);
        return { filePath: '/output/video-export-20261022/' + shape + '-sample.mp4' };
      });
      await p.evaluate(shape => {
        studio.selectShape(shape);
        window.bridgeCalls = []; window.failWrite = true;
        window.xhs = { miniTool: {
          writeTempFile: async options => {
            if (Object.keys(options).join() !== 'data') throw new Error('unexpected write arguments');
            bridgeCalls.push('write');
            if (failWrite) { failWrite = false; throw new Error('mock disk error'); }
            return window.saveTestVideo(options.data);
          },
          postNote: async options => {
            bridgeCalls.push(options);
            if (window.failPublish) throw new Error('mock cancelled');
            return { errMsg: 'postNote:ok' };
          }
        } };
      }, shape);
      await p.click('#export-video'); await p.click('#video-start');
      await p.waitForFunction(() => !studio.videoExport.recording && !!studio.videoExport.blob, null, { timeout: 125000 });
      await p.waitForFunction(() => !document.getElementById('video-share').disabled);
      assert.match(await p.locator('#video-status').innerText(), /写入本地文件失败/);
      assert.deepEqual(await p.evaluate(() => bridgeCalls), ['write'], 'generation never auto-publishes');
      await p.click('#video-share');
      await p.waitForFunction(() => bridgeCalls.length === 3);
      const call = await p.evaluate(() => bridgeCalls[2]);
      assert.deepEqual(call, { pageType: 'video_publish', mediaInfo: { video_resources: { video_url: '/output/video-export-20261022/' + shape + '-sample.mp4' } } });
      await p.waitForFunction(() => document.getElementById('video-preview').readyState >= 2);
      // Fragmented MP4 exposes an initial duration estimate with metadata
      // preload. Decode through the end before checking the full duration.
      await p.evaluate(async () => { const v = document.getElementById('video-preview'); v.playbackRate = 4; await v.play(); });
      await p.waitForFunction(() => document.getElementById('video-preview').ended, null, { timeout: 40000 });
      const metadata = await p.evaluate(() => {
        const v = document.getElementById('video-preview');
        const canvas = document.createElement('canvas'); canvas.width = 720; canvas.height = 960;
        const ctx = canvas.getContext('2d'); ctx.drawImage(v, 0, 0);
        const actual = ctx.getImageData(0, 0, 720, 960).data;
        const expected = studio.videoExport.ctx.getImageData(0, 0, 720, 960).data;
        let difference = 0;
        for (let i = 0; i < actual.length; i++) if (i % 4 !== 3) difference += Math.abs(actual[i] - expected[i]);
        return { width: v.videoWidth, height: v.videoHeight, duration: v.duration, type: studio.videoExport.blob.type, bytes: studio.videoExport.blob.size,
          finalFrameMeanError: difference / (720 * 960 * 3) };
      });
      assert.equal(metadata.width, 720); assert.equal(metadata.height, 960);
      assert.ok(metadata.duration > 5 && metadata.duration < 120, 'finite, decodable full animation');
      assert.ok(metadata.finalFrameMeanError < 8, 'decoded last frame contains the complete letter');
      await p.locator('#video-preview').screenshot({ path: path.join(output, shape + '-decoded-end.png') });
      await p.evaluate(() => { window.failPublish = true; }); await p.click('#video-share');
      await p.waitForFunction(() => document.getElementById('video-status').textContent.includes('未能打开'));
      assert.match(await p.locator('#video-status').innerText(), /尚未保存到相册或发布/);
      await p.locator('#video-dialog').screenshot({ path: path.join(output, shape + '-dialog.png') });
      report.recordings.push({ shape, ...metadata, writeFailureRetried: true, explicitPublish: true, publishFailureHandled: true });
      await p.click('#video-close');
      assert.equal(await p.evaluate(() => studio.videoExport.blob === null && studio.videoExport.stream === null && !document.getElementById('video-preview').getAttribute('src')), true);
      await p.close();
      console.log('MP4 RECORDING PASS', shape, metadata);
    }
    const q = await page();
    for (const width of [320, 390, 501, 900]) {
      await q.setViewportSize({ width, height: 844 });
      const layout = await q.evaluate(() => {
        const row = document.querySelector('.save-actions').getBoundingClientRect();
        return [...document.querySelectorAll('.save-actions button')].every(button => {
          const r = button.getBoundingClientRect();
          return r.left >= row.left - 1 && r.right <= row.right + 1 && Math.abs(r.top - row.top) <= 1 && button.scrollWidth <= button.clientWidth;
        }) && document.documentElement.scrollWidth <= innerWidth;
      });
      assert.equal(layout, true, 'save actions fit ' + width);
    }
    await q.setViewportSize({ width: 390, height: 844 });
    await q.evaluate(() => document.documentElement.style.setProperty('--safe-area-inset-top', '20px'));
    assert.equal(await q.locator('.studio').evaluate(el => getComputedStyle(el).paddingTop), '76px');
    await q.click('#export-video'); await q.click('#video-start');
    const trackState = await q.evaluate(() => { window.testTracks = studio.videoExport.stream.getTracks(); return testTracks.map(t => t.readyState); });
    assert.ok(trackState.every(x => x === 'live')); await q.click('#video-close');
    assert.equal(await q.evaluate(() => testTracks.every(t => t.readyState === 'ended')), true);
    await q.click('#export-video'); await q.click('#video-start');
    await q.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
    assert.match(await q.locator('#video-status').innerText(), /后台而取消/);
    assert.equal(await q.evaluate(() => studio.videoExport.recording), false);
    await q.click('#video-close');
    await q.evaluate(() => { window.MediaRecorder = undefined; }); await q.click('#export-video');
    assert.equal(await q.locator('#video-start').isDisabled(), true);
    assert.match(await q.locator('#video-status').innerText(), /不支持 MP4/);
    report.checks.push({ responsiveWidths: [320, 390, 501, 900], simulatorSafeArea: true, cancelReleasesTracks: true, backgroundCancels: true, unsupportedFallback: true, noAutoPublish: true });
    await q.close();
    assert.deepEqual(errors, []); report.pageErrors = errors;
    fs.writeFileSync(path.join(output, 'video-results.json'), JSON.stringify(report, null, 2));
    console.log('VIDEO EXPORT PASS');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
