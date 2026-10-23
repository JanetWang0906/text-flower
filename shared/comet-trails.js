(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();else root.CometTrails=factory();
})(typeof window!=='undefined'?window:this,function(){
  'use strict';
  const TAU=Math.PI*2,clamp=n=>Math.max(0,Math.min(1,n)),smooth=n=>{n=clamp(n);return n*n*(3-2*n);};
  const cache=new WeakMap();
  function random(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
  function profile(id,seed){
    const r=random(seed*2017+id*7919+5731),role=id%10<2?'comet':id%10<6?'veil':'filament';
    const width=role==='comet'?3.2+r()*2.8:role==='veil'?.9+r()*1.25:.25+r()*.48;
    const brightness=role==='comet'?.72+r()*.28:role==='veil'?.32+r()*.34:.14+r()*.34;
    const wave=(id*7)%4,launchDelay=Math.round(([0,.12,.27,.43][wave]+r()*.045)*60)/60;
    return{role,beamWidth:width,brightness,launchDelay,tailDuration:role==='comet'?1.8+r()*1.6:.65+r()*2.25,coreFraction:role==='comet'?.18+r()*.08:.14,sparkle:role==='comet'&&r()<.3,sparklePhase:r()*TAU};
  }
  function visibility(p,age=p.age){return smooth(age/.09)*((p.brightness==null?1:p.brightness))*Math.exp(-Math.max(0,age-.7)*.14);}
  function weight(p,u,age){return((p.beamWidth==null?2:p.beamWidth))*visibility(p,age)*Math.pow(u,.88)*smooth((u-.05)/.86);}
  function mesh(p){
    const saved=cache.get(p);if(saved&&saved.age===p.age)return saved;
    const source=p.trail,points=[],stride=Math.max(1,Math.ceil((source.length-1)/22));
    for(let i=0;i<source.length;i+=stride)points.push({x:source[i].x,y:source[i].y});
    const tip=points[points.length-1];
    if(source.length&&(!tip||tip.x!==p.x||tip.y!==p.y))points.push({x:p.x,y:p.y});
    let length=0;for(let i=0;i<points.length;i++){if(i)length+=Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y);points[i].distance=length;}
    for(let i=0;i<points.length;i++){
      const before=points[Math.max(0,i-1)],after=points[Math.min(points.length-1,i+1)],dx=after.x-before.x,dy=after.y-before.y,l=Math.hypot(dx,dy)||1,u=length?points[i].distance/length:0;
      Object.assign(points[i],{nx:-dy/l,ny:dx/l,u,radius:(p.beamWidth||2)*.5*Math.pow(u,.88)});
    }
    const result={age:p.age,points,length,paths:new Map()};cache.set(p,result);return result;
  }
  function ribbon(m,gain){
    if(m.paths.has(gain))return m.paths.get(gain);
    const points=m.points,path=new Path2D(),first=points[0],last=points[points.length-1];
    path.moveTo(first.x+first.nx*first.radius*gain,first.y+first.ny*first.radius*gain);
    for(let i=1;i<points.length;i++){const q=points[i];path.lineTo(q.x+q.nx*q.radius*gain,q.y+q.ny*q.radius*gain);}
    const angle=Math.atan2(last.ny,last.nx);path.arc(last.x,last.y,last.radius*gain,angle,angle-Math.PI,true);
    for(let i=points.length-1;i>=0;i--){const q=points[i];path.lineTo(q.x-q.nx*q.radius*gain,q.y-q.ny*q.radius*gain);}path.closePath();m.paths.set(gain,path);return path;
  }
  function gradient(c,a,b,color,core=false){
    const g=c.createLinearGradient(a.x,a.y,b.x+.001,b.y+.001);
    const rgba=suffix=>'rgba('+[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)).join(',')+','+parseInt(suffix,16)/255+')';
    g.addColorStop(0,rgba('00'));g.addColorStop(.2,rgba(core?'03':'13'));g.addColorStop(.55,rgba(core?'18':'70'));g.addColorStop(.82,rgba(core?'91':'d6'));g.addColorStop(1,rgba(core?'ed':'ff'));return g;
  }
  function sparkle(c,p,hex,alpha,reduced){
    if(!p.sparkle||reduced)return;
    const pulse=Math.max(0,Math.sin(p.age*5.1+p.sparklePhase))**6;if(pulse<.18)return;
    const r=4.6+p.beamWidth*.7;c.save();c.translate(p.x,p.y);c.globalAlpha=alpha*pulse*.8;
    c.strokeStyle=hex;c.lineWidth=.85;c.beginPath();for(let i=0;i<4;i++){const a=i*Math.PI/4,length=i%2?r*.48:r;c.moveTo(Math.cos(a)*-length,Math.sin(a)*-length);c.lineTo(Math.cos(a)*length,Math.sin(a)*length);}c.stroke();
    c.strokeStyle='#fffefa';c.lineWidth=.35;c.stroke();c.restore();
  }
  function draw(c,p,hex,glow,reduced=false){
    if(!p.started)return;
    const alpha=((p.opacity==null?1:p.opacity))*visibility(p);if(alpha<.015)return;
    const m=mesh(p);if(m.points.length<2||m.length<.1)return;
    const first=m.points[0],last=m.points[m.points.length-1];
    c.save();
    if(p.role!=='filament'){
      c.fillStyle=gradient(c,first,last,hex);c.globalAlpha=alpha*.07;c.fill(ribbon(m,2.8));c.globalAlpha=alpha*.15;c.fill(ribbon(m,1.65));
    }
    c.globalAlpha=alpha;c.fillStyle=gradient(c,first,last,hex);c.fill(ribbon(m,1));
    c.fillStyle=gradient(c,first,last,'#fffefa',true);c.globalAlpha=alpha*(reduced?.7:.88+.12*Math.sin(p.age*12+p.glint));c.fill(ribbon(m,p.coreFraction));
    if(p.role==='comet'){
      const size=p.beamWidth*4;c.globalAlpha=alpha*.45;c.drawImage(glow,p.x-size/2,p.y-size/2,size,size);
    }
    c.restore();sparkle(c,p,hex,alpha,reduced);
  }
  return{profile,visibility,weight,mesh,draw};
});
