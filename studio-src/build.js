/**
 * AdAnalyzer — studio-src/build.js
 * Compila o Nexus CRM (React) e publica direto em ../studio/, já
 * atualizando index.html e asset-manifest.json com os nomes novos.
 *
 * Uso: npm install && npm run build   (dentro de studio-src/)
 */

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const OUT_DIR = path.join(__dirname, '..', 'studio');
const JS_DIR = path.join(OUT_DIR, 'static', 'js');
const CSS_DIR = path.join(OUT_DIR, 'static', 'css');

function hashOf(content) {
  return crypto.createHash('md5').update(content).digest('hex').slice(0, 8);
}

function cleanOldBuilds(dir, prefix) {
  if (!fs.existsSync(dir)) return;
  for (const file of fs.readdirSync(dir)) {
    if (file.startsWith(prefix)) fs.rmSync(path.join(dir, file));
  }
}

async function main() {
  fs.mkdirSync(JS_DIR, { recursive: true });
  fs.mkdirSync(CSS_DIR, { recursive: true });

  const tmpOut = path.join(__dirname, '.tmp-build');
  fs.rmSync(tmpOut, { recursive: true, force: true });

  await esbuild.build({
    entryPoints: [path.join(__dirname, 'src', 'index.js')],
    bundle: true,
    minify: true,
    sourcemap: true,
    outfile: path.join(tmpOut, 'main.js'),
    loader: { '.js': 'jsx', '.jsx': 'jsx' },
    jsx: 'automatic',
    define: {
      'process.env.NODE_ENV': '"production"',
      'process.env.REACT_APP_ANTHROPIC_KEY': '""',
    },
  });

  const jsContent = fs.readFileSync(path.join(tmpOut, 'main.js'));
  const jsHash = hashOf(jsContent);
  const jsName = `main.${jsHash}.js`;
  const jsMapName = `${jsName}.map`;

  const cssRaw = fs.readFileSync(path.join(tmpOut, 'main.css'), 'utf8');
  const cssContent = cssRaw.replace(/\/\*# sourceMappingURL=.*\*\/\s*$/, '').trimEnd() + '\n';
  const cssHash = hashOf(cssContent);
  const cssName = `main.${cssHash}.css`;

  cleanOldBuilds(JS_DIR, 'main.');
  cleanOldBuilds(CSS_DIR, 'main.');

  fs.writeFileSync(path.join(JS_DIR, jsName), jsContent);
  fs.copyFileSync(path.join(tmpOut, 'main.js.map'), path.join(JS_DIR, jsMapName));
  fs.writeFileSync(path.join(CSS_DIR, cssName), cssContent);
  fs.rmSync(tmpOut, { recursive: true, force: true });

  // Atualiza index.html
  const indexPath = path.join(OUT_DIR, 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');
  html = html.replace(/\/studio\/static\/js\/main\.[a-f0-9]+\.js/, `/studio/static/js/${jsName}`);
  html = html.replace(/\/studio\/static\/css\/main\.[a-f0-9]+\.css/, `/studio/static/css/${cssName}`);
  fs.writeFileSync(indexPath, html);

  // Atualiza asset-manifest.json
  fs.writeFileSync(path.join(OUT_DIR, 'asset-manifest.json'), JSON.stringify({
    files: {
      'main.css': `/studio/static/css/${cssName}`,
      'main.js': `/studio/static/js/${jsName}`,
      'index.html': '/studio/index.html',
      [jsMapName]: `/studio/static/js/${jsMapName}`,
    },
    entrypoints: [`static/css/${cssName}`, `static/js/${jsName}`],
  }, null, 2) + '\n');

  console.log('Build publicado em studio/:');
  console.log('  JS: ', jsName);
  console.log('  CSS:', cssName);
}

main().catch((e) => { console.error(e); process.exit(1); });
