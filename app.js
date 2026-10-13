import { Background } from './background.js?v=2.0-20261006';
import { LetterMotion, connectPaths } from './motion.js?v=2.0-20261006';
import { canSaveArtwork, saveArtwork, savedLabel } from './platforms/web.js?v=2.0-20261006';
const $ = id => document.getElementById(id);
const W = 900, H = 1200, PAPER = '#f8f5ef';
const FONT = '"Songti SC", "STSong", "Noto Serif CJK SC", SimSun, serif';
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const mix = (a, b, t) => a + (b - a) * t;
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
    // Keep the original pink/purple/blue/yellow hues and lightness;
    // increase saturation for a brighter cake on the gold-foil paper.
    palettes: { light: ['#fe8f9f', '#c2a6f0', '#88bbf9', '#ffc76d', '#34312e'], dark: ['#ffb4c0', '#ddd0f2', '#b6d5fb', '#ffda94', '#f4efe6'] }
  }
};

export class RoseStudio {
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
    let svgText;
    if (source) svgText = source.innerHTML; // 小工具离线包:路径内联在入口页
    else {
      const response = await fetch(config.file);
      if (!response.ok) throw new Error(`${config.name}路径未能加载，请刷新页面重试。`);
      svgText = await response.text();
    }
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
export const studio = new RoseStudio();
