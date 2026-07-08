// 从 public/icon.svg 生成 192x192 与 512x512 PNG，供 PWA manifest 使用。
// 一次性脚本，不进 CI；如需重跑 `node scripts/gen-pwa-icons.cjs`。
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svgPath = path.resolve(__dirname, '..', 'public', 'icon.svg');
const svg = fs.readFileSync(svgPath);

const targets = [
  { size: 192, out: path.resolve(__dirname, '..', 'public', 'pwa-192x192.png') },
  { size: 512, out: path.resolve(__dirname, '..', 'public', 'pwa-512x512.png') },
  { size: 180, out: path.resolve(__dirname, '..', 'public', 'apple-touch-icon.png') },
  { size: 512, out: path.resolve(__dirname, '..', 'public', 'maskable-512x512.png'), maskable: true },
];

(async () => {
  for (const t of targets) {
    const img = sharp(svg, { density: 384 });
    let buf = await img.resize(t.size, t.size).png().toBuffer();
    if (t.maskable) {
      // maskable 图标：把内容缩进到中央 80%（四周留 10% 安全区），避免被圆形/圆角遮罩裁掉
      const inner = Math.round(t.size * 0.8);
      const offset = Math.round((t.size - inner) / 2);
      buf = await sharp(buf)
        .resize(inner, inner)
        .extend({
          top: offset, bottom: offset, left: offset, right: offset,
          background: { r: 0x05, g: 0x08, b: 0x18, alpha: 1 },
        })
        .png()
        .toBuffer();
    }
    fs.writeFileSync(t.out, buf);
    console.log(`wrote ${path.basename(t.out)} (${t.size}x${t.size}${t.maskable ? ', maskable' : ''})`);
  }
})();
