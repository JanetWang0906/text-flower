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
for (const [name, data] of [['app.js', app], ['index.html', html], ['style.css', fs.readFileSync(path.join(source, 'style.css'))]]) {
  fs.writeFileSync(path.join(target, name), data);
}
for (const image of ['IMG_0003.jpg', 'IMG_0006.jpg', 'IMG_0045.JPG', 'IMG_0046.JPG']) {
  fs.copyFileSync(path.join(baseline, image), path.join(target, image));
}
// The previous shared stylesheet must not enter a future mini-tool ZIP.
const oldToolbar = path.join(target, 'toolbar.css');
if (fs.existsSync(oldToolbar)) fs.unlinkSync(oldToolbar);
console.log('minitool/ 已从 minitool-src/ 生成；未读取网页版源码，未生成 ZIP。');
