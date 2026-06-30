// Verify the app-source block in standalone.html compiles without error.
const fs = require('fs');
const path = require('path');
const babel = require('@babel/standalone');

const html = fs.readFileSync(path.join(__dirname, '..', 'standalone.html'), 'utf-8');
const match = html.match(/<script type="text\/plain" id="app-source">([\s\S]*?)<\/script>/);
if (!match) {
  console.error('FAIL: no app-source block found');
  process.exit(1);
}

try {
  const out = babel.transform(match[1], { presets: [['react', { runtime: 'classic' }]] });
  if (/\bimport\b/.test(out.code)) {
    console.error('FAIL: output contains an import statement (classic runtime should not emit these)');
    process.exit(1);
  }
  console.log('Babel compile OK — output length:', out.code.length, 'chars, no imports');
} catch (e) {
  console.error('Babel error:', e.message);
  process.exit(1);
}
