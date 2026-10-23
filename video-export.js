// Web-only MP4 recording and download. No native bridge or publishing flow.
import { saveVideo } from './platforms/web.js?v=web-video-20261023-r1';

const WIDTH = 720, HEIGHT = 960, FPS = 24;
const MAX_SECONDS = 120, MAX_BYTES = 32 * 1024 * 1024;
const { t } = window.WebI18n;
const $ = id => document.getElementById(id);
function mp4Type() {
  try {
    if (typeof MediaRecorder !== 'function' || typeof MediaRecorder.isTypeSupported !== 'function' ||
        typeof HTMLCanvasElement.prototype.captureStream !== 'function') return '';
    return ['video/mp4;codecs=avc1.42E01E', 'video/mp4'].find(type => MediaRecorder.isTypeSupported(type)) || '';
  } catch (error) { return ''; }
}

export class WebVideoExport {
  constructor(studio) {
    this.studio = studio; this.dialog = $('video-dialog'); this.canvas = $('video-canvas');
    this.ctx = this.canvas.getContext('2d'); this.preview = $('video-preview'); this.token = 0;
    this.blob = null; this.url = ''; this.stream = null; this.recording = false;
    $('export-video').addEventListener('click', () => this.open());
    $('video-retry').addEventListener('click', () => this.start());
    $('video-download').addEventListener('click', () => this.download());
    $('video-close').addEventListener('click', () => { this.clear(); this.dialog.close(); });
    this.dialog.addEventListener('close', () => { if (!this.dialog.open) this.clear(); });
    this.preview.addEventListener('error', () => {
      if (this.blob && this.dialog.open) this.message('视频已生成，当前浏览器无法预览。可点击「下载 MP4」后播放。');
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.recording) this.abort('生成因页面切到后台而取消，请回到前台重新生成。');
    });
    window.addEventListener('pagehide', () => this.clear());
    studio.ready.then(() => { if (studio.status !== 'error') $('export-video').disabled = false; });
  }
  message(text) { $('video-status').textContent = t(text); }
  releaseRecorder() {
    cancelAnimationFrame(this.raf); clearTimeout(this.watchdog);
    const recorder = this.recorder; this.recorder = null;
    if (recorder) {
      recorder.ondataavailable = recorder.onstop = recorder.onerror = null;
      if (recorder.state !== 'inactive') { try { recorder.stop(); } catch (error) {} }
    }
    if (this.stream) this.stream.getTracks().forEach(track => track.stop());
    this.stream = null; this.recording = false;
  }
  clear() {
    ++this.token; this.releaseRecorder(); this.blob = null;
    this.preview.pause(); this.preview.removeAttribute('src'); this.preview.load();
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = ''; this.preview.hidden = true; this.canvas.hidden = false;
    this.canvas.width = this.canvas.height = 1;
    $('video-download').hidden = true; $('video-download').disabled = false;
    $('video-retry').hidden = true; $('video-close').textContent = t('关闭');
  }
  open() {
    if (this.dialog.open) return;
    this.dialog.showModal(); this.start();
  }
  abort(text) {
    ++this.token; this.releaseRecorder(); this.blob = null;
    $('video-download').hidden = true; $('video-retry').hidden = false;
    $('video-close').textContent = t('关闭'); this.message(text);
  }
  start() {
    if (this.recording) return;
    this.clear(); this.canvas.width = WIDTH; this.canvas.height = HEIGHT;
    const type = mp4Type();
    if (!type) {
      this.studio.render(this.ctx, WIDTH, HEIGHT, false);
      this.message('当前浏览器不支持 MP4 生成，请换用支持 MP4 录制的浏览器或使用系统录屏。高清图片仍可保存。');
      return;
    }
    const token = this.token; this.filename = t('字里花间-' + this.studio.shapeConfig.name + '.mp4');
    $('video-close').textContent = t('取消生成'); this.message('正在生成视频…');
    let scene, recorder; const chunks = []; let bytes = 0;
    try {
      scene = this.studio.createVideoScene(); scene.render(this.ctx, WIDTH, HEIGHT);
      this.stream = this.canvas.captureStream(FPS);
      recorder = new MediaRecorder(this.stream, { mimeType: type, videoBitsPerSecond: 2400000 });
      if (!/^video\/mp4(?:;|$)/i.test(recorder.mimeType)) throw new Error(t('MP4 编码不可用'));
      this.recorder = recorder; this.recording = true;
      recorder.ondataavailable = event => {
        if (token !== this.token || !event.data.size) return;
        chunks.push(event.data); bytes += event.data.size;
        if (bytes > MAX_BYTES) this.abort('视频超过 32 MB，请调快动画速度或减少文字后重试。');
      };
      recorder.onerror = () => this.abort('视频编码失败，请重新生成或使用系统录屏。');
      recorder.onstop = () => {
        if (token !== this.token) return;
        const mime = recorder.mimeType; this.releaseRecorder();
        if (!bytes) { this.abort('未能生成视频，请保持页面在前台后重试。'); return; }
        this.blob = new Blob(chunks, { type: mime }); this.finish(token);
      };
      recorder.start(500);
    } catch (error) { this.abort('无法开始生成视频，请重新生成或使用系统录屏。'); return; }
    const began = performance.now(); let previous = began, lastPaint = began, completeAt = 0;
    this.watchdog = setTimeout(() => {
      if (token === this.token && this.recording) this.abort('生成超过 120 秒，请调快动画速度或减少文字后重试。');
    }, MAX_SECONDS * 1000 + 1000);
    const frame = time => {
      if (token !== this.token || !this.recording) return;
      try {
        if (time - lastPaint >= 1000 / FPS) {
          const delta = Math.min((time - previous) / 1000, .12); previous = lastPaint = time;
          const complete = scene.advance(delta); scene.render(this.ctx, WIDTH, HEIGHT);
          if (complete && !completeAt) completeAt = time;
          this.message(complete ? '信已展开，正在保留结尾…' : '正在生成视频 · ' + Math.floor((time - began) / 1000) + ' 秒');
          if (completeAt && time - completeAt >= 2000) { recorder.stop(); return; }
          if (time - began > MAX_SECONDS * 1000) { this.abort('动画超过 120 秒，请调快速度或减少文字后重试。'); return; }
        }
        this.raf = requestAnimationFrame(frame);
      } catch (error) { this.abort('生成中断，请重新生成或使用系统录屏。'); }
    };
    this.raf = requestAnimationFrame(frame);
  }
  finish(token) {
    if (token !== this.token || !this.dialog.open) return;
    this.url = URL.createObjectURL(this.blob);
    this.preview.src = this.url; this.preview.hidden = false; this.canvas.hidden = true;
    $('video-download').hidden = false; $('video-retry').hidden = false; $('video-close').textContent = t('关闭');
    this.download();
  }
  async download() {
    if (!this.blob || $('video-download').disabled) return;
    const token = this.token; $('video-download').disabled = true;
    try {
      await saveVideo(this.blob, this.filename);
      if (token === this.token) this.message('MP4 已生成 · ' + (this.blob.size / 1024 / 1024).toFixed(1) + ' MB。已开始下载；若浏览器未下载，可点击「下载 MP4」重试。');
    } catch (error) {
      if (token === this.token) this.message('自动下载未能开始，可点击「下载 MP4」重试。');
    } finally { if (token === this.token) $('video-download').disabled = false; }
  }
}
