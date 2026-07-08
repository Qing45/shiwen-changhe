// 把 public/icon.svg 转成 Android 各种密度的 mipmap launcher 图标，
// 覆盖 Capacitor 默认的 Capacitor logo。一次性脚本。
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svg = fs.readFileSync(path.resolve(__dirname, '..', 'public', 'icon.svg'));

// Android 各密度的 launcher icon 边长（px）。hdpi 是 baseline。
const sizes = {
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192,
};

const resRoot = path.resolve(__dirname, '..', 'android', 'app', 'src', 'main', 'res');

(async () => {
  for (const [density, size] of Object.entries(sizes)) {
    const dir = path.join(resRoot, `mipmap-${density}`);
    fs.mkdirSync(dir, { recursive: true });

    // 正方形 launcher
    const buf = await sharp(svg).resize(size, size).png().toBuffer();
    fs.writeFileSync(path.join(dir, 'ic_launcher.png'), buf);

    // 圆形 launcher（same image；Android 系统会自己套遮罩）
    fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), buf);

    // foreground：只画中心 70% 区域（自适应图标 108dp 画布的安全区是 66dp ≈ 61%），
    // 留出余量避免被圆形/圆角/squircle 遮罩裁掉笔画
    const inner = Math.round(size * 0.7);
    const fgBuf = await sharp(svg)
      .resize(inner, inner)
      .png()
      .toBuffer();
    fs.writeFileSync(path.join(dir, 'ic_launcher_foreground.png'), fgBuf);

    console.log(`wrote mipmap-${density}: launcher + round + foreground (${size}px)`);
  }
})();
