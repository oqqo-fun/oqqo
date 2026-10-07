// Static build. Output goes to dist/ unless OQQO_OUT says otherwise (the gates use temp dirs).
// OQQO_REGISTER points the build at a different register file (gates use synthetic fixtures).
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateRegister, renderSocial, renderCa, renderTiles, renderMeta, renderFavicon, cspString } from './render.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(process.env.OQQO_OUT || join(root, 'dist'));
const regPath = resolve(process.env.OQQO_REGISTER || join(root, 'src', 'register.json'));

const reg = JSON.parse(readFileSync(regPath, 'utf8'));
const errs = validateRegister(reg);
if (errs.length) {
  console.error('register invalid:\n - ' + errs.join('\n - '));
  process.exit(1);
}
const tokens = JSON.parse(readFileSync(join(root, 'src', 'tokens.json'), 'utf8'));

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'css'), { recursive: true });
mkdirSync(join(out, 'js'), { recursive: true });

const tokenCss = ':root {\n' + Object.entries(tokens).map(([k, v]) => '  --' + k + ': ' + v + ';').join('\n') + '\n}\n';
writeFileSync(join(out, 'css', 'tokens.css'), tokenCss);
copyFileSync(join(root, 'src', 'css', 'base.css'), join(out, 'css', 'base.css'));
for (const f of readdirSync(join(root, 'src', 'js'))) copyFileSync(join(root, 'src', 'js', f), join(out, 'js', f));
writeFileSync(join(out, 'favicon.svg'), renderFavicon(tokens));
mkdirSync(join(out, 'assets'), { recursive: true });
for (const [from, to] of [['brand/LOGO OQQO PNG...png', 'logo-light.png'], ['brand/LOGO OQQO JPG.jpg.jpeg', 'logo-dark.jpg'], ['reference/sampul oqqo jpg.jpg.jpeg', 'cover.jpg']]) copyFileSync(join(root, from), join(out, 'assets', to));

const csp = cspString(reg);
let html = readFileSync(join(root, 'src', 'index.html'), 'utf8');
html = html
  .replace('<!--@CSP-->', '<meta http-equiv="Content-Security-Policy" content="' + csp + '">')
  .replace('<!--@META-->', renderMeta(reg, tokens))
  .replace('<!--@SOCIAL-->', renderSocial(reg))
  .replace('<!--@CA-->', renderCa(reg))
  .replace('<!--@TILES-->', renderTiles(reg));
writeFileSync(join(out, 'index.html'), html);

writeFileSync(join(out, '_headers'),
  '/*\n' +
  '  Content-Security-Policy: ' + cspString(reg, { headerOnly: true }) + '\n' +
  '  X-Content-Type-Options: nosniff\n' +
  '  Referrer-Policy: no-referrer\n' +
  '  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()\n' +
  '  Cross-Origin-Opener-Policy: same-origin\n' +
  '/js/*\n  Cache-Control: public, max-age=300\n' +
  '/css/*\n  Cache-Control: public, max-age=300\n');
writeFileSync(join(out, 'robots.txt'), 'User-agent: *\nAllow: /\n');

console.log('built ' + out);
