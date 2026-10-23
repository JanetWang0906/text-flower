/* Offline MP4 recording. Only documented miniTool APIs are used for delivery. */
(function (root) {
  'use strict';
  const WIDTH = 720, HEIGHT = 960, FPS = 24;
  const MAX_SECONDS = 120, MAX_BYTES = 32 * 1024 * 1024;
  const $ = id => document.getElementById(id);
  function mp4Type() {
    try {
      if (typeof root.MediaRecorder !== 'function' || typeof root.MediaRecorder.isTypeSupported !== 'function' ||
          typeof HTMLCanvasElement.prototype.captureStream !== 'function') return '';
      return ['video/mp4;codecs=avc1.42E01E', 'video/mp4'].find(type => root.MediaRecorder.isTypeSupported(type)) || '';
    } catch (error) { return ''; }
  }
  function dataURL(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('视频读取失败，请重新生成。'));
      reader.onabort = () => reject(new Error('视频读取已取消。'));
      reader.readAsDataURL(blob);
    });
  }
  class TextVideoExport {
    constructor(studio) {
      this.studio = studio; this.dialog = $('video-dialog'); this.canvas = $('video-canvas');
      this.ctx = this.canvas.getContext('2d'); this.preview = $('video-preview'); this.token = 0;
      $('export-video').addEventListener('click', () => this.open());
      $('video-start').addEventListener('click', () => this.start());
      $('video-share').addEventListener('click', () => this.share());
      $('video-close').addEventListener('click', () => { this.clear(); this.dialog.close(); });
      this.preview.addEventListener('error', () => {
        if (!this.filePath || !this.dialog.open) return;
        this.preview.hidden = true; this.canvas.hidden = false;
        this.message('视频文件已就绪，当前环境无法预览；仍可尝试打开视频发布页。');
      });
      this.dialog.addEventListener('close', () => { if (!this.dialog.open) this.clear(); });
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && this.recording) this.abort('录制因页面切到后台而取消，请回到前台重新生成。');
      });
      root.addEventListener('pagehide', () => this.clear());
      studio.ready.then(() => { if (studio.status !== 'error') $('export-video').disabled = false; });
    }
    sdk() { return root.xhs && root.xhs.miniTool; }
    message(text) { $('video-status').textContent = text; }
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
      ++this.token; this.releaseRecorder(); this.blob = null; this.filePath = '';
      this.preview.pause(); this.preview.removeAttribute('src'); this.preview.removeAttribute('poster'); this.preview.load();
      this.preview.hidden = true; this.canvas.hidden = false;
      this.canvas.width = 1; this.canvas.height = 1;
      $('video-start').disabled = false; $('video-start').hidden = false;
      $('video-share').disabled = false; $('video-share').hidden = true;
      $('video-close').textContent = '关闭';
    }
    open() {
      this.clear(); this.canvas.width = WIDTH; this.canvas.height = HEIGHT;
      this.studio.render(this.ctx, WIDTH, HEIGHT, false);
      this.message(mp4Type() ? '将自动重播完整动画；当前作品和未应用的文字草稿会保留。' :
        '当前环境不支持 MP4 录制。可尝试更新小红书后重试，或使用系统录屏；高清图片仍可正常保存。');
      $('video-start').disabled = !mp4Type(); this.dialog.showModal();
    }
    abort(message) {
      ++this.token; this.releaseRecorder(); this.blob = null;
      $('video-start').hidden = false; $('video-start').disabled = false;
      $('video-start').textContent = '重新生成'; $('video-share').hidden = true;
      $('video-close').textContent = '关闭'; this.message(message);
    }
    start() {
      if (this.recording) return;
      const type = mp4Type();
      if (!type) { this.message('当前环境不支持 MP4 录制，请更新客户端或使用系统录屏。'); return; }
      this.clear(); const token = this.token;
      this.canvas.width = WIDTH; this.canvas.height = HEIGHT;
      $('video-start').hidden = true; $('video-close').textContent = '取消生成';
      let scene, recorder;
      const chunks = []; let bytes = 0;
      try {
        scene = this.studio.createVideoScene(); scene.render(this.ctx, WIDTH, HEIGHT);
        this.stream = this.canvas.captureStream(FPS);
        recorder = new root.MediaRecorder(this.stream, { mimeType: type, videoBitsPerSecond: 2400000 });
        if (!/^video\/mp4(?:;|$)/i.test(recorder.mimeType)) throw new Error('MP4 编码不可用');
        this.recorder = recorder; this.recording = true;
        recorder.ondataavailable = event => {
          if (token !== this.token || !event.data.size) return;
          chunks.push(event.data); bytes += event.data.size;
          if (bytes > MAX_BYTES) this.abort('视频超过 32 MB，请调快动画速度或减少文字后重试。');
        };
        recorder.onerror = () => this.abort('视频编码失败，请尝试更新客户端或使用系统录屏。');
        recorder.onstop = () => {
          if (token !== this.token) return;
          const mime = recorder.mimeType;
          this.releaseRecorder();
          if (!bytes) { this.abort('没有录到视频，请保持页面在前台后重试。'); return; }
          this.blob = new Blob(chunks, { type: mime });
          this.finish(token);
        };
        recorder.start(500);
      } catch (error) { this.abort('当前环境无法启动 MP4 录制，可更新客户端或使用系统录屏。'); return; }
      const began = performance.now(); let previous = began, lastPaint = began, completeAt = 0;
      this.watchdog = setTimeout(() => {
        if (token === this.token && this.recording) this.abort('录制超过 120 秒，请调快动画速度或减少文字后重试。');
      }, MAX_SECONDS * 1000 + 1000);
      const frame = time => {
        if (token !== this.token || !this.recording) return;
        try {
          if (time - lastPaint >= 1000 / FPS) {
            const delta = Math.min((time - previous) / 1000, .12);
            previous = lastPaint = time;
            const complete = scene.advance(delta); scene.render(this.ctx, WIDTH, HEIGHT);
            if (complete && !completeAt) completeAt = time;
            this.message(complete ? '信已展开，正在保留结尾…' : '正在生成视频 · ' + Math.floor((time - began) / 1000) + ' 秒');
            if (completeAt && time - completeAt >= 2000) { recorder.stop(); return; }
            if (time - began > MAX_SECONDS * 1000) { this.abort('动画超过 120 秒，请调快速度或减少文字后重试。'); return; }
          }
          this.raf = requestAnimationFrame(frame);
        } catch (error) { this.abort('生成中断，请重新生成或尝试使用系统录屏。'); }
      };
      this.raf = requestAnimationFrame(frame);
    }
    async localFile(token) {
      if (this.filePath) return this.filePath;
      const sdk = this.sdk();
      if (!sdk || typeof sdk.writeTempFile !== 'function') throw new Error('请在支持视频分享的小红书客户端内打开。');
      const data = await dataURL(this.blob);
      if (token !== this.token) return '';
      const result = await sdk.writeTempFile({ data });
      if (token !== this.token) return '';
      // Treat returned native handles as opaque; only reject media sources
      // the documented container cannot play. Do not rewrite native paths.
      if (!result || typeof result.filePath !== 'string' || !result.filePath || /^(?:https?:|data:|blob:)/i.test(result.filePath)) {
        throw new Error('未能取得本地视频文件，请重试。');
      }
      this.filePath = result.filePath; return this.filePath;
    }
    async finish(token) {
      $('video-start').hidden = false; $('video-start').textContent = '重新生成'; $('video-close').textContent = '关闭';
      const sdk = this.sdk(), canShare = sdk && typeof sdk.writeTempFile === 'function' && typeof sdk.postNote === 'function';
      $('video-share').hidden = !canShare;
      const size = (this.blob.size / 1024 / 1024).toFixed(1);
      this.message('MP4 已生成 · ' + size + ' MB。' + (canShare ? '正在准备本地视频…' : '请在小红书内打开以预览并分享视频。'));
      if (!canShare) return;
      $('video-share').disabled = true;
      try {
        const filePath = await this.localFile(token);
        if (!filePath || token !== this.token) return;
        this.showPreview(filePath);
        this.message('MP4 已生成 · ' + size + ' MB。可预览或打开视频发布页。');
      } catch (error) {
        if (token === this.token) this.message('MP4 已生成，写入本地文件失败。可点击打开视频发布页重试；仍失败时请重新生成。');
      } finally { if (token === this.token) $('video-share').disabled = false; }
    }
    showPreview(filePath) {
      this.preview.poster = this.canvas.toDataURL('image/jpeg', .8);
      this.preview.src = filePath; this.preview.hidden = false; this.canvas.hidden = true;
    }
    async share() {
      const sdk = this.sdk();
      if (!this.blob || !sdk || typeof sdk.postNote !== 'function' || $('video-share').disabled) return;
      const token = this.token; $('video-share').disabled = true;
      try {
        const filePath = await this.localFile(token);
        if (!filePath || token !== this.token) return;
        if (this.preview.getAttribute('src') !== filePath) this.showPreview(filePath);
        await sdk.postNote({ pageType: 'video_publish', mediaInfo: { video_resources: { video_url: filePath } } });
        if (token === this.token) this.message('视频发布流程已返回；是否发布请以发布页的操作为准。');
      } catch (error) {
        if (token === this.token) this.message('未能打开视频发布页，可重试。视频尚未保存到相册或发布。');
      } finally { if (token === this.token) $('video-share').disabled = false; }
    }
  }
  root.TextVideoExport = TextVideoExport;
})(window);
