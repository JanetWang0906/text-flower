const fs = require('node:fs');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const hash = data => crypto.createHash('sha256').update(data).digest('hex');

(async () => {
  const original = 'backups/minitool-original-20260928/';
  const manifest = JSON.parse(fs.readFileSync('backups/minitool-original-sha256.json'));
  for (const [file, expected] of Object.entries(manifest)) assert.equal(hash(fs.readFileSync(original + file)), expected);
  const html = fs.readFileSync('minitool/index.html', 'utf8');
  const oldHtml = fs.readFileSync(original + 'index.html', 'utf8');
  const actions = text => text.match(/<div class="actions">[^]*?<\/div>/)[0];
  assert.equal(actions(html), actions(oldHtml), 'original controls retained exactly');
  assert.ok(fs.readFileSync('minitool/style.css', 'utf8').startsWith(fs.readFileSync(original + 'style.css', 'utf8')), 'original CSS preserved in full');
  for (const id of ['rose-source', 'text-form', 'crop-dialog', 'notice-dialog']) {
    const element = text => text.match(new RegExp('<(?:template|form|dialog) id="' + id + '"[^]*?<\/(?:template|form|dialog)>'))[0];
    assert.equal(element(html), element(oldHtml), id + ' unchanged');
  }
  const app = fs.readFileSync('minitool/app.js', 'utf8'), oldApp = fs.readFileSync(original+'app.js', 'utf8');
  const method = (text, name, next) => text.slice(text.indexOf('  '+name+'('), text.indexOf('  '+next+'('));
  assert.ok(app.includes('sdk.writeTempFile({ data: dataUrl })') && app.includes('sdk.saveImageToPhotosAlbum({ filePath })'), 'original native album bridge flow retained');
  assert.equal(method(app,'frame','resize'), method(oldApp,'frame','resize'), 'original frame/speed scheduling unchanged');
  const solver = text => text.slice(text.indexOf('  const tail=4'), text.indexOf(' supported(){'));
  assert.equal(solver(app), solver(oldApp), 'original solver and collision performance tuning unchanged');
  // Build in a fixture without any web implementation files. This catches
  // accidental dependencies on root app.js, motion.js, index.html or CSS.
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'minitool-isolation-'));
  try {
    fs.mkdirSync(path.join(fixture,'tests'));
    fs.copyFileSync('tests/build-minitool.cjs', path.join(fixture,'tests/build-minitool.cjs'));
    fs.cpSync('minitool-src', path.join(fixture,'minitool-src'), {recursive:true});
    fs.cpSync(original, path.join(fixture,original), {recursive:true});
    fs.mkdirSync(path.join(fixture,'蛋糕')); fs.copyFileSync('蛋糕/蛋糕.svg',path.join(fixture,'蛋糕/蛋糕.svg'));
    execFileSync(process.execPath,[path.join(fixture,'tests/build-minitool.cjs')],{stdio:'pipe'});
    for (const name of ['app.js','index.html','style.css']) assert.equal(hash(fs.readFileSync(path.join(fixture,'minitool',name))), hash(fs.readFileSync('minitool/'+name)), 'isolated build '+name);
  } finally { fs.rmSync(fixture,{recursive:true,force:true}); }
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  try {
    const histories = [];
    for (const base of [original, 'minitool/']) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const time = new Date('2026-10-06T00:00:00Z');
      await page.clock.install({ time }); await page.clock.pauseAt(time);
      await page.goto('http://127.0.0.1:8765/' + base + 'index.html');
      await page.evaluate(async () => { window.s = studio; await s.ready; });
      const history = [];
      for (const steps of [0, 60, 120, 200]) {
        const state = await page.evaluate(steps => {
          for (let i=0; i<steps; i++) s.tick(1/120); s.draw();
          return { size:s.size, paragraphSize:s.paragraphSize, text:s.text, colors:s.colors, ink:s.ink, speed:s.speed, introSpeed:s.introSpeed,
            status:s.status, motion:s.motion.save(), glyphs:s.motion.originals, png:s.canvas.toDataURL() };
        }, steps);
        history.push(hash(JSON.stringify(state)));
      }
      // Compare actual pointer drag and release at the same logical position.
      const tip = await page.evaluate(() => { const g=s.motion.originals[0],r=s.canvas.getBoundingClientRect(); return {x:r.x+g.x*r.width/900,y:r.y+g.y*r.height/1200}; });
      await page.mouse.move(tip.x, tip.y); await page.mouse.down();
      await page.mouse.move(tip.x+60, tip.y-50, { steps:10 });
      await page.evaluate(() => { for(let i=0;i<60;i++)s.tick(1/120); }); await page.mouse.up();
      history.push(hash(await page.evaluate(() => JSON.stringify({status:s.status,mode:s.mode,motion:s.motion.save(),glyphs:s.motion.originals}))));
      const result = await page.evaluate(() => {
        for(let i=0;i<120*90&&s.status!=='complete';i++)s.tick(1/120);
        s.draw(); return {status:s.status,motion:s.motion.save(),glyphs:s.motion.originals,png:s.canvas.toDataURL()};
      });
      assert.equal(result.status, 'complete'); history.push(hash(JSON.stringify(result)));
      histories.push(history);
      if (base === 'minitool/') {
        await page.click('#reset'); await page.evaluate(() => {for(let i=0;i<370;i++)s.tick(1/120);s.draw();s.updateUI();window.scrollTo(0,0);});
        await page.screenshot({ path:'output/minitool-preserved-rose.png', fullPage:true });
        await page.check('[name=shape][value=cake]');
        await page.evaluate(() => {for(let i=0;i<370;i++)s.tick(1/120);s.draw();s.updateUI();window.scrollTo(0,0);});
        await page.screenshot({ path:'output/minitool-preserved-cake-dark.png', fullPage:true });
        await page.check('[name=palette][value=light]');
        await page.waitForFunction(() => s.background.current.name==='IMG_0003.jpg');
        await page.evaluate(() => window.scrollTo(0,0));
        await page.screenshot({ path:'output/minitool-preserved-cake-light.png', fullPage:true });
      }
      await page.close();
    }
    assert.deepEqual(histories[1], histories[0], 'rose intro, formed rendering, real drag, full physics and final rendering match original exactly');
    const webManifest = JSON.parse(fs.readFileSync('output/web-before-minitool-isolation.json'));
    for (const [file, expected] of Object.entries(webManifest)) assert.equal(hash(fs.readFileSync(file)), expected, file+' web file untouched');
    const report = { baseline:original, originalUI:true, originalCSS:true, originalSolver:true, nativeAlbumFlowRetained:true, isolatedBuild:true, roseFramesCompared:histories[0].length, roseExactMatch:true, webUntouched:true, packed:false, realDevice:false };
    fs.writeFileSync('output/minitool-baseline-results.json', JSON.stringify(report,null,2)); console.log('MINITOOL BASELINE PASS', report);
  } finally { await browser.close(); }
})().catch(error => {console.error(error);process.exitCode=1;});
