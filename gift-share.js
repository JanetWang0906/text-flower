/* Local Canvas QR generation and photo decoding. The host supplies saving. */
(function () {
  'use strict';
  const t = value => window.WebI18n ? window.WebI18n.t(value) : value;
  const $ = id => document.getElementById(id);
  const waitForPaint = () => new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
  const readImage = url => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(t('无法读取这张图片，请选择 PNG、JPG 或 WebP 格式的二维码图片。')));
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
        if (!studio.motion || studio.status === 'error') throw new Error(t('信纸尚未准备好，请刷新后重试。'));
        this.defaults = studio.giftSettings();
        $('save-gift-qr').disabled = false;
      }).catch(error => {
        this.loadError = error;
        if (this.entry.open && !this.busy) $('gift-entry-status').textContent = t(error.message);
      });
    }
    showEntry() {
      if (this.busy) return;
      $('gift-entry-status').textContent = t(this.loadError ? this.loadError.message : '');
      if (!this.entry.open) this.entry.showModal();
    }
    clearPreview() {
      $('gift-qr-image').removeAttribute('src'); this.dataUrl = null;
      $('gift-qr-status').textContent = t('');
    }
    async makeGift() {
      if (this.busy) return;
      const resetToDefaults = !!this.defaults;
      this.setBusy(true);
      // Accept the choice immediately; resource loading continues behind the
      // editor instead of disabling the entrance until every image is ready.
      this.entry.close();
      if (!this.defaults) $('gift-status').textContent = t('正在准备信纸…');
      try {
        await this.waitUntilReady();
        if (resetToDefaults) { await this.studio.restoreGift(this.defaults); this.studio.importedGift = false; }
        $('gift-entry-status').textContent = t(''); $('gift-status').textContent = t('');
      } catch (error) {
        $('gift-status').textContent = t('');
        $('gift-entry-status').textContent = t(error.message);
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
      this.setBusy(true); $('gift-entry-status').textContent = t('正在拆开礼物…');
      let url, image;
      const canvas = document.createElement('canvas');
      try {
        if (file.size > 20 * 1024 * 1024) throw new Error(t('图片超过 20 MB，请选择原始二维码图片或裁去多余的空白后重试。'));
        if (file.type && !/^image\/(png|jpeg|webp|gif|bmp|x-ms-bmp)$/.test(file.type)) throw new Error(t('请选择 PNG、JPG 或 WebP 格式的二维码图片。'));
        url = URL.createObjectURL(file); image = await readImage(url);
        if (!image.naturalWidth || !image.naturalHeight) throw new Error(t('这张图片没有可读取的画面，请换一张。'));
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
        if (!code) throw new Error(t('没有找到可识别的二维码，请选择清晰、完整且四周留有白边的礼物二维码图片。'));
        const gift = window.GiftCodec.decode(code.data);
        await this.waitUntilReady();
        await this.studio.restoreGift(gift);
        $('gift-entry-status').textContent = t(''); this.entry.close();
        $('gift-status').textContent = t('礼物已拆开，点击「展开」或亲手牵引，读读藏在里面的话。');
        this.studio.canvas.focus({ preventScroll: true });
      } catch (error) { $('gift-entry-status').textContent = t(error.message || '未能识别这份礼物，请重试。'); }
      finally {
        if (url) URL.revokeObjectURL(url);
        if (image) image.src = '';
        canvas.width = canvas.height = 1; this.setBusy(false);
        if (this.entry.open) $('gift-open').focus({ preventScroll: true });
      }
    }
    generate() {
      const button = $('save-gift-qr'); if (button.disabled) return;
      button.disabled = true; $('save-status').textContent = t('');
      const canvas = document.createElement('canvas');
      try {
        if ($('message').value !== this.studio.text) throw new Error(t('文字尚未应用，请先点击「应用文字」，再保存分享二维码。'));
        const content = window.GiftCodec.encode(this.studio.giftSettings());
        window.qrcode.stringToBytes = window.qrcode.stringToBytesFuncs['UTF-8'];
        const qr = window.qrcode(0, 'M'); qr.addData(content, 'Byte'); qr.make();
        const count = qr.getModuleCount(), unit = 8, margin = 6 * unit;
        canvas.width = (count + 12) * unit; canvas.height = canvas.width + 150;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#000';
        for (let y = 0; y < count; y++) for (let x = 0; x < count; x++) {
          if (qr.isDark(y, x)) ctx.fillRect(margin + x * unit, margin + y * unit, unit, unit);
        }
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = '28px "Songti SC", serif'; ctx.fillText(t('字里花间 · 有一份礼物送给你'), canvas.width / 2, canvas.width + 20, canvas.width - margin * 2);
        ctx.font = '22px sans-serif'; ctx.fillText(t('打开字里花间 → 拆开收到的礼物 → 选择此图'), canvas.width / 2, canvas.width + 68, canvas.width - margin * 2);
        ctx.font = '19px sans-serif'; ctx.fillText(t('祝福与设置都在码里 · 请发送原图'), canvas.width / 2, canvas.width + 110, canvas.width - margin * 2);
        this.dataUrl = canvas.toDataURL('image/png');
        $('gift-qr-image').src = this.dataUrl; $('gift-qr-status').textContent = t('');
        this.preview.showModal();
        if (this.options.autoSave && this.options.autoSave()) this.save();
      } catch (error) { $('save-status').textContent = t(error.message || '未能生成分享二维码，请重试。'); }
      finally { canvas.width = canvas.height = 1; button.disabled = false; }
    }
    async save() {
      if (!this.dataUrl || this.saving) return;
      this.saving = true; const button = $('gift-qr-save');
      button.disabled = true; $('gift-qr-close').disabled = true;
      button.textContent = t('正在保存…'); $('gift-qr-status').textContent = t('');
      try { $('gift-qr-status').textContent = t(await this.options.save(this.dataUrl, t('字里花间-礼物二维码.png'))); }
      catch (error) { $('gift-qr-status').textContent = t('保存失败，请检查相册权限后重试，也可长按或右键保存上方二维码。'); }
      finally { this.saving = false; button.disabled = false; $('gift-qr-close').disabled = false; button.textContent = t('保存二维码'); }
    }
  }
  window.GiftShare = GiftShare;
}());
