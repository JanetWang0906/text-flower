/* Web-only language, copy and starter letters. Shared mini-tool data stays intact. */
(function () {
  'use strict';
  const key = 'text-in-bloom-language';
  let language = 'en';
  try { if (localStorage.getItem(key) === 'zh') language = 'zh'; } catch (error) {}
  const dictionary = new Map([
    ['字里花间', 'Text in Bloom'], ['拆开收到的礼物', 'Open a gift'], ['文字造型', 'Letter shape'],
    ['玫瑰', 'Rose'], ['蛋糕', 'Cake'], ['礼物', 'Gift'], ['烟花', 'Fireworks'],
    ['保存高清图片', 'Save image'], ['保存分享二维码', 'Save gift QR'], ['保存视频', 'Save video'], ['礼物二维码', 'Gift-QR'],
    ['正在展开信纸…', 'Preparing your paper…'], ['文字与动画设置', 'Letter and animation settings'],
    ['生花', 'Bloom'], ['成形', 'Form'], ['重放', 'Replay'], ['展开', 'Unfold'], ['暂停', 'Pause'],
    ['重新展开', 'Unfold again'], ['继续展开', 'Resume'], ['展开这封信', 'Open this letter'], ['生成文字烟花', 'Replay fireworks'],
    ['继续', 'Resume'], ['再放一次', 'Replay'], ['自动放完', 'Play all'], ['绽放', 'Bloom'],
    ['编辑文字', 'Edit text'], ['写给你的文字', 'Your letter'], ['应用文字', 'Apply text'],
    ['按字宽铺满玫瑰，每个字只出现一次', 'Each character is used once to fill the rose.'],
    ['点击播放，或从枝叶上端轻轻向下拉。', 'Choose “Unfold”, or gently pull the handle.'],
    ['自动播放', 'Automatic'], ['亲手牵引', 'Drag by hand'], ['点击绽放', 'Tap to bloom'], ['打开这封信', 'Open this letter'],
    ['自动', 'Auto'], ['手动', 'Manual'], ['手动牵引文字', 'Drag the letters by hand'], ['手动点击绽放', 'Tap to bloom fireworks'],
    ['信纸背景', 'Paper'], ['棉纹纸', 'Cotton'], ['金箔纸', 'Gold fleck'], ['墨皮纸', 'Ink'], ['星夜纸', 'Starlight'],
    ['我的背景', 'My image'], ['＋ 上传背景', '+ Upload image'], ['段落字号', 'Letter size'],
    ['细密 · 12', 'Fine · 12'], ['舒展 · 32', 'Large · 32'], ['细腻 · 12', 'Fine · 12'], ['醒目 · 48', 'Large · 48'],
    ['自动适配字号', 'Fit text to shape'], ['花与叶的颜色', 'Rose colors'], ['蛋糕的颜色', 'Cake colors'],
    ['礼物的颜色', 'Gift colors'], ['烟花的颜色', 'Firework colors'], ['花朵', 'Petals'], ['枝叶', 'Leaves'],
    ['奶油', 'Frosting'], ['托盘', 'Plate'], ['蜡烛', 'Candle'], ['盒身', 'Box'], ['盒盖与丝带', 'Lid & ribbon'],
    ['蝴蝶结', 'Bow'], ['金色', 'Gold'], ['粉色', 'Pink'], ['蓝色', 'Blue'], ['画布配色', 'Color theme'],
    ['浅色背景', 'Light'], ['深色背景', 'Dark'], ['段落颜色', 'Letter ink'], ['恢复默认色', 'Reset colors'],
    ['牵动整根文字绳，松手后沿路径滑出并自然下落，全部落地后整理成信', 'Drag the strand and let go. The letters fall, then gather into your letter.'],
    ['点击哪里，就从哪里绽放文字烟花；自动模式会在随机位置逐朵盛开', 'Tap anywhere to bloom a firework, or let automatic mode choose each spot.'],
    ['裁一张属于你的信纸', 'Make it your paper'], ['拖动图片调整位置，缩放选择范围。保留框内的竖版画面。', 'Drag to position your image and zoom to crop. The portrait area inside the frame will be used.'],
    ['背景裁切预览，可拖动或使用方向键调整图片位置', 'Image crop preview. Drag or use arrow keys to reposition.'],
    ['缩放', 'Zoom'], ['重置裁切', 'Reset crop'], ['取消', 'Cancel'], ['使用这张背景', 'Use this image'], ['知道了', 'OK'],
    ['1800 × 2400 像素。可右键或长按图片保存，也可以点击下方按钮下载。', '1800 × 2400 pixels. Save the image with a long press or right-click, or download it below.'],
    ['当前文字作品的高清图片', 'High-resolution image of your letter artwork'], ['下载图片', 'Download image'], ['关闭预览', 'Close preview'],
    ['字里花间 · 把心意交给你', 'A little letter, made for you'], ['今天，想送出还是收下？', 'Make a gift, or open one?'],
    ['把祝福做成礼物，或拆开别人为你准备的那一份。', 'Turn your words into a gift, or open one someone made for you.'],
    ['制作一份礼物', 'Make a gift'], ['从默认玫瑰开始，写下你的心意。', 'Start with a rose and make the words your own.'],
    ['从相册选择礼物二维码，在这里亲手打开。', 'Choose a gift QR image to open your letter here.'],
    ['选择收到的礼物二维码图片', 'Choose a gift QR image'], ['一份可以亲手打开的心意', 'A gift waiting to unfold'],
    ['请将原图发给收礼人。对方打开「字里花间」，选择「拆开收到的礼物」并上传此图，就能体验你的定制动画。祝福与设置直接保存在码里，离线也能拆开。', 'Send the original image. The recipient can open Text in Bloom, choose “Open a gift” and select it to play your letter. The words and settings are stored in the code, so it works offline.'],
    ['包含当前祝福文字、造型、颜色和动画设置的礼物二维码', 'Gift QR containing your words, shape, colors and animation settings'],
    ['保存二维码', 'Save QR image'], ['自动重播完整动画，完成后下载 MP4。生成期间请保持页面在前台。', 'Your full animation will replay and download as an MP4. Keep this page in the foreground while it is being made.'],
    ['正在生成的视频画面', 'Video being generated'], ['生成的视频预览', 'Generated video preview'],
    ['720 × 960 像素 · 24 帧／秒 · 无声', '720 × 960 pixels · 24 fps · Silent'], ['下载 MP4', 'Download MP4'],
    ['重新生成', 'Generate again'], ['取消生成', 'Cancel'], ['关闭', 'Close'],
    ['一朵玫瑰，藏着一封信', 'A rose with a letter inside'], ['一块蛋糕，藏着一封信', 'A cake with a letter inside'],
    ['一份礼物，藏着一封信', 'A gift with a letter inside'], ['原来，这些话都藏在花里', 'Every word was waiting inside the rose'],
    ['原来，这些祝福都藏在蛋糕里', 'All these wishes, tucked inside a cake'], ['原来，这些心意都藏在礼物里', 'A gift filled with words for you'],
    ['原来，这些心愿都藏在烟花里', 'Every firework held a wish for you'],
    ['枝叶先滑出，花朵接着展开', 'The leaves unfurl, then the petals follow'],
    ['托盘、蛋糕、奶油和蜡烛依次展开', 'The plate, cake, frosting and candle unfold'],
    ['蝴蝶结、盒盖与丝带、盒身从上往下依次展开', 'The bow, ribbon and box unfold from top to bottom'],
    ['文字烟花，沿各自的弧线逐朵绽放', 'Words bloom along arcs of light'],
    ['松手，让文字绳自然落下', 'Let go and let the letters fall'], ['已暂停 · 等你继续', 'Paused · Whenever you are ready'],
    ['等每一个字落地，再整理成信', 'Waiting for the letters to land'], ['把字句，整理成写给你的信', 'Gathering the words into your letter'],
    ['让这封信，慢慢舒展', 'Letting your letter unfold'], ['点一下，让文字为你绽放', 'Tap to let your words bloom'],
    ['松手，读这封信', 'Let go to read'], ['轻轻拨动文字', 'Nudge the letters'], ['轻轻牵动文字', 'Gently drag'],
    ['拨动这里', 'Nudge here'], ['拖动这里', 'Drag here'],
    ['点哪里，就从哪里绽放一朵文字烟花。上一朵回落后，继续点下一个位置，直到放完这封信。', 'Tap anywhere to bloom a firework of words. When it falls, tap another spot to continue your letter.'],
    ['每次绽放一朵，上一朵回落后，再在另一个随机位置接着盛开。也可以亲手点击选择爆心。', 'One firework blooms at a time, then another follows in a new spot. You can also tap to choose where it blooms.'],
    ['把落下的字句，整理成写给你的信', 'Gathering the fallen words into your letter'], ['等每一个字轻轻落地', 'Letting every letter settle'],
    ['点哪里，就从哪里开出一朵文字烟花', 'Tap anywhere to bloom a firework of words'],
    ['等这一朵回落，再从你点的位置接着绽放', 'Your next firework will bloom where you tapped'],
    ['烟花都已绽放，等字句轻轻落地', 'All wishes have bloomed; letting the letters land'],
    ['还有心愿没放完，再点一个位置继续', 'There are more wishes. Tap another spot to continue'],
    ['这一朵正在绽放，回落后再点下一朵', 'Let this firework fall, then tap for the next'],
    ['让心愿，在夜空里一朵朵绽放', 'Let your wishes bloom across the night'],
    ['文字烟花画布。点击任意位置，从那里绽放一朵烟花；自动模式在随机位置交错、逐朵绽放。所有文字落地后整理成信。', 'Firework canvas. Tap anywhere to bloom a firework, or play automatically. When all letters land, they gather into a letter.'],
    ['每次用一部分文字绽放烟花，可写 1–2000 个字素；文字不重复填充。', 'Each firework uses the next part of your letter. Use 1–2000 characters; words are never repeated to fill the shape.'],
    ['输入过长，请按当前建议范围精简文字。', 'Your text is too long. Shorten it to fit the suggested range.'],
    ['这份礼物的文字无法按原字号组成完整造型，请让送礼人检查文字后重新保存二维码。', 'This letter cannot fill the shape at its original size. Ask the sender to check it and save a new QR image.'],
    ['当前使用了自定义背景照片，单张二维码无法完整保存照片。请先选择一种内置信纸，再保存分享二维码。', 'A QR code cannot include a custom photo. Choose a built-in paper before saving your gift QR.'],
    ['未能生成高清图片，请重试。', 'The image could not be generated. Please try again.'], ['正在生成…', 'Generating…'],
    ['正在下载…', 'Downloading…'], ['已导出图片', 'Image download started'],
    ['下载失败，可右键或长按图片保存，或重试下载。', 'The download could not start. Try again, or save the image with a long press or right-click.'],
    ['无法读取这张图片，请换一张 JPG、PNG 或 WebP 图片。', 'This image could not be read. Try another JPG, PNG or WebP image.'],
    ['无法读取这张图片，请选择 PNG、JPG 或 WebP 格式的二维码图片。', 'This image could not be read. Choose a PNG, JPG or WebP gift QR image.'],
    ['信纸尚未准备好，请刷新后重试。', 'The paper is not ready. Refresh the page and try again.'], ['正在准备信纸…', 'Preparing your paper…'],
    ['正在拆开礼物…', 'Opening your gift…'], ['图片超过 20 MB，请选择原始二维码图片或裁去多余的空白后重试。', 'This image is over 20 MB. Choose the original QR image, or crop extra space and try again.'],
    ['请选择 PNG、JPG 或 WebP 格式的二维码图片。', 'Choose a PNG, JPG or WebP gift QR image.'], ['这张图片没有可读取的画面，请换一张。', 'This image has no readable content. Try another image.'],
    ['没有找到可识别的二维码，请选择清晰、完整且四周留有白边的礼物二维码图片。', 'No readable QR code was found. Choose a clear, complete gift QR image with its white border.'],
    ['礼物已拆开，点击「展开」或亲手牵引，读读藏在里面的话。', 'Your gift is ready. Choose “Unfold” or gently drag to read the words inside.'],
    ['未能识别这份礼物，请重试。', 'This gift could not be read. Please try again.'],
    ['文字尚未应用，请先点击「应用文字」，再保存分享二维码。', 'Apply your edited text before saving the gift QR.'],
    ['字里花间 · 有一份礼物送给你', 'Text in Bloom · A gift for you'], ['打开字里花间 → 拆开收到的礼物 → 选择此图', 'Text in Bloom → Open a gift → Choose this image'],
    ['祝福与设置都在码里 · 请发送原图', 'Your words are inside · Send the original image'],
    ['未能生成分享二维码，请重试。', 'The gift QR could not be generated. Please try again.'], ['正在保存…', 'Saving…'],
    ['保存失败，请检查相册权限后重试，也可长按或右键保存上方二维码。', 'Saving failed. Try again, or save the QR image above with a long press or right-click.'],
    ['已下载礼物二维码，请将原图发给收礼人。', 'Gift QR download started. Send the original image to your recipient.'],
    ['礼物数据不完整，请重新选择二维码。', 'The gift data is incomplete. Choose the QR image again.'],
    ['暂不支持这份礼物的数据版本，请使用与送礼人相同或更新的版本打开。', 'This gift uses an unsupported version. Open it with the same or a newer version of Text in Bloom.'],
    ['礼物中的文字或设置不完整，无法打开。请让送礼人重新保存分享二维码。', 'The letter or settings are incomplete. Ask the sender to save a new gift QR image.'],
    ['这份礼物超出单张二维码的容量，请精简祝福文字后重试。文字不会被截断。', 'This letter is too large for one QR code. Shorten it and try again. Your words will not be cut off.'],
    ['这不是「字里花间」的礼物二维码，请选择送礼人保存的分享二维码图片。', 'This is not a Text in Bloom gift QR. Choose the gift QR image saved by the sender.'],
    ['礼物数据过大，无法打开。', 'This gift contains too much data to open.'], ['礼物数据已损坏，请重新选择原始二维码图片。', 'The gift data is damaged. Choose the original QR image again.'],
    ['视频已生成，当前浏览器无法预览。可点击「下载 MP4」后播放。', 'Your video is ready, but this browser cannot preview it. Choose “Download MP4” to watch it.'],
    ['生成因页面切到后台而取消，请回到前台重新生成。', 'Video generation stopped when the page went into the background. Return here and generate it again.'],
    ['当前浏览器不支持 MP4 生成，请换用支持 MP4 录制的浏览器或使用系统录屏。高清图片仍可保存。', 'This browser cannot generate MP4 video. Use a browser with MP4 recording support or a screen recorder. You can still save an image.'],
    ['正在生成视频…', 'Generating your video…'], ['视频超过 32 MB，请调快动画速度或减少文字后重试。', 'The video is over 32 MB. Increase the animation speed or shorten your letter, then try again.'],
    ['视频编码失败，请重新生成或使用系统录屏。', 'Video encoding failed. Generate it again or use a screen recorder.'],
    ['未能生成视频，请保持页面在前台后重试。', 'No video was generated. Keep the page in the foreground and try again.'],
    ['无法开始生成视频，请重新生成或使用系统录屏。', 'Video generation could not start. Try again or use a screen recorder.'],
    ['生成超过 120 秒，请调快动画速度或减少文字后重试。', 'Generation took over 120 seconds. Increase the speed or shorten your letter and try again.'],
    ['动画超过 120 秒，请调快速度或减少文字后重试。', 'The animation is over 120 seconds. Increase the speed or shorten your letter and try again.'],
    ['信已展开，正在保留结尾…', 'Your letter has unfolded. Holding the final frame…'],
    ['生成中断，请重新生成或使用系统录屏。', 'Video generation was interrupted. Try again or use a screen recorder.'],
    ['自动下载未能开始，可点击「下载 MP4」重试。', 'The automatic download could not start. Choose “Download MP4” to try again.']
  ]);
  const patterns = [
    [/^(.+)字号$/, (_, shape) => t(shape) + ' size'],
    [/^回到(.+)$/, (_, shape) => 'Reset ' + t(shape).toLowerCase()],
    [/^生成文字(.+)$/, (_, shape) => 'Form a ' + t(shape).toLowerCase()],
    [/^(生花|成形|重放|展开) ([\d.]+)×$/, (_, action, speed) => t(action) + ' ' + speed + '×'],
    [/^(生花|成形|重放|展开)速度 ([\d.]+) 倍，点击切换$/, (_, action, speed) => t(action) + ' speed ' + speed + '×. Click to change.'],
    [/^切换(生花|成形|重放|展开)速度$/, (_, action) => 'Change ' + t(action).toLowerCase() + ' speed'],
    [/^细腻 · (\d+)$/, (_, value) => 'Fine · ' + value],
    [/^(\d+) 字素$/, (_, count) => count + ' characters'],
    [/^\d+ 号字建议约 .+$/, () => 'Fit depends on letter width. Use “Fit text to shape” after editing; every character is kept.'],
    [/^先写下一句话，再让它组成(.+)。$/, (_, shape) => 'Write a few words first, then turn them into a ' + t(shape).toLowerCase() + '.'],
    [/^文字(太少|太多)，无法铺满完整(.+)。.+$/, (_, amount, shape) => 'There is ' + (amount === '太少' ? 'too little' : 'too much') + ' text to fill the ' + t(shape).toLowerCase() + '. Adjust your letter or choose “Fit text to shape”.'],
    [/^文字较少，字距已自动拉开.*。$/, () => 'Letter spacing adjusted to fill the shape.'],
    [/^已适配(.+)字号为 (\d+)。$/, (_, shape, size) => t(shape) + ' size adjusted to ' + size + '.'],
    [/^(.+)路径未能加载，请刷新页面重试。$/, (_, shape) => 'The ' + t(shape).toLowerCase() + ' could not load. Refresh the page and try again.'],
    [/^文字(.+)动画。拖动.+$/, (_, shape) => t(shape) + ' letter animation. Drag the handle and let go. The letters fall and gather into your letter.'],
    [/^文字(.+)预览$/, (_, shape) => t(shape) + ' preview'],
    [/^拖动.+圆圈，文字会跟随手指牵动；.+$/, () => 'Drag the handle to guide the strand. Let go and the letters will fall, then gather into your letter.'],
    [/^点击播放，(.+)会慢慢展开成一封信。.+$/, (_, shape) => 'Choose “Unfold” to open your ' + t(shape).toLowerCase() + ' letter, or gently drag the handle.'],
    [/^从.+，轻轻拉开$/, () => 'Gently pull the handle'],
    [/^让字句，慢慢组成(.+)$/, (_, shape) => 'Letting the words form a ' + t(shape).toLowerCase()],
    [/^字里花间 · (.+)$/, (_, rest) => 'Text in Bloom · ' + t(rest)],
    [/^字里花间-(.+)(\.png|\.mp4)$/, (_, shape, ext) => 'Text-in-Bloom-' + t(shape) + ext],
    [/^正在生成视频 · (\d+) 秒$/, (_, seconds) => 'Generating video · ' + seconds + ' seconds'],
    [/^MP4 已生成 · ([\d.]+) MB。.+$/, (_, size) => 'MP4 ready · ' + size + ' MB. Download started. If it does not appear, choose “Download MP4”.']
  ];
  const reverse = new Map(Array.from(dictionary, ([zh, en]) => [en, zh]));
  function t(value) {
    if (typeof value !== 'string') return value;
    const source = reverse.get(value) || value;
    if (language === 'zh') return source;
    let result = dictionary.get(source);
    if (!result) for (const [pattern, translate] of patterns) if (pattern.test(source)) { result = source.replace(pattern, translate); break; }
    if (result && result !== source) reverse.set(result, source);
    return result || source;
  }
  const chineseRose = document.getElementById('message').value;
  const defaults = {
    zh: Object.keys(window.TextShapes.SHAPES).reduce((letters, name) => { if (name !== 'rose') letters[name] = window.TextShapes.SHAPES[name].defaultText; return letters; }, { rose: chineseRose }),
    en: {
      rose: `I have tucked these words inside a rose for you to open whenever you need a little kindness. May there be sunlight on your windowsill, a favorite song on your way home, and someone who listens.
You do not have to make every day remarkable. A good meal, a deep breath, a laugh that catches you by surprise: these are beautiful ways to be alive. Rest when you need to, and let a quiet day be enough.
There is no grand occasion for this letter. I simply wanted you to know that you are thought of, your ordinary days matter, and there is gentle light ahead. Keep a little of this rose for yourself.`,
      cake: `Make a wish, and take your time. This little cake holds a birthday letter just for you. May the year ahead bring easy laughter, brave little beginnings, and people who make you feel at home.
You do not need to become someone else to deserve a wonderful year. Keep the things that make you curious. Make room for rest, good food, and the kind of joy that arrives without an invitation.
Here is to the mornings you have not met yet, the places waiting to become favorites, and all the ordinary moments that will turn into lovely memories. Happy birthday. I am glad you are here.`,
      gift: `A small gift, with a letter inside. There is no special occasion: I just wanted to send a little warmth your way. I hope it finds you between one busy moment and the next, and gives you a reason to pause.
May you have people who listen, a place where you can be yourself, and something good to look forward to. May the difficult days grow softer, and the happy ones linger a little longer.
You do not have to do anything with these words. Keep them, open them again, or let them quietly brighten your afternoon. Some gifts are simply a way of saying: I was thinking of you, and I hope life is being kind to you.`,
      firework: `Here is a sky full of small wishes for you. A bright beginning, a lighter heart, a little courage when you need it. Let each burst carry something good into the night.
May you laugh often, sleep peacefully, and find delight in things you nearly walked past. May there always be someone to share the view with you, even when the celebration is only a quiet moment at the end of a long day.
When the last light fades, the words will still be here. Keep what you need: a wish, a memory, a reminder that there are beautiful days ahead. Tonight, let your hopes bloom.`
    }
  };
  // Static text bindings are captured once; user letters, filenames and SVG
  // geometry are excluded. Dynamic state uses t() at its point of rendering.
  const bindings = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    if (node.parentElement.closest('script,style,textarea,svg,canvas')) continue;
    if (/[\u3400-\u9fff]/.test(node.nodeValue)) bindings.push({ node, source: node.nodeValue, text: true });
  }
  document.querySelectorAll('[aria-label],[title],[alt]').forEach(element => {
    for (const name of ['aria-label', 'title', 'alt']) if (/[\u3400-\u9fff]/.test(element.getAttribute(name) || '')) bindings.push({ element, name, source: element.getAttribute(name) });
  });
  function render() {
    document.documentElement.lang = language === 'en' ? 'en' : 'zh-CN';
    for (const binding of bindings) {
      if (binding.text && binding.node.isConnected) {
        const current = binding.node.nodeValue;
        const source = current === (binding.last === undefined ? binding.source : binding.last) ? binding.source : current;
        binding.last = source.replace(source.trim(), t(source.trim())); binding.node.nodeValue = binding.last;
      } else if (binding.element && binding.element.isConnected) {
        const current = binding.element.getAttribute(binding.name);
        const source = current === (binding.last === undefined ? binding.source : binding.last) ? binding.source : current;
        binding.last = t(source); binding.element.setAttribute(binding.name, binding.last);
      }
    }
    document.querySelectorAll('[data-language-control]').forEach(control => {
      control.querySelector('.language-code').textContent = language === 'en' ? 'EN' : '中';
      control.querySelector('.language-toggle').setAttribute('aria-label', language === 'en' ? 'Change language' : '切换语言');
      control.querySelectorAll('[data-language]').forEach(button => button.setAttribute('aria-checked', String(button.dataset.language === language)));
    });
  }
  function setLanguage(next) {
    if (!['en', 'zh'].includes(next) || next === language) return;
    const previous = language; language = next;
    try { localStorage.setItem(key, language); } catch (error) {}
    // Translate already-visible notices without touching letter content.
    document.querySelectorAll('.error,#video-status,#loading,#fit-note').forEach(el => { if (el.textContent) el.textContent = t(el.textContent); });
    render(); window.dispatchEvent(new CustomEvent('languagechange', { detail: { language, previous } }));
  }
  document.querySelectorAll('[data-language-control]').forEach((control, index) => {
    const menuId = 'language-menu-' + index;
    control.innerHTML = '<button class="language-toggle" type="button" aria-haspopup="menu" aria-expanded="false" aria-controls="' + menuId + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 6.5h14M5 17.5h14"/></svg><span class="language-code">EN</span></button><div id="' + menuId + '" class="language-menu" role="menu" aria-label="Language / 语言" hidden><button type="button" role="menuitemradio" data-language="en" lang="en">English</button><button type="button" role="menuitemradio" data-language="zh" lang="zh-CN">中文</button></div>';
    const toggle = control.querySelector('.language-toggle'), menu = control.querySelector('.language-menu');
    const close = () => { menu.hidden = true; toggle.setAttribute('aria-expanded', 'false'); };
    toggle.addEventListener('click', () => { menu.hidden = !menu.hidden; toggle.setAttribute('aria-expanded', String(!menu.hidden)); if (!menu.hidden) menu.querySelector('[data-language="' + language + '"]').focus(); });
    menu.addEventListener('click', event => { const button = event.target.closest('[data-language]'); if (button) { setLanguage(button.dataset.language); close(); toggle.focus(); } });
    control.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !menu.hidden) { event.preventDefault(); event.stopPropagation(); close(); toggle.focus(); }
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) && !menu.hidden) {
        event.preventDefault(); const buttons = Array.from(menu.querySelectorAll('button')); const current = buttons.indexOf(document.activeElement);
        buttons[event.key === 'Home' ? 0 : event.key === 'End' ? 1 : (current + 1) % 2].focus();
      }
    });
    document.addEventListener('click', event => { if (!control.contains(event.target)) close(); });
  });
  window.WebI18n = { t, defaults, get language() { return language; }, setLanguage, render };
  document.getElementById('message').value = defaults[language].rose;
  render();
}());
