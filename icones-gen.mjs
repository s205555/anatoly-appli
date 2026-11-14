// Génère app/src/icones.mjs : tracés SVG Phosphor (MIT) utilisés par le site et l'application.
// Ne garde que les icônes réellement citées : tout littéral de front/src et app/src qui est un nom d'icône ('nom' ou 'nom:poids').
// Un nom sans poids peut être complété à l'exécution (`${n}:fill`) : dans un fichier qui contient `}:fill` ou `}:bold`, on garde aussi ce poids pour ses noms nus.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
const POIDS = ['regular', 'bold', 'fill'];
const dispo = new Set(readdirSync('node_modules/@phosphor-icons/core/assets/regular').map((f) => f.replace(/\.svg$/, '')));

function fichiers(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = `${dir}/${f}`;
    if (statSync(p).isDirectory()) return /node_modules|statique/.test(f) ? [] : fichiers(p);
    return /\.(jsx?|mjs)$/.test(f) && f !== 'icones.mjs' ? [p] : [];
  });
}
// Absentes de l'ancien jeu : les médailles (distinctions.js) qui les citent s'affichent sans glyphe, on garde ce rendu à l'identique.
// Retirer un nom d'ici pour que la médaille correspondante gagne son glyphe.
const EXCLUS = new Set([]);
const garde = new Set();
for (const f of [...fichiers('src'), ...fichiers('../app/src')]) {
  const src = readFileSync(f, 'utf8');
  const dyn = POIDS.filter((p) => p !== 'regular' && src.includes(`}:${p}`));
  for (const [, lit] of src.matchAll(/(?<![\w$])(?:'([^'\n]*)'|"([^"\n]*)"|`([^`\n$]*)`)/g).map((m) => [m[0], m[1] ?? m[2] ?? m[3]])) {
    const [base, poids, ...reste] = lit.split(':');
    if (reste.length || !dispo.has(base) || EXCLUS.has(base)) continue;
    if (!poids) for (const p of ['regular', ...dyn]) garde.add(`${base}|${p}`);
    else if (poids === 'bold' || poids === 'fill') garde.add(`${base}|${poids}`);
  }
}
const sortie = {};
for (const k of [...garde].sort()) {
  const [n, poids] = k.split('|');
  const svg = readFileSync(`node_modules/@phosphor-icons/core/assets/${poids}/${n}${poids === 'regular' ? '' : `-${poids}`}.svg`, 'utf8');
  sortie[`${n}${poids === 'regular' ? '' : `:${poids}`}`] = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/<rect width="256" height="256" fill="none"\/>/, '');
}
writeFileSync('../app/src/icones.mjs', `// Icônes Phosphor (licence MIT, phosphoricons.com), générées par front/icones-gen.mjs. viewBox 0 0 256 256.\nexport const ICONES = ${JSON.stringify(sortie, null, 0)};\nexport const icone = (nom, taille = 20, classe = '') => \`<svg class="ic \${classe}" width="\${taille}" height="\${taille}" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true" focusable="false">\${ICONES[nom] ?? ''}</svg>\`;\n`);
console.log(Object.keys(sortie).length, 'icônes');
