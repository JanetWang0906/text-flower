// Independent material chains follow the configured SVG path order. Unreleased
// material slides along its SVG path; gravity acts only beyond the exit.
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const mix=(a,b,t)=>a+(b-a)*t;
const ease=t=>{t=clamp(t);return t*t*(3-2*t);};
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function arcTable(points){let length=0;return {points:points.map((p,i)=>{if(i)length+=dist(p,points[i-1]);return Object.assign({},p,{s:length});}),get length(){return length;}};}
export function sample(path,s){s=clamp(s,0,path.length);let a=0,b=path.points.length-1;while(b-a>1){const m=(a+b)>>1;if(path.points[m].s<s)a=m;else b=m;}const p=path.points[a],q=path.points[b],u=(s-p.s)/(q.s-p.s||1);return{x:mix(p.x,q.x,u),y:mix(p.y,q.y,u),angle:Math.atan2(q.y-p.y,q.x-p.x)};}
export function connectPaths(paths,order=paths.map((_,i)=>i)){
 const chains=order.map(index=>Object.assign(arcTable(paths[index].points.slice()),{colorIndex:index}));
 return {chains,length:chains.reduce((sum,chain)=>sum+chain.length,0)};
}
export function connectRose(paths){return connectPaths(paths,[1,0]);}
export class LetterMotion {
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
