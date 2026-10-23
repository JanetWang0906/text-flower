const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { chromium } = require('playwright');
const { SHAPES } = require('../shared/shapes.js');
const codec = require('../gift-codec.js');
const base = process.env.ROSE_URL || 'http://127.0.0.1:8766/';
const out = 'output/firework-head-tail-20261022';
fs.mkdirSync(out, {recursive:true});
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
for (const name of ['shapes.js','firework-motion.js','comet-trails.js','comet-fireworks.js'])
  assert.equal(fs.readFileSync('shared/'+name,'utf8'),fs.readFileSync('minitool/shared/'+name,'utf8'));
for (const name of ['comet-trails.js','comet-fireworks.js'])
  assert.equal(fs.readFileSync('shared/'+name,'utf8'),fs.readFileSync('/Users/janetwang/.codex/skills/comet-fireworks/assets/'+name,'utf8'),'skill source remains unchanged');
assert.equal(SHAPES.firework.procedural,true);
assert.equal(SHAPES.firework.svg,fs.readFileSync('烟花/firework [转换]2.svg','utf8').replace(/<\?xml[^]*?\?>\s*/, '').trim());
assert.equal(SHAPES.firework.diameter,520);

(async()=>{
  const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  const report={targets:[],packed:false,realDevice:false,skill:'comet-fireworks',variant:'Moving bright heads and tapered text tails; independent airborne flight; preserve release style until paragraph assembly; ink begins at floor/pile contact'};
  try{
    for(const mini of[false,true]){
      const label=mini?'minitool':'web',page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],external=[],svgRequests=[];
      page.on('pageerror',e=>errors.push(e.message));
      page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(base))external.push(r.url());if(/firework\.svg/.test(r.url()))svgRequests.push(r.url())});
      const time=new Date('2026-10-21T03:00:00Z');await page.clock.install({time});await page.clock.pauseAt(time);
      if(mini)await page.addInitScript(()=>{window.fetch=()=>{throw new Error('offline source must not fetch')};Intl.Segmenter=undefined;window.ResizeObserver=undefined});
      await page.goto(new URL(mini?'minitool/index.html':'',base).href);
      await page.evaluate(async mini=>{window.s=mini?window.studio:(await import(document.querySelector('script[type=module]').src)).studio;await s.ready;await s.gifts.ready;document.getElementById('gift-entry-dialog').close()},mini);
      await page.context().setOffline(true);
      await page.check('[name=mode][value=manual]');await page.check('[name=shape][value=firework]');
      const initial=await page.evaluate(()=>({shape:s.shape,status:s.status,phase:s.motion.phase,hidden:s.motion.originals.every(g=>g.alpha===0),count:s.sources.length,colors:s.colors,sourceIds:s.motion.originals.map(g=>g.source.id)}));
      assert.equal(initial.shape,'firework');assert.equal(initial.status,'idle');assert.equal(initial.phase,'burst');assert.equal(initial.hidden,true);assert.equal(initial.count,293);
      assert.equal(await page.locator('#intro-speed').isVisible(),false);
      assert.doesNotMatch(await page.locator('#canvas').getAttribute('aria-label'),/绳|SVG/);
      await page.evaluate(()=>{s.motion.seed=s.motion.randomState=123;s.draw();s.updateUI()});
      const click=async(x,y)=>{await page.locator('#canvas').scrollIntoViewIfNeeded();const point=await page.evaluate(({x,y})=>{const r=s.canvas.getBoundingClientRect();return{x:r.x+x*r.width/900,y:r.y+y*r.height/1200}},{x,y});await page.mouse.click(point.x,point.y)};
      await click(590,440);
      assert.equal(await page.evaluate(()=>s.motion.bursts.length),1,'one click emits exactly one burst');
      const first=await page.evaluate(()=>s.motion.bursts[0]);assert.ok(Math.abs(first.x-590)<3&&Math.abs(first.y-440)<3,'exact pointer origin');
      await page.evaluate(()=>{for(let i=0;i<80;i++)s.tick(1/120)});await click(400,650);
      await page.evaluate(()=>{for(let i=0;i<95;i++)s.tick(1/120);s.draw();s.updateUI()});
      const manual=await page.evaluate(()=>{
        const gs=s.motion.originals.filter(g=>g.alpha>.01);
        const bounds={left:Math.min(...gs.map(g=>g.x-g.w*g.scale/2)),right:Math.max(...gs.map(g=>g.x+g.w*g.scale/2)),
          top:Math.min(...gs.map(g=>g.y-s.size*g.scale/2)),bottom:Math.max(...gs.map(g=>g.y+s.size*g.scale/2))};
        return{origins:s.motion.bursts.map(b=>[b.x,b.y]),count:s.motion.bursts.length,queued:s.motion.pendingBursts,
          rays:s.motion.geometry.rays.length,visible:gs.length,bounds,width:bounds.right-bounds.left,height:bounds.bottom-bounds.top,
          source:s.motion.geometry.source,free:s.motion.front,
          gradient:s.motion.beams.every(b=>{const gs=s.motion.originals.slice(b.from,b.end+1).filter(g=>g.state==='burst'&&g.alpha>.01);return gs.every((g,i)=>!i||(g.scale>gs[i-1].scale&&g.alpha>gs[i-1].alpha))})};
      });
      assert.equal(manual.count,1);assert.equal(manual.queued.length,1);assert.equal(manual.rays,22);assert.equal(manual.visible,147);
      assert.equal(manual.gradient,true);assert.ok(manual.free>0,'outer letters continue directly into flight without a formed-pose hold');
      assert.equal(await page.evaluate(()=>s.motion.geometry.diameter),520,'the reference SVG size stays unchanged');
      [[590,440],[400,650]].forEach((p,i)=>p.forEach((v,j)=>assert.ok(Math.abs(manual.origins.concat(manual.queued.map(p=>[p.x,p.y]))[i][j]-v)<3)));
      assert.match(await page.locator('#stage-label').innerText(),/等这一朵回落/);
      await page.locator('#canvas').screenshot({path:`${out}/${label}-formed.png`});await page.screenshot({path:`${out}/${label}-manual.png`,fullPage:true});
      const manualHash=hash(await page.evaluate(()=>JSON.stringify(s.motion.save())));
      if(report.targets.length)assert.equal(manualHash,report.targets[0].manualHash,'both platforms use identical SVG geometry and motion');
      const geometryHash=hash(await page.evaluate(()=>JSON.stringify(s.motion.geometry)));
      if(report.targets.length)assert.equal(geometryHash,report.targets[0].geometryHash);
      // Measure physical text advances instead of checking implementation
      // offsets: the visible gap should match normal paragraph tracking.
      const flow=await page.evaluate(()=>{
        const m=s.motion,gaps=[];let pauses=0,movingPairs=0,maxPathError=0;
        const closest=(p,ray,b)=>{let best=Infinity;for(let i=1;i<ray.points.length;i++){const a=ray.points[i-1],q=ray.points[i],dx=q.x-a.x,dy=q.y-a.y;
          const t=Math.max(0,Math.min(1,((p.x-b.originX-a.x)*dx+(p.y-b.originY-a.y)*dy)/(dx*dx+dy*dy||1)));
          best=Math.min(best,Math.hypot(p.x-b.originX-a.x-t*dx,p.y-b.originY-a.y-t*dy))}return best};
        for(let frame=0;frame<18;frame++){
          const before=m.nodes.map(p=>p.pathS);s.tick(1/60);
          for(const b of m.beams){for(let i=b.from;i<=b.end;i++){
            const p=m.nodes[i],g=m.originals[i];if(p.released||g.alpha<.25)continue;
            if(before[i]>=0){movingPairs++;if(p.pathS-before[i]<1e-6)pauses++;}
            maxPathError=Math.max(maxPathError,closest(p,m.geometry.rays[b.rayIndex],b));
            if(i===b.end)continue;const q=m.nodes[i+1],h=m.originals[i+1];
            if(q.released||h.alpha<.25)continue;
            const visibleHalf=(g.w*g.scale+h.w*h.scale)/2;
            gaps.push((q.pathS-p.pathS-visibleHalf)/(s.size*(g.scale+h.scale)/2));
          }}
        }
        return{gapMin:Math.min(...gaps),gapMax:Math.max(...gaps),samples:gaps.length,movingPairs,pauses,maxPathError};
      });
      assert.ok(flow.samples>100);assert.ok(flow.gapMin>.07&&flow.gapMax<.11,'paragraph-sized tracking without stretched spokes');
      assert.ok(flow.movingPairs>100);assert.equal(flow.pauses,0,'path text never waits in a fixed formed pose');assert.ok(flow.maxPathError<1e-5);
      const groundRules=await page.evaluate(()=>{
        const m=s.motion,saved=m.save();m.nodes.forEach(p=>{p.released=false;p.s=1});
        const a=m.nodes[0],b=m.nodes[1];
        for(const p of[a,b]){p.released=true;p.s=0;p.age=.2;p.releaseScale=p.releaseAlpha=1;delete p.landedAt;p.vx=p.vy=0;}
        a.x=a.px=30+a.radius;a.y=a.py=500;b.x=b.px=a.x+8;b.y=b.py=510;
        m.contacts();m.markGroundContacts();m.updateGlyphs();
        const airStaysColored=[a,b].every(p=>p.landedAt===undefined)&&m.originals.slice(0,2).every(g=>g.blend===1);
        a.x=a.px=450;a.y=a.py=1180-a.radius;b.x=b.px=450;b.y=b.py=a.y-a.radius-b.radius;
        m.contacts();m.markGroundContacts();m.updateGlyphs();
        const groundAndPile=[a,b].every(p=>p.landedAt!==undefined),start=m.originals[0].blend;
        m.physicsTime+=.275;m.updateGlyphs();const halfway=m.originals[0].blend;
        m.physicsTime+=.275;m.updateGlyphs();const end=m.originals[0].blend;
        m.restore(saved);return{airStaysColored,groundAndPile,start,halfway,end};
      });
      assert.equal(groundRules.airStaysColored,true);assert.equal(groundRules.groundAndPile,true);
      assert.equal(groundRules.start,1);assert.ok(groundRules.halfway>.4&&groundRules.halfway<.6);assert.equal(groundRules.end,0);
      const flight=await page.evaluate(()=>{
        // An upper ray has clear space for a collision-free free-flight sample.
        const m=s.motion,b=m.beams[17],index=b.end;
        for(let i=0;i<300&&!m.nodes[index].released;i++)s.tick(1/120);
        const p=m.nodes[index],old={x:p.x,y:p.y,vx:p.vx,vy:p.vy};
        s.tick(1/60);const d=Math.exp(-.27/60);
        return{released:p.released,error:Math.max(Math.abs(p.vx-old.vx*d),Math.abs(p.vy-(old.vy*d+p.gravity/60)),Math.abs(p.x-old.x-p.vx/60),Math.abs(p.y-old.y-p.vy/60))};
      });
      assert.equal(flight.released,true);assert.ok(flight.error<1e-6,'glyph follows independent ballistic motion after the SVG exit');
      await page.click('#play');const frozen=await page.evaluate(()=>JSON.stringify(s.motion.save()));
      await page.clock.runFor(700);await page.check('[name=palette][value=light]');
      assert.equal(await page.evaluate(()=>JSON.stringify(s.motion.save())),frozen,'pause and palette keep random schedule, history and glyphs frozen');
      const png=await page.evaluate(()=>s.exportImage()),bytes=Buffer.from(png.split(',')[1],'base64');
      assert.equal(bytes.readUInt32BE(16),1800);assert.equal(bytes.readUInt32BE(20),2400);
      assert.equal(await page.evaluate(()=>JSON.stringify(s.motion.save())),frozen,'HD export cannot advance the burst');fs.writeFileSync(`${out}/${label}-hd.png`,bytes);
      await page.check('[name=palette][value=dark]');await page.click('#play');
      // A second contact must not emit another burst.
      const beforeSecond=await page.evaluate(()=>s.motion.bursts.length);
      await page.locator('#canvas').dispatchEvent('pointerdown',{pointerId:9,isPrimary:false,button:0,clientX:10,clientY:10});
      assert.equal(await page.evaluate(()=>s.motion.bursts.length),beforeSecond);
      const finish=await page.evaluate(()=>{
        let landed=false,maxOpening=0,airSamples=0,badAirColor=0,groundColorSamples=0;for(let i=0;i<120*45&&s.status!=='complete';i++){const before=s.motion.phase;s.tick(1/120);for(const g of s.motion.originals){const p=s.motion.nodes[g.node];if(!p.released)continue;if(p.landedAt===undefined){airSamples++;if(g.blend!==1)badAirColor++;}else if(g.blend<1)groundColorSamples++;}if(before==='settle'&&s.motion.phase==='order')landed=s.motion.supported();maxOpening=Math.max(maxOpening,new Set(s.motion.nodes.filter(p=>p.beam>=0&&!p.released).map(p=>s.motion.beams[p.beam].burst)).size)}
        s.draw();s.updateUI();return {status:s.status,time:s.motion.time,landed,maxOpening,airSamples,badAirColor,groundColorSamples,origins:s.motion.bursts.map(b=>[b.x,b.y]),used:s.motion.cursor,total:s.sources.length,finite:s.motion.nodes.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)),
          ids:s.motion.originals.map(g=>g.source.id),exact:s.motion.originals.every(g=>Math.abs(g.x-g.source.finalX)<1e-6&&Math.abs(g.y-g.source.finalY)<1e-6&&g.alpha===1)};
      });
      assert.ok(finish.airSamples>1000);assert.equal(finish.badAirColor,0);assert.ok(finish.groundColorSamples>1000);assert.equal(finish.status,'complete');assert.equal(finish.maxOpening,1);assert.equal(finish.origins.length,2);assert.equal(finish.landed,true);assert.equal(finish.exact,true);assert.equal(finish.finite,true);assert.equal(finish.used,finish.total);assert.deepEqual(finish.ids,initial.sourceIds);delete finish.ids;delete initial.sourceIds;
      await page.locator('#canvas').screenshot({path:`${out}/${label}-letter.png`});
      await page.locator('#paragraph-size').evaluate(input=>{input.value=32;input.dispatchEvent(new Event('input',{bubbles:true}))});
      assert.equal(await page.evaluate(()=>s.status==='complete'&&s.motion.originals.every(g=>g.alpha===1&&g.state==='landed')),true,'reflowing a completed letter keeps all text visible');
      await page.evaluate(()=>{s.mode='manual';s.reset();s.motion.burst({x:450,y:450});s.status='playing';for(let i=0;i<600;i++)s.tick(1/120);s.updateUI()});
      assert.equal(await page.evaluate(()=>s.motion.bursts.length),1,'manual mode cannot emit unrequested bursts');
      assert.match(await page.locator('#stage-label').innerText(),/还有心愿没放完，再点一个位置继续/);
      // Automatic mode starts immediately and emits spatially separate bursts.
      await page.check('[name=mode][value=manual]');await page.check('[name=mode][value=auto]');await page.evaluate(()=>{s.motion.seed=s.motion.randomState=4927;window.autoMaxOpening=0;for(let i=0;i<1200;i++){s.tick(1/120);autoMaxOpening=Math.max(autoMaxOpening,new Set(s.motion.nodes.filter(p=>p.beam>=0&&!p.released).map(p=>s.motion.beams[p.beam].burst)).size)}s.draw();s.updateUI()});
      const auto=await page.evaluate(()=>({status:s.status,origins:s.motion.bursts.map(b=>[b.x,b.y]),count:s.motion.bursts.length,maxOpening:autoMaxOpening,used:s.motion.cursor,total:s.sources.length}));
      assert.equal(auto.status,'playing');assert.equal(auto.maxOpening,1,'automatic mode has exactly one opening at any time');assert.ok(auto.count>=2);assert.ok(auto.count<=2,'automatic blooms wait for the previous opening to finish');assert.ok(new Set(auto.origins.map(p=>p.join(','))).size===auto.count);
      assert.ok(auto.origins.every(p=>p[0]>=260&&p[0]<=640&&p[1]>=285&&p[1]<=700),'automatic centers leave room for the full new SVG');
      await page.locator('#canvas').screenshot({path:`${out}/${label}-auto.png`});
      const saved=await page.evaluate(()=>s.motion.save());
      const afterA=await page.evaluate(()=>{for(let i=0;i<60;i++)s.motion.step(1/60,true);return JSON.stringify(s.motion.save())});
      const afterB=await page.evaluate(saved=>{s.motion.restore(saved);for(let i=0;i<120;i++)s.motion.step(1/120,true);return JSON.stringify(s.motion.save())},saved);
      // Physics state is independent of whether the host supplies 60 or 120 Hz.
      const a=JSON.parse(afterA),b=JSON.parse(afterB);assert.deepEqual(a.nodes,b.nodes);assert.deepEqual(a.firework.beams,b.firework.beams);assert.deepEqual(a.firework.bursts,b.firework.bursts);
      const settings=await page.evaluate(()=>s.giftSettings());assert.equal(settings.s,3);assert.deepEqual(codec.decode(codec.encode(settings)),settings);
      await page.check('[name=shape][value=rose]');await page.evaluate(async settings=>s.restoreGift(settings),settings);
      assert.equal(await page.evaluate(()=>s.motion.procedural),true);assert.equal(await page.evaluate(()=>s.status),'playing');
      // Existing shape controls and formation speed are restored on return.
      await page.check('[name=shape][value=rose]');assert.equal(await page.locator('#intro-speed').isVisible(),true);
      assert.equal(await page.locator('[name=mode][value=manual] + span').innerText(),'亲手牵引');
      await page.check('[name=shape][value=firework]');
      const sizes=[];
      for(const size of[12,32]){
        const result=await page.evaluate(size=>{s.apply(s.text,size);for(let i=0;i<120*40&&s.status!=='complete';i++)s.tick(1/120);return{size,status:s.status,time:s.motion.time,finite:s.motion.nodes.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))}},size);
        assert.equal(result.status,'complete');assert.equal(result.finite,true);sizes.push(result);
      }
      // Short text uses a distributed subset of the supplied rays without duplicating words.
      assert.equal(await page.evaluate(()=>s.apply('愿你开心🌷',20)),true);
      await page.evaluate(()=>{for(let i=0;i<120*40&&s.status!=='complete';i++)s.tick(1/120)});
      assert.equal(await page.evaluate(()=>s.status),'complete');
      const layouts=[];for(const width of[320,390,900,1280]){await page.setViewportSize({width,height:844});const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);layouts.push({width,overflow})}
      assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.deepEqual(svgRequests,[]);
      report.targets.push({label,initial,manual,manualHash,geometryHash,flow,groundRules,flight,finish,auto,sizes,layouts,errors,external,svgRequests,export:[1800,2400]});
      console.log(label,{manualBursts:finish.origins.length,maxOpening:finish.maxOpening,autoBursts:auto.count,width:manual.width,height:manual.height,finish,sizes});await page.close();
    }
    const now={};const walk=dir=>{for(const p of fs.readdirSync(dir,{withFileTypes:true})){if(['node_modules','.git'].includes(p.name))continue;const f=dir==='.'?p.name:dir+'/'+p.name;if(p.isDirectory())walk(f);else if(f.endsWith('.zip'))now[f]=hash(fs.readFileSync(f))}};walk('.');
    assert.deepEqual(now,JSON.parse(fs.readFileSync(out+'/zip-before.json')));report.historicalZIPsUnchanged=true;
    fs.writeFileSync(out+'/results.json',JSON.stringify(report,null,2));
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
