const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { chromium } = require('playwright');
const pngSize = data => { const buf=Buffer.from(data.split(',')[1],'base64'); return [buf.readUInt32BE(16),buf.readUInt32BE(20)]; };

(async () => {
  const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  const results=[];
  try {
    for(const native of [false,true]) {
      const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      const time=new Date('2026-10-07T00:00:00Z');await page.clock.install({time});await page.clock.pauseAt(time);
      await page.addInitScript(native=>{
        window.fetch=()=>{throw new Error('No network API allowed');};
        if(native){window.calls=[];window.rejectSave=false;window.xhs={miniTool:{
          writeTempFile:async ({data})=>{window.calls.push({kind:'temp',data});return{filePath:'tmp/hd.png'};},
          saveImageToPhotosAlbum:async ({filePath})=>{window.calls.push({kind:'album',filePath});if(window.rejectSave)throw{errMsg:'permission denied'};}
        }};}
      },native);
      await page.route('**/minitool/index.html?*',async route=>{
        const response=await route.fetch();await route.fulfill({response,headers:Object.assign({},response.headers(),{
          'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'none'"
        })});
      });
      await page.goto('http://127.0.0.1:8765/minitool/index.html?v=minitool-hd-guide-20261007');
      await page.evaluate(async()=>{window.s=studio;await s.ready;});
      assert.equal(await page.locator('#save-image').isVisible(),true);
      assert.match(await page.locator('#save-image').innerText(),/保存高清图片/);
      await page.check('[name=shape][value=cake]');
      await page.evaluate(()=>{for(let i=0;i<370;i++)s.tick(1/120);s.draw();s.updateUI();});
      const guide=await page.evaluate(()=>{
        const p=s.guidePosition();s.ctx.save();s.ctx.font='23px "Songti SC", "STSong", "Noto Serif CJK SC", SimSun, serif';const w=s.ctx.measureText('拖动这里').width;s.ctx.restore();
        const overlaps=s.motion.originals.filter(g=>{const hw=(Math.abs(Math.cos(g.angle))*g.w+Math.abs(Math.sin(g.angle))*s.size)/2,hh=(Math.abs(Math.sin(g.angle))*g.w+Math.abs(Math.cos(g.angle))*s.size)/2;return g.ch.trim()&&g.x+hw>=p.x-10&&g.x-hw<=p.x+w+10&&g.y+hh>=p.y-22&&g.y-hh<=p.y+22;}).length;
        return{position:p,overlaps};
      });
      assert.deepEqual(guide,{position:{x:55,y:740},overlaps:0});
      const before=await page.evaluate(()=>JSON.stringify({motion:s.motion.save(),status:s.status,canvas:[s.canvas.width,s.canvas.height],screen:s.canvas.toDataURL()}));
      const noGuide=await page.evaluate(()=>{
        let calls=0;const old=s.drawGuide;s.drawGuide=()=>{calls++;old.call(s);};
        const data=s.exportImage();s.drawGuide=old;return{calls,data};
      });
      assert.equal(noGuide.calls,0,'export excludes guide, grip ring and arrow');assert.deepEqual(pngSize(noGuide.data),[1800,2400]);
      fs.writeFileSync('output/minitool-hd-cake.png',Buffer.from(noGuide.data.split(',')[1],'base64'));
      await page.click('#save-image');
      const after=await page.evaluate(()=>JSON.stringify({motion:s.motion.save(),status:s.status,canvas:[s.canvas.width,s.canvas.height],screen:s.canvas.toDataURL()}));
      const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
      assert.equal(hash(after),hash(before),'export never mutates playback or display canvas');
      if(native){
        assert.deepEqual(await page.evaluate(()=>calls.map(c=>c.kind)),['temp','album']);
        assert.deepEqual(pngSize(await page.evaluate(()=>calls[0].data)),[1800,2400]);
        assert.equal(await page.evaluate(()=>calls[1].filePath),'tmp/hd.png');
        assert.equal(await page.locator('#export-dialog').isVisible(),false);
        await page.clock.runFor(2300);await page.evaluate(()=>{window.rejectSave=true;});
        await page.click('#save-image');assert.match(await page.locator('#save-image').innerText(),/保存失败/);
        await page.clock.runFor(2300);assert.equal(await page.locator('#save-image').isEnabled(),true);
      }else{
        await page.waitForFunction(()=>document.getElementById('export-image').naturalWidth===1800);
        assert.equal(await page.locator('#export-dialog').isVisible(),true);
        assert.deepEqual(await page.locator('#export-image').evaluate(img=>[img.naturalWidth,img.naturalHeight]),[1800,2400]);
        await page.click('#export-close');assert.equal(await page.locator('#export-image').evaluate(img=>img.hasAttribute('src')),false);
      }
      // The export remains HD on both a small canvas and a wide desktop preview.
      for(const width of [320,501,1280]){
        await page.setViewportSize({width,height:848});
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
        const data=await page.evaluate(()=>s.exportImage());assert.deepEqual(pngSize(data),[1800,2400]);
      }
      if(!native){
        await page.setViewportSize({width:501,height:848});await page.evaluate(()=>{window.scrollTo(0,0);s.resize();});
        await page.screenshot({path:'output/minitool-hd-guide-preview.png',fullPage:true});
      }
      assert.deepEqual(errors,[]);results.push({nativeMock:native,guide,exportSize:[1800,2400],unchangedPlayback:true,errors,realDevice:false});await page.close();
    }
    const snapshot=JSON.parse(fs.readFileSync('output/web-before-hd-guide.json'));
    for(const [f,h] of Object.entries(snapshot))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'),h,f+' web untouched');
    fs.writeFileSync('output/minitool-hd-guide-results.json',JSON.stringify(results,null,2));console.log('MINITOOL HD GUIDE PASS',results);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
