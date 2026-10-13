const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});try{
 const p=await browser.newPage({viewport:{width:408,height:858}});await p.clock.install();await p.goto('http://127.0.0.1:8765/?v=birthday-20261006');await p.evaluate(async()=>{window.s=(await import('/app.js?v=2.0-color-20261006')).studio;await s.ready;for(let i=0;i<370;i++)s.tick(1/120)});
 const initial=await p.evaluate(()=>({tip:s.motion.originals[0].y,pathStart:s.paths[1].points[0].y,overflow:document.documentElement.scrollWidth>innerWidth}));assert.ok(Math.abs(initial.tip-initial.pathStart)<25);assert.equal(initial.overflow,false);await p.screenshot({path:'output/pile-initial.png',fullPage:true});
 const results=[];
 for(const size of [12,20,32]){
  const r=await p.evaluate(size=>{const range=s.range(size);s.apply('花'.repeat(Math.floor((range.min+range.max)/2)),size);s.start();for(let i=0;i<120*70&&s.motion.phase!=='order';i++)s.tick(1/120);
   const ns=s.motion.nodes;let separation=Infinity;for(let i=0;i<ns.length;i++)for(let j=i+1;j<ns.length;j++){const a=ns[i],b=ns[j];if(a.chain===b.chain&&j-i===1)continue;separation=Math.min(separation,Math.hypot(a.x-b.x,a.y-b.y)/(a.radius+b.radius));}
   s.draw();return{size,phase:s.motion.phase,time:s.elapsed,support:s.motion.supported(),height:Math.max(...ns.map(n=>n.y))-Math.min(...ns.map(n=>n.y)),separation,error:s.motion.maxError};},size);
  results.push(r);assert.equal(r.phase,'order');assert.ok(r.support);assert.ok(r.height>size*2);assert.ok(r.separation>.85);assert.ok(r.error<.1);
 }
 await p.evaluate(()=>{s.reset();s.apply(document.querySelector('#message').value,20);s.start();for(let i=0;i<120*70&&s.motion.phase!=='order';i++)s.tick(1/120);s.draw()});await p.locator('#canvas').screenshot({path:'output/pile-landed.png'});
 fs.writeFileSync('output/pile-results.json',JSON.stringify({initial,results},null,2));console.log({initial,results});
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
