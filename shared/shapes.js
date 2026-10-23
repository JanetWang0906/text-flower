/* Shared shape configuration and SVG sampling. No animation or platform saving. */
(function (root, factory) {
  'use strict';
  const catalog = factory();
  if (typeof module === 'object' && module.exports) module.exports = catalog;
  else root.TextShapes = catalog;
}(typeof window === 'object' ? window : this, function () {
  'use strict';
const BIRTHDAY_TEXT = `生日快乐！把今天的祝福，写成一块只属于你的蛋糕。愿烛光照亮眼前的小小愿望，也照亮新一岁还没走过的路。
愿你有好好吃饭的胃口，有安心入睡的夜晚，有想见就能见的人，也有说走就走的勇气。忙碌的时候记得歇一歇，难过的时候有人愿意听你慢慢说。
吹灭蜡烛之前，请认真许一个愿。愿你喜欢的事都有回响，惦念的人平安顺遂，努力的日子偶尔收获惊喜，平凡的生活也能尝出甜味。
新的一岁，不必急着成为谁。继续做你自己，笑得自在，走得从容。愿你被爱包围，也拥有照顾自己的力量。今天的蛋糕很甜，往后的每一天，都愿你快乐。`;

// Shared configuration only; each platform retains its existing text-rope engine.
const SHAPES = {
  rose: {
    name: '玫瑰', file: './玫瑰路径图.svg', order: [1, 0], grip: '枝叶上端', defaultBackground: 'IMG_0006.jpg',
    idle: '一朵玫瑰，藏着一封信', complete: '原来，这些话都藏在花里',
    unfolding: '枝叶先滑出，花朵接着展开', colorLabel: '花与叶的颜色',
    parts: [{ id: 'flower', label: '花朵', selector: '.cls-2' }, { id: 'leaf', label: '枝叶', selector: '.cls-1' }],
    palettes: { light: ['#d35159', '#4b8b3d', '#34312e'], dark: ['#f2a2b0', '#b8d99b', '#f4efe6'] }
  },
  cake: {
    paletteBackgrounds: { light: 'IMG_0003.jpg', dark: 'IMG_0046.JPG' },
    name: '蛋糕', file: './蛋糕/蛋糕.svg', order: [2, 1, 0, 3], grip: '托盘左端', defaultBackground: 'IMG_0046.JPG', intro: true,
    idle: '一块蛋糕，藏着一封信', complete: '原来，这些祝福都藏在蛋糕里',
    unfolding: '托盘、蛋糕、奶油和蜡烛依次展开', colorLabel: '蛋糕的颜色',
    parts: [{ id: 'cream', label: '奶油', selector: '.cls-4' }, { id: 'cake-body', label: '蛋糕', selector: '.cls-1' }, { id: 'plate', label: '托盘', selector: '.cls-2' }, { id: 'candle', label: '蜡烛', selector: '.cls-3' }],
    palettes: { light: ['#4c7900', '#ffc834', '#634600', '#d19d01', '#34312e'], dark: ['#ffb4c0', '#ddd0f2', '#b6d5fb', '#ffda94', '#f4efe6'] }
  },
  firework: {
    name: '烟花', motion: 'firework', procedural: true, intro: true, order: [0],
    file: './烟花/firework [转换]2.svg', center: [564.87, 548.36], diameter: 520,
    grip: '画布任意位置', defaultBackground: 'IMG_0046.JPG',
    paletteBackgrounds: { light: 'IMG_0003.jpg', dark: 'IMG_0046.JPG' },
    footnote: '点击哪里，就从哪里绽放文字烟花；自动模式会在随机位置逐朵盛开',
    idle: '让心愿，在夜空里一朵朵绽放', complete: '原来，这些心愿都藏在烟花里',
    unfolding: '文字烟花，沿各自的弧线逐朵绽放', colorLabel: '烟花的颜色',
    canvasLabel: '文字烟花画布。点击任意位置，从那里绽放一朵烟花；自动模式在随机位置交错、逐朵绽放。所有文字落地后整理成信。',
    parts: [{ id: 'firework-gold', label: '金色', selector: '.cls-1' }, { id: 'firework-pink', label: '粉色', selector: '.cls-2' }, { id: 'firework-blue', label: '蓝色', selector: '.cls-3' }],
    palettes: { light: ['#b3851a', '#cb4e80', '#4085b4', '#34312e'], dark: ['#fff3ae', '#f5b2a9', '#b2d7ed', '#f4efe6'] }
  },
  gift: {
    paletteBackgrounds: { light: 'IMG_0003.jpg', dark: 'IMG_0046.JPG' },
    name: '礼物', file: './礼物/gift2 [转换].svg', order: [2, 1, 0], grip: '蝴蝶结左端', defaultBackground: 'IMG_0046.JPG', intro: true,
    guide: { x: -55, y: -54 }, resetLightOnPalette: true,
    idle: '一份礼物，藏着一封信', complete: '原来，这些心意都藏在礼物里',
    unfolding: '蝴蝶结、盒盖与丝带、盒身从上往下依次展开', colorLabel: '礼物的颜色',
    parts: [{ id: 'gift-box', label: '盒身', selector: '.cls-1', offsetY: 14 }, { id: 'gift-lid', label: '盒盖与丝带', selector: '.cls-3' }, { id: 'gift-bow', label: '蝴蝶结', selector: '.cls-2', offsetY: -24 }],
    palettes: { light: ['#e1b860', '#f2c10d', '#75aadb', '#34312e'], dark: ['#f6bfd2', '#ffb4c0', '#ffda94', '#f4efe6'] }
  }
};

SHAPES.firework.svg = `<svg id="_图层_1" data-name="图层 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1155.79 1154.41">
  <defs>
    <style>
      .cls-1 {
        stroke: #f7d878;
      }

      .cls-1, .cls-2, .cls-3 {
        fill: none;
        fill-rule: evenodd;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-width: 14px;
      }

      .cls-2 {
        stroke: #ec78a2;
      }

      .cls-3 {
        stroke: #92cdf0;
      }
    </style>
  </defs>
  <path class="cls-2" d="M275.52,49.03s219.65,142.72,289.35,499.33"/>
  <path class="cls-2" d="M564.87,548.36s126.27-384.93,359.77-492.34"/>
  <path class="cls-2" d="M1141.78,361.91s-357.43-44.71-576.92,186.45"/>
  <path class="cls-2" d="M1148.79,673.26s-289.72-180.94-583.92-124.9"/>
  <path class="cls-2" d="M824.23,1067.07s-44.55-322.57-259.36-518.7"/>
  <path class="cls-3" d="M291.86,1067.07s46.52-292.21,273.01-518.7"/>
  <path class="cls-2" d="M7,723.83s223.97-203.49,557.87-175.47"/>
  <path class="cls-2" d="M9.33,375.92s298.69-58.72,555.53,172.44"/>
  <path class="cls-1" d="M118.74,843.58s102.9-214.06,411.11-286.44"/>
  <path class="cls-2" d="M186.79,999.35s79.21-278.21,378.08-450.99"/>
  <path class="cls-2" d="M555.18,1147.41s-53.36-251.14,9.68-599.05"/>
  <path class="cls-1" d="M574.04,575.42s98.42,269.84,96.09,522.01"/>
  <path class="cls-3" d="M564.87,548.36s373.77,191.81,408.8,408.96"/>
  <path class="cls-1" d="M595.49,552.13s371.17,59.95,445.89,232.74"/>
  <path class="cls-3" d="M564.87,548.36s313.71-169.21,583.92-48.69"/>
  <path class="cls-1" d="M574.97,528.31s192.66-298.05,447.08-320.51"/>
  <path class="cls-1" d="M560.87,503.17S481.66,178.91,507.35,7"/>
  <path class="cls-3" d="M564.87,548.36s0-343.93,164.1-508.67"/>
  <path class="cls-1" d="M109.74,273.01s251.54,39.79,440.18,242.73"/>
  <path class="cls-3" d="M29.31,538.1s234.35-125.17,535.56,10.26"/>
  <path class="cls-1" d="M546.92,580.42s-148.31,309.97-136.64,510.33"/>
  <path class="cls-3" d="M137.55,150.53s331.95,104.55,427.32,397.83"/>
</svg>`;

SHAPES.firework.defaultText = `送你一束用文字点亮的烟花，把心底的小小愿望，写进每一道向外舒展的光里。愿这一刻的明亮，陪你走过往后平凡又珍贵的日子。
愿你抬头时有星光，回家时有灯火，疲惫时有可以安心停靠的地方。愿那些还没说出口的心愿，都能在某个温柔的夜晚，慢慢找到自己的回响。
生活不必每一天都热烈，也可以是一顿认真做的晚饭，一段不赶时间的散步，一句刚好听见的关心。愿你珍惜眼前的小小快乐，也保留向远处出发的勇气。
让这些字句从中心出发，沿着各自的弧线飞向夜空。等它们轻轻落下，再替我把祝福整理成一封信，交到你的手里。
愿你始终有想见的人，有值得期待的明天，有重新开始的力气。今夜的烟花为你盛开，往后的日子，也愿你心里常有光。`;


SHAPES.cake.defaultText = BIRTHDAY_TEXT;
SHAPES.gift.defaultText = `送你一份小小的礼物，把想说的话，悄悄藏进每一道丝带里。愿你打开它的时候，刚好也收下一点惊喜，一点温柔，和一个属于自己的好心情。
愿你在忙碌的日子里，也能留一点时间给喜欢的事。听一首歌，走一段路，看一看傍晚的天空，让平凡的一天也有值得记住的瞬间。
不必等到特别的节日，才值得被认真惦念。那些努力过的时刻，那些藏在心里的愿望，都有人愿意轻轻接住，陪你慢慢走向更远的地方。
如果今天有一点累，就先歇一歇；如果遇见了开心的事，也别忘了好好庆祝。愿你的生活有光，有爱，有不期而遇的美好。
这份礼物没有期限，里面的祝福也是。愿你始终被温柔以待，也记得把温柔留一份给自己。`;
// Geometry from 礼物/gift2 [转换].svg; checked against that source by tests/gift-shape.cjs.
SHAPES.gift.svg = `<svg id="_图层_1" data-name="图层 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1063 860.93">
  <defs>
    <style>
      .cls-1 {
        stroke: #f6bfd2;
      }

      .cls-1, .cls-2, .cls-3 {
        fill: none;
        fill-rule: evenodd;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-width: 14px;
      }

      .cls-2 {
        stroke: #f9d784;
      }

      .cls-3 {
        stroke: #f7c0bf;
      }
    </style>
  </defs>
  <path class="cls-1" d="M180,512.77l26,273s5.17,65.68,78,67,468,1,468,1c0,0,94.74,6.98,101-72s17-287,17-287"/>
  <path class="cls-3" d="M485,477.77c-98.54-.95-224.11,3.37-318-1-21.42-1-36.69-21.67-37-39-.32-17.76-2.53-49.27-1-71,1.26-17.89,22.67-34.52,49-35,157.81-2.86,513.23-7.57,680-7,61.91.21,61,50,61,50v65s-.38,33.72-50,35c-40.05,1.04-164.74,3.11-288,4-73.63.53-89.65-34.6-91-64-1.82-39.78,15.63-69.4,43-69,32.94.48,43.98,32.57,42,73-1.92,39.13-86.1,56.75-86,104,.27,132.57-.57,214.88-1,249-.59,46.67,13.33,63.11,42,63,20.84-.08,37.18-13.11,38-62,1.31-78.05,1.97-150.89,1-262"/>
  <path class="cls-2" d="M7,322.77c59.28.47,114.45-14.29,148-52,19.72-22.17,23.89-39.97,21-50-3.14-10.9-13.71-23.07-27-23-13.69.07-25.34,13.09-27,25-1.98,14.15,4.02,33.42,44,53,108.16,52.97,310.8-1.98,308-10-11.7-33.48-5.43-176.12-104-223-29.45-14.01-90.26-13.87-124,21-46.12,47.66-18.08,119.22,14,144,63.22,48.82,120.04,70.45,215,58,12.38-1.62,26.32,24.23,50,25,17.3.56,60.13-25.85,62-71,1.31-31.58-17.39-69.87-55-72-35.43-2.01-59.58,40.43-59,67,1.11,50.59,34.45,73.69,60,76,8.04.73,36.73-11.55,46-28,8.58-15.23,125.7,26.29,226-64,51.33-46.2,50.65-106.97,20-149-37.57-51.52-102.48-56.05-153-16-76.59,60.71-79.44,193.16-78,220,2.92,54.46,77.79,52.87,99,48,47.92-10.99,81.93-26.74,132-51,70.92-34.37,95.74-48.81,136-36,31.02,9.87,45.72,49.72,45,79-.44,17.95-6.85,28.16-12,32-11.54,8.61-30.23,13.31-36-1-5.86-14.53,4.28-22.65,15-29,18.09-10.71,49.24-1.76,83,29"/>
</svg>`;

// Sampling is identical in web and offline builds. The mini-tool alone keeps
// the original rose's top alignment; all other artwork is centered.
function samplePaths(svgText, config, options) {
  // The procedural text emitter needs a single allocation lane for the
  // existing letter engine. This lane is never painted or used as a firework.
  if (config.procedural) return [[{ x: 450, y: 600 }, { x: 451, y: 600 }]];
  const xml = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  if (xml.querySelector('parsererror')) throw new Error(`${config.name}路径文件无法解析。`);
  const svg = document.importNode(xml.documentElement, true);
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
  document.body.append(svg);
  try {
    const box = svg.viewBox.baseVal;
    const scale = Math.min(760 / box.width, 1060 / box.height);
    const ox = (900 - box.width * scale) / 2 - box.x * scale;
    const oy = (options && options.top !== undefined ? options.top : (1200 - box.height * scale) / 2) - box.y * scale;
    return config.parts.map(part => {
      const path = svg.querySelector(part.selector);
      if (!path) throw new Error(`SVG 中缺少${part.label}路径。`);
      const length = path.getTotalLength(), samples = Math.ceil(length * scale / 1.5), points = [];
      for (let i = 0; i <= samples; i++) {
        const p = path.getPointAtLength(length * i / samples);
        points.push({ x: ox + p.x * scale, y: oy + p.y * scale + (part.offsetY || 0) });
      }
      return points;
    });
  } finally { svg.remove(); }
}

// The SVG is sampled once and shared by all local bursts. Coordinates are
// offsets from its real common root, so clicking always places that root.
let cachedFireworkGeometry;
function fireworkGeometry() {
  if (cachedFireworkGeometry) return cachedFireworkGeometry;
  const config = SHAPES.firework;
  const xml = new DOMParser().parseFromString(config.svg, 'image/svg+xml');
  if (xml.querySelector('parsererror')) throw new Error('烟花路径文件无法解析。');
  const svg = document.importNode(xml.documentElement, true);
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
  document.body.append(svg);
  try {
    const box = svg.viewBox.baseVal, scale = (config.diameter - 20) / Math.max(box.width, box.height);
    const rays = Array.from(svg.querySelectorAll('path')).map(path => {
      const length = path.getTotalLength(), count = Math.max(2, Math.ceil(length * scale / 1.5));
      const points = [];
      for (let i = 0; i <= count; i++) {
        const p = path.getPointAtLength(length * i / count);
        points.push({ x: (p.x - config.center[0]) * scale, y: (p.y - config.center[1]) * scale });
      }
      if (Math.hypot(points[0].x, points[0].y) > Math.hypot(points[count].x, points[count].y)) points.reverse();
      let span = 0;
      points.forEach((p, i) => { if (i) span += Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y); p.s = span; });
      const color = config.parts.findIndex(part => path.matches(part.selector));
      if (color < 0) throw new Error('烟花路径颜色缺失。');
      return { points, length: span, color };
    });
    const points = [].concat(...rays.map(ray => ray.points));
    const bounds = { left: Math.min(...points.map(p => p.x)), right: Math.max(...points.map(p => p.x)),
      top: Math.min(...points.map(p => p.y)), bottom: Math.max(...points.map(p => p.y)) };
    cachedFireworkGeometry = { rays, bounds, diameter: config.diameter, source: config.file };
    return cachedFireworkGeometry;
  } finally { svg.remove(); }
}

// Keep the gift label near its left bow endpoint, clear of the first letters.
function shapeGuidePosition(config, tip) {
  if (!config.guide) return null;
  return { x: Math.max(35, Math.min(700, tip.x + config.guide.x)),
    y: Math.max(60, Math.min(1160, tip.y + config.guide.y)) };
}

return { SHAPES, samplePaths, shapeGuidePosition, fireworkGeometry };
}));
