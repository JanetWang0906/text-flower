const assert = require('node:assert/strict');
const codec = require('../gift-codec.js');
const qrcode = require('../vendor/qrcode.js');
const jsQR = require('../vendor/jsQR.js');
qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];

const sample = { v: 1, s: 0, t: '给你的祝福\n愿你开心 🌷✨ e\u0301 👩‍👩‍👧‍👦 <script>这也是文字</script>',
  c: ['#D35159', '#4B8B3D'], i: '#34312E', p: 'light', f: 20, l: 28, a: [1, 3, .5, 1], b: [1, 1.25, .3, .75] };
const payload = codec.encode(sample);
assert.ok(payload.startsWith('ZLHJ:'));
assert.equal(codec.decode(payload).t, sample.t, 'all Unicode, newlines and literal markup survive');
assert.deepEqual(codec.decode(payload), codec.validate(sample));
assert.deepEqual(codec.SHAPES, ['rose', 'cake', 'gift', 'firework']);
const gift = { ...sample, s: 2, c: ['#F6BFD2', '#F7C0BF', '#F9D784'] };
assert.deepEqual(codec.decode(codec.encode(gift)), codec.validate(gift), 'three-part gift shape round trip');
assert.throws(() => codec.validate({ ...gift, c: sample.c }), /不完整/);
const firework = { ...gift, s: 3, c: ['#F7D878', '#EC78A2', '#92CDF0'] };
assert.deepEqual(codec.decode(codec.encode(firework)), codec.validate(firework), 'firework uses a new shape index without changing historical gift indices');
assert.throws(() => codec.validate({ ...firework, c: sample.c }), /不完整/);
assert.throws(() => codec.decode('https://example.com/works/123'), /不是/);
assert.throws(() => codec.decode('ZLHJ:{'), /损坏/);
assert.throws(() => codec.decode('ZLHJ:' + JSON.stringify({ ...sample, v: 2 })), /版本/);
for (const patch of [{ s: 99 }, { c: ['#d35159'] }, { i: 'red' }, { a: [0, 100, 1, 1] }, { a: [0, 1, 1, 'true'] }, { a: [0, 1, 1, 0] },
  { b: [4, 1, .5, .5] }, { b: [0, 1, -1, 0] }, { b: ['0', 1, .5, .5] }, { f: 20.1 }, { l: 49 }, { t: '' }]) {
  assert.throws(() => codec.decode('ZLHJ:' + JSON.stringify({ ...sample, ...patch })), /不完整/);
}
assert.throws(() => codec.encode({ ...sample, t: '祝'.repeat(800) }), /容量/);
assert.throws(() => codec.decode('ZLHJ:' + JSON.stringify({ ...sample, t: '你'.repeat(2001) })), /过大/);

// Use actual modules and the independent decoder, including the exact QR-M limit.
const max = { ...sample, t: '你'.repeat(400) };
max.t += 'x'.repeat(codec.MAX_BYTES - codec.bytes(codec.encode(max)));
const exact = codec.encode(max);
assert.equal(codec.bytes(exact), 2331);
assert.throws(() => codec.encode({ ...max, t: max.t + 'x' }), /容量/);
for (const content of [payload, exact]) {
  const qr = qrcode(0, 'M'); qr.addData(content, 'Byte'); qr.make();
  const n = qr.getModuleCount(), scale = 5, side = (n + 8) * scale;
  const pixels = new Uint8ClampedArray(side * side * 4); pixels.fill(255);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) {
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      const index = (((y + 4) * scale + dy) * side + (x + 4) * scale + dx) * 4;
      pixels[index] = pixels[index + 1] = pixels[index + 2] = 0;
    }
  }
  const decoded = jsQR(pixels, side, side, { inversionAttempts: 'dontInvert' });
  assert.ok(decoded); assert.equal(decoded.data, content, 'actual QR modules preserve the entire payload');
  assert.deepEqual(codec.decode(decoded.data), codec.decode(content));
}
console.log('GIFT CODEC PASS: Unicode, validation, actual QR-M decoding, 2331-byte capacity boundary');
