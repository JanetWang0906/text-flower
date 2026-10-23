import { Background } from './background.js?v=web-language-20261023-r1';
import { LetterMotion, connectPaths } from './motion.js?v=firework-visible-tail-20261022-r7';
import { canSaveArtwork, saveArtwork, savedLabel } from './platforms/web.js?v=web-video-20261023-r1';
import { WebVideoExport } from './video-export.js?v=web-language-20261023-r1';
const { t } = window.WebI18n;
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

const { SHAPES, samplePaths, shapeGuidePosition } = window.TextShapes;
const { releaseAction } = window.TextInteraction;
const FireworkMotion = window.TextFirework.adapt(LetterMotion);

export class RoseStudio {
  constructor() {
    this.canvas = $('canvas'); this.ctx = this.canvas.getContext('2d');
    this.speed = 2; this.introSpeed = 1; this.mode = 'auto'; this.status = 'loading'; this.elapsed = 0; this.size = 20; this.paragraphSize = 28;
    this.shape = 'rose'; this.shapeConfig = SHAPES.rose; this.pathCache = {};
    this.shapePalettes = {};
    Object.keys(SHAPES).forEach(key => { this.shapePalettes[key] = { light: SHAPES[key].palettes.light.slice(), dark: SHAPES[key].palettes.dark.slice() }; });
    this.introEnabled = !!$('bloom'); this.maxSpacing = this.introEnabled ? 1.6 : 1.25;
    this.paletteMode = 'light'; this.palettes = this.shapePalettes.rose; this.colors = this.palettes.light.slice(0,-1); this.ink = '#34312e'; this.text = $('message').value;
    this.defaultTexts = window.WebI18n.defaults[window.WebI18n.language]; this.shapeBackgrounds = {};
    this.importedGift = false;
    this.sources = []; this.chains = []; this.paths = []; this.drag = null; this.returning = false;
    this.accumulator = 0; this.previousFrame = 0; this.lastUI = '';
    this.defaultFootnote = document.querySelector('.footnote').textContent;
    this.updateShapeControls(); this.bind();
    this.background = new Background(() => this.draw(), (mode, fromPicker) => {
      // Explicit light-paper selection resets configured shape colors; restoring a
      // shape's saved paper must keep that shape's customized palette.
      if (this.shapeConfig.paletteBackgrounds && mode === 'light' && fromPicker) {
        const count = this.shapeConfig.parts.length;
        this.palettes.light.splice(0, count, ...this.shapeConfig.palettes.light.slice(0, count));
        this.setPalette('light');
      } else if (this.paletteMode !== mode) this.setPalette(mode);
    });
    if (typeof ResizeObserver === 'function') {
      this.resizeObserver = new ResizeObserver(() => {
        // Changing the canvas buffer can also change its intrinsic height.
        // Resize on the next frame to keep that update outside observer delivery.
        if (this.resizeFrame) return;
        this.resizeFrame = requestAnimationFrame(() => { this.resizeFrame = 0; this.resize(); });
      });
      this.resizeObserver.observe(this.canvas);
    } else { window.addEventListener('resize', () => this.resize()); }
    this.ready = this.initialize();
  }
  async loadPaths(shape) {
    const config = SHAPES[shape], source = document.getElementById(shape + '-source');
    if (config.procedural) return samplePaths(null, config).map(makeTable);
    let svgText = config.svg || (source && source.innerHTML);
    if (!svgText) {
      const response = await fetch(config.file);
      if (!response.ok) throw new Error(t(`${config.name}路径未能加载，请刷新页面重试。`));
      svgText = await response.text();
    }
    return samplePaths(svgText, config).map(makeTable);
  }
  async initialize() {
    try {
      const keys = Object.keys(SHAPES), paths = await Promise.all(keys.map(key => this.loadPaths(key)));
      keys.forEach((key, i) => { this.pathCache[key] = paths[i]; });
      this.paths = this.pathCache[this.shape]; this.ropePath = connectPaths(this.paths, this.shapeConfig.order);
      const defaults = await Promise.all([document.fonts.ready, this.background.ready, this.background.preload(SHAPES.cake.defaultBackground), this.background.preload('IMG_0003.jpg'), this.background.preload('IMG_0045.JPG')]);
      this.shapeBackgrounds.rose = { state: this.background.current, palette: this.paletteMode };
      this.shapeBackgrounds.cake = { state: { image: defaults[2], name: SHAPES.cake.defaultBackground, zoom: 1, x: .5, y: .5 }, palette: 'dark' };
      this.shapeBackgrounds.gift = { state: { image: defaults[2], name: SHAPES.gift.defaultBackground, zoom: 1, x: .5, y: .5 }, palette: 'dark' };
      this.shapeBackgrounds.firework = { state: { image: defaults[2], name: SHAPES.firework.defaultBackground, zoom: 1, x: .5, y: .5 }, palette: 'dark' };
      if (!this.apply(this.text, this.size, this.paragraphSize, false, window.WebI18n.language === 'en', this.hasIntro())) throw new Error(t($('input-error').textContent));
      $('loading').hidden = true; $('play').disabled = false; if ($('bloom')) $('bloom').disabled = false; $('reset').disabled = false;
      if ($('save-image')) $('save-image').disabled = false;
      document.querySelectorAll('input[name=shape]').forEach(input => { input.disabled = false; });
      this.resize();
      requestAnimationFrame(t => this.frame(t));
    } catch (error) {
      this.status = 'error'; $('loading').textContent = t(error.message);
      $('input-error').textContent = t(error.message); console.error(error);
    }
  }
  hasIntro() { return this.introEnabled || !!this.shapeConfig.intro; }
  updateShapeControls() {
    const config = this.shapeConfig;
    document.querySelectorAll('input[name=shape]').forEach(input => { input.checked = input.value === this.shape; });
    document.querySelector('label[for="font-size"]').textContent = t(config.name + '字号');
    const setting = document.querySelector('.color-setting');
    setting.dataset.shape = this.shape;
    setting.querySelector('legend').textContent = t(config.colorLabel);
    const row = setting.querySelector('.color-row'); row.textContent = t('');
    config.parts.forEach((part, i) => {
      const label = document.createElement('label'); label.className = 'color-control';
      const input = document.createElement('input'); input.type = 'color'; input.id = part.id + '-color'; input.value = this.colors[i]; input.dataset.pathColor = i;
      const name = document.createElement('span'); name.textContent = t(part.label);
      const output = document.createElement('output'); output.id = part.id + '-hex'; output.textContent = t(this.colors[i].toUpperCase());
      label.append(input, name, output); row.append(label);
    });
    this.canvas.setAttribute('aria-label', t(config.canvasLabel || `文字${config.name}动画。拖动${config.grip}圆圈牵引文字绳，松手后沿路径滑出并自然下落，全部落地后整理成信。`));
    document.querySelector('.workspace').setAttribute('aria-label', t(`文字${config.name}预览`));
    $('reset').setAttribute('aria-label', t('回到' + config.name)); $('reset').title = t('回到' + config.name);
    if ($('bloom')) {
      const action = this.shape === 'rose' ? '生花' : this.shape === 'firework' ? '重放' : '成形';
      $('bloom').lastElementChild.textContent = t(action); $('bloom').setAttribute('aria-label', t('生成文字' + config.name));
      $('intro-speed').textContent = t(`${action} ${this.introSpeed}×`); $('intro-speed').setAttribute('aria-label', t(`${action}速度 ${this.introSpeed} 倍，点击切换`)); $('intro-speed').title = t(`切换${action}速度`);
    }
    $('speed').textContent = t(`展开 ${this.speed}×`);
    document.querySelector('[name=mode][value=manual]').setAttribute('aria-label', t(config.motion === 'firework' ? '手动点击绽放' : '手动牵引文字'));
    document.querySelector('.footnote').textContent = t(config.footnote || this.defaultFootnote);
    $('intro-speed').hidden = !!config.procedural;
    document.title = t('字里花间 · ' + config.idle);
  }
  selectShape(shape) {
    if (shape === this.shape || !this.pathCache[shape]) return false;
    const previous = { shape: this.shape, shapeConfig: this.shapeConfig, paths: this.paths, ropePath: this.ropePath, palettes: this.palettes, colors: this.colors, ink: this.ink };
    const nextText = !this.importedGift && this.text === this.defaultTexts[this.shape] ? this.defaultTexts[shape] : this.text;
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
  giftSettings() {
    const background = this.background.current;
    const paper = window.GiftCodec.PAPERS.indexOf(background && (background.selection || background.name));
    if (paper < 0) throw new Error(t('当前使用了自定义背景照片，单张二维码无法完整保存照片。请先选择一种内置信纸，再保存分享二维码。'));
    return window.GiftCodec.validate({ v: 1, s: window.GiftCodec.SHAPES.indexOf(this.shape), t: this.text, c: this.colors.slice(), i: this.ink,
      p: this.paletteMode, f: this.size, l: this.paragraphSize,
      a: [this.mode === 'auto' ? 0 : 1, this.speed, this.introSpeed, this.hasIntro() ? 1 : 0],
      b: [paper, background.zoom, background.x, background.y] });
  }
  async restoreGift(data) {
    const gift = window.GiftCodec.validate(data), shape = window.GiftCodec.SHAPES[gift.s];
    const config = SHAPES[shape], paths = this.pathCache[shape];
    const ropePath = connectPaths(paths, config.order);
    // Prepare the complete new scene before touching the current work or UI.
    const candidate = Object.create(this); candidate.shapeConfig = config; candidate.ropePath = ropePath;
    const sources = candidate.layout(gift.t, gift.f, gift.l);
    const width = sources.reduce((n, g) => n + g.w + gift.f * .08, 0) - gift.f * .08;
    const ratio = config.procedural ? 1 : ropePath.length / Math.max(1, width);
    if (ratio < .95 || ratio > this.maxSpacing) throw new Error(t('这份礼物的文字无法按原字号组成完整造型，请让送礼人检查文字后重新保存二维码。'));
    const motion = new (config.motion === 'firework' ? FireworkMotion : LetterMotion)(ropePath, sources, gift.f, sources.letterSize, !!gift.a[3]);
    const name = window.GiftCodec.PAPERS[gift.b[0]], image = await this.background.preload(name);
    const background = { image, name, zoom: gift.b[1], x: gift.b[2], y: gift.b[3] };
    this.shapeBackgrounds[this.shape] = { state: this.background.current, palette: this.paletteMode };
    this.cancelCapture(); this.importedGift = true;
    this.shapePalettes[shape][gift.p] = gift.c.concat(gift.i);
    Object.assign(this, { shape, shapeConfig: config, paths, ropePath, palettes: this.shapePalettes[shape],
      paletteMode: gift.p, colors: gift.c.slice(), ink: gift.i, mode: gift.a[0] ? 'manual' : 'auto',
      speed: gift.a[1], introSpeed: gift.a[2], motion, sources, text: gift.t, size: gift.f, paragraphSize: sources.letterSize,
      elapsed: 0, status: 'idle', returning: false, returnState: null, accumulator: 0, previousFrame: 0 });
    this.chains = paths.map((path, index) => ({ index, path, glyphs: motion.originals.filter(g => motion.independent ? g.chain === index : g.color === index) }));
    $('message').value = gift.t; $('message').removeAttribute('aria-invalid');
    $('input-error').textContent = t(''); $('fit-note').textContent = t('');
    $('text-form').hidden = true; $('edit-toggle').setAttribute('aria-expanded', 'false');
    $('font-size').value = gift.f; $('font-value').textContent = t(gift.f);
    $('paragraph-size').min = Math.min(12, this.paragraphSize); $('paragraph-size').value = this.paragraphSize;
    $('paragraph-value').textContent = t(this.paragraphSize); $('paragraph-min').textContent = t(`细腻 · ${Math.min(12, this.paragraphSize)}`);
    document.querySelectorAll('input[name=mode]').forEach(input => { input.checked = input.value === this.mode; });
    $('speed').textContent = t(`展开 ${this.speed}×`); $('speed').setAttribute('aria-label', t(`展开速度 ${this.speed} 倍，点击切换`));
    this.updateShapeControls(); this.setPalette(gift.p);
    if(motion.procedural){motion.palette=this.colors.slice();if(this.mode==='auto')this.status='playing';}
    this.background.use(background, gift.p); this.shapeBackgrounds[shape] = { state: background, palette: gift.p };
    this.inputHint(); this.updateUI(); this.draw();
  }
  layout(text, roseSize, requestedSize = this.paragraphSize) {
    const chars = graphemes(text);
    if (!text.trim()) throw new Error(t('先写下一句话，再让它组成' + this.shapeConfig.name + '。'));
    if (chars.length > 2000) throw new Error(t('输入过长，请按当前建议范围精简文字。'));
    let rows, height, letterSize = requestedSize;
    // Fit the final letter, not the small temporary landing area. Explicit
    // newlines count toward height; every valid <=200-grapheme input can fit.
    for (; letterSize >= 1; letterSize--) {
      this.ctx.font = `${letterSize}px ${FONT}`;
      rows = [[]]; let width = 0;
      for (let index = 0; index < chars.length; index++) {
        const ch = chars[index];
        if (ch === '\n' || ch === '\r\n' || ch === '\r') { rows.push([]); width = 0; continue; }
        // Keep Latin words together without dropping spaces or changing the
        // underlying character sequence used by the animation and QR format.
        if (/[A-Za-z0-9]/.test(ch) && (!index || /\s/.test(chars[index - 1]))) {
          let wordWidth = 0;
          for (let next = index; next < chars.length && !/\s/.test(chars[next]); next++) wordWidth += this.ctx.measureText(chars[next]).width + letterSize * .09;
          if (wordWidth <= 600 && width + wordWidth > 600 && rows[rows.length - 1].length) { rows.push([]); width = 0; }
        }
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
    if(this.shapeConfig.procedural)return {min:1,max:2000};
    const L=(this.ropePath&&this.ropePath.length)||6000;
    return {min:Math.ceil(L/(size*1.08*this.maxSpacing)),max:Math.floor(L/(size*1.08*.95))};
  }
  inputHint(size=this.size) {
    const r=this.range(size),count=graphemes($('message').value).filter(g=>!/[\r\n]/.test(g)).length;
    $('count').textContent=t(`${count} 字素`);
    $('edit-hint').textContent=t(`${size} 号字建议约 ${r.min}–${r.max} 个中文字符；按实际字宽校验，不重复补字。`);
    if(this.shapeConfig.procedural)$('edit-hint').textContent=t('每次用一部分文字绽放烟花，可写 1–2000 个字素；文字不重复填充。');
  }
  apply(text, size, paragraphSize = this.paragraphSize, keepComplete = false, autoFit = false, intro = false) {
    try {
      const requested=size;
      const sizes=autoFit?Array.from({length:21},(_,i)=>i+12).sort((a,b)=>Math.abs(a-requested)-Math.abs(b-requested)): [size];
      let sources,ratio;
      for(const candidate of sizes){
        sources=this.layout(text,candidate,paragraphSize);
        const width=sources.reduce((n,g)=>n+g.w+candidate*.08,0)-candidate*.08;
        ratio=this.shapeConfig.procedural?1:this.ropePath.length/Math.max(1,width);
        if(ratio>=.95&&ratio<=this.maxSpacing){size=candidate;break;}
      }
      if(ratio<.95||ratio>this.maxSpacing){const lo=this.range(32).min,hi=this.range(12).max;throw new Error(t(`文字${ratio>this.maxSpacing?'太少':'太多'}，无法铺满完整${this.shapeConfig.name}。支持约 ${lo}–${hi} 个中文字符（含标点），请调整字数后再试${$('auto-fit')&&!autoFit?'，或点击「自动适配字号」':''}。`));}
      const motion=new (this.shapeConfig.motion === 'firework' ? FireworkMotion : LetterMotion)(this.ropePath,sources,size,sources.letterSize,intro);
      this.cancelCapture();this.motion=motion;this.sources=sources;this.size=size;this.paragraphSize=sources.letterSize;this.text=text;
      this.elapsed=0;this.status=keepComplete?'complete':'idle';this.returning=false;this.returnState=null;
      this.chains=this.paths.map((path,index)=>({index,path,glyphs:motion.originals.filter(g=>motion.independent?g.chain===index:g.color===index)}));
      if(keepComplete)motion.finish();
      if(motion.procedural&&!keepComplete){motion.palette=this.colors.slice();if(this.mode==='auto')this.status='playing';}
      $('input-error').textContent=t('');$('message').removeAttribute('aria-invalid');
      $('font-size').value=size;$('font-value').textContent=t(size);
      $('paragraph-size').min=Math.min(12,this.paragraphSize);$('paragraph-size').value=this.paragraphSize;$('paragraph-value').textContent=t(this.paragraphSize);
      $('paragraph-min').textContent=t(`细腻 · ${Math.min(12,this.paragraphSize)}`);
      $('fit-note').textContent=t(ratio>1.25?`文字较少，字距已自动拉开${size!==requested?`，${this.shapeConfig.name}字号适配为 ${size}`:''}。`:(size!==requested?`已适配${this.shapeConfig.name}字号为 ${size}。`:''));
      this.inputHint();this.accumulator=0;this.updateUI();this.draw();return true;
    } catch(error){$('text-form').hidden=false;$('edit-toggle').setAttribute('aria-expanded','true');$('input-error').textContent=t(error.message);$('message').setAttribute('aria-invalid','true');this.inputHint(size);return false;}
  }
  reset() { if(this.paths.length)this.apply(this.text,this.size,this.paragraphSize,false,false,this.hasIntro()); }
  updateLanguage() {
    const replaceText = !this.importedGift && this.text === this.defaultTexts[this.shape];
    const replaceDraft = $('message').value === this.text;
    this.defaultTexts = window.WebI18n.defaults[window.WebI18n.language];
    if (replaceText) {
      const next = this.defaultTexts[this.shape];
      if (!this.motion) this.text = next;
      else this.apply(next, this.size, this.paragraphSize, false, true, this.hasIntro());
      if (replaceDraft) $('message').value = this.text;
    }
    if (this.gifts && this.gifts.defaults) {
      const gift = this.gifts.defaults, candidate = Object.create(this);
      candidate.shapeConfig = SHAPES.rose;
      candidate.ropePath = connectPaths(this.pathCache.rose, SHAPES.rose.order);
      for (const size of Array.from({length:21}, (_, i) => i + 12).sort((a,b) => Math.abs(a - 20) - Math.abs(b - 20))) {
        const sources = candidate.layout(this.defaultTexts.rose, size, 28);
        const width = sources.reduce((sum, g) => sum + g.w + size * .08, 0) - size * .08;
        const ratio = candidate.ropePath.length / Math.max(1, width);
        if (ratio >= .95 && ratio <= this.maxSpacing) { gift.t = this.defaultTexts.rose; gift.f = size; gift.l = sources.letterSize; break; }
      }
    }
    $('paragraph-min').textContent = t('细腻 · ' + Math.min(12, this.paragraphSize));
    this.lastUI = ''; this.updateShapeControls(); this.inputHint(); this.updateUI(); this.draw();
  }
  saveImage() {
    const btn = $('save-image'); if (!btn || btn.disabled) return;
    btn.disabled = true; btn.textContent = t('正在生成…');
    $('save-status').textContent = t(''); $('export-status').textContent = t('');
    try {
      const dataUrl = this.exportImage();
      this.exportFilename = t(`字里花间-${this.shapeConfig.name}.png`);
      $('export-image').src = dataUrl;
      $('export-dialog').showModal();
    } catch (error) {
      $('export-image').removeAttribute('src'); this.exportFilename = t(null);
      $('save-status').textContent = t('未能生成高清图片，请重试。');
    } finally {
      btn.textContent = t('保存高清图片'); btn.disabled = false;
    }
  }
  exportImage() {
    // Redraw at 2× logical resolution without touching the display canvas.
    const canvas = document.createElement('canvas');
    canvas.width = W * 2; canvas.height = H * 2;
    try {
      this.render(canvas.getContext('2d'), canvas.width, canvas.height, false);
      return canvas.toDataURL('image/png');
    } finally { canvas.width = 1; canvas.height = 1; }
  }
  createVideoScene() {
    // Replay with this web implementation's engine; never rebuild the UI or
    // change the live motion, pending draft, or background crop.
    const scene = Object.create(this);
    scene.colors = this.colors.slice();
    scene.background = Object.create(this.background);
    scene.background.current = Object.assign({}, this.background.current);
    scene.motion = new (this.shapeConfig.motion === 'firework' ? FireworkMotion : LetterMotion)(this.ropePath, this.sources, this.size, this.paragraphSize, true);
    scene.motion.palette = scene.colors.slice(); scene.motion.autoContinue = true;
    const introSpeed = this.introSpeed, speed = this.speed;
    let hold = 0, accumulator = 0;
    return {
      render: (ctx, width, height) => scene.render(ctx, width, height, false),
      advance: delta => {
        if (scene.motion.phase === 'rope' && !scene.motion.flowing) {
          hold += delta;
          if (hold < .8) return false;
          scene.motion.drop();
        }
        accumulator += delta * (scene.motion.phase === 'intro' ? introSpeed : speed);
        while (accumulator >= 1 / 120 && scene.motion.phase !== 'complete') {
          scene.motion.step(1 / 120, true); accumulator -= 1 / 120;
        }
        return scene.motion.phase === 'complete';
      }
    };
  }
  async downloadImage() {
    const dataUrl = $('export-image').getAttribute('src'), filename = this.exportFilename;
    const btn = $('export-download'); if (!dataUrl || btn.disabled) return;
    btn.disabled = true; btn.textContent = t('正在下载…'); $('export-status').textContent = t('');
    try {
      await saveArtwork(dataUrl, filename);
      $('export-status').textContent = t(savedLabel);
    } catch (error) { $('export-status').textContent = t('下载失败，可右键或长按图片保存，或重试下载。'); }
    finally { btn.disabled = false; btn.textContent = t('下载图片'); }
  }
  start() {
    if(this.motion&&this.motion.procedural){
      if(this.status==='playing')this.status='paused';
      else {
        if(this.status==='complete')this.apply(this.text,this.size,this.paragraphSize,false,false,false);
        this.motion.autoContinue=true;this.status='playing';
      }
      this.updateUI();return;
    }

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
        $('notice-text').textContent = t($('input-error').textContent);
        $('notice-dialog').showModal();
      } else if (!$('input-error').textContent) this.importedGift = false;
    });
    if ($('notice-ok')) $('notice-ok').addEventListener('click', () => $('notice-dialog').close());
    $('export-download').addEventListener('click', () => this.downloadImage());
    const clearExport = () => {
      $('export-image').removeAttribute('src'); this.exportFilename = t(null);
      $('export-status').textContent = t('');
    };
    $('export-close').addEventListener('click', () => { $('export-dialog').close(); clearExport(); });
    $('export-dialog').addEventListener('cancel', clearExport);
    $('export-dialog').addEventListener('close', clearExport);
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
        e.target.value = this.size; $('font-value').textContent = t(this.size);
        $('fit-note').textContent = t($('input-error').textContent); this.inputHint();
      }
    });
    $('paragraph-size').addEventListener('input', e => {
      if (!this.paths.length) { e.target.value = this.paragraphSize; return; }
      if (!this.apply($('message').value, this.size, Number(e.target.value), this.status === 'complete')) {
        e.target.value = this.paragraphSize; $('fit-note').textContent = t($('input-error').textContent);
      }
    });
    if ($('auto-fit')) $('auto-fit').addEventListener('click', () => this.apply($('message').value, this.size, this.paragraphSize, this.status === 'complete', true, this.hasIntro()));
    document.querySelector('.color-row').addEventListener('input', e => {
      if (!e.target.matches('input[data-path-color]')) return;
      const i = Number(e.target.dataset.pathColor);
      this.colors[i] = e.target.value; this.palettes[this.paletteMode][i] = e.target.value; $(this.shapeConfig.parts[i].id + '-hex').textContent = t(e.target.value.toUpperCase()); this.draw();
    });
    $('paragraph-color').addEventListener('input', e => { this.ink = e.target.value; Object.keys(this.shapePalettes).forEach(key => { const palette = this.shapePalettes[key][this.paletteMode]; palette[palette.length-1] = this.ink; }); this.draw(); });
    document.querySelectorAll('input[name=palette]').forEach(input => input.addEventListener('change', () => this.choosePalette(input.value)));
    $('reset-colors').addEventListener('click', () => { this.palettes[this.paletteMode] = this.shapeConfig.palettes[this.paletteMode].slice(); this.setPalette(this.paletteMode); });
    document.querySelectorAll('input[name=mode]').forEach(input => input.addEventListener('change', e => { this.mode = e.target.value; this.reset(); }));
    $('speed').addEventListener('click', () => { const speeds=[.5,1,1.5,2,3]; this.speed=speeds[(speeds.indexOf(this.speed)+1)%speeds.length]; $('speed').textContent=t(`展开 ${this.speed}×`); $('speed').setAttribute('aria-label', t(`展开速度 ${this.speed} 倍，点击切换`)); });
    const introSpeeds=[.5,1,1.5,2];
    if ($('intro-speed')) $('intro-speed').addEventListener('click', () => { this.introSpeed=introSpeeds[(introSpeeds.indexOf(this.introSpeed)+1)%introSpeeds.length]; const action=this.shape==='rose'?'生花':this.shape==='firework'?'重放':'成形'; $('intro-speed').textContent=t(`${action} ${this.introSpeed}×`); $('intro-speed').setAttribute('aria-label', t(`${action}速度 ${this.introSpeed} 倍，点击切换`)); });
    $('play').addEventListener('click', () => this.start()); $('reset').addEventListener('click', () => this.reset());
    this.canvas.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.start(); }
      if (e.key === 'Escape') this.release(false);
    });
    this.canvas.addEventListener('pointerdown', e => this.pointerDown(e));
    this.canvas.addEventListener('pointermove', e => this.pointerMove(e));
    this.canvas.addEventListener('pointerup', e => this.release(true, e));
    this.canvas.addEventListener('pointercancel', e => this.release(false, e, true));
    this.canvas.addEventListener('lostpointercapture', e => this.release(false, e, true));
    document.addEventListener('visibilitychange', () => {
      this.previousFrame = 0; this.accumulator = 0;
      if (document.hidden) { this.release(false); if (this.status === 'playing') { this.status = 'paused'; this.updateUI(); } }
    });
  }
  setPalette(mode) {
    this.paletteMode = mode; const colors = this.palettes[mode]; this.colors = colors.slice(0,-1); this.ink = colors[colors.length-1];
    this.shapeConfig.parts.forEach((part,i) => { $(part.id+'-color').value = colors[i]; $(part.id+'-hex').textContent = t(colors[i].toUpperCase()); });
    $('paragraph-color').value = this.ink;
    document.querySelectorAll('input[name=palette]').forEach(input => { input.checked = input.value === mode; });
    this.draw();
  }
  choosePalette(mode) {
    if (mode === 'light' && this.shapeConfig.resetLightOnPalette) {
      const count = this.shapeConfig.parts.length;
      this.palettes.light.splice(0, count, ...this.shapeConfig.palettes.light.slice(0, count));
    }
    this.setPalette(mode);
    // Only the user's palette action selects paper; paper selection itself
    // calls setPalette, so choosing a texture never starts a feedback loop.
    const papers = this.shapeConfig.paletteBackgrounds;
    if (papers) this.background.choose(papers[mode]);
  }
  pointerPosition(e) { const r = this.canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; }
  pointerDown(e) {
    if(this.motion&&this.motion.procedural){
      if(e.button>0||e.isPrimary===false||this.status==='loading'||this.status==='error')return;
      if(this.status==='complete')this.apply(this.text,this.size,this.paragraphSize,false,false,false);
      if(this.motion.burst(this.pointerPosition(e))){
        this.mode='manual';this.motion.autoContinue=false;
        document.querySelector('[name=mode][value=manual]').checked=true;
        this.status='playing';this.updateUI();this.draw();
      }
      e.preventDefault();return;
    }

    if(!this.motion||!['idle','playing'].includes(this.status)||this.drag||this.returning||e.button>0||this.motion.phase!=='rope')return;
    const p=this.pointerPosition(e),hit=Math.max(42,25*W/this.canvas.getBoundingClientRect().width);
    const candidates=this.motion.originals.filter((g,i)=>this.motion.independent ? g.alpha > .1 : i===0||g.state==='falling');
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
  release(allowStart, event, interrupted = false) {
    const action = releaseAction(this.drag, allowStart, event, interrupted);
    if(action==='ignore')return;const drag=this.drag;this.cancelCapture();
    if(action==='continue'){this.motion.drop();this.status='playing';}
    else {this.returning=true;this.returnState={from:this.motion.nodes.map(n=>Object.assign({},n)),target:drag.snapshot,t:0,status:drag.previousStatus==='idle'?'idle':'paused'};this.status='idle';}
    this.updateUI();
  }
  tick(dt) {
    if(!this.motion)return;
    if(this.motion.procedural)this.motion.palette=this.colors.slice();
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
  drawGlyph(ch, x, y, angle, color, alpha = 1, scale = 1, ctx = this.ctx, glow = 0) {
    if (!ch.trim()) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.scale(scale, scale); ctx.fillStyle = color; ctx.globalAlpha = alpha; if(glow){ctx.shadowColor=color;ctx.shadowBlur=glow;} ctx.fillText(ch, 0, 0); ctx.restore();
  }
  draw() { this.render(this.ctx, this.canvas.width, this.canvas.height, true); }
  render(ctx, width, height, showGuide) {
    ctx.setTransform(width / W, 0, 0, height / H, 0, 0);
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
    if(this.background)this.background.draw(ctx);
    ctx.font = `${this.size}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (!this.sources.length) return;
    const paletteKey=this.ink+this.colors.join(',');
    if(this.paletteKey!==paletteKey){this.paletteKey=paletteKey;this.paintColors=this.colors.map(color=>Array.from({length:101},(_,i)=>blendColor(this.ink,color,i/100)));}
    for(const g of this.motion.originals)this.drawGlyph(g.ch,g.x,g.y,g.angle,this.paintColors[g.color][Math.round(clamp(g.blend)*100)],g.alpha===undefined?1:g.alpha,g.scale,ctx,g.glow||0);
    if (showGuide && this.status === 'idle' && !this.saveGuard && this.motion.phase !== 'intro') this.drawGuide();
  }
  drawGuide() {
    if(this.motion.procedural){
      if(this.motion.cursor===0){
        const ctx=this.ctx;ctx.save();ctx.font=`25px ${FONT}`;ctx.textAlign='center';
        ctx.fillStyle=this.paletteMode==='dark'?'#efe6d6':'#817466';ctx.globalAlpha=.7;
        ctx.fillText(t('点一下，让文字为你绽放'),450,600);ctx.restore();
      }
      return;
    }

    const ctx = this.ctx, tip = this.motion.guideGlyph || this.motion.originals[0];
    ctx.save(); ctx.font = `23px ${FONT}`; ctx.textAlign = 'left';
    ctx.strokeStyle = (this.drag&&this.drag.armed) ? this.colors[tip.color] : (this.paletteMode === 'dark' ? '#efe6d6' : '#a39586'); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(tip.x, tip.y, 29, 0, Math.PI * 2); ctx.stroke();
    if (!this.drag && !this.returning) {
      ctx.beginPath(); ctx.moveTo(tip.x, tip.y + 40); ctx.lineTo(tip.x, tip.y + 94);
      ctx.moveTo(tip.x - 7, tip.y + 86); ctx.lineTo(tip.x, tip.y + 94); ctx.lineTo(tip.x + 7, tip.y + 86); ctx.stroke();
    }
    const label = t(this.drag ? this.drag.armed ? '松手，读这封信' : this.motion.independent ? '轻轻拨动文字' : '轻轻牵动文字' : this.motion.independent ? '拨动这里' : '拖动这里');
    const position = this.guidePosition(label), x = position.x, y = position.y;
    ctx.fillStyle = this.paletteMode === 'dark' ? '#efe6d6' : '#817466'; ctx.fillText(label, x, y); ctx.restore();
  }
  guidePosition(label = '拖动这里') {
    const tip = this.motion.guideGlyph || this.motion.originals[0];
    const placed = shapeGuidePosition(this.shapeConfig, tip);
    if (placed) return placed;
    if (this.shape !== 'cake') return { x: Math.max(35, tip.x - 215), y: clamp(tip.y + 18, 60, H - 40) };
    // The cake grip is among the tray's letters. Keep its label in the blank
    // area to the left (the user's marked position), with room while dragging.
    const ctx = this.ctx; ctx.save(); ctx.font = `23px ${FONT}`;
    const width = ctx.measureText(label).width; ctx.restore();
    const x = 55;
    for (let y = 740; y >= 190; y -= 28) {
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
    $('play-label').textContent = t(playing ? '暂停' : complete ? '重新展开' : paused ? '继续展开' : this.introEnabled ? '展开' : '展开这封信');
    $('play-icon').textContent = t(playing ? 'Ⅱ' : '▷');
    $('mode-hint').textContent = t(this.mode === 'manual' ? `拖动${config.grip}圆圈，文字会跟随手指牵动；松手后沿路径逐步滑出，离开路径的文字自然下落，全部落地后整理成信。` : `点击播放，${config.name}会慢慢展开成一封信。也可直接拖动${config.grip}。`);
    this.canvas.dataset.manual = String(['idle','playing'].includes(this.status));
    let stage = this.drag ? this.drag.armed ? '松手，让文字绳自然落下' : `从${config.grip}，轻轻拉开` : complete ? config.complete : paused ? '已暂停 · 等你继续' : this.motion && this.motion.phase==='intro' ? `让字句，慢慢组成${config.name}` : playing ? this.motion.phase==='settle' ? '等每一个字落地，再整理成信' : this.motion.phase==='rope' ? config.unfolding : this.motion.phase==='order' ? '把字句，整理成写给你的信' : '让这封信，慢慢舒展' : config.idle;
    if (this.motion && this.motion.procedural) {
      stage = this.motion.ui(this);
      for (const id of ['play-label', 'mode-hint']) $(id).textContent = t($(id).textContent);
    }
    if (stage !== this.lastUI) { $('stage-label').textContent = t(stage); this.lastUI = stage; }


  }
  snapshot() {
    return {shape:this.shape,pathCount:this.paths.length,status:this.status,elapsed:this.elapsed,phase:(this.motion&&this.motion.phase),size:this.size,paragraphSize:this.paragraphSize,sourceCount:this.sources.length,freeNodes:(this.motion&&this.motion.front),nodes:(this.motion&&this.motion.nodes.length),maxConstraintError:(this.motion&&this.motion.maxError),dragging:!!this.drag,returning:this.returning};
  }
}
export const studio = new RoseStudio();
window.addEventListener('languagechange', () => studio.updateLanguage());
studio.videoExport = new WebVideoExport(studio);
studio.gifts = new window.GiftShare(studio, {
  save: async (dataUrl, filename) => { await saveArtwork(dataUrl, filename); return '已下载礼物二维码，请将原图发给收礼人。'; }
});
