const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium, webkit } = require('playwright');
const base = process.env.ROSE_URL || 'http://127.0.0.1:8777/';
const out = path.resolve('output/web-language-20261023'); fs.mkdirSync(out, { recursive: true });
(async () => {
  const report = { engines: [], physicalDevice: false };
  for (const engine of [
    { name: 'chromium', api: chromium, options: { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true } },
    { name: 'webkit', api: webkit, options: { headless: true } }
  ]) {
    const b = await engine.api.launch(engine.options);
    const result = { name: engine.name, errors: [], states: [], layouts: [] };
    try {
      const p = await b.newPage({ viewport: { width: 584, height: 848 }, acceptDownloads: true });
      p.on('pageerror', e => result.errors.push(e.message));
      await p.goto(base);
      await p.evaluate(async () => { window.s = (await import(document.querySelector('script[type=module][src]').src)).studio; await s.ready; await s.gifts.ready; });
      assert.equal(await p.locator('html').getAttribute('lang'), 'en');
      assert.equal(await p.evaluate(() => s.status === 'error'), false);
      assert.equal(await p.locator('#gift-entry-title').innerText(), 'Make a gift, or open one?');
      // First-visit language choice remains usable inside the modal.
      await p.click('.entry-language .language-toggle'); await p.click('.entry-language [data-language=zh]');
      assert.equal(await p.locator('html').getAttribute('lang'), 'zh-CN');
      assert.equal(await p.evaluate(() => s.text === WebI18n.defaults.zh.rose), true);
      await p.click('.entry-language .language-toggle'); await p.click('.entry-language [data-language=en]');
      await p.click('#gift-create'); await p.waitForFunction(() => !s.gifts.busy);
      const chineseLeaks = () => p.evaluate(() => {
        const found = [], walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let node;
        while ((node = walker.nextNode())) {
          const parent = node.parentElement;
          if (parent.closest('script,style,textarea,svg,[data-language-control]') || !parent.getClientRects().length) continue;
          if (/[\u3400-\u9fff]/.test(node.nodeValue)) found.push(node.nodeValue);
        }
        return found;
      });
      for (const lang of ['en', 'zh']) {
        await p.evaluate(lang => WebI18n.setLanguage(lang), lang);
        for (const shape of ['rose', 'cake', 'gift', 'firework']) {
          const state = await p.evaluate(shape => {
            s.selectShape(shape);
            const initial = { shape: s.shape, language: WebI18n.language, correctDefault: s.text === WebI18n.defaults[WebI18n.language][shape], text: s.text, size: s.size,
              characters: s.sources.map(g => g.ch).join(''), error: document.getElementById('input-error').textContent };
            s.motion.finish(); s.status = 'complete'; s.draw(); s.updateUI();
            return initial;
          }, shape);
          assert.equal(state.shape, shape); assert.equal(state.correctDefault, true); assert.equal(state.error, '');
          assert.equal(state.characters, state.text.replace(/[\r\n]/g, ''));
          if (lang === 'en') { assert.equal(/[\u3400-\u9fff]/.test(state.text), false); assert.deepEqual(await chineseLeaks(), []); }
          result.states.push({ ...state, text: undefined, characters: undefined });
          if (lang === 'en' && engine.name === 'chromium') {
            assert.equal(await p.evaluate(() => { const scene = s.createVideoScene(); let seconds = 0; while (seconds < 120) { seconds += 1/24; if (scene.advance(1/24)) return true; } return false; }), true);
          }
        }
        await p.evaluate(() => s.selectShape('rose'));
        for (const width of [280, 320, 360, 390, 402, 584, 900, 1280]) {
          await p.setViewportSize({ width, height: 848 });
          const state = await p.evaluate(() => ({ width: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth,
            controls: [...document.querySelectorAll('.masthead button,.shape-setting .segmented span,.save-actions button,.actions button')].filter(e => e.getBoundingClientRect().height).map(e => {
              const r = e.getBoundingClientRect(), range = document.createRange(); range.selectNodeContents(e);
              return { text: e.textContent, inside: r.left >= 0 && r.right <= innerWidth, glyphs: [...range.getClientRects()].every(t => t.left >= r.left - 1 && t.right <= r.right + 1), fit: e.scrollWidth <= e.clientWidth, height: r.height };
            }) }));
          assert.equal(state.overflow, false, JSON.stringify({ lang, ...state })); assert.ok(state.controls.every(c => c.inside && c.glyphs && c.fit), JSON.stringify({lang,...state}));
          result.layouts.push({ lang, width, passed: true });
        }
        await p.setViewportSize({ width: 584, height: 848 });
        await p.screenshot({ path: path.join(out, engine.name + '-' + lang + '.png') });
      }
      const large = await p.addStyleTag({content: '.language-toggle,.gift-entry-link,.shape-label,.segmented span,.save-actions button,.actions button{font-size:22px!important}'});
      for (const lang of ['en','zh']) for (const width of [280,320,584]) {
        await p.evaluate(lang => WebI18n.setLanguage(lang),lang); await p.setViewportSize({width,height:848});
        assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true,'large text '+lang+' '+width);
        const fit=await p.locator('.shape-setting .segmented span,.save-actions button,.actions button').evaluateAll(elements=>elements.filter(e=>e.getBoundingClientRect().height).every(e=>e.scrollWidth<=e.clientWidth));
        assert.equal(fit,true,'large text labels '+lang+' '+width); result.layouts.push({lang,width,largeText:22,passed:true});
      }
      await large.evaluate(el=>el.remove()); await p.setViewportSize({width:584,height:848});
      // Preserve applied custom content and an independent pending draft.
      await p.evaluate(() => { WebI18n.setLanguage('en'); s.selectShape('rose'); s.apply(s.text.replace('rose', 'flower'), s.size, s.paragraphSize, false, true, false); document.getElementById('message').value = 'Keep my draft / 保留草稿'; window.customText = s.text; window.motion = JSON.stringify(s.motion.save()); });
      await p.evaluate(() => WebI18n.setLanguage('zh'));
      assert.equal(await p.evaluate(() => s.text === customText && document.getElementById('message').value === 'Keep my draft / 保留草稿' && JSON.stringify(s.motion.save()) === motion), true);
      // Imported gift text is preserved even when it exactly matches a preset.
      await p.evaluate(async () => { const gift = s.giftSettings(); gift.t = WebI18n.defaults.en.rose; await s.restoreGift(gift); document.getElementById('message').value = gift.t; WebI18n.setLanguage('en'); window.importedText = s.text; WebI18n.setLanguage('zh'); });
      assert.equal(await p.evaluate(() => s.text === importedText && s.importedGift), true);
      await p.reload(); await p.evaluate(async () => { window.s=(await import(document.querySelector('script[type=module][src]').src)).studio;await s.ready; });
      assert.equal(await p.locator('html').getAttribute('lang'), 'zh-CN');
      await p.click('#gift-create'); await p.waitForFunction(() => !s.gifts.busy);
      await p.evaluate(() => WebI18n.setLanguage('en'));
      assert.equal(await p.evaluate(() => s.text === WebI18n.defaults.en.rose), true);
      // English errors, image filenames, QR captions and video notices.
      await p.click('#edit-toggle'); await p.fill('#message', ''); await p.locator('#text-form').evaluate(f => f.requestSubmit());
      assert.match(await p.locator('#notice-text').innerText(), /Write a few words/); await p.click('#notice-ok');
      await p.evaluate(() => { document.getElementById('message').value=s.text;document.getElementById('text-form').hidden=true; });
      await p.click('#save-image'); assert.equal(await p.locator('#export-title').innerText(), 'Save image');
      if (engine.name === 'chromium') { const d=p.waitForEvent('download'); await p.click('#export-download'); assert.equal((await d).suggestedFilename(),'Text-in-Bloom-Rose.png'); }
      await p.click('#export-close');
      await p.click('#save-gift-qr'); await p.locator('#gift-qr-dialog').waitFor({state:'visible'});
      assert.equal(await p.locator('#gift-qr-title').innerText(), 'Save gift QR');
      const gift = await p.evaluate(async () => { const img=await new Promise(resolve=>{const i=new Image();i.onload=()=>resolve(i);i.src=document.getElementById('gift-qr-image').src;});const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const x=c.getContext('2d');x.drawImage(img,0,0);const pixels=x.getImageData(0,0,c.width,c.height);return GiftCodec.decode(jsQR(pixels.data,c.width,c.height).data); });
      assert.equal(gift.t, await p.evaluate(() => s.text));
      if(engine.name==='chromium'){const d=p.waitForEvent('download');await p.click('#gift-qr-save');assert.equal((await d).suggestedFilename(),'Text-in-Bloom-Gift-QR.png');}
      await p.click('#gift-qr-close');
      if(engine.name==='chromium'){
        const d=p.waitForEvent('download',{timeout:125000});await p.click('#export-video');const video=await d;
        assert.equal(video.suggestedFilename(),'Text-in-Bloom-Rose.mp4');const file=path.join(out,'english-rose.mp4');await video.saveAs(file);
        const bytes=fs.readFileSync(file);assert.equal(bytes.toString('ascii',4,8),'ftyp');
        assert.match(await p.locator('#video-status').innerText(),/MP4 ready/);assert.deepEqual(await chineseLeaks(),[]);
        result.englishMP4Download={bytes:bytes.length,filename:video.suggestedFilename(),realMP4:true};await p.click('#video-close');
      }
      await p.evaluate(() => { window.MediaRecorder=undefined; }); await p.click('#export-video');
      assert.match(await p.locator('#video-status').innerText(), /cannot generate MP4/); assert.deepEqual(await chineseLeaks(), []); await p.click('#video-close');
      result.defaultsBothLanguages = true; result.customDraftAndImportedTextPreserved = true; result.persistedChoice = true; result.localizedExportAndErrors = true;
      assert.deepEqual(result.errors, []); report.engines.push(result);
      console.log(engine.name,'LANGUAGE PASS',result.states.length,'shape/language states,',result.layouts.length,'layouts');
    } finally { await b.close(); }
  }
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));
})().catch(error => {console.error(error);process.exitCode=1;});
