(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./comet-trails.js'));
  else root.CometFireworks = factory(root.CometTrails);
})(typeof window !== 'undefined' ? window : this, function(Trails) {
  'use strict';
  var TAU = Math.PI * 2, DT = 1 / 60;
  var PALETTE = ['#f5b2a9', '#fbd2a1', '#fff3ae', '#d0e5ae', '#b2d7ed', '#dec5e7'];
  function clamp(n) { return Math.max(0, Math.min(1, n)); }
  function smooth(n) { n = clamp(n); return n * n * (3 - 2 * n); }
  function random(seed) {
    return function() {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function positive(n, fallback, name) {
    if (n == null) return fallback;
    if (!Number.isFinite(n) || n <= 0) throw new TypeError(name + ' must be positive and finite');
    return n;
  }
  function point(p, fallback) {
    p = p == null ? fallback : p;
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) throw new TypeError('Point requires finite x and y');
    return {x: p.x, y: p.y};
  }
  function rgba(hex, a) { return 'rgba(' + [1, 3, 5].map(function(i) { return parseInt(hex.slice(i, i + 2), 16); }).join(',') + ',' + a + ')'; }
  function create(input) {
    if (!Trails) throw new Error('Load comet-trails.js before comet-fireworks.js');
    input = input || {};
    var width = positive(input.width, 810, 'width'), height = positive(input.height, 1080, 'height');
    var scale = positive(input.scale, 1, 'scale'), timeScale = positive(input.timeScale, 1, 'timeScale');
    var count = input.count == null ? 246 : input.count;
    if (!Number.isInteger(count) || count < 1 || count > 2000) throw new RangeError('count must be an integer from 1 to 2000');
    var palette = (input.palette || PALETTE).slice();
    if (!palette.length || !palette.every(function(s) { return /^#[0-9a-f]{6}$/i.test(s); })) throw new TypeError('palette requires #rrggbb colors');
    var origin = point(input.origin, {x: width / 2, y: height * 185 / 1080});
    var launchFrom = input.launchFrom == null ? null : point(input.launchFrom);
    var fadeY = input.fadeY == null ? height * 518 / 1080 : input.fadeY;
    if (!Number.isFinite(fadeY)) throw new TypeError('fadeY must be finite');
    var reduced = Boolean(input.reducedMotion), seed = input.seed == null ? 0 : input.seed;
    if (!Number.isFinite(seed)) throw new TypeError('seed must be finite');
    var particles, plan, time, accumulator, paused, destroyed = false;
    var sprites = null, spriteDocument = null, rocketTrail;
    var launchDuration = launchFrom ? 1.6 : 0;

    // Read-only free-flight projection estimates visible colored ribbon area.
    function visibleMass(p) {
      var x = origin.x, y = origin.y, vx = p.initialVx, vy = p.initialVy, age = 0, mass = 0;
      var points = [{x: x, y: y, t: 0}], drag = Math.exp(-DT * .27);
      for (var i = 1; i <= 93; i++) {
        if (i * DT + 1e-9 < p.launchDelay) continue;
        age += DT; vx *= drag; vy = vy * drag + 72 * scale * DT; x += vx * DT; y += vy * DT;
        points.push({x: x, y: y, t: age});
        if (i !== 33 && i !== 63 && i !== 93) continue;
        var tail = points.filter(function(q) { return age - q.t < p.tailDuration; });
        for (var j = 1; j < tail.length; j++) {
          var a = tail[j - 1], b = tail[j], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
          if (mx >= 0 && mx <= width && my >= 0 && my <= height) mass += Math.hypot(b.x - a.x, b.y - a.y) * Trails.weight(p, j / (tail.length - 1), age);
        }
      }
      return Math.max(1, mass);
    }
    function balance(rnd) {
      var n = palette.length, counts = Array(n).fill(0), masses = Array(n).fill(0);
      var sectors = Array.from({length: n}, function() { return Array(12).fill(0); });
      var offset = Math.floor(rnd() * n);
      var caps = Array.from({length: n}, function(_, c) { return Math.floor(count / n) + (((c - offset + n) % n) < count % n ? 1 : 0); });
      particles.forEach(function(p) {
        p.visualMass = visibleMass(p);
        p.sector = Math.floor((Math.atan2(p.initialVy, p.initialVx) + Math.PI) / TAU * 12) % 12;
      });
      var target = particles.reduce(function(s, p) { return s + p.visualMass; }, 0) / n;
      var sorted = particles.slice().sort(function(a, b) { return b.visualMass - a.visualMass; });
      sorted.forEach(function(p) {
        var selected = -1, cost = Infinity;
        for (var c = 0; c < n; c++) if (counts[c] < caps[c]) {
          var score = masses[c] / target + sectors[c][p.sector] * .055;
          if (score < cost) { cost = score; selected = c; }
        }
        p.color = selected; counts[selected]++; masses[selected] += p.visualMass; sectors[selected][p.sector]++;
      });
      for (var iteration = 0; iteration < 8; iteration++) {
        var best = null, changeBest = -1e-8;
        for (var i = 0; i < sorted.length; i++) for (var j = i + 1; j < sorted.length; j++) {
          var a = sorted[i], b = sorted[j], c = a.color, d = b.color;
          if (c === d) continue;
          var delta = b.visualMass - a.visualMass, mc = masses[c] / target, md = masses[d] / target;
          var change = Math.pow(mc + delta / target - 1, 2) + Math.pow(md - delta / target - 1, 2) - Math.pow(mc - 1, 2) - Math.pow(md - 1, 2);
          if (a.sector !== b.sector) change += .0003 * (-2 * sectors[c][a.sector] + 2 * sectors[c][b.sector] + 2 * sectors[d][a.sector] - 2 * sectors[d][b.sector] + 4);
          if (change < changeBest) { changeBest = change; best = {a: a, b: b, c: c, d: d, delta: delta}; }
        }
        if (!best) break;
        masses[best.c] += best.delta; masses[best.d] -= best.delta;
        sectors[best.c][best.a.sector]--; sectors[best.c][best.b.sector]++;
        sectors[best.d][best.b.sector]--; sectors[best.d][best.a.sector]++;
        best.a.color = best.d; best.b.color = best.c;
      }
      plan = {counts: counts, visibleFractions: masses.map(function(m) { return m / (target * n); }), angularCounts: sectors,
        cometCounts: palette.map(function(_, c) { return particles.filter(function(p) { return p.color === c && p.role === 'comet'; }).length; }),
        launchWindow: Math.max.apply(null, particles.map(function(p) { return p.launchDelay; }))};
    }
    function replay(nextSeed) {
      if (destroyed) throw new Error('Instance destroyed');
      if (nextSeed != null) { if (!Number.isFinite(nextSeed)) throw new TypeError('seed must be finite'); seed = nextSeed; }
      time = 0; accumulator = 0; paused = false; particles = []; rocketTrail = [];
      var rnd = random(51947 + seed * 1549);
      for (var i = 0; i < count; i++) {
        var angle = i / count * TAU + (rnd() - .5) * .1, depth = 2 * rnd() - 1, projected = Math.sqrt(1 - depth * depth);
        var speed = (i % 4 === 0 ? 52 + rnd() * 51 : 146 + rnd() * 92) * scale;
        var vx = Math.cos(angle) * speed * projected, vy = Math.sin(angle) * speed * projected;
        var p = {id: i, x: origin.x, y: origin.y, vx: vx, vy: vy, initialVx: vx, initialVy: vy, age: 0, opacity: 1, fadeAge: null,
          size: .7 + rnd() * 1.5, trail: [{x: origin.x, y: origin.y, age: 0}], tailDuration: .65 + rnd() * 1.05, dead: false, glint: rnd() * TAU};
        Object.assign(p, Trails.profile(i, seed), {started: false}); p.beamWidth *= scale; particles.push(p);
      }
      balance(rnd);
      return snapshot();
    }
    function rocket() {
      if (!launchFrom) return null;
      var t = clamp(time / 1.6), e = 1 - Math.pow(1 - t, 1.12), s = smooth(t);
      return {x: launchFrom.x + (origin.x - launchFrom.x) * s, y: launchFrom.y + (origin.y - launchFrom.y) * e};
    }
    function tick() {
      time += DT;
      if (time < launchDuration - 1e-9) {
        rocketTrail.forEach(function(q) { q.age += DT; }); rocketTrail = rocketTrail.filter(function(q) { return q.age < .55; });
        var r = rocket(); rocketTrail.push({x: r.x, y: r.y, age: 0}); return;
      }
      var age = time - launchDuration, drag = Math.exp(-DT * .27);
      particles.forEach(function(p) {
        if (age + 1e-9 < p.launchDelay) return;
        p.started = true; p.age += DT; p.vx *= drag; p.vy = p.vy * drag + 72 * scale * DT; p.x += p.vx * DT; p.y += p.vy * DT;
        if (p.vy > 0 && p.y >= fadeY && p.fadeAge === null) p.fadeAge = p.age;
        if (p.fadeAge !== null) p.opacity = 1 - smooth((p.age - p.fadeAge) / 1.05);
        p.trail.forEach(function(q) { q.age += DT; }); p.trail = p.trail.filter(function(q) { return q.age < p.tailDuration; }); p.trail.push({x: p.x, y: p.y, age: 0});
        if (p.opacity === 0 || p.y > height - 30 * scale || p.x < -220 * scale || p.x > width + 220 * scale || p.age > 11) p.dead = true;
      });
      particles = particles.filter(function(p) { return !p.dead; });
    }
    function advance(seconds) {
      if (!Number.isFinite(seconds) || seconds < 0) throw new TypeError('advance requires finite nonnegative seconds');
      if (destroyed || paused || !particles.length) return snapshot();
      accumulator += seconds * timeScale;
      while (accumulator + 1e-10 >= DT) {
        accumulator -= DT; if (accumulator < 0) accumulator = 0; tick();
        if (!particles.length) { accumulator = 0; break; }
      }
      return snapshot();
    }
    function snapshot() {
      return {seed: seed, time: time, explosionAge: time - launchDuration, phase: destroyed ? 'destroyed' : time < launchDuration - 1e-9 ? 'launch' : particles.length ? 'burst' : 'complete',
        paused: paused, active: particles.filter(function(p) { return p.started; }).length, pending: particles.filter(function(p) { return !p.started; }).length, count: count, reducedMotion: reduced};
    }
    function glow(doc, hex) {
      var a = doc.createElement('canvas'); a.width = a.height = 64;
      var c = a.getContext('2d'), g = c.createRadialGradient(32, 32, 0, 32, 32, 31);
      g.addColorStop(0, 'rgba(255,255,255,.9804)'); g.addColorStop(.075, 'rgba(255,255,255,.8039)');
      g.addColorStop(.23, rgba(hex, .6)); g.addColorStop(.6, rgba(hex, .13)); g.addColorStop(1, rgba(hex, 0));
      c.fillStyle = g; c.fillRect(0, 0, 64, 64); return a;
    }
    function star(c, x, y, r) {
      c.save(); c.translate(x, y); c.beginPath(); c.moveTo(0, -r);
      c.quadraticCurveTo(r * .15, -r * .16, r * .57, 0); c.quadraticCurveTo(r * .13, r * .12, 0, r);
      c.quadraticCurveTo(-r * .13, r * .12, -r * .57, 0); c.quadraticCurveTo(-r * .15, -r * .16, 0, -r);
      c.fillStyle = '#fffefa'; c.fill(); c.restore();
    }
    function draw(c) {
      if (destroyed || !particles.length) return;
      var doc = c.canvas.ownerDocument;
      if (!sprites || spriteDocument !== doc) { sprites = palette.map(function(hex) { return glow(doc, hex); }); sprites.push(glow(doc, '#c7e6ff')); spriteDocument = doc; }
      c.save();
      try {
        if (time < launchDuration - 1e-9) {
          var r = rocket(); rocketTrail.forEach(function(q) {
            c.globalAlpha = clamp(1 - q.age / .55) * .65; c.fillStyle = '#fffce8'; c.beginPath(); c.arc(q.x, q.y, 1.3 * scale, 0, TAU); c.fill();
          });
          c.globalAlpha = 1; c.drawImage(sprites[palette.length], r.x - 16 * scale, r.y - 16 * scale, 32 * scale, 32 * scale); star(c, r.x, r.y, 5.8 * scale); return;
        }
        var age = time - launchDuration;
        if (age < 2) {
          c.globalAlpha = 1 - smooth(age / 2);
          c.drawImage(sprites[palette.length], origin.x - 29 * scale, origin.y - 29 * scale, 58 * scale, 58 * scale);
          c.drawImage(sprites[Math.min(2, palette.length - 1)], origin.x - 20 * scale, origin.y - 20 * scale, 40 * scale, 40 * scale);
          c.beginPath(); c.arc(origin.x, origin.y, 3 * scale, 0, TAU); c.fillStyle = '#fffefa'; c.fill(); star(c, origin.x, origin.y, 7 * scale);
        }
        particles.forEach(function(p) { Trails.draw(c, p, palette[p.color], sprites[p.color], reduced); });
      } finally { c.restore(); }
    }
    replay(seed);
    return {advance: advance, draw: draw, replay: replay, snapshot: snapshot,
      pause: function() { paused = true; return snapshot(); }, resume: function() { paused = false; return snapshot(); },
      particles: function() { return JSON.parse(JSON.stringify(particles)); }, balance: function() { return JSON.parse(JSON.stringify(plan)); },
      destroy: function() { destroyed = true; particles = []; rocketTrail = []; sprites = null; spriteDocument = null; },
      palette: palette.slice()};
  }
  return {create: create, palette: PALETTE.slice(), version: '1.0.0'};
});
