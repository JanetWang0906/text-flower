/* SVG-shaped text bursts. Shared by web and the offline mini-tool.
   Reuses comet timing profiles and the host collision/support/letter flow. */
(function (root) {
  'use strict';
  const DT = 1 / 60;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const mix = (a, b, t) => a + (b - a) * t;
  const ease = t => { t = clamp(t); return t * t * (3 - 2 * t); };
  const copy = value => JSON.parse(JSON.stringify(value));
  const sessionSeed = Math.floor(Math.random() * 2147483647);
  function curvePoint(ray, s) {
    const points = ray.points; s = clamp(s, 0, ray.length);
    let a = 0, b = points.length - 1;
    while (b - a > 1) { const m = (a + b) >> 1; if (points[m].s < s) a = m; else b = m; }
    const p = points[a], q = points[b], t = (s - p.s) / (q.s - p.s || 1);
    return { x: mix(p.x, q.x, t), y: mix(p.y, q.y, t), angle: Math.atan2(q.y - p.y, q.x - p.x) };
  }
  function adapt(LetterMotion) {
    return class FireworkMotion extends LetterMotion {
      constructor(path, sources, size, letterSize) {
        super(path, sources, size, letterSize, false);
        this.fireworkReady = true; this.independent = true; this.procedural = true;
        this.phase = 'burst'; this.front = 0; this.cursor = 0;
        this.beams = []; this.bursts = []; this.pendingBursts = []; this.lastReadyBurst = -1; this.accumulator = 0; this.physicsTime = 0;
        this.nextBurstAt = 0; this.autoContinue = false; this.seed = sessionSeed; this.randomState = sessionSeed;
        this.geometry = root.TextShapes.fireworkGeometry();
        this.groupSize = Math.ceil(sources.length / Math.ceil(sources.length / 180));
        this.palette = ['#f7d878', '#ec78a2', '#92cdf0'];
        this.chains.forEach(c => { c.feed = 1; c.active = true; c.rest.fill(0); });
        this.nodes.forEach(p => { p.s = 1; p.released = false; p.beam = -1; p.vx = p.vy = 0; });
        this.updateGlyphs();
      }
      get remaining() { return this.nodes.length - this.cursor; }
      get available() { return Math.max(0, this.remaining - this.pendingBursts.length * this.groupSize); }
      get burstReady() {
        const last = this.bursts.length - 1;
        return this.beams.every(beam => beam.burst !== last ||
          this.nodes.slice(beam.from, beam.end + 1).every(p => p.released));
      }
      random() {
        let n = this.randomState = (this.randomState + 0x6D2B79F5) | 0;
        n = Math.imul(n ^ n >>> 15, 1 | n); n ^= n + Math.imul(n ^ n >>> 7, 61 | n);
        return ((n ^ n >>> 14) >>> 0) / 4294967296;
      }
      randomOrigin() {
        const bounds = this.geometry.bounds, padding = this.size * .7 + 24;
        const minX = padding - bounds.left, maxX = 900 - padding - bounds.right;
        const minY = Math.max(250, 55 + this.size * .7 - bounds.top), maxY = 700;
        let point;
        for (let attempt = 0; attempt < 8; attempt++) {
          point = { x: mix(minX, maxX, this.random()), y: mix(minY, maxY, this.random()) };
          if (this.bursts.slice(-2).every(b => Math.hypot(b.x - point.x, b.y - point.y) > 235)) break;
        }
        return point;
      }
      burst(point) {
        if (!this.available || this.phase !== 'burst') return false;
        const origin = { x: clamp(point.x, 0, 900), y: clamp(point.y, 0, 1170) };
        if (this.burstReady && !this.pendingBursts.length) return this.emitBurst(origin);
        // Preserve the location of a quick second tap, but never start a
        // second bloom while the previous one is still opening.
        this.pendingBursts.push(origin); return true;
      }
      emitBurst(point) {
        if (!this.remaining || this.phase !== 'burst') return false;
        const origin = { x: clamp(point.x, 0, 900), y: clamp(point.y, 0, 1170) };
        const from = this.cursor, count = Math.min(this.remaining, this.groupSize);
        const burstSeed = Math.floor(this.random() * 1000000);
        const countBeams = Math.min(this.geometry.rays.length, count);
        const rays = Array.from({ length: countBeams }, (_, i) => Math.floor(i * this.geometry.rays.length / countBeams));
        const burstIndex = this.bursts.length;
        this.bursts.push({ x: origin.x, y: origin.y, at: this.physicsTime, count, seed: burstSeed, diameter: this.geometry.diameter });
        let offset = 0;
        rays.forEach((rayIndex, i) => {
          const ray = this.geometry.rays[rayIndex];
          const n = Math.floor(count / countBeams) + (i < count % countBeams ? 1 : 0);
          const beamIndex = this.beams.length, profile = root.CometTrails.profile(i, burstSeed);
          const beam = { originX: origin.x, originY: origin.y, rayIndex, gravity: 160,
            role: profile.role, brightness: profile.brightness,
            delay: profile.launchDelay, born: this.physicsTime, age: 0, started: false, color: ray.color,
            burst: burstIndex, from: from + offset, end: from + offset + n - 1, headS: 0, speed: 240 };
          this.beams.push(beam);
          let material = 0;
          for (let j = 0; j < n; j++) {
            const index = from + offset + j, p = this.nodes[index], g = this.originals[index];
            if (j) material += (this.originals[index - 1].w + g.w) / 2 + this.size * .09;
            p.beam = beamIndex; p.pathS = -1; p.trailU = material;
            p.x = p.px = origin.x; p.y = p.py = origin.y; p.gravity = beam.gravity;
            g.color = beam.color;
          }
          // The bright head belongs to the moving text trail, including at
          // birth near the center. Its style never depends on SVG distance.
          for (let j = 0; j < n; j++) {
            const index = from + offset + j, p = this.nodes[index];
            p.trailU = material ? p.trailU / material : 1;
            p.radius = Math.max(this.size, this.originals[index].w) * this.trailStyle(p).scale / 2;
          }
          offset += n;
        });
        this.cursor += count; this.nextBurstAt = this.physicsTime;
        this.updateGlyphs(); return true;
      }
      save() {
        return Object.assign(super.save(), { firework: copy({ beams: this.beams, bursts: this.bursts, pendingBursts: this.pendingBursts, lastReadyBurst: this.lastReadyBurst, cursor: this.cursor,
          accumulator: this.accumulator, physicsTime: this.physicsTime, nextBurstAt: this.nextBurstAt,
          autoContinue: this.autoContinue, seed: this.seed, randomState: this.randomState, steps: this.steps }) });
      }
      restore(state) {
        Object.assign(this, copy(state.firework)); this.supportCache = null;
        super.restore(state);
        this.originals.forEach((g, i) => { const p = this.nodes[i]; if (p.beam >= 0) g.color = this.beams[p.beam].color; });
        this.updateGlyphs();
      }
      step(dt, automatic = true) {
        if (['order', 'scale', 'complete'].includes(this.phase)) { super.step(dt, automatic); return; }
        this.time += dt; this.accumulator += dt;
        while (this.accumulator + 1e-10 >= DT) {
          this.accumulator = Math.max(0, this.accumulator - DT);
          this.physicsTick(automatic || this.autoContinue);
          if (this.phase === 'order') { this.accumulator = 0; break; }
        }
        this.updateGlyphs();
      }
      physicsTick(automatic) {
        this.physicsTime += DT;
        if (this.remaining && this.burstReady && this.physicsTime >= this.nextBurstAt) {
          if (this.pendingBursts.length) this.emitBurst(this.pendingBursts.shift());
          else if (automatic) this.emitBurst(this.randomOrigin());
        }
        const drag = Math.exp(-.27 * DT);
        this.beams.forEach(beam => {
          if (this.physicsTime - beam.born + 1e-9 < beam.delay) return;
          if (this.nodes.slice(beam.from, beam.end + 1).every(p => p.released)) return;
          beam.started = true; beam.age += DT;
          // Continuous outward travel: fast opening that gradually slows,
          // with no fixed-pose hold between formation and the falling exit.
          beam.headS = 170 / .8 * (1 - Math.exp(-.8 * beam.age)) + 70 * beam.age;
          beam.speed = 170 * Math.exp(-.8 * beam.age) + 70;
          let previousS = beam.headS, previousWidth = 0, previousScale = 1;
          for (let i = beam.end; i >= beam.from; i--) {
            const p = this.nodes[i], g = this.originals[i];
            const scale = this.trailStyle(p).scale;
            let position = previousS;
            if (i < beam.end) {
              // Use normal paragraph advances in each glyph's trail size.
              position -= (previousWidth * previousScale + g.w * scale) / 2
                + this.size * .09 * (previousScale + scale) / 2;
            }
            previousS = position; previousWidth = g.w; previousScale = scale;
            if (!p.released) { p.previousPathS = p.pathS; p.pathS = position; }
          }
        });
        this.nodes.forEach(p => {
          if (p.beam < 0) return;
          const beam = this.beams[p.beam]; if (!beam.started) return;
          let flightDt = DT;
          if (!p.released) {
            const ray = this.geometry.rays[beam.rayIndex];
            if (p.pathS < 0) return;
            const point = curvePoint(ray, p.pathS);
            p.x = p.px = beam.originX + point.x; p.y = p.py = beam.originY + point.y;
            if (p.pathS < ray.length && p.y < 1170 - p.radius) return;
            if (p.pathS >= ray.length) flightDt *= clamp((p.pathS - ray.length) / (p.pathS - p.previousPathS || 1));
            p.released = true; p.s = 0; p.vx = Math.cos(point.angle) * beam.speed;
            p.vy = Math.sin(point.angle) * beam.speed; p.age = 0;
            const style = this.trailStyle(p); p.releaseScale = style.scale; p.releaseAlpha = style.alpha; p.releaseAngle = point.angle;
          }
          p.age += flightDt; p.px = p.x; p.py = p.y;
          const flightDrag = flightDt === DT ? drag : Math.exp(-.27 * flightDt);
          p.vx *= flightDrag; p.vy = p.vy * flightDrag + p.gravity * flightDt;
          p.x += p.vx * flightDt; p.y += p.vy * flightDt;
        });
        this.contacts();
        this.markGroundContacts();
        this.front = this.nodes.filter(p => p.released).length; this.steps++;
        if (this.bursts.length && this.burstReady && this.lastReadyBurst !== this.bursts.length - 1) {
          this.lastReadyBurst = this.bursts.length - 1;
          this.nextBurstAt = this.physicsTime + .25 + this.random() * .4;
        }
        if (this.front === this.nodes.length) {
          this.phase = 'settle';
          if (!this.supportCache || this.steps - this.supportCache.at >= 5)
            this.supportCache = { value: this.supported(), at: this.steps };
          const grounded = this.supportCache.value && this.nodes.every(p => Math.hypot(p.x - p.px, p.y - p.py) < .7);
          this.phaseTime = grounded ? this.phaseTime + DT : 0;
          if (this.phaseTime >= .35 && this.nodes.every(p => p.landedAt !== undefined && this.physicsTime - p.landedAt >= .55)) {
            this.updateGlyphs(); this.origins = this.originals.map(g => ({ x: g.x, y: g.y, angle: g.angle, scale: g.scale, alpha: g.alpha }));
            this.phase = 'order'; this.phaseTime = 0;
          }
        }
      }
      contacts() {
        // Airborne embers pass independently. Resolving their overlaps in
        // the sky injected large impulses into the upper rays at release.
        this.nodes.forEach(p => {
          if (!p.released) return;
          p.x = clamp(p.x, 30 + p.radius, 870 - p.radius); p.y = Math.min(p.y, 1180 - p.radius);
        });
        const grounded = this.groundContactNodes();
        this.nodes.forEach((p, i) => { p.s = grounded.has(i) ? 0 : 1; });
        // Reuse the host collision grid for actual ground/pile contacts.
        for (let pass = 0; grounded.size && pass < 6; pass++) {
          this.collide();
          for (let i = 1; i < this.nodes.length; i++) {
            const a = this.nodes[i - 1], b = this.nodes[i]; if (!grounded.has(i - 1) || !grounded.has(i) || a.chain !== b.chain) continue;
            let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
            if (d >= a.radius + b.radius) continue;
            if (d < .001) { dx = i % 2 ? .001 : -.001; dy = -.001; d = Math.hypot(dx, dy); }
            const push = Math.min(2, (a.radius + b.radius - d) / 2) / d;
            a.x -= dx * push; a.y -= dy * push; b.x += dx * push; b.y += dy * push;
          }
          this.nodes.forEach(p => {
            if (!p.released) return;
            p.x = clamp(p.x, 30 + p.radius, 870 - p.radius); p.y = Math.min(p.y, 1180 - p.radius);
          });
        }
        this.nodes.forEach(p => { if (p.released) p.s = 0; });
        this.nodes.forEach((p, i) => {
          if (!p.released || !grounded.has(i)) return;
          const vx = (p.x - p.px) / DT, vy = (p.y - p.py) / DT;
          if (Math.abs(vx - p.vx) > .01) p.vx = vx;
          if (Math.abs(vy - p.vy) > .01) p.vy = vy;
          if (p.x <= 30 + p.radius || p.x >= 870 - p.radius) p.vx = 0;
          if (p.y >= 1180 - p.radius) { p.vy = 0; p.vx *= .75; }
        });
      }
      groundContactNodes() {
        const nodes = this.nodes, cell = Math.max(64, ...nodes.map(p => p.radius * 2 + 2));
        const grid = new Map(), reached = new Set(), queue = [];
        nodes.forEach((p, i) => {
          if (!p.released) return;
          const key = Math.floor(p.x / cell) + ',' + Math.floor(p.y / cell);
          if (!grid.has(key)) grid.set(key, []); grid.get(key).push(i);
          if (p.y + p.radius >= 1179.5) { reached.add(i); queue.push(i); }
        });
        // Only actual floor contact, or contact with a pile connected to the
        // floor, starts the ink transition. Air collisions and walls do not.
        for (let q = 0; q < queue.length; q++) {
          const a = nodes[queue[q]], cx = Math.floor(a.x / cell), cy = Math.floor(a.y / cell);
          for (let x = cx - 1; x <= cx + 1; x++) for (let y = cy - 1; y <= cy + 1; y++) {
            for (const i of grid.get(x + ',' + y) || []) {
              if (reached.has(i)) continue;
              const b = nodes[i];
              if (Math.hypot(a.x - b.x, a.y - b.y) <= a.radius + b.radius + 1.5) { reached.add(i); queue.push(i); }
            }
          }
        }
        return reached;
      }
      markGroundContacts() {
        for (const i of this.groundContactNodes()) if (this.nodes[i].landedAt === undefined) this.nodes[i].landedAt = this.physicsTime;
      }
      trailStyle(p) {
        const u = p.trailU;
        return { scale: .24 + .8 * Math.pow(u, .7), alpha: .45 + .55 * Math.pow(u, .85) };
      }
      updateGlyphs() {
        if (!this.fireworkReady) { super.updateGlyphs(); return; }
        if (['order', 'scale', 'complete'].includes(this.phase)) {
          super.updateGlyphs();
          const u = this.phase === 'order' ? ease(this.phaseTime / 1.8) : 1;
          this.originals.forEach((g, i) => {
            const origin = this.origins && this.origins[i];
            g.scale += ((origin && origin.scale !== undefined ? origin.scale : 1) - 1) * (1 - u);
            g.alpha = mix(origin && origin.alpha !== undefined ? origin.alpha : 1, 1, u); g.glow = 0;
          });
          return;
        }
        this.originals.forEach((g, i) => {
          const p = this.nodes[i]; g.glow = 0;
          if (p.beam < 0 || !this.beams[p.beam].started || (!p.released && p.pathS < 0)) { g.alpha = 0; g.state = 'waiting'; return; }
          const beam = this.beams[p.beam];
          g.x = p.x; g.y = p.y;
          if (p.released) {
            g.angle = p.releaseAngle * (1 - ease(p.age / .8));
            g.scale = p.releaseScale; g.alpha = p.releaseAlpha;
            g.blend = p.landedAt === undefined ? 1 : 1 - ease((this.physicsTime - p.landedAt) / .55);
            g.state = p.landedAt === undefined ? 'falling' : 'landed';
          } else {
            const style = this.trailStyle(p), point = curvePoint(this.geometry.rays[beam.rayIndex], p.pathS);
            g.angle = point.angle; g.scale = style.scale; g.alpha = style.alpha; g.blend = 1; g.state = 'burst';
            if (i === beam.end && beam.role === 'comet') g.glow = 2;
          }
        });
      }
      ui(studio) {
        const $ = id => document.getElementById(id), manual = studio.mode === 'manual';
        $('play-label').textContent = studio.status === 'playing' ? '暂停' : studio.status === 'paused' ? '继续' : studio.status === 'complete' ? '再放一次' : manual ? '自动放完' : '绽放';
        $('mode-hint').textContent = manual ? '点哪里，就从哪里绽放一朵文字烟花。上一朵回落后，继续点下一个位置，直到放完这封信。' : '每次绽放一朵，上一朵回落后，再在另一个随机位置接着盛开。也可以亲手点击选择爆心。';
        if (studio.status === 'complete') return studio.shapeConfig.complete;
        if (studio.status === 'paused') return '已暂停 · 等你继续';
        if (this.phase === 'order' || this.phase === 'scale') return '把落下的字句，整理成写给你的信';
        if (this.phase === 'settle') return '等每一个字轻轻落地';
        if (manual && !this.bursts.length) return '点哪里，就从哪里开出一朵文字烟花';
        if (manual && this.pendingBursts.length) return '等这一朵回落，再从你点的位置接着绽放';
        if (!this.remaining) return '烟花都已绽放，等字句轻轻落地';
        if (manual) return this.burstReady ? '还有心愿没放完，再点一个位置继续' : '这一朵正在绽放，回落后再点下一朵';
        return '让心愿，在夜空里一朵朵绽放';
      }
    };
  }
  root.TextFirework = { adapt };
}(window));
