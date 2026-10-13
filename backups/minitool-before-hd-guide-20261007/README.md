# 小工具专用源码

以 `backups/minitool-original-20260928/` 的原小工具为基础新增蛋糕。

- `app.js` 保留原小工具的动画、18 轮约束求解、落地支撑优化、入场及展开两种速度、手动牵引、文字校验弹窗、背景上传裁切和保存相册；同一引擎处理玫瑰与蛋糕。
- `index.html` 保留原来的按钮行、背景选择位置、并排字号、弹窗和安全区；只增加造型选择与内联蛋糕 SVG。
- `style.css` 保留原 CSS，只追加造型选择和蛋糕四色所需的局部规则。
- `node tests/build-minitool.cjs` 仅将本目录生成到 `minitool/`。不会读项目根目录的网页 JS、HTML 或 CSS，也不会创建 ZIP。
- 本目录是后续小工具修改的入口；项目根目录的网页继续独立维护。网页改动必须经明确选择才能移入小工具。

原始文件的 SHA-256 保存在 `backups/minitool-original-sha256.json`。`backups/minitool-before-isolation-20261006/` 保存隔离前状态，供对比恢复。
