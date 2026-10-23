/* Local Canvas QR generation and photo decoding. The host supplies saving. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const waitForPaint = () => new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
  const readImage = url => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('无法读取这张图片，请选择 PNG、JPG 或 WebP 格式的二维码图片。'));
    image.src = url;
  });
  class GiftShare {
    constructor(studio, options) {
      this.studio = studio; this.options = options; this.busy = false; this.dataUrl = null;
      this.entry = $('gift-entry-dialog'); this.preview = $('gift-qr-dialog');
      $('gift-entry').addEventListener('click', () => this.showEntry());
      $('gift-create').addEventListener('click', () => this.makeGift());
      $('gift-open').addEventListener('click', () => { if (!this.busy) $('gift-file').click(); });
      $('gift-file').addEventListener('change', event => {
        const file = event.target.files[0]; event.target.value = '';
        if (file) this.openPhoto(file);
      });
      $('save-gift-qr').addEventListener('click', () => this.generate());
      $('gift-qr-save').addEventListener('click', () => this.save());
      $('gift-qr-close').addEventListener('click', () => { this.preview.close(); this.clearPreview(); });
      this.entry.addEventListener('cancel', event => { if (this.busy) event.preventDefault(); });
      this.preview.addEventListener('cancel', event => { if (this.saving) event.preventDefault(); });
      this.preview.addEventListener('close', () => this.clearPreview());
      this.showEntry();
      this.ready = studio.ready.then(() => {
        if (!studio.motion || studio.status === 'error') throw new Error('信纸尚未准备好，请刷新后重试。');
        this.defaults = studio.giftSettings();
        $('save-gift-qr').disabled = false;
      }).catch(error => {
        this.loadError = error;
        if (this.entry.open && !this.busy) $('gift-entry-status').textContent = error.message;
      });
    }
    showEntry() {
      if (this.busy) return;
      $('gift-entry-status').textContent = this.loadError ? this.loadError.message : '';
      if (!this.entry.open) this.entry.showModal();
    }
    clearPreview() {
      $('gift-qr-image').removeAttribute('src'); this.dataUrl = null;
      $('gift-qr-status').textContent = '';
    }
    async makeGift() {
      if (this.busy) return;
      const resetToDefaults = !!this.defaults;
      this.setBusy(true);
      // Accept the choice immediately; resource loading continues behind the
      // editor instead of disabling the entrance until every image is ready.
      this.entry.close();
      if (!this.defaults) $('gift-status').textContent = '正在准备信纸…';
      try {
        await this.waitUntilReady();
        if (resetToDefaults) await this.studio.restoreGift(this.defaults);
        $('gift-entry-status').textContent = ''; $('gift-status').textContent = '';
      } catch (error) {
        $('gift-status').textContent = '';
        $('gift-entry-status').textContent = error.message;
        if (!this.entry.open) this.entry.showModal();
      }
      finally { this.setBusy(false); }
    }
    async waitUntilReady() {
      await this.ready;
      if (this.loadError) throw this.loadError;
    }
    setBusy(busy) {
      this.busy = busy; this.entry.setAttribute('aria-busy', String(busy));
      $('gift-create').disabled = busy;
      $('gift-open').disabled = busy;
    }
    async openPhoto(file) {
      if (this.busy) return;
      this.setBusy(true); $('gift-entry-status').textContent = '正在拆开礼物…';
      let url, image;
      const canvas = document.createElement('canvas');
      try {
        if (file.size > 20 * 1024 * 1024) throw new Error('图片超过 20 MB，请选择原始二维码图片或裁去多余的空白后重试。');
        if (file.type && !/^image\/(png|jpeg|webp|gif|bmp|x-ms-bmp)$/.test(file.type)) throw new Error('请选择 PNG、JPG 或 WebP 格式的二维码图片。');
        url = URL.createObjectURL(file); image = await readImage(url);
        if (!image.naturalWidth || !image.naturalHeight) throw new Error('这张图片没有可读取的画面，请换一张。');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        let code = null;
        // Bound decoding memory; retry a larger sample for dense codes in photos.
        for (const limit of [1400, 2200]) {
          const scale = Math.min(1, limit / Math.max(image.naturalWidth, image.naturalHeight));
          canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
          ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          await waitForPaint();
          const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
          code = window.jsQR(pixels.data, pixels.width, pixels.height, { inversionAttempts: 'attemptBoth' });
          if (code || scale === 1) break;
        }
        if (!code) throw new Error('没有找到可识别的二维码，请选择清晰、完整且四周留有白边的礼物二维码图片。');
        const gift = window.GiftCodec.decode(code.data);
        await this.waitUntilReady();
        await this.studio.restoreGift(gift);
        $('gift-entry-status').textContent = ''; this.entry.close();
        $('gift-status').textContent = '礼物已拆开，点击「展开」或亲手牵引，读读藏在里面的话。';
        this.studio.canvas.focus({ preventScroll: true });
      } catch (error) { $('gift-entry-status').textContent = error.message || '未能识别这份礼物，请重试。'; }
      finally {
        if (url) URL.revokeObjectURL(url);
        if (image) image.src = '';
        canvas.width = canvas.height = 1; this.setBusy(false);
        if (this.entry.open) $('gift-open').focus({ preventScroll: true });
      }
    }
    async generate() {
      const button = $('save-gift-qr'); if (button.disabled) return;
      button.disabled = true; $('save-status').textContent = ''; const label = button.textContent; button.textContent = '正在生成…';
      const canvas = document.createElement('canvas');
      let thumbnail;
      try {
        if ($('message').value !== this.studio.text) throw new Error('文字尚未应用，请先点击「应用文字」，再保存分享二维码。');
        const content = window.GiftCodec.encode(this.studio.giftSettings());
        const name = this.studio.shapeConfig.name;
        if (this.options.thumbnail) thumbnail = this.options.thumbnail();
        await waitForPaint();
        window.qrcode.stringToBytes = window.qrcode.stringToBytesFuncs['UTF-8'];
        const qr = window.qrcode(0, 'M'); qr.addData(content, 'Byte'); qr.make();
        const count = qr.getModuleCount(), unit = 8, margin = 6 * unit;
        const qrSize = (count + 12) * unit;
        const thumbWidth = thumbnail ? Math.min(180, Math.round(qrSize * .15)) : 0;
        const thumbHeight = Math.round(thumbWidth * 4 / 3), footerHeight = Math.max(180, thumbHeight + 48);
        canvas.width = qrSize; canvas.height = qrSize + footerHeight;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#000';
        for (let y = 0; y < count; y++) for (let x = 0; x < count; x++) {
          if (qr.isDark(y, x)) ctx.fillRect(margin + x * unit, margin + y * unit, unit, unit);
        }
        // The QR matrix and its six-module white border remain identical.
        // Identification belongs entirely below that original square.
        if (thumbnail) {
          ctx.drawImage(thumbnail, margin, qrSize + 24, thumbWidth, thumbHeight);
          ctx.strokeStyle = '#d8d2c6'; ctx.lineWidth = 1;
          ctx.strokeRect(margin + .5, qrSize + 24.5, thumbWidth - 1, thumbHeight - 1);
        }
        const textX = thumbnail ? margin + thumbWidth + 28 : margin;
        const textWidth = qrSize - textX - margin;
        const top = qrSize + (footerHeight - 110) / 2;
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#34312e';
        const line = (text, y, font) => {
          ctx.font = font;
          const chars = Array.from(text); let clipped = false;
          while (chars.length && ctx.measureText(chars.join('') + (clipped ? '…' : '')).width > textWidth) { chars.pop(); clipped = true; }
          ctx.fillText(chars.join('') + (clipped ? '…' : ''), textX, y);
        };
        line('字里花间 · ' + name + '礼物', top + 18, '28px "Songti SC", serif');
        line('打开字里花间 → 拆开收到的礼物', top + 62, '20px sans-serif');
        line('选择此图 · 请发送原图', top + 98, '19px sans-serif');
        const pixels = ctx.getImageData(0, 0, qrSize, qrSize);
        const decoded = window.jsQR(pixels.data, qrSize, qrSize, { inversionAttempts: 'dontInvert' });
        if (!decoded || decoded.data !== content) throw new Error('二维码自检未通过，请重试。祝福文字不会被截断。');
        this.qrDetails = { qrSize, unit, moduleCount: count, errorCorrection: 'M', thumbnail: !!thumbnail, footerHeight };
        this.dataUrl = canvas.toDataURL('image/png');
        $('gift-qr-image').src = this.dataUrl; $('gift-qr-status').textContent = '';
        this.preview.showModal();
        if (this.options.autoSave && this.options.autoSave()) this.save();
      } catch (error) { $('save-status').textContent = error.message || '未能生成分享二维码，请重试。'; }
      finally { canvas.width = canvas.height = 1; if (thumbnail) thumbnail.width = thumbnail.height = 1; button.disabled = false; button.textContent = label; }
    }
    async save() {
      if (!this.dataUrl || this.saving) return;
      this.saving = true; const button = $('gift-qr-save');
      button.disabled = true; $('gift-qr-close').disabled = true;
      button.textContent = '正在保存…'; $('gift-qr-status').textContent = '';
      try { $('gift-qr-status').textContent = await this.options.save(this.dataUrl, '字里花间-礼物二维码.png'); }
      catch (error) { $('gift-qr-status').textContent = '保存失败，请检查相册权限后重试，也可长按或右键保存上方二维码。'; }
      finally { this.saving = false; button.disabled = false; $('gift-qr-close').disabled = false; button.textContent = '保存二维码'; }
    }
  }
  window.GiftShare = GiftShare;
}());
