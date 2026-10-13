// Backgrounds stay on this device; uploads are decoded from local object URLs.
// Preset papers carry a palette mode: picking one switches the canvas palette
// automatically (dark textures → dark palette, light papers → light palette).
const PAPER_PALETTE = { 'IMG_0006.jpg': 'light', 'IMG_0003.jpg': 'light', 'IMG_0045.JPG': 'dark', 'IMG_0046.JPG': 'dark' };
const $ = id => document.getElementById(id);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const decode = src => new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error('无法读取这张图片，请换一张 JPG、PNG 或 WebP 图片。')); image.src = src; });
export class Background {
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
