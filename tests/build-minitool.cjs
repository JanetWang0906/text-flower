// Build only the independent mini-tool source. Never read web app/layout/CSS.
// Run: node tests/build-minitool.cjs (directory only; does not create a ZIP).
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'minitool-src');
const target = path.join(root, 'minitool');
const baseline = path.join(root, 'backups', 'minitool-original-20260928');
fs.mkdirSync(target, { recursive: true });

const app = fs.readFileSync(path.join(source, 'app.js'), 'utf8');
assert.doesNotMatch(app, /^import\s|^export\s|\bfetch\s*\(|\.download\s*=/m);
assert.ok(app.includes('window.studio = studio;'), '小工具启动入口缺失');
let html = fs.readFileSync(path.join(source, 'index.html'), 'utf8');
assert.doesNotMatch(html, /type="module"|toolbar\.css|shared-controls/);
assert.ok(html.includes('id="rose-source"') && html.includes('id="cake-source"'));
// Keep the original rose geometry in the original entry; refresh cake only.
const cake = fs.readFileSync(path.join(root, '蛋糕', '蛋糕.svg'), 'utf8').replace(/<\?xml[^]*?\?>\s*/, '').trim();
html = html.replace(/<template id="cake-source">[^]*?<\/template>/, () => '<template id="cake-source">' + cake + '</template>');
// Both implementations read the same catalog. The offline copy stays local.
html = html.replace('../shared/shapes.js', './shared/shapes.js');
html = html.replace('../shared/interaction.js', './shared/interaction.js');
html = html.replace('../shared/firework-motion.js', './shared/firework-motion.js');
html = html.replace('../shared/comet-trails.js', './shared/comet-trails.js');
html = html.replace('../shared/comet-fireworks.js', './shared/comet-fireworks.js');
// Offline ZIP entries are literal filenames; web cache-busting suffixes have
// no purpose here and can break resource resolution in embedded containers.
html = html.replace(/\b(src|href)="(\.\/[^"?#]+)\?[^"#]*"/g, '$1="$2"');
assert.doesNotMatch(html, /<(?:script|link)\b[^>]*(?:src|href)="[^"\s]*[?#]/);
fs.cpSync(path.join(root, 'shared'), path.join(target, 'shared'), { recursive: true });
for (const [name, data] of [['app.js', app], ['index.html', html], ['style.css', fs.readFileSync(path.join(source, 'style.css'))]]) {
  fs.writeFileSync(path.join(target, name), data);
}
// QR code, photo decoding and gift UI are local mini-tool assets as well.
for (const name of ['gift-codec.js', 'gift-share.js', 'gift-share.css', 'video-export.js']) {
  fs.copyFileSync(path.join(source, name), path.join(target, name));
}
// Runtime libraries and their complete JSON license texts are supported
// archive assets; development README/TXT copies stay in the source tree.
fs.cpSync(path.join(source, 'vendor'), path.join(target, 'vendor'), {
  recursive: true,
  filter: file => fs.statSync(file).isDirectory() || /\.(js|json)$/i.test(file)
});
for (const name of ['README.md', 'qrcode-LICENSE.txt', 'jsQR-LICENSE.txt']) {
  const file = path.join(target, 'vendor', name);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}
for (const image of ['IMG_0003.jpg', 'IMG_0006.jpg', 'IMG_0045.JPG', 'IMG_0046.JPG']) {
  fs.copyFileSync(path.join(baseline, image), path.join(target, image));
}
// The previous shared stylesheet must not enter a future mini-tool ZIP.
const oldToolbar = path.join(target, 'toolbar.css');
if (fs.existsSync(oldToolbar)) fs.unlinkSync(oldToolbar);
console.log('minitool/ 已从 minitool-src/ 生成；未读取网页版源码，未生成 ZIP。');
