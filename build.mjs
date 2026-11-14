// Construit l'application : app.<empreinte>.js (entrée), chunk.<empreinte>.js (écrans chargés à la demande) et app.<empreinte>.css
// dans app/statique/app/, plus manifest.json (entrée js + css) lu par app/src/pages/app.mjs.
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';
import { ICONES } from '../app/src/icones.mjs';

const sortie = new URL('../app/statique/app/', import.meta.url).pathname;

// Garde-fou : chaque <Ic n="..."> littéral doit exister dans ICONES (sinon icône vide à l'écran). Corriger avec `node icones-gen.mjs`.
function fichiers(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? fichiers(`${dir}/${e.name}`) : /\.jsx$/.test(e.name) ? [`${dir}/${e.name}`] : []);
}
function tousFichiers(dir, motif) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? tousFichiers(`${dir}/${e.name}`, motif) : motif.test(e.name) ? [`${dir}/${e.name}`] : []);
}
const manquantes = new Set();
for (const f of fichiers('src')) for (const [, n] of readFileSync(f, 'utf8').matchAll(/<Ic\s+n=(?:"([^"]+)"|\{'([^']+)'\})/g).map((m) => [0, m[1] ?? m[2]])) if (!(n in ICONES)) manquantes.add(`${n} (${f})`);
if (manquantes.size) { console.error('Icônes absentes de app/src/icones.mjs (lancer node icones-gen.mjs) :\n' + [...manquantes].join('\n')); process.exit(1); }

// Les feuilles de style sont toutes chargées par l'entrée (main.jsx) : un écran qui les importe à son tour
// ne doit pas produire un morceau JS vide de plus (7 fichiers de 0 octet, une requête chacun).
const cssDejaDansEntree = {
  name: 'css-deja-dans-entree',
  setup(b) {
    b.onResolve({ filter: /\.css$/ }, (args) => (args.importer.endsWith('/src/main.jsx')
      ? undefined
      : { path: resolve(args.resolveDir, args.path), namespace: 'css-vide' }));
    b.onLoad({ filter: /.*/, namespace: 'css-vide' }, () => ({ contents: '', loader: 'js' }));
  },
};

// Feuille du site (app/statique/anatoly.css) : l'appli ne charge plus que sa feuille. Seules les règles qu'elle peut
// atteindre sont reprises : une règle reste si chacun de ses sélecteurs de classe ou d'identifiant apparaît dans le code de l'appli.
const SITE_CSS = resolve(import.meta.dirname, '../app/statique/anatoly.css');
const SOURCES = [...tousFichiers('src', /\.(jsx?|mjs|css)$/), resolve(import.meta.dirname, '../app/src/pages/app.mjs')];
let mots;
const motsDeLAppli = () => (mots ??= new Set(SOURCES.flatMap((f) => readFileSync(f, 'utf8').match(/[A-Za-z_][\w-]*/g) ?? [])));
function blocs(css) {
  const sortie = [];
  let profondeur = 0, debut = 0, tete = 0;
  for (let k = 0; k < css.length; k++) {
    if (css[k] === '{') { if (profondeur === 0) debut = k; profondeur++; }
    else if (css[k] === '}' && --profondeur === 0) { sortie.push({ tete: css.slice(tete, debut).trim(), corps: css.slice(debut + 1, k) }); tete = k + 1; }
  }
  return sortie;
}
const atteignable = (sel) => [...sel.replace(/\[[^\]]*\]/g, '').matchAll(/[.#]([A-Za-z_][\w-]*)/g)].every((m) => motsDeLAppli().has(m[1]));
function cssCommun(css) {
  const sortie = [];
  for (const { tete, corps } of blocs(css.replace(/\/\*[\s\S]*?\*\//g, ''))) {
    if (/^@(media|supports)/.test(tete)) { const dedans = cssCommun(corps); if (dedans) sortie.push(`${tete}{${dedans}}`); }
    else if (tete.startsWith('@')) sortie.push(`${tete}{${corps}}`); // @font-face, @keyframes : toujours repris
    else {
      const gardes = tete.split(/,(?![^()]*\))/).map((s) => s.trim()).filter(atteignable); // virgules hors :is(...)
      if (gardes.length) sortie.push(`${gardes.join(',')}{${corps}}`);
    }
  }
  return sortie.join('\n');
}
const cssDuSite = {
  name: 'css-commun',
  setup(b) {
    b.onResolve({ filter: /^\.\/anatoly-commun\.css$/ }, () => ({ path: 'anatoly-commun.css', namespace: 'css-commun' }));
    b.onLoad({ filter: /.*/, namespace: 'css-commun' }, () => ({ contents: cssCommun(readFileSync(SITE_CSS, 'utf8')), loader: 'css' }));
  },
};

const r = await build({
  entryPoints: ['src/main.jsx'], bundle: true, minify: true, write: false, format: 'esm', splitting: true, metafile: true,
  target: ['es2022', 'safari16'], outdir: 'x', entryNames: 'app.[hash]', chunkNames: 'chunk.[hash]',
  jsx: 'automatic', jsxImportSource: 'preact', legalComments: 'none', logLevel: 'warning', external: ['/statique/*'],
  plugins: [cssDejaDansEntree, cssDuSite],
});
mkdirSync(sortie, { recursive: true });
for (const f of readdirSync(sortie)) if (/^(app|chunk)\.[0-9A-Za-z]+\.(js|css)$/.test(f)) rmSync(sortie + f);
const manifest = {};
const ecrits = [];
let total = 0, totalGz = 0;
for (const f of r.outputFiles) {
  if (/^chunk\..*\.css$/.test(f.path.split('/').pop())) continue; // déjà inclus dans le CSS de l'entrée
  const nom = f.path.split('/').pop();
  const gz = gzipSync(f.contents).length;
  writeFileSync(sortie + nom, f.contents);
  ecrits.push(nom);
  const sortieMeta = r.metafile.outputs[`x/${nom}`];
  if (sortieMeta?.entryPoint === 'src/main.jsx') manifest[nom.endsWith('.css') ? 'css' : 'js'] = nom;
  else if (nom.endsWith('.css')) manifest.css = nom;
  if (nom.endsWith('.js')) { total += f.contents.length; totalGz += gz; }
  console.log(`${nom} : ${(f.contents.length / 1024).toFixed(1)} Ko, ${(gz / 1024).toFixed(1)} Ko gzip`);
}
const fermeture = (k, vus = new Set()) => { vus.add(k); for (const i of r.metafile.outputs[k].imports) if (i.kind === 'import-statement' && !vus.has(i.path)) fermeture(i.path, vus); return vus; };
const entree = Object.keys(r.metafile.outputs).find((k) => r.metafile.outputs[k].entryPoint === 'src/main.jsx' && k.endsWith('.js'));
const init = [...fermeture(entree)].map((k) => r.outputFiles.find((f) => `x/${f.path.split('/').pop()}` === k).contents);
console.log(`Chargement initial (entrée + morceaux statiques) : ${init.length} fichiers, ${(init.reduce((a, c) => a + c.length, 0) / 1024).toFixed(1)} Ko, ${(init.reduce((a, c) => a + gzipSync(c).length, 0) / 1024).toFixed(1)} Ko gzip`);
console.log(`JS total : ${(total / 1024).toFixed(1)} Ko, ${(totalGz / 1024).toFixed(1)} Ko gzip`);
// Tous les fichiers construits : le service worker les met en cache en arrière-plan (écrans non visités, démarrage hors ligne).
manifest.fichiers = ecrits;
writeFileSync(sortie + 'manifest.json', JSON.stringify(manifest));
