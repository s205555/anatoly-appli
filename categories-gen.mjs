import fs from 'fs';
const W = new URL('./src/', import.meta.url).pathname; // usage : node categories-gen.mjs [dossier de l'original]
const dart=fs.readFileSync((process.argv[2] || '/tmp/gymmane') + '/lib/catalog/exercise_catalog.dart','utf8');
const ents=[...dart.matchAll(/Exercise\(\s*id: '([^']+)',\s*name: '((?:[^'\\]|\\.)*)',[\s\S]*?equipment: '([^']+)',[\s\S]*?art: '([^']*)',(\s*kind: '([^']+)')?/g)].map(m=>({id:m[1],name:m[2].replace(/\\'/g,"'"),eq:m[3],art:m[4],kind:m[6]||''}));
const set=(n)=>new Set([...dart.match(new RegExp(`const Set<String> ${n} = \\{([\\s\\S]*?)\\};`))[1].matchAll(/'([^']+)'/g)].map(x=>x[1]));
const stretch=set('kStretchIds'), kit=set('kNeedsKit'), cextra=set('kCardioExtras'), cal=set('kCalisthenicsEquipment');
const modes=Object.fromEntries([...dart.match(/const Map<String, String> kExerciseModes = \{([\s\S]*?)\};/)[1].matchAll(/'([^']+)': '([^']+)'/g)].map(x=>[x[1],x[2]]));
const IL=(new Function('return {'+fs.readFileSync(W+'illustrations.js','utf8').match(/ILLUSTRATION_PAR_ID = \{([\s\S]*?)\n\};/)[1]+'}'))();
const {EXERCICES}=await import(W+'exercices.js');
const EQ={barre:['Barbell'],'barre-ez':['Barbell'],halteres:['Dumbbell'],machine:['Machine'],smith:['Machine'],poulie:['Cable'],'poids-du-corps':['Bodyweight','Weighted','Rings'],kettlebell:['Kettlebell'],elastique:['Band'],autre:['Other','Rings','Weighted']};
const byName=new Map(ents.map(e=>[e.name.toLowerCase(),e])), byArt=new Map();
for(const e of ents) if(e.art) (byArt.get(e.art)||byArt.set(e.art,[]).get(e.art)).push(e);
const genre={}, equip={}, nu=[]; let n=0;
for(const a of EXERCICES){
  let o=byName.get((a.en||'').toLowerCase());
  if(!o){ const l=(byArt.get(IL[a.id])||[]).filter(e=>(EQ[a.materiel]||[]).includes(e.eq)&&(e.eq!=='Rings'||a.id.includes('ring'))); const slug=(x)=>x.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); const net=l.length>1?l.filter(e=>slug(e.name)===e.art):l; if(net.length===1) o=net[0]; }
  if(!o) continue; n++;
  const k=o.kind||(stretch.has(o.id)?'stretch':(modes[o.id]==='cardio'||cextra.has(o.id))?'cardio':cal.has(o.eq)?'calisthenics':'strength');
  const g={stretch:'etirement',sport:'sport',cardio:'cardio',calisthenics:'callisthenie'}[k]; if(g) genre[a.id]=g;
  if(o.eq==='Rings') equip[a.id]='anneaux'; if(o.eq==='Weighted') equip[a.id]='leste';
  if(o.eq==='Bodyweight'&&!kit.has(o.id)) nu.push(a.id);
}
const grp=(obj)=>{const r={};for(const [k,v] of Object.entries(obj))(r[v]||=[]).push(k);return r};
const out=`// Généré depuis le catalogue de l'original (exercise_catalog.dart : kind, kStretchIds, kCardioExtras, équipement, kNeedsKit), par nom anglais puis illustration.
// Genre (exerciseKind) et matériel que le catalogue d'Anatoly n'a pas : anneaux, lesté, sans matériel. Absent = force, ou matériel du catalogue.
const liste = (o) => Object.fromEntries(Object.entries(o).flatMap(([k, ids]) => ids.map((id) => [id, k])));
export const GENRE_PAR_ID = liste(${JSON.stringify(grp(genre))});
export const EQUIPEMENT_PAR_ID = liste(${JSON.stringify(grp(equip))});
export const SANS_MATERIEL = new Set(${JSON.stringify(nu)});
`;
fs.writeFileSync(W+'categories-exercices.js',out);
console.log(n, "exercices rattachés");
