const {chromium}=require('playwright'), assert=require('node:assert/strict'), fs=require('node:fs');
(async()=>{const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});const page=await browser.newPage({viewport:{width:408,height:858}});try{
await page.goto('http://127.0.0.1:8765/');await page.evaluate(async()=>{window.studio=(await import('/app.js?v=rope-20260925-3')).studio;await studio.ready;});
const report=await page.evaluate(()=>{
const s=studio,results=[];
for(const fixture of [{name:'150 multiline',text:('你的眼睛比海辽阔。\n'.repeat(15)).slice(0,150),rose:12,letter:48},{name:'200 large',text:'春'.repeat(200),rose:32,letter:48},{name:'200 emoji',text:'🌹'.repeat(200),rose:32,letter:48},{name:'many explicit lines',text:'春\n'.repeat(99)+'春',rose:20,letter:48},{name:'small paragraph',text:'花开时节，见字如面。'.repeat(8),rose:32,letter:12}]){
if(!s.apply(fixture.text,fixture.rose,fixture.letter))return {error:fixture.name+': '+document.querySelector('#input-error').textContent};
const originals=s.chains.flatMap(c=>c.glyphs.filter(g=>g.source));const a=s.chains[1].glyphs.filter(g=>g.source).at(-1),b=s.chains[0].glyphs.find(g=>g.source);let samples=0,maxGap=0;
for(let f=0;f<=Math.ceil(s.duration*60);f++){s.renderAt(f/60);for(const g of originals){const r=Math.max(g.w,s.size)*g.scale*.72;if(!Number.isFinite(g.x+g.y)||g.x-r<0||g.x+r>900||g.y-r<0||g.y+r>1200)return{error:fixture.name+' out of canvas '+g.source.id};}
if(a&&b&&f/60>a.exit&&f/60>b.exit&&f/60<a.arrival-.7){const gap=Math.hypot(a.x-b.x,a.y-b.y),expected=s.motion.speed*(b.exit-a.exit);maxGap=Math.max(maxGap,gap/expected);samples++;if(gap>expected*1.65+2)return{error:fixture.name+' flower leaf gap '+gap+' / '+expected};}}
if(!originals.every(g=>Math.abs(g.x-g.source.finalX)<.01&&Math.abs(g.y-g.source.finalY)<.01&&Math.abs(s.size*g.scale-s.paragraphSize)<.01))return{error:fixture.name+' final positions'};
results.push({name:fixture.name,rose:s.size,paragraph:s.paragraphSize,originals:originals.length,joinSamples:samples,maxGapRatio:maxGap});}
return{results};});console.log(JSON.stringify(report));assert.ok(!report.error,report.error);
await page.click('#edit-toggle');await page.fill('#message','春'.repeat(150));await page.locator('#font-size').evaluate(e=>{e.value='12';e.dispatchEvent(new Event('input',{bubbles:true}));});assert.equal(await page.evaluate(()=>studio.text),'春'.repeat(150));
await page.locator('#paragraph-size').evaluate(e=>{e.value='48';e.dispatchEvent(new Event('input',{bubbles:true}));});const large=await page.evaluate(()=>new Set(studio.sources.map(g=>g.row)).size);
await page.locator('#paragraph-size').evaluate(e=>{e.value='18';e.dispatchEvent(new Event('input',{bubbles:true}));});assert.ok(large>await page.evaluate(()=>new Set(studio.sources.map(g=>g.row)).size));assert.equal(await page.inputValue('#font-size'),'12');
assert.equal(await page.locator('.intro,#clock').count(),0);assert.ok(!(await page.textContent('#mode-hint')).includes('回车'));
await page.evaluate(()=>{studio.elapsed=studio.duration;studio.status='complete';studio.renderAt(studio.duration);studio.draw();studio.updateUI();});await page.locator('#paragraph-size').evaluate(e=>{e.value='32';e.dispatchEvent(new Event('input',{bubbles:true}));});assert.equal(await page.evaluate(()=>studio.status),'complete');
await page.click('#edit-toggle');await page.screenshot({path:'output/independent-paragraph-mobile.png',fullPage:true});
fs.writeFileSync('output/typesetting-results.json',JSON.stringify({passed:true,...report,checks:['current draft used by sliders','independent sizes','rewrap on paragraph size change','complete preview preserved','intro and clock removed','mobile prompt'],realDeviceTested:false},null,2));
console.log('Typesetting and shared stem handoff passed');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
