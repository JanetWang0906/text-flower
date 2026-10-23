/* Offline gift format. No URLs, storage, network calls, or animation engine. */
(function (root, factory) {
  'use strict';
  const codec = factory();
  if (typeof module === 'object' && module.exports) module.exports = codec;
  else root.GiftCodec = codec;
}(typeof window === 'object' ? window : this, function () {
  'use strict';
  const PREFIX = 'ZLHJ:';
  const VERSION = 1;
  // QR Model 2, version 40, medium error correction, one UTF-8 byte segment.
  const MAX_BYTES = 2331;
  const PAPERS = ['IMG_0006.jpg', 'IMG_0003.jpg', 'IMG_0045.JPG', 'IMG_0046.JPG'];
  const SHAPES = ['rose', 'cake', 'gift', 'firework'];
  const hex = value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
  const number = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
  const bytes = text => Array.from(text).reduce((n, ch) => n + (ch.codePointAt(0) < 128 ? 1 : ch.codePointAt(0) < 2048 ? 2 : ch.codePointAt(0) < 65536 ? 3 : 4), 0);
  function validate(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('礼物数据不完整，请重新选择二维码。');
    if (data.v !== VERSION) throw new Error('暂不支持这份礼物的数据版本，请使用与送礼人相同或更新的版本打开。');
    const parts = data.s === 0 ? 2 : data.s === 1 ? 4 : data.s === 2 || data.s === 3 ? 3 : 0;
    if (!parts || typeof data.t !== 'string' || !data.t.trim() || data.t.length > 8000 || Array.from(data.t).length > 2000 ||
        !Array.isArray(data.c) || data.c.length !== parts || !data.c.every(hex) || !hex(data.i) ||
        !['light', 'dark'].includes(data.p) || !Number.isInteger(data.f) || !number(data.f, 12, 32) ||
        !Number.isInteger(data.l) || !number(data.l, 1, 48) ||
        !Array.isArray(data.a) || data.a.length !== 4 || ![0, 1].includes(data.a[0]) ||
        ![.5, 1, 1.5, 2, 3].includes(data.a[1]) || ![.5, 1, 1.5, 2].includes(data.a[2]) || data.a[3] !== 1 ||
        !Array.isArray(data.b) || data.b.length !== 4 || !Number.isInteger(data.b[0]) || !PAPERS[data.b[0]] ||
        !number(data.b[1], 1, 3) || !number(data.b[2], 0, 1) || !number(data.b[3], 0, 1)) {
      throw new Error('礼物中的文字或设置不完整，无法打开。请让送礼人重新保存分享二维码。');
    }
    // Copy only known fields. Imported keys never become application properties.
    return { v: VERSION, s: data.s, t: data.t, c: data.c.map(color => color.toLowerCase()), i: data.i.toLowerCase(),
      p: data.p, f: data.f, l: data.l, a: data.a.slice(), b: data.b.slice() };
  }
  function encode(data) {
    const text = PREFIX + JSON.stringify(validate(data));
    if (bytes(text) > MAX_BYTES) throw new Error('这份礼物超出单张二维码的容量，请精简祝福文字后重试。文字不会被截断。');
    return text;
  }
  function decode(text) {
    if (typeof text !== 'string' || !text.startsWith(PREFIX)) throw new Error('这不是「字里花间」的礼物二维码，请选择送礼人保存的分享二维码图片。');
    if (text.length > MAX_BYTES || bytes(text) > MAX_BYTES) throw new Error('礼物数据过大，无法打开。');
    let data;
    try { data = JSON.parse(text.slice(PREFIX.length)); }
    catch (error) { throw new Error('礼物数据已损坏，请重新选择原始二维码图片。'); }
    return validate(data);
  }
  return { PREFIX, VERSION, MAX_BYTES, PAPERS, SHAPES, bytes, validate, encode, decode };
}));
