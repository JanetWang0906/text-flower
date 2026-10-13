/*! 字里花间 · 小工具构建产物 — 由 tests/build-minitool.cjs 生成,勿手改 */
(function(){
"use strict";
// Independent material chains follow the configured SVG path order. Unreleased
// material slides along its SVG path; gravity acts only beyond the exit.
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const mix=(a,b,t)=>a+(b-a)*t;
const ease=t=>{t=clamp(t);return t*t*(3-2*t);};
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function arcTable(points){let length=0;return {points:points.map((p,i)=>{if(i)length+=dist(p,points[i-1]);return Object.assign({},p,{s:length});}),get length(){return length;}};}
function sample(path,s){s=clamp(s,0,path.length);let a=0,b=path.points.length-1;while(b-a>1){const m=(a+b)>>1;if(path.points[m].s<s)a=m;else b=m;}const p=path.points[a],q=path.points[b],u=(s-p.s)/(q.s-p.s||1);return{x:mix(p.x,q.x,u),y:mix(p.y,q.y,u),angle:Math.atan2(q.y-p.y,q.x-p.x)};}
function connectPaths(paths,order=paths.map((_,i)=>i)){
 const chains=order.map(index=>Object.assign(arcTable(paths[index].points.slice()),{colorIndex:index}));
 return {chains,length:chains.reduce((sum,chain)=>sum+chain.length,0)};
}
function connectRose(paths){return connectPaths(paths,[1,0]);}
class LetterMotion {
 constructor(path,sources,size,letterSize,intro=false){
  this.path=path;this.size=size;this.letterSize=letterSize;this.introDur=3;this.phase=intro?'intro':'rope';this.time=0;this.phaseTime=0;this.front=1;this.maxError=0;this.errorFrames=0;this.steps=0;this.grip=null;this.flowing=false;
  this.nodes=[];this.originals=[];
  if(sources.length<path.chains.length)throw new Error('文字数量不足以分配到每条路径。');
  const total=sources.reduce((sum,g)=>sum+g.w+size*.08,0);
  let width=0,curveLength=0,split=0;
  this.chains=path.chains.map((curve,c)=>{
   const from=split,target=total*(curveLength+=curve.length)/path.length;
   const limit=sources.length-(path.chains.length-c-1);
   do{width+=sources[split].w+size*.08;split++;}while(split<limit&&width<target);
   const group=sources.slice(from,split),start=this.nodes.length;
   const lead=c?dist(path.chains[c-1].points[0],curve.points[0]):0;
   const chain={curve,start,end:start+group.length-1,spacing:7,feed:0,active:c===0,free:0,rest:[],handoffLead:lead};
   const span=group.reduce((sum,g)=>sum+g.w+size*.08,0);let cursor=0;
   for(const source of group){const s=(cursor+source.w/2)/span*curve.length;cursor+=source.w+size*.08;
    const point=sample(curve,s),node=this.nodes.length,radius=Math.max(size,source.w)*.5;
    this.nodes.push(Object.assign({},point,{px:point.x,py:point.y,s,chain:c,radius}));
    if(node>start)chain.rest.push(s-this.nodes[node-1].s);
    this.originals.push({source,ch:source.ch,w:source.w,s,node,chain:c,color:curve.colorIndex,x:0,y:0,angle:0,scale:1,alpha:1,blend:1,state:'path'});
   }
   return chain;
  });
  // Begin each following path early by the distance between its exit and
  // the preceding exit, preserving the original rose handoff for any shape.
  this.handoffLead=this.chains.length>1?this.chains[1].handoffLead:0;
  this.compact=Math.min(1,size/letterSize,340/Math.max(letterSize,...sources.map(g=>Math.abs(g.finalY-600)*2+letterSize)));
  this.updateGlyphs();
 }
 save(){return{nodes:this.nodes.map(n=>Object.assign({},n)),chains:this.chains.map(c=>({feed:c.feed,active:c.active,free:c.free})),front:this.front,phase:this.phase,phaseTime:this.phaseTime,time:this.time,flowing:this.flowing,origins:this.origins?this.origins.map(g=>Object.assign({},g)):undefined};}
 restore(s){this.nodes=s.nodes.map(n=>Object.assign({},n));this.chains.forEach((c,i)=>Object.assign(c,s.chains[i]));for(const k of ['front','phase','phaseTime','time','flowing','origins'])this[k]=s[k];this.grip=null;this.updateGlyphs();}
 drop(){this.grip=null;this.flowing=true;}
 setGrip(index,p){this.grip={index:clamp(index,0,this.nodes.length-1),x:clamp(p.x,30,870),y:clamp(p.y,30,1170)};}
 finish(){this.phase='complete';this.phaseTime=0;this.updateGlyphs();}
 step(dt,automatic=true){
  if(this.phase==='complete')return;
  this.time+=dt;
  // Intro: the text rope threads through the path like a chain being pulled
  // through a tube (reverse of the fall's slide) before the formed rose shows.
  if(this.phase==='intro'){
   this.phaseTime+=dt;
   if(this.phaseTime>=this.introDur){this.phase='rope';this.phaseTime=0;}
   this.updateGlyphs();return;
  }
  if(this.phase==='order'||this.phase==='scale'){
   this.phaseTime+=dt;const duration=this.phase==='order'?1.8:1.6;
   if(this.phaseTime>=duration){this.phase=this.phase==='order'?'scale':'complete';this.phaseTime=0;}this.updateGlyphs();return;
  }
  const ns=this.nodes;
  for(const [ci,c] of this.chains.entries()){
   if(ci>0&&!c.active){const previous=this.chains[ci-1],last=ns[previous.end];c.active=previous.active&&previous.feed>Math.max(0,last.s-c.handoffLead);}
   const moving=c.active&&(this.grip||this.flowing||automatic);
   if(moving){const rate=this.grip?clamp(dist(ns[this.grip.index],this.grip)*4,120,700):280;c.feed=Math.min(c.curve.length+c.spacing,c.feed+rate*dt);}
   c.free=0;
   for(let i=c.start;i<=c.end;i++){
    const p=ns[i];
    if(p.s>=c.feed){const anchor=sample(c.curve,p.s-c.feed);p.x=p.px=anchor.x;p.y=p.py=anchor.y;continue;}
    c.free++;
    // textstring-aligned dynamics: damping .97, gravity 1400 px/s^2 at 120 Hz,
    // no low velocity cap. Terminal fall speed ~390 px/s must exceed the feed
    // rate (280 px/s), otherwise the inextensible rope buckles into folds and
    // the falling strand splits into side-by-side columns. Settle keeps the
    // same damping so the trailing strand collapses and lands naturally
    // instead of hanging frozen mid-air.
    let vx=clamp((p.x-p.px)*.97,-1500*dt,1500*dt),vy=clamp((p.y-p.py)*.97,-1500*dt,1500*dt);
    // During settle, letters that have stayed slow for a while are resting in
    // the pile — suppress their residual jitter so the 0.35 px/frame
    // stability gate passes promptly. A falling or toppling letter leaves the
    // slow band within ~0.08 s, well under the 0.2 s timer, so genuine falls
    // (including the trailing strand's collapse onto the pile) are untouched.
    if(this.phase==='settle'){
     const slow=vx*vx+vy*vy<.81;
     p.slow=slow?p.slow+dt:0;
     if(p.slow>.2){vx*=.3;vy*=.3;}
    }else p.slow=0;
    p.px=p.x;p.py=p.y;p.x+=vx;p.y+=vy+1400*dt*dt;
   }
  }
  // Solve both ropes and their collisions together: the two piles support
  // one another, but no spring connects their endpoints.
  // During the fall, collisions run once per tick (after the main passes) —
  // per-pass collision solving injects energy into fast rope impacts. Once
  // every node is free and slow (settling pile), collisions interleave with
  // every other pass so the loaded piles converge without deep overlap —
  // per-pass solving measured 4.6 ms/tick here (7× the fall) and was the
  // stutter source when the last sentence lands on phones.
  const tail=4,settling=this.front===ns.length,passes=18;
  for(let pass=0;pass<passes;pass++){
   for(const c of this.chains){
    const last=c.start+c.free-1,anchor=Math.min(c.end,last+1);
    for(let j=c.start;j<anchor;j++){
     const i=pass%2?anchor-1-(j-c.start):j,a=ns[i],b=ns[i+1],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||.001,r=c.rest[i-c.start],k=(d-r)/d;
     const af=!!(this.grip&&this.grip.index===i),bf=i+1>last||!!(this.grip&&this.grip.index===i+1);
     if(!af&&!bf){a.x+=dx*k*.5;a.y+=dy*k*.5;b.x-=dx*k*.5;b.y-=dy*k*.5;}
     else if(!af){a.x+=dx*k;a.y+=dy*k;}else if(!bf){b.x-=dx*k;b.y-=dy*k;}
    }
   }
   if(this.grip){const p=ns[this.grip.index];if(p.s<this.chains[p.chain].feed){p.x=this.grip.x;p.y=this.grip.y;p.px=p.x;p.py=p.y;}}
   if((settling&&pass%2===0)||(pass%3===2)){this.collide();for(const p of ns)if(p.s<this.chains[p.chain].feed){p.x=clamp(p.x,30+p.radius,870-p.radius);p.y=clamp(p.y,30+p.radius,1180-p.radius);}}
  }
  if(!settling)this.collide();
  for(const p of ns)if(p.s<this.chains[p.chain].feed){p.x=clamp(p.x,30+p.radius,870-p.radius);p.y=clamp(p.y,30+p.radius,1180-p.radius);}
  for(let pass=0;pass<tail;pass++){
   for(const c of this.chains){
    const last=c.start+c.free-1,anchor=Math.min(c.end,last+1);
    for(let j=c.start;j<anchor;j++){
     const i=pass%2?anchor-1-(j-c.start):j,a=ns[i],b=ns[i+1],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||.001,r=c.rest[i-c.start],k=(d-r)/d;
     const af=!!(this.grip&&this.grip.index===i),bf=i+1>last||!!(this.grip&&this.grip.index===i+1);
     if(!af&&!bf){a.x+=dx*k*.5;a.y+=dy*k*.5;b.x-=dx*k*.5;b.y-=dy*k*.5;}
     else if(!af){a.x+=dx*k;a.y+=dy*k;}else if(!bf){b.x-=dx*k;b.y-=dy*k;}
    }
   }
  }
  if(this.grip){
   const c=this.chains[ns[this.grip.index].chain],anchor=Math.min(c.end,c.start+c.free);
   for(let i=anchor-1;i>=c.start;i--){const a=ns[i],b=ns[i+1],d=dist(a,b)||1,r=c.rest[i-c.start];a.x=b.x+(a.x-b.x)/d*r;a.y=b.y+(a.y-b.y)/d*r;}
  }
  let error=0;
  for(const c of this.chains)for(let i=c.start;i<Math.min(c.end,c.start+c.free);i++)error=Math.max(error,Math.abs(dist(ns[i],ns[i+1])-c.rest[i-c.start])/c.rest[i-c.start]);
  this.maxError=Math.max(this.maxError,error);if(error>.1)this.errorFrames++;
  this.front=this.chains.reduce((sum,c)=>sum+c.free,0);this.steps++;
  if(this.front===ns.length){
   this.phase='settle';
   // supported() is O(n^2); cache it for 10 ticks (~83 ms) so the settle
   // phase doesn't dominate the frame budget on phones.
   if(!(this.supportCache&&this.steps-this.supportCache.at<10))this.supportCache={value:this.supported(),at:this.steps};
   const grounded=this.supportCache.value&&ns.every(p=>Math.hypot(p.x-p.px,p.y-p.py)<.35);
   this.phaseTime=grounded&&!this.grip?this.phaseTime+dt:0;
   if(this.phaseTime>=.35){this.updateGlyphs();this.origins=this.originals.map(g=>({x:g.x,y:g.y,angle:g.angle}));this.phase='order';this.phaseTime=0;}
  }
  this.updateGlyphs();
 }
 collide(){
  const grid=new Map(),cell=Math.max(32,...this.nodes.map(p=>p.radius*2));
  for(let i=0;i<this.nodes.length;i++){
   const a=this.nodes[i];if(a.s>=this.chains[a.chain].feed)continue;
   const cx=Math.floor(a.x/cell),cy=Math.floor(a.y/cell);
   for(let x=cx-1;x<=cx+1;x++)for(let y=cy-1;y<=cy+1;y++)for(const j of grid.get(x+','+y)||[]){
    const b=this.nodes[j];if(a.chain===b.chain&&i-j===1)continue;
    let dx=a.x-b.x,dy=a.y-b.y,d=Math.hypot(dx,dy),r=a.radius+b.radius;
    if(d>=r)continue;if(d<.001){dx=(i%2?1:-1)*.001;dy=-.001;d=Math.hypot(dx,dy);}
    const k=(r-d)/d,af=!!(this.grip&&this.grip.index===i),bf=!!(this.grip&&this.grip.index===j);
    // Cap per-pass correction so a one-shot push can never tunnel a glyph
    // through another (which would lock a crossing into the pile).
    const cap=2;
    if(!af){const f=bf?1:.5;let mx=dx*k*f,my=dy*k*f;const m=Math.hypot(mx,my);if(m>cap){mx*=cap/m;my*=cap/m;}a.x+=mx;a.y+=my;}
    if(!bf){const f=af?1:.5;let mx=dx*k*f,my=dy*k*f;const m=Math.hypot(mx,my);if(m>cap){mx*=cap/m;my*=cap/m;}b.x-=mx;b.y-=my;}
   }
   const key=cx+','+cy;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(i);
  }
 }
 supported(){
  // Follow the contact network from the floor, including lateral contacts
  // in stable arches. A top-down-only test rejects these supported piles.
  // Spatial-grid neighbor search: the former all-pairs scan was O(n²) and,
  // even cached to every 10 ticks, spiked the settle phase on phones.
  // Cell 64 covers radius contacts (~37 px) and chain-rest contacts (~36 px).
  const ns=this.nodes,cell=64,grid=new Map(),seen=new Set(),queue=[];
  ns.forEach((p,i)=>{const k=Math.floor(p.x/cell)+','+Math.floor(p.y/cell);if(grid.has(k))grid.get(k).push(i);else grid.set(k,[i]);});
  ns.forEach((p,i)=>{if(p.y+p.radius>=1178){seen.add(i);queue.push(i);}});
  for(let q=0;q<queue.length;q++){
   const a=ns[queue[q]],ax=Math.floor(a.x/cell),ay=Math.floor(a.y/cell),rest=this.chains[a.chain].rest,start=this.chains[a.chain].start;
   for(let x=ax-1;x<=ax+1;x++)for(let y=ay-1;y<=ay+1;y++)for(const j of grid.get(x+','+y)||[]){
    if(seen.has(j))continue;const b=ns[j];
    const chainTouch=a.chain===b.chain&&Math.abs(queue[q]-j)===1&&dist(a,b)<=rest[Math.min(queue[q],j)-start]+1;
    if(dist(a,b)<=a.radius+b.radius+3||chainTouch){seen.add(j);queue.push(j);}
   }
  }
  return seen.size===ns.length;
 }
 updateGlyphs(){
  const ordered=['order','scale','complete'].includes(this.phase),u=this.phase==='order'?ease(this.phaseTime/1.8):1,v=this.phase==='scale'?ease(this.phaseTime/1.6):this.phase==='complete'?1:0;
  if(this.phase==='intro'){
   // Rope-threading intro: the dark text starts as the finished paragraph
   // (same layout as the final letter). The rope is pulled through the rose
   // path: glyphs stream from the paragraph tail to each chain's entry port,
   // turn flower/leaf colored as they cross it, then slide along the path;
   // no dark rope is left outside once the path is full.
   const t=ease(Math.min(1,this.phaseTime/this.introDur)),F=260;
   for(let i=0;i<this.originals.length;i++){
    const g=this.originals[i],c=this.chains[g.chain],Lc=c.curve.length,enter=Lc-g.s,pos=t*Lc-enter;
    if(pos>=0){
     const pnt=sample(c.curve,pos),colorMix=t>=1?1:Math.min(1,pos/50);
     g.x=pnt.x;g.y=pnt.y;g.angle=pnt.angle;g.blend=colorMix;g.state='path';g.scale=1;g.alpha=1;
    }else{
     // outside the path: rest in the paragraph, or fly toward the port during
     // the last F rope-px before entry
     const port=c.curve.points[0],u=ease(clamp((t*Lc-enter+F)/F,0,1));
     g.x=mix(g.source.finalX,port.x,u);g.y=mix(g.source.finalY,port.y,u);
     g.angle=mix(0,port.angle,u);g.blend=0;g.state='falling';g.scale=mix(this.letterSize/this.size,1,u);g.alpha=1;
    }
   }
   return;
  }
  for(let i=0;i<this.originals.length;i++){
   const g=this.originals[i],c=this.chains[g.chain];
   if(!ordered){
    if(g.s>=c.feed){const p=sample(c.curve,g.s-c.feed);g.x=p.x;g.y=p.y;g.angle=p.angle;g.blend=1;g.state='path';g.alpha=1;}
    else{const p=this.nodes[g.node];g.x=p.x;g.y=p.y;g.angle=0;g.blend=0;g.state='falling';g.alpha=1;}
    g.scale=1;continue;
   }
   const factor=mix(this.compact,1,v),target={x:450+(g.source.finalX-450)*factor,y:600+(g.source.finalY-600)*factor},o=(this.origins&&this.origins[i])||target;
   g.x=mix(o.x,target.x,u);g.y=mix(o.y,target.y,u);g.angle=(o.angle||0)*(1-u);g.scale=mix(1,this.letterSize/this.size*factor,u);g.blend=0;g.state='landed';
  }
 }
}

// Backgrounds stay on this device; uploads are decoded from local object URLs.
// Preset papers carry a palette mode: picking one switches the canvas palette
// automatically (dark textures → dark palette, light papers → light palette).
const PAPER_PALETTE = { 'IMG_0006.jpg': 'light', 'IMG_0003.jpg': 'light', 'IMG_0045.JPG': 'dark', 'IMG_0046.JPG': 'dark' };
/* $ — 由 app.js 提供 */
/* clamp = (v, a =  — 由 motion.js 提供 */
const decode = src => new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error('无法读取这张图片，请换一张 JPG、PNG 或 WebP 图片。')); image.src = src; });
class Background {
  constructor(redraw, onPalette) {
    this.redraw = redraw; this.onPalette = onPalette; this.current = null; this.uploaded = null; this.request = 0; this.pending = null; this.images = {};
    this.preview = $('crop-preview'); this.dialog = $('crop-dialog');
    document.querySelectorAll('[data-background]').forEach(button => button.addEventListener('click', () => this.choose(button.dataset.background)));
    $('upload-background').addEventListener('click', () => $('background-file').click());
    $('background-file').addEventListener('change', async e => {
      const file = e.target.files[0]; e.target.value = ''; if (!file) return;
      const request = ++this.request, url = URL.createObjectURL(file);
      try {
        const image = await decode(url); if (request !== this.request) return;
        this.pending = { image, name: file.name, zoom: 1, x: .5, y: .5 };
        $('crop-name').textContent = file.name; $('crop-zoom').value = '1';
        $('background-error').textContent = ''; this.dialog.showModal(); this.drawPreview();
      } catch (e) { if (request === this.request) $('background-error').textContent = e.message; }
      finally { URL.revokeObjectURL(url); }
    });
    $('crop-zoom').addEventListener('input', e => {
      const old = this.rect(this.pending), cx = old.x + old.w / 2, cy = old.y + old.h / 2;
      this.pending.zoom = Number(e.target.value);
      const next = this.rect(this.pending), image = this.pending.image;
      this.pending.x = clamp((cx - next.w / 2) / (image.naturalWidth - next.w || 1));
      this.pending.y = clamp((cy - next.h / 2) / (image.naturalHeight - next.h || 1)); this.drawPreview();
    });
    $('crop-reset').addEventListener('click', () => { Object.assign(this.pending, { zoom: 1, x: .5, y: .5 }); $('crop-zoom').value = '1'; this.drawPreview(); });
    $('crop-cancel').addEventListener('click', () => this.dialog.close());
    this.dialog.addEventListener('close', () => { this.pending = null; this.drag = null; });
    $('crop-apply').addEventListener('click', () => {
      this.uploaded = Object.assign({}, this.pending, { selection: 'custom' });
      $('custom-background').hidden = false; this.use(this.uploaded); this.dialog.close();
    });
    this.preview.addEventListener('pointerdown', e => {
      if (e.button > 0) return; this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
      this.preview.setPointerCapture(e.pointerId); e.preventDefault();
    });
    this.preview.addEventListener('pointermove', e => {
      if (!this.drag || this.drag.id !== e.pointerId) return;
      const bounds = this.preview.getBoundingClientRect(), crop = this.rect(this.pending), image = this.pending.image;
      this.pending.x = clamp(this.pending.x - (e.clientX - this.drag.x) * crop.w / bounds.width / (image.naturalWidth - crop.w || Infinity));
      this.pending.y = clamp(this.pending.y - (e.clientY - this.drag.y) * crop.h / bounds.height / (image.naturalHeight - crop.h || Infinity));
      this.drag.x = e.clientX; this.drag.y = e.clientY; this.drawPreview();
    });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) this.preview.addEventListener(event, () => { this.drag = null; });
    this.preview.addEventListener('keydown', e => {
      const axes = { ArrowLeft: ['x', .025], ArrowRight: ['x', -.025], ArrowUp: ['y', .025], ArrowDown: ['y', -.025] };
      if (!axes[e.key]) return; e.preventDefault(); const [axis, delta] = axes[e.key]; this.pending[axis] = clamp(this.pending[axis] + delta); this.drawPreview();
    });
    this.ready = this.choose('IMG_0006.jpg');
  }
  preload(name) {
    if (!this.images[name]) this.images[name] = decode('./' + name).catch(error => { delete this.images[name]; throw error; });
    return this.images[name];
  }
  use(state, palette) {
    ++this.request; this.current = state;
    const name = state.selection || state.name;
    if (name === 'custom') this.uploaded = state;
    this.select(name); $('background-error').textContent = '';
    const mode = palette || PAPER_PALETTE[name];
    if (mode && this.onPalette) this.onPalette(mode);
    this.redraw();
  }
  async choose(name) {
    const request = ++this.request;
    try {
      const next = name === 'custom' ? this.uploaded : { image: await this.preload(name), zoom: 1, x: .5, y: .5, name };
      if (request !== this.request || !next) return;
      this.use(next);
    } catch (e) { if (request === this.request) $('background-error').textContent = e.message; }
  }
  select(name) { document.querySelectorAll('[data-background]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.background === name))); }
  rect(state) {
    const { image, zoom, x, y } = state, iw = image.naturalWidth, ih = image.naturalHeight;
    const cover = Math.max(900 / iw, 1200 / ih) * zoom, w = 900 / cover, h = 1200 / cover;
    return { x: Math.max(0, iw - w) * x, y: Math.max(0, ih - h) * y, w, h };
  }
  paint(ctx, state, width, height) { const r = this.rect(state); ctx.drawImage(state.image, r.x, r.y, r.w, r.h, 0, 0, width, height); }
  drawPreview() {
    const ctx = this.preview.getContext('2d'); ctx.clearRect(0, 0, 600, 800); this.paint(ctx, this.pending, 600, 800);
    ctx.strokeStyle = '#ffffff88'; ctx.lineWidth = 1; ctx.beginPath();
    for (let i = 1; i < 3; i++) { ctx.moveTo(200*i, 0); ctx.lineTo(200*i,800); ctx.moveTo(0,800*i/3); ctx.lineTo(600,800*i/3); } ctx.stroke();
    $('crop-zoom-value').textContent = Math.round(this.pending.zoom * 100) + '%';
  }
  draw(ctx) { if (this.current) this.paint(ctx, this.current, 900, 1200); }
}

// Native album adapter. The offline package contains no browser download path.
const canSaveArtwork = () => !!(window.xhs && window.xhs.miniTool && typeof window.xhs.miniTool.saveImageToPhotosAlbum === 'function');
const savedLabel = '已保存到相册';
async function saveArtwork(dataUrl) {
  const sdk = window.xhs && window.xhs.miniTool;
  if (!canSaveArtwork()) throw new Error('当前环境不支持保存图片');
  let filePath = dataUrl;
  if (typeof sdk.writeTempFile === 'function') filePath = (await sdk.writeTempFile({ data: dataUrl })).filePath;
  await sdk.saveImageToPhotosAlbum({ filePath });
}




const $ = id => document.getElementById(id);
const W = 900, H = 1200, PAPER = '#f8f5ef';
const FONT = '"Songti SC", "STSong", "Noto Serif CJK SC", SimSun, serif';
/* clamp = (v, a =  — 由 motion.js 提供 */
/* mix = (a, b, t)  — 由 motion.js 提供 */
const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('zh', { granularity: 'grapheme' }) : null; // Chrome 61 容器基线无 Segmenter 时退化为按码点切分
const graphemes = text => segmenter ? Array.from(segmenter.segment(text), s => s.segment) : Array.from(text);
const rgba = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
function blendColor(a, b, t) { const x = rgba(a), y = rgba(b); return `rgb(${x.map((v, i) => Math.round(mix(v, y[i], t))).join(',')})`; }
function makeTable(points) {
  let length = 0, lastAngle = 0;
  points.forEach((p, i) => {
    if (i) length += distance(p, points[i - 1]);
    const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
    let angle = Math.atan2(b.y - a.y, b.x - a.x);
    while (angle - lastAngle > Math.PI) angle -= Math.PI * 2;
    while (angle - lastAngle < -Math.PI) angle += Math.PI * 2;
    p.s = length; p.angle = angle; lastAngle = angle;
  });
  return { points, length };
}

const BIRTHDAY_TEXT = `生日快乐！把今天的祝福，写成一块只属于你的蛋糕。愿烛光照亮眼前的小小愿望，也照亮新一岁还没走过的路。
愿你有好好吃饭的胃口，有安心入睡的夜晚，有想见就能见的人，也有说走就走的勇气。忙碌的时候记得歇一歇，难过的时候有人愿意听你慢慢说。
吹灭蜡烛之前，请认真许一个愿。愿你喜欢的事都有回响，惦念的人平安顺遂，努力的日子偶尔收获惊喜，平凡的生活也能尝出甜味。
新的一岁，不必急着成为谁。继续做你自己，笑得自在，走得从容。愿你被爱包围，也拥有照顾自己的力量。今天的蛋糕很甜，往后的每一天，都愿你快乐。`;

// Shape defaults and geometry share the same LetterMotion implementation.
const SHAPES = {
  rose: {
    name: '玫瑰', file: './玫瑰路径图.svg', order: [1, 0], grip: '枝叶上端', defaultBackground: 'IMG_0006.jpg',
    idle: '一朵玫瑰，藏着一封信', complete: '原来，这些话都藏在花里',
    unfolding: '枝叶先滑出，花朵接着展开', colorLabel: '花与叶的颜色',
    parts: [{ id: 'flower', label: '花朵', selector: '.cls-2' }, { id: 'leaf', label: '枝叶', selector: '.cls-1' }],
    palettes: { light: ['#d35159', '#4b8b3d', '#34312e'], dark: ['#f2a2b0', '#b8d99b', '#f4efe6'] }
  },
  cake: {
    name: '蛋糕', file: './蛋糕/蛋糕.svg', order: [2, 1, 0, 3], grip: '托盘左端', defaultBackground: 'IMG_0046.JPG', intro: true,
    idle: '一块蛋糕，藏着一封信', complete: '原来，这些祝福都藏在蛋糕里',
    unfolding: '托盘、蛋糕、奶油和蜡烛依次展开', colorLabel: '蛋糕的颜色',
    parts: [{ id: 'cream', label: '奶油', selector: '.cls-4' }, { id: 'cake-body', label: '蛋糕', selector: '.cls-1' }, { id: 'plate', label: '托盘', selector: '.cls-2' }, { id: 'candle', label: '蜡烛', selector: '.cls-3' }],
    palettes: { light: ['#b64b65', '#547f75', '#577ba3', '#9a702c', '#34312e'], dark: ['#ffb4c0', '#ddd0f2', '#b6d5fb', '#ffda94', '#f4efe6'] }
  }
};

class RoseStudio {
  constructor() {
    this.canvas = $('canvas'); this.ctx = this.canvas.getContext('2d');
    this.speed = 2; this.introSpeed = 1; this.mode = 'auto'; this.status = 'loading'; this.elapsed = 0; this.size = 20; this.paragraphSize = 28;
    this.shape = 'rose'; this.shapeConfig = SHAPES.rose; this.pathCache = {};
    this.shapePalettes = {};
    Object.keys(SHAPES).forEach(key => { this.shapePalettes[key] = { light: SHAPES[key].palettes.light.slice(), dark: SHAPES[key].palettes.dark.slice() }; });
    this.introEnabled = !!$('bloom'); this.maxSpacing = this.introEnabled ? 1.6 : 1.25;
    this.paletteMode = 'light'; this.palettes = this.shapePalettes.rose; this.colors = this.palettes.light.slice(0,-1); this.ink = '#34312e'; this.text = $('message').value;
    this.defaultTexts = { rose: this.text, cake: BIRTHDAY_TEXT }; this.shapeBackgrounds = {};
    this.sources = []; this.chains = []; this.paths = []; this.drag = null; this.returning = false;
    this.accumulator = 0; this.previousFrame = 0; this.lastUI = '';
    this.updateShapeControls(); this.bind();
    this.background = new Background(() => this.draw(), mode => { if (this.paletteMode !== mode) this.setPalette(mode); });
    if (typeof ResizeObserver === 'function') { this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(this.canvas); } else { window.addEventListener('resize', () => this.resize()); }
    this.ready = this.initialize();
  }
  async loadPaths(shape) {
    const config = SHAPES[shape], source = document.getElementById(shape + '-source');
    if (!source) throw new Error(config.name + '路径数据缺失。');
        const svgText = source.innerHTML; // 小工具离线包:路径内联在入口页,禁止网络请求
    const xml = new DOMParser().parseFromString(svgText, 'image/svg+xml');
    if (xml.querySelector('parsererror')) throw new Error(`${config.name}路径文件无法解析。`);
    const svg = document.importNode(xml.documentElement, true);
    // Never insert the SVG artwork into the visible canvas. It is geometry only.
    svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
    document.body.append(svg);
    try {
      const box = svg.viewBox.baseVal;
      const scale = Math.min(760 / box.width, 1060 / box.height);
      const ox = (W - box.width * scale) / 2 - box.x * scale, oy = (H - box.height * scale) / 2 - box.y * scale;
      return config.parts.map(part => {
        const path = svg.querySelector(part.selector);
        if (!path) throw new Error(`SVG 中缺少${part.label}路径。`);
        const length = path.getTotalLength(), samples = Math.ceil(length * scale / 1.5), points = [];
        for (let i = 0; i <= samples; i++) { const p = path.getPointAtLength(length * i / samples); points.push({ x: ox + p.x * scale, y: oy + p.y * scale }); }
        return makeTable(points);
      });
    } finally { svg.remove(); }
  }
  async initialize() {
    try {
      const keys = Object.keys(SHAPES), paths = await Promise.all(keys.map(key => this.loadPaths(key)));
      keys.forEach((key, i) => { this.pathCache[key] = paths[i]; });
      this.paths = this.pathCache[this.shape]; this.ropePath = connectPaths(this.paths, this.shapeConfig.order);
      const defaults = await Promise.all([document.fonts.ready, this.background.ready, this.background.preload(SHAPES.cake.defaultBackground), this.background.preload('IMG_0003.jpg')]);
      this.shapeBackgrounds.rose = { state: this.background.current, palette: this.paletteMode };
      this.shapeBackgrounds.cake = { state: { image: defaults[2], name: SHAPES.cake.defaultBackground, zoom: 1, x: .5, y: .5 }, palette: 'dark' };
      if (!this.apply(this.text, this.size, this.paragraphSize, false, false, this.hasIntro())) throw new Error($('input-error').textContent);
      $('loading').hidden = true; $('play').disabled = false; if ($('bloom')) $('bloom').disabled = false; $('reset').disabled = false;
      if ($('save-image')) $('save-image').disabled = false;
      document.querySelectorAll('input[name=shape]').forEach(input => { input.disabled = false; });
      this.resize();
      requestAnimationFrame(t => this.frame(t));
    } catch (error) {
      this.status = 'error'; $('loading').textContent = error.message;
      $('input-error').textContent = error.message; console.error(error);
    }
  }
  hasIntro() { return this.introEnabled || !!this.shapeConfig.intro; }
  updateShapeControls() {
    const config = this.shapeConfig;
    document.querySelectorAll('input[name=shape]').forEach(input => { input.checked = input.value === this.shape; });
    document.querySelector('label[for="font-size"]').textContent = config.name + '字号';
    const setting = document.querySelector('.color-setting');
    setting.querySelector('legend').textContent = config.colorLabel;
    const row = setting.querySelector('.color-row'); row.textContent = '';
    config.parts.forEach((part, i) => {
      const label = document.createElement('label'); label.className = 'color-control';
      const input = document.createElement('input'); input.type = 'color'; input.id = part.id + '-color'; input.value = this.colors[i]; input.dataset.pathColor = i;
      const name = document.createElement('span'); name.textContent = part.label;
      const output = document.createElement('output'); output.id = part.id + '-hex'; output.textContent = this.colors[i].toUpperCase();
      label.append(input, name, output); row.append(label);
    });
    this.canvas.setAttribute('aria-label', `文字${config.name}动画。拖动${config.grip}圆圈牵引文字绳，松手后沿路径滑出并自然下落，全部落地后整理成信。`);
    document.querySelector('.workspace').setAttribute('aria-label', `文字${config.name}预览`);
    $('reset').setAttribute('aria-label', '回到' + config.name); $('reset').title = '回到' + config.name;
    if ($('bloom')) {
      const action = this.shape === 'rose' ? '生花' : '成形';
      $('bloom').lastElementChild.textContent = action; $('bloom').setAttribute('aria-label', '生成文字' + config.name);
      $('intro-speed').textContent = `${this.introSpeed}×`; $('intro-speed').setAttribute('aria-label', `${action}速度 ${this.introSpeed} 倍，点击切换`); $('intro-speed').title = `切换${action}速度`;
    }
    document.title = '字里花间 · ' + config.idle;
  }
  selectShape(shape) {
    if (shape === this.shape || !this.pathCache[shape]) return false;
    const previous = { shape: this.shape, shapeConfig: this.shapeConfig, paths: this.paths, ropePath: this.ropePath, palettes: this.palettes, colors: this.colors, ink: this.ink };
    const nextText = this.text === this.defaultTexts[this.shape] ? this.defaultTexts[shape] : this.text;
    const replaceDraft = $('message').value === this.text;
    this.shape = shape; this.shapeConfig = SHAPES[shape]; this.paths = this.pathCache[shape];
    this.ropePath = connectPaths(this.paths, this.shapeConfig.order); this.palettes = this.shapePalettes[shape];
    this.colors = this.palettes[this.paletteMode].slice(0,-1); this.ink = this.palettes[this.paletteMode].slice(-1)[0];
    if (!this.apply(nextText, this.size, this.paragraphSize, false, true, this.hasIntro())) {
      Object.assign(this, previous); this.updateShapeControls(); this.updateUI(); this.inputHint(); this.draw(); return false;
    }
    if (replaceDraft) $('message').value = nextText;
    this.shapeBackgrounds[previous.shape] = { state: this.background.current, palette: this.paletteMode };
    this.updateShapeControls(); this.setPalette(this.shapeBackgrounds[shape].palette);
    this.background.use(this.shapeBackgrounds[shape].state, this.shapeBackgrounds[shape].palette);
    this.inputHint(); return true;
  }
  layout(text, roseSize, requestedSize = this.paragraphSize) {
    const chars = graphemes(text);
    if (!text.trim()) throw new Error('先写下一句话，再让它组成' + this.shapeConfig.name + '。');
    if (chars.length > 2000) throw new Error('输入过长，请按当前建议范围精简文字。');
    let rows, height, letterSize = requestedSize;
    // Fit the final letter, not the small temporary landing area. Explicit
    // newlines count toward height; every valid <=200-grapheme input can fit.
    for (; letterSize >= 1; letterSize--) {
      this.ctx.font = `${letterSize}px ${FONT}`;
      rows = [[]]; let width = 0;
      for (const ch of chars) {
        if (ch === '\n' || ch === '\r\n' || ch === '\r') { rows.push([]); width = 0; continue; }
        const w = this.ctx.measureText(ch).width;
        if (width + w > 600 && rows[rows.length-1].length) { rows.push([]); width = 0; }
        rows[rows.length-1].push({ ch, letterW: w, x: width + w / 2 }); width += w + letterSize * .09;
      }
      height = (rows.length - 1) * letterSize * 1.65 + letterSize;
      if (height <= 840) break;
    }
    const stageFactor = Math.min(1, 300 / height, roseSize / letterSize);
    const sources = [], top = 600 - height / 2 + letterSize / 2;
    this.ctx.font = `${roseSize}px ${FONT}`;
    rows.forEach((row, r) => row.forEach(p => {
      const finalX = 150 + p.x, finalY = top + r * letterSize * 1.65;
      sources.push({ ch: p.ch, w: this.ctx.measureText(p.ch).width, stageW: p.letterW * stageFactor,
        x: 450 + (finalX - 450) * stageFactor, y: 600 + (finalY - 600) * stageFactor,
        finalX, finalY, row: r, id: sources.length });
    }));
    sources.letterSize = letterSize; sources.stageFactor = stageFactor;
    return sources;
  }
  range(size=this.size) {
    const L=(this.ropePath&&this.ropePath.length)||6000;
    return {min:Math.ceil(L/(size*1.08*this.maxSpacing)),max:Math.floor(L/(size*1.08*.95))};
  }
  inputHint(size=this.size) {
    const r=this.range(size),count=graphemes($('message').value).filter(g=>!/[\r\n]/.test(g)).length;
    $('count').textContent=`${count} 字素`;
    $('edit-hint').textContent=`${size} 号字建议约 ${r.min}–${r.max} 个中文字符；按实际字宽校验，不重复补字。`;
  }
  apply(text, size, paragraphSize = this.paragraphSize, keepComplete = false, autoFit = false, intro = false) {
    try {
      const requested=size;
      const sizes=autoFit?Array.from({length:21},(_,i)=>i+12).sort((a,b)=>Math.abs(a-requested)-Math.abs(b-requested)): [size];
      let sources,ratio;
      for(const candidate of sizes){
        sources=this.layout(text,candidate,paragraphSize);
        const width=sources.reduce((n,g)=>n+g.w+candidate*.08,0)-candidate*.08;
        ratio=this.ropePath.length/Math.max(1,width);
        if(ratio>=.95&&ratio<=this.maxSpacing){size=candidate;break;}
      }
      if(ratio<.95||ratio>this.maxSpacing){const lo=this.range(32).min,hi=this.range(12).max;throw new Error(`文字${ratio>this.maxSpacing?'太少':'太多'}，无法铺满完整${this.shapeConfig.name}。支持约 ${lo}–${hi} 个中文字符（含标点），请调整字数后再试${$('auto-fit')&&!autoFit?'，或点击「自动适配字号」':''}。`);}
      const motion=new LetterMotion(this.ropePath,sources,size,sources.letterSize,intro);
      this.cancelCapture();this.motion=motion;this.sources=sources;this.size=size;this.paragraphSize=sources.letterSize;this.text=text;
      this.elapsed=0;this.status=keepComplete?'complete':'idle';this.returning=false;this.returnState=null;
      this.chains=this.paths.map((path,index)=>({index,path,glyphs:motion.originals.filter(g=>g.color===index)}));
      if(keepComplete)motion.finish();
      $('input-error').textContent='';$('message').removeAttribute('aria-invalid');
      $('font-size').value=size;$('font-value').textContent=size;
      $('paragraph-size').min=Math.min(12,this.paragraphSize);$('paragraph-size').value=this.paragraphSize;$('paragraph-value').textContent=this.paragraphSize;
      $('paragraph-min').textContent=`细腻 · ${Math.min(12,this.paragraphSize)}`;
      $('fit-note').textContent=ratio>1.25?`文字较少，字距已自动拉开${size!==requested?`，${this.shapeConfig.name}字号适配为 ${size}`:''}。`:(size!==requested?`已适配${this.shapeConfig.name}字号为 ${size}。`:'');
      this.inputHint();this.accumulator=0;this.updateUI();this.draw();return true;
    } catch(error){$('text-form').hidden=false;$('edit-toggle').setAttribute('aria-expanded','true');$('input-error').textContent=error.message;$('message').setAttribute('aria-invalid','true');this.inputHint(size);return false;}
  }
  reset() { if(this.paths.length)this.apply(this.text,this.size,this.paragraphSize,false,false,this.hasIntro()); }
  async saveImage() {
    const btn = $('save-image'); if (!btn || btn.disabled) return;
    btn.disabled = true; const label = btn.textContent; btn.textContent = '正在保存…';
    try {
      // 导出瞬间隐藏「拖动这里」等引导标识,保存干净画面
      let dataUrl;
      this.saveGuard = true;
      try { this.draw(); dataUrl = this.canvas.toDataURL('image/png'); }
      finally { this.saveGuard = false; this.draw(); }
      await saveArtwork(dataUrl, `字里花间-${this.shapeConfig.name}.png`);
      btn.textContent = savedLabel;
    } catch (e) { btn.textContent = e && e.errMsg ? '保存失败' : '保存失败'; }
    setTimeout(() => { btn.textContent = label; btn.disabled = false; }, 2200);
  }
  start() {
    if (this.status === 'error' || this.status === 'loading') return;
    if (this.status === 'playing') { this.cancelCapture(); this.status = 'paused'; this.updateUI(); return; }
    // 展开 is the opposite of 生花: never replay the intro — resume from the
    // formed rose (a finished letter re-applies without the intro).
    if (this.status === 'complete') this.apply(this.text, this.size, this.paragraphSize, false, false, false);
    if (this.motion && this.motion.phase === 'intro') { this.motion.phase = 'rope'; this.motion.phaseTime = 0; this.motion.updateGlyphs(); }
    this.cancelCapture();
    if(this.mode==='manual'&&this.motion.phase==='rope')this.motion.drop();
    this.returning = false; this.status = 'playing'; this.updateUI();
  }
  bind() {
    $('edit-toggle').addEventListener('click', () => {
      const open = $('text-form').hidden; $('text-form').hidden = !open;
      $('edit-toggle').setAttribute('aria-expanded', String(open));
      if (open) { $('text-form').scrollIntoView({ behavior: 'smooth', block: 'center' }); $('message').focus({ preventScroll: true }); }
    });
    if ($('bloom')) $('bloom').addEventListener('click', () => { if (this.paths.length) this.apply(this.text, this.size, this.paragraphSize, false, false, true); });
    $('text-form').addEventListener('submit', e => {
      e.preventDefault();
      if (!this.paths.length) return;
      if (!this.apply($('message').value, this.size, this.paragraphSize, false, this.introEnabled, this.hasIntro()) && $('notice-dialog')) {
        $('notice-text').textContent = $('input-error').textContent;
        $('notice-dialog').showModal();
      }
    });
    if ($('notice-ok')) $('notice-ok').addEventListener('click', () => $('notice-dialog').close());
    document.querySelectorAll('input[name=shape]').forEach(input => input.addEventListener('change', () => { this.selectShape(input.value); }));
    if ($('save-image')) {
      $('save-image').hidden = !canSaveArtwork();
      $('save-image').addEventListener('click', () => this.saveImage());
    }
    $('message').addEventListener('input', () => {
      this.inputHint();
    });
    this.inputHint();
    $('font-size').addEventListener('input', e => {
      if (!this.paths.length) { e.target.value = this.size; return; }
      if (!this.apply($('message').value, Number(e.target.value), this.paragraphSize, this.status === 'complete')) {
        e.target.value = this.size; $('font-value').textContent = this.size;
        $('fit-note').textContent = $('input-error').textContent; this.inputHint();
      }
    });
    $('paragraph-size').addEventListener('input', e => {
      if (!this.paths.length) { e.target.value = this.paragraphSize; return; }
      if (!this.apply($('message').value, this.size, Number(e.target.value), this.status === 'complete')) {
        e.target.value = this.paragraphSize; $('fit-note').textContent = $('input-error').textContent;
      }
    });
    if ($('auto-fit')) $('auto-fit').addEventListener('click', () => this.apply($('message').value, this.size, this.paragraphSize, this.status === 'complete', true, this.hasIntro()));
    document.querySelector('.color-row').addEventListener('input', e => {
      if (!e.target.matches('input[data-path-color]')) return;
      const i = Number(e.target.dataset.pathColor);
      this.colors[i] = e.target.value; this.palettes[this.paletteMode][i] = e.target.value; $(this.shapeConfig.parts[i].id + '-hex').textContent = e.target.value.toUpperCase(); this.draw();
    });
    $('paragraph-color').addEventListener('input', e => { this.ink = e.target.value; Object.keys(this.shapePalettes).forEach(key => { const palette = this.shapePalettes[key][this.paletteMode]; palette[palette.length-1] = this.ink; }); this.draw(); });
    document.querySelectorAll('input[name=palette]').forEach(input => input.addEventListener('change', () => this.choosePalette(input.value)));
    $('reset-colors').addEventListener('click', () => { this.palettes[this.paletteMode] = this.shapeConfig.palettes[this.paletteMode].slice(); this.setPalette(this.paletteMode); });
    document.querySelectorAll('input[name=mode]').forEach(input => input.addEventListener('change', e => { this.mode = e.target.value; this.reset(); }));
    $('speed').addEventListener('click', () => { const speeds=[.5,1,1.5,2,3]; this.speed=speeds[(speeds.indexOf(this.speed)+1)%speeds.length]; $('speed').textContent=`${this.speed}×`; $('speed').setAttribute('aria-label', `展开速度 ${this.speed} 倍，点击切换`); });
    const introSpeeds=[.5,1,1.5,2];
    if ($('intro-speed')) $('intro-speed').addEventListener('click', () => { this.introSpeed=introSpeeds[(introSpeeds.indexOf(this.introSpeed)+1)%introSpeeds.length]; const action=this.shape==='rose'?'生花':'成形'; $('intro-speed').textContent=`${this.introSpeed}×`; $('intro-speed').setAttribute('aria-label', `${action}速度 ${this.introSpeed} 倍，点击切换`); });
    $('play').addEventListener('click', () => this.start()); $('reset').addEventListener('click', () => this.reset());
    this.canvas.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.start(); }
      if (e.key === 'Escape') this.release(false);
    });
    this.canvas.addEventListener('pointerdown', e => this.pointerDown(e));
    this.canvas.addEventListener('pointermove', e => this.pointerMove(e));
    this.canvas.addEventListener('pointerup', () => this.release(true));
    this.canvas.addEventListener('pointercancel', () => this.release(false));
    this.canvas.addEventListener('lostpointercapture', () => { if (this.drag) this.release(false); });
    document.addEventListener('visibilitychange', () => {
      this.previousFrame = 0; this.accumulator = 0;
      if (document.hidden) { this.release(false); if (this.status === 'playing') { this.status = 'paused'; this.updateUI(); } }
    });
  }
  setPalette(mode) {
    this.paletteMode = mode; const colors = this.palettes[mode]; this.colors = colors.slice(0,-1); this.ink = colors[colors.length-1];
    this.shapeConfig.parts.forEach((part,i) => { $(part.id+'-color').value = colors[i]; $(part.id+'-hex').textContent = colors[i].toUpperCase(); });
    $('paragraph-color').value = this.ink;
    document.querySelectorAll('input[name=palette]').forEach(input => { input.checked = input.value === mode; });
    this.draw();
  }
  choosePalette(mode) {
    this.setPalette(mode);
    // Only the user's palette action selects paper; paper selection itself
    // calls setPalette, so choosing a texture never starts a feedback loop.
    if (this.shape === 'cake') this.background.choose(mode === 'light' ? 'IMG_0003.jpg' : 'IMG_0046.JPG');
  }
  pointerPosition(e) { const r = this.canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; }
  pointerDown(e) {
    if(!this.motion||!['idle','playing'].includes(this.status)||this.drag||this.returning||e.button>0||this.motion.phase!=='rope')return;
    const p=this.pointerPosition(e),hit=Math.max(42,25*W/this.canvas.getBoundingClientRect().width);
    const candidates=this.motion.originals.filter((g,i)=>i===0||g.state==='falling');
    const nearest=candidates.reduce((a,g)=>!a||distance(g,p)<distance(a,p)?g:a,null);
    if(!nearest||distance(p,nearest)>hit)return;
    const snapshot=this.motion.save(),node=Math.floor(nearest.node);
    this.drag={id:e.pointerId,start:p,node,armed:false,snapshot,previousStatus:this.status,offset:{x:this.motion.nodes[node].x-p.x,y:this.motion.nodes[node].y-p.y}};
    this.mode='manual';document.querySelector('input[value="manual"]').checked=true;
    this.motion.setGrip(node,{x:p.x+this.drag.offset.x,y:p.y+this.drag.offset.y});
    this.canvas.setPointerCapture(e.pointerId);this.canvas.dataset.dragging='true';e.preventDefault();this.updateUI();
  }
  pointerMove(e) {
    if(!this.drag||e.pointerId!==this.drag.id)return;
    const p=this.pointerPosition(e);this.drag.armed = this.drag.armed || distance(p,this.drag.start)>=36;
    this.motion.setGrip(this.drag.node,{x:p.x+this.drag.offset.x,y:p.y+this.drag.offset.y});e.preventDefault();
  }
  cancelCapture() {
    if(!this.drag)return;const id=this.drag.id;this.drag=null;if(this.motion)this.motion.grip=null;
    if(this.canvas.hasPointerCapture(id))this.canvas.releasePointerCapture(id);this.canvas.dataset.dragging='false';
  }
  release(allowStart) {
    if(!this.drag)return;const drag=this.drag;this.cancelCapture();
    if(allowStart&&(drag.armed||drag.previousStatus==='playing')){this.motion.drop();this.status='playing';}
    else {this.returning=true;this.returnState={from:this.motion.nodes.map(n=>Object.assign({},n)),target:drag.snapshot,t:0,status:drag.previousStatus==='idle'?'idle':'paused'};this.status='idle';}
    this.updateUI();
  }
  tick(dt) {
    if(!this.motion)return;
    if(this.returning){const r=this.returnState;r.t+=dt;const u=smooth(r.t/.4);this.motion.nodes.forEach((n,i)=>{n.x=mix(r.from[i].x,r.target.nodes[i].x,u);n.y=mix(r.from[i].y,r.target.nodes[i].y,u);});this.motion.updateGlyphs();if(u===1){this.motion.restore(r.target);this.status=r.status;this.returning=false;this.elapsed=this.motion.time;}return;}
    if(this.motion.phase==='intro'){this.motion.step(dt);this.elapsed=this.motion.time;return;}
    if(this.drag||this.status==='playing'){this.motion.step(dt,!this.drag&&this.mode==='auto');this.elapsed=this.motion.time;if(this.motion.phase==='complete')this.status='complete';}
  }
  frame(time) {
    const delta = this.previousFrame ? Math.min((time - this.previousFrame) / 1000, .05) : 0;
    this.previousFrame = time;
    const introActive = !!(this.motion && this.motion.phase === 'intro');
    const active = this.status === 'playing' || this.drag || this.returning || introActive;
    if (active) {
      this.accumulator += delta * (this.drag || this.returning ? 1 : introActive ? this.introSpeed : this.speed);
      while (this.accumulator >= 1 / 120) { this.tick(1 / 120); this.accumulator -= 1 / 120; }
      this.draw(); this.updateUI();
    } else this.accumulator = 0;
    requestAnimationFrame(t => this.frame(t));
  }
  resize() {
    const width = this.canvas.getBoundingClientRect().width, ratio = Math.min(window.devicePixelRatio || 1, 3);
    const pixelWidth = Math.max(1, Math.round(width * ratio));
    if (this.canvas.width !== pixelWidth) { this.canvas.width = pixelWidth; this.canvas.height = Math.round(pixelWidth * H / W); }
    this.draw();
  }
  drawGlyph(ch, x, y, angle, color, alpha = 1, scale = 1) {
    if (!ch.trim()) return;
    const ctx = this.ctx; ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.scale(scale, scale); ctx.fillStyle = color; ctx.globalAlpha = alpha; ctx.fillText(ch, 0, 0); ctx.restore();
  }
  draw() {
    const ctx = this.ctx;
    ctx.setTransform(this.canvas.width / W, 0, 0, this.canvas.height / H, 0, 0);
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
    if(this.background)this.background.draw(ctx);
    ctx.font = `${this.size}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (!this.sources.length) return;
    const paletteKey=this.ink+this.colors.join(',');
    if(this.paletteKey!==paletteKey){this.paletteKey=paletteKey;this.paintColors=this.colors.map(color=>Array.from({length:101},(_,i)=>blendColor(this.ink,color,i/100)));}
    for(const g of this.motion.originals)this.drawGlyph(g.ch,g.x,g.y,g.angle,this.paintColors[g.color][Math.round(clamp(g.blend)*100)],g.alpha===undefined?1:g.alpha,g.scale);
    if (this.status === 'idle' && !this.saveGuard && this.motion.phase !== 'intro') this.drawGuide();
  }
  drawGuide() {
    const ctx = this.ctx, tip = this.motion.originals[0];
    ctx.save(); ctx.font = `23px ${FONT}`; ctx.textAlign = 'left';
    ctx.strokeStyle = (this.drag&&this.drag.armed) ? this.colors[tip.color] : (this.paletteMode === 'dark' ? '#efe6d6' : '#a39586'); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(tip.x, tip.y, 29, 0, Math.PI * 2); ctx.stroke();
    if (!this.drag && !this.returning) {
      ctx.beginPath(); ctx.moveTo(tip.x, tip.y + 40); ctx.lineTo(tip.x, tip.y + 94);
      ctx.moveTo(tip.x - 7, tip.y + 86); ctx.lineTo(tip.x, tip.y + 94); ctx.lineTo(tip.x + 7, tip.y + 86); ctx.stroke();
    }
    const label = this.drag ? this.drag.armed ? '松手，读这封信' : '轻轻牵动文字' : '拖动这里';
    const position = this.guidePosition(label), x = position.x, y = position.y;
    ctx.fillStyle = this.paletteMode === 'dark' ? '#efe6d6' : '#817466'; ctx.fillText(label, x, y); ctx.restore();
  }
  guidePosition(label = '拖动这里') {
    const tip = this.motion.originals[0];
    if (this.shape !== 'cake') return { x: Math.max(35, tip.x - 215), y: clamp(tip.y + 18, 60, H - 40) };
    // The cake grip is among the tray's letters. Keep its label in the blank
    // area to the left (the user's marked position), with room while dragging.
    const ctx = this.ctx; ctx.save(); ctx.font = `23px ${FONT}`;
    const width = ctx.measureText(label).width; ctx.restore();
    const x = 55;
    for (let y = 610; y >= 190; y -= 28) {
      const clear = this.motion.originals.every(g => {
        if (!g.ch.trim()) return true;
        const scale = g.scale || 1, w = g.w * scale, h = this.size * scale;
        const hw = (Math.abs(Math.cos(g.angle)) * w + Math.abs(Math.sin(g.angle)) * h) / 2;
        const hh = (Math.abs(Math.sin(g.angle)) * w + Math.abs(Math.cos(g.angle)) * h) / 2;
        return g.x + hw < x - 10 || g.x - hw > x + width + 10 || g.y + hh < y - 22 || g.y - hh > y + 22;
      });
      if (clear) return { x, y };
    }
    return { x, y: 160 };
  }
  updateUI() {
    const playing = this.status === 'playing', complete = this.status === 'complete', paused = this.status === 'paused';
    const config = this.shapeConfig;
    $('play-label').textContent = playing ? '暂停' : complete ? '重新展开' : paused ? '继续展开' : this.introEnabled ? '展开' : '展开这封信';
    $('play-icon').textContent = playing ? 'Ⅱ' : '▷';
    $('mode-hint').textContent = this.mode === 'manual' ? `拖动${config.grip}圆圈，文字会跟随手指牵动；松手后沿路径逐步滑出，离开路径的文字自然下落，全部落地后整理成信。` : `点击播放，${config.name}会慢慢展开成一封信。也可直接拖动${config.grip}。`;
    this.canvas.dataset.manual = String(['idle','playing'].includes(this.status));
    const stage = this.drag ? this.drag.armed ? '松手，让文字绳自然落下' : `从${config.grip}，轻轻拉开` : complete ? config.complete : paused ? '已暂停 · 等你继续' : this.motion && this.motion.phase==='intro' ? `让字句，慢慢组成${config.name}` : playing ? this.motion.phase==='settle' ? '等每一个字落地，再整理成信' : this.motion.phase==='rope' ? config.unfolding : this.motion.phase==='order' ? '把字句，整理成写给你的信' : '让这封信，慢慢舒展' : config.idle;
    if (stage !== this.lastUI) { $('stage-label').textContent = stage; this.lastUI = stage; }


  }
  snapshot() {
    return {shape:this.shape,pathCount:this.paths.length,status:this.status,elapsed:this.elapsed,phase:(this.motion&&this.motion.phase),size:this.size,paragraphSize:this.paragraphSize,sourceCount:this.sources.length,freeNodes:(this.motion&&this.motion.front),nodes:(this.motion&&this.motion.nodes.length),maxConstraintError:(this.motion&&this.motion.maxError),dragging:!!this.drag,returning:this.returning};
  }
}
const studio = new RoseStudio();

window.studio = studio;
})();
