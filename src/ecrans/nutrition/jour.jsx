/* Nutrition : écran du jour (portage GymMane, GPLv3). */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  nutritionStore, catalogue, getAliment, rechercherAliments, getRepasJour, ajouterAuRepas, supprimerEntree,
  totalsJour, totauxSemaine, calculerObjectifsSuggeres, getObjectifs,
  calculerQualiteProteines, labelQualite, eauMl, eauObjectifMl, eauProgression, ajouterEau, verreMl, getShake, energie, uniteEnergie, repasDeLHeure,
  complementsDuJour, toggleComplement, ajouterComplement, supprimerComplement, modifierComplement,
  jeuneEtat, demarrerJeune, terminerJeune, toggleFavori, jourLocal, jourDe, dernierPoidsKg, setRepasJour,
  CATEGORIES_ORDRE, CAT_LABEL, CAT_PHOTO, MACRO_COULEUR, PORTION_LABEL,
} from './aliments.jsx';
import { Feuille, Ic, Kicker, Rond, Interrupteur } from '../../ui.jsx';
import { dateLongue, nombre, afficher, etat, enCours, jourDe as jourSeance, secondesEcouleesSession } from '../../donnees.js';
import { langue, t, dp } from '../../i18n.js';
import { T } from '../../i18n/m09.js';
import { G } from '../../i18n/gm.js';
import { jours } from '../../i18n/m10.js';
import { lots as lotsPrep, version as versionPrep, poidsTotal, macrosLot, photoAliment as photoSlug, plans as plansTous, recettes as recettesTous, noterEntrees, entreeDepuisItem, totalMacros } from './etat.js';
import { suiviActif, basculerSuivi, SUIVIS } from './gm-etat.js';
import { UNITES_SUPP, aPrendreLe, ajouterJours, joursRestants, libelleDose, libelleUnite } from './complements.js';
import { L26 } from '../../i18n/l26.js';
import { FeuilleIA } from './ia.jsx';
import { TIA } from '../../i18n/ia-repas.js';
import { Photo, Assiette, Dossier, Coup, Flacon, Anneau, Piste, IMG } from './gm.jsx';
import { FeuilleAjoutRapide, FeuilleOptionsRepas, FeuilleEau, FeuilleObjectifs, FeuilleNouvelAliment, FeuilleShake, FeuillePlatPerso } from './feuilles-gm.jsx';
import { PLATS } from '../../nutrition-donnees.js';
import '../../ecrans/m09.css';

/* ===== Petits composants locaux ===== */
const photoAliment = (a) => (!a ? null : a.perso ? a.photo || null : `/statique/nutrition/${a.id}.webp`);

const NOM_REPAS = { 'petit-dejeuner': () => T().petitDejeuner, dejeuner: () => T().dejeuner, diner: () => T().diner, collations: () => T().collations };
const NOMS_PATH = {
  'M12 5v14M5 12h14': 'plus:bold', 'M5 12h14': 'minus:bold', 'M5 12l5 5 10-10': 'check:bold',
  'M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM21 21l-4.35-4.35': 'magnifying-glass:bold',
  'M4 8h16M4 8c0 4 3 6 8 6s8-2 8-6M6 8l1 12h10l1-12': 'cooking-pot',
  'M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z': 'star:fill',
  'M5 3h14v4h-2v14H7V7H5z': 'egg', 'M4 8h16M6 8v10M18 8v10M9 8v10M15 8v10M7 18h14M3 18h2': 'lightning',
  'M12 3c3 4 6 6 6 10a6 6 0 0 1-12 0c0-4 3-6 6-10z': 'leaf',
};
const CAT_NOM = { fruit: 'orange', veg: 'carrot', legume: 'plant', nut: 'acorn', meat: 'cow', fish: 'fish', egg: 'egg', dairy: 'cheese', grain: 'grains', bakery: 'bread', oil: 'drop', pantry: 'jar', drink: 'coffee', sauce: 'jar-label', spice: 'pepper' };
const nomDe = (a) => (a.perso ? a.nom : (langue === 'en' ? a.nomEn : a.nomFr));
/* Icônes de la maison (Phosphor) : plus de tracés bruts injectés. */
function IcLoc({ d, taille = 22 }) {
  return <Ic n={NOMS_PATH[d] ?? 'fork-knife'} taille={taille} />;
}

function AnneauCal({ part, taille = 148, trait = 12, couleur = 'var(--accent)' }) {
  const r = (taille - trait) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, part));
  return <svg width={taille} height={taille} viewBox={`0 0 ${taille} ${taille}`} aria-hidden="true">
    <circle cx={taille / 2} cy={taille / 2} r={r} fill="none" stroke="var(--raised2)" stroke-width={trait} />
    <circle cx={taille / 2} cy={taille / 2} r={r} fill="none" stroke={couleur} stroke-width={trait} stroke-linecap="round"
      stroke-dasharray={`${c * p} ${c}`} transform={`rotate(-90 ${taille / 2} ${taille / 2})`} style="transition: stroke-dasharray 700ms var(--ease-out)" />
  </svg>;
}

function VaisseauEau({ part, shaker = false }) {
  const h = 132, w = 84, x = 22, y = 16, l = 40, haut = 10;
  const niv = y + l + (h - y - l - haut) * (1 - part);
  return <div class="nut-vaisseau" aria-hidden="true">
    <svg viewBox={`0 0 ${w} ${h}`}>
      {shaker
        ? <>
          <rect x="26" y="2" width="32" height="8" rx="2" fill="currentColor" opacity=".55" />
          <path d="M26 8 h32 v12 h-32 z" fill="currentColor" opacity=".35" />
          <path d={`M22 ${y + 4} h40 v${l} q0 ${h - y - l - haut} -20 ${h - y - l - haut} q-20 0 -20 -${h - y - l - haut} z`} fill="none" stroke="currentColor" stroke-width="3" />
          <rect x={x + 2} y={niv} width="40" height={h - y - l - haut - (niv - y - l)} fill="currentColor" opacity=".5" rx="4" />
        </>
        : <>
          <path d="M28 4 h28 v10 l6 12 v104 h-40 v-104 l6-12 z" fill="none" stroke="currentColor" stroke-width="3" />
          <rect x="34" y={niv} width="24" height={h - y - l - haut - (niv - y - l)} fill="currentColor" opacity=".5" rx="4" />
        </>}
    </svg>
  </div>;
}

function RadarAmino({ scores }) {
  const R = 74, cx = 84, cy = 84;
  const n = 9;
  const angle = (i) => (i / n) * 2 * Math.PI - Math.PI / 2;
  const pt = (i, r) => `${(cx + r * Math.cos(angle(i))).toFixed(1)},${(cy + r * Math.sin(angle(i))).toFixed(1)}`;
  const poly = scores.map((s, i) => pt(i, Math.max(4, R * Math.min(1, s)))).join(' ');
  const grille = Array.from({ length: 4 }, (_, g) => Array.from({ length: n }, (_, i) => pt(i, R * (g + 1) / 4)).join(' '));
  return <svg class="nut-radar" viewBox="0 0 168 168" role="img" aria-label="Radar des acides aminés">
    {grille.map((d, i) => <polygon key={i} points={d} fill="none" stroke="var(--border)" stroke-width="1" />)}
    {Array.from({ length: n }, (_, i) => <line key={i} x1={cx} y1={cy} x2={pt(i, R).split(',')[0]} y2={pt(i, R).split(',')[1]} stroke="var(--border)" stroke-width="1" />)}
    <polygon points={poly} fill="var(--accent-soft)" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" />
  </svg>;
}

/* ===== Feuille d'ajout au repas (showAddFoodSheet) ===== */
function TuileAliment({ a, onClick }) {
  const nom = nomDe(a);
  return <button type="button" class="gm-tuile-aliment" onClick={onClick}>
    <span class="gm-tuile-aliment-case"><Photo src={photoAliment(a)} nom={nom} taille={84} incline={false} ombre={false} /></span>
    <b>{nom}</b>
    <small>{a.approx === 1 ? '≈ ' : ''}{a.kcal} kcal{a.perso ? '' : ' · 100 g'}</small>
  </button>;
}
function LigneAliment({ icone, art, titre, detail, badge, onClick }) {
  return <button type="button" class="gm-ligne-aliment" onClick={onClick}>
    <span class="gm-ligne-aliment-art">{art ?? <i><Ic n={icone} taille={17} /></i>}</span>
    <span class="gm-ligne-aliment-texte"><b><span>{titre}</span>{badge}</b><small>{detail}</small></span>
    <Ic n="plus:bold" taille={15} />
  </button>;
}

function FeuilleRecherche({ ouvert, fermer, repasCible, jour, ouvrirRapide, ouvrirNouvel, ouvrirPlatPerso }) {
  const [q, setQ] = useState('');
  const [categorie, setCategorie] = useState(null);
  const [plats, setPlats] = useState(false);
  const [detail, setDetail] = useState(null);
  const [plat, setPlat] = useState(null); // id de PLATS
  const [ia, setIa] = useState(false);
  const t09 = T();
  const g = G();
  const qn = q.trim();
  const plier = (x) => String(x).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const parcours = !!qn || !!categorie || plats;
  const resultats = useMemo(() => {
    if (plats) return [];
    if (categorie) {
      const liste = [];
      for (const [id, a] of catalogue.value) if (a.cat === categorie && (!qn || plier(nomDe(a)).includes(plier(qn)))) liste.push({ id, a });
      for (const [id, a] of Object.entries(nutritionStore.value.alimentsPerso)) if (a.cat === categorie) liste.push({ id, a: { ...a, id, perso: true } });
      return liste.slice(0, 200);
    }
    return qn ? rechercherAliments(qn, 60) : [];
  }, [qn, categorie, plats, nutritionStore.value.alimentsPerso]);
  const mine = resultats.filter((r) => r.a.perso).map((r) => r.a);
  const biblio = resultats.filter((r) => !r.a.perso).map((r) => r.a);
  const recettesVues = categorie ? [] : recettesTous().filter((r) => !qn || plier(r.nom).includes(plier(qn)));
  const platsVus = categorie || (!qn && !plats) ? [] : PLATS.filter((p) => !qn || plier(langue === 'en' ? p[2] : p[1]).includes(plier(qn)));
  const recents = parcours ? [] : nutritionStore.value.recents.map(getAliment).filter(Boolean).slice(0, 12);
  const rien = parcours && !recettesVues.length && !platsVus.length && !resultats.length;
  const repasNom = g.repasPhrase[repasCible] ?? '';

  const toutFermer = () => { setDetail(null); setPlat(null); setIa(false); setQ(''); setCategorie(null); setPlats(false); fermer(); };
  const noterRecette = (r) => {
    noterEntrees(jour, r.items.map((it) => ({ ...entreeDepuisItem(it), repas: repasCible })));
    afficher(g.ajouteAu(repasNom), 'ok');
    toutFermer();
  };

  if (ia) return <FeuilleIA ouvert={ouvert} fermer={toutFermer} repasCible={repasCible} />;
  if (detail) {
    const a = getAliment(detail);
    if (a) return <FeuilleAliment ouvert={ouvert} fermer={() => setDetail(null)} fermerTout={toutFermer} aliment={a} repasCible={repasCible} />;
  }
  if (plat) {
    const p = PLATS.find((x) => x[0] === plat);
    if (p) return <FeuillePlat ouvert={ouvert} fermer={() => setPlat(null)} fermerTout={toutFermer} plat={p} repasCible={repasCible} />;
  }

  return <Feuille ouverte={ouvert} fermer={toutFermer} large titre={g.ajouterAu(repasNom)}>
    <div class="gm-pile">
    <div class="gm-recherche-ligne">
      <label class="gm-recherche-champ">
        <Ic n="magnifying-glass:bold" taille={16} />
        <input value={q} onInput={(e) => setQ(e.target.value)} placeholder={g.chercherAliment} aria-label={g.chercherAliment} enterKeyHint="search" />
        {q && <button type="button" aria-label={t.commun.annuler} onClick={() => setQ('')}><Ic n="x-circle:fill" taille={18} /></button>}
      </label>
      <button type="button" class="gm-rond48" aria-label={g.nouvelAliment} onClick={() => { toutFermer(); ouvrirNouvel(qn); }}><Ic n="plus:bold" taille={19} /></button>
    </div>
    <div class="gm-cats">
      <button type="button" class={`gm-cat ${plats ? 'on' : ''}`} aria-pressed={plats} onClick={() => { setPlats(!plats); setCategorie(null); }}>
        <span><Assiette taille={50} items={['rice', 'chicken-breast', 'broccoli'].map((x) => ({ src: photoSlug(x), nom: x }))} /></span>
        <small>{g.plats}</small>
      </button>
      {CATEGORIES_ORDRE.map((c) => <button key={c} type="button" class={`gm-cat ${categorie === c ? 'on' : ''}`} aria-pressed={categorie === c} onClick={() => { setCategorie(categorie === c ? null : c); setPlats(false); }}>
        <span><Photo src={photoSlug(CAT_PHOTO[c])} nom={CAT_LABEL[c]()} taille={46} incline={false} ombre={false} /></span>
        <small>{CAT_LABEL[c]()}</small>
      </button>)}
    </div>
    {!parcours && <div class="m14">
      <LigneAliment icone="sparkle" titre={TIA().ligne} detail={TIA().ligneAide} badge={<span class="nut-beta"><Ic n="flask:fill" taille={10} />{t09.beta}</span>} onClick={() => setIa(true)} />
    </div>}
    {(recettesVues.length > 0 || !parcours) && <>
      <p class="gm-kicker gm-section">{g.repasEnregistres}</p>
      {!parcours && <LigneAliment icone="cooking-pot:bold" titre={g.creerPlat} detail={g.creerPlatIndice} onClick={() => { toutFermer(); ouvrirPlatPerso(); }} />}
      {recettesVues.map((r) => <LigneAliment key={r.id} icone="cooking-pot" titre={r.nom} detail={`${Math.round(totalMacros(r.items.map((it) => entreeDepuisItem(it))).k)} kcal · ${g.nAliments(r.items.length)}`} onClick={() => noterRecette(r)} />)}
    </>}
    {platsVus.length > 0 && <>
      <p class="gm-kicker gm-section">{g.plats}{plats && !qn ? <span>{platsVus.length}</span> : null}</p>
      {platsVus.map((p) => <LigneAliment key={p[0]} icone="cooking-pot" titre={langue === 'en' ? p[2] : p[1]} detail={t09.repasPrets} onClick={() => setPlat(p[0])} />)}
    </>}
    {mine.length > 0 && <>
      <p class="gm-kicker gm-section">{g.mesAliments}</p>
      <div class="gm-grille">{mine.map((a) => <TuileAliment key={a.id} a={a} onClick={() => setDetail(a.id)} />)}</div>
    </>}
    {recents.length > 0 && <>
      <p class="gm-kicker gm-section">{g.recents}</p>
      <div class="gm-grille">{recents.map((a) => <TuileAliment key={a.id} a={a} onClick={() => setDetail(a.id)} />)}</div>
    </>}
    {biblio.length > 0 && <>
      <p class="gm-kicker gm-section">{categorie ? CAT_LABEL[categorie]() : g.baseAliments}<span>{biblio.length}</span></p>
      <div class="gm-grille">{biblio.map((a) => <TuileAliment key={a.id} a={a} onClick={() => setDetail(a.id)} />)}</div>
    </>}
    {!parcours && !recettesVues.length && !recents.length && <p class="gm-note centre m22">{g.rechercheVide}</p>}
    {rien && <div class="m22">
      <p class="gm-note centre">{g.rienPour(qn)}</p>
      {qn && <button type="button" class="btn pri gm-plein m14" onClick={() => { toutFermer(); ouvrirNouvel(qn); }}>{g.creerNomme(qn)}</button>}
    </div>}
    <button type="button" class="btn gm-plein m18" onClick={() => { toutFermer(); ouvrirRapide(); }}><Ic n="lightning:bold" taille={16} />{g.ajoutRapide}</button>
    </div>
  </Feuille>;
}

/* ===== Feuille détail aliment ===== */
function FeuilleAliment({ ouvert, fermer, fermerTout, aliment, repasCible }) {
  const t09 = T();
  const [qte, setQte] = useState(1); // portions
  const [grammes, setGrammes] = useState(null); // grammes directs si différent
  const gPort = aliment.gPortion || 100;
  const g = grammes ?? Math.round(qte * gPort);
  const facteur = g / 100;
  const kcal = Math.round(aliment.kcal * facteur);
  const p = Math.round(aliment.p * facteur * 10) / 10;
  const c = Math.round(aliment.c * facteur * 10) / 10;
  const l = Math.round(aliment.l * facteur * 10) / 10;
  const f = Math.round((aliment.f || 0) * facteur * 10) / 10;
  const nom = aliment.perso ? aliment.nom : (langue === 'en' ? aliment.nomEn : aliment.nomFr);
  const catN = CAT_LABEL[aliment.cat]?.() ?? '';
  const portionLabel = PORTION_LABEL[aliment.kind]?.() ?? t09.portUnit;
  const estFavori = nutritionStore.value.favoris.includes(aliment.id);

  const ajouter = () => {
    if (!repasCible) return;
    ajouterAuRepas(jourLocal(), repasCible, aliment.id, g);
    afficher(`${nom}${dp()}${kcal} kcal`, 'ok');
    (fermerTout ?? fermer)();
  };

  return <Feuille ouverte={ouvert} fermer={fermer} titre={t09.valeurs} sous={nom}
    pied={<>
      <button type="button" class="btn" onClick={() => toggleFavori(aliment.id)} title={t09.favoris}>
        <IcLoc d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z" taille={16} />
        {estFavori ? ' ✓' : ''}
      </button>
      {repasCible && <button type="button" class="btn pri" onClick={ajouter}>{t09.ajouterA(NOM_REPAS[repasCible]?.() ?? repasCible)}</button>}
    </>}>
    <div class="nut-fiche">
      <span class="nut-vignette" style="width:88px;height:88px;border-radius:22px;background:var(--raised2)">
        {photoAliment(aliment) ? <img src={photoAliment(aliment)} alt="" loading="lazy" /> : <Ic n={CAT_NOM[aliment.cat] ?? 'fork-knife'} taille={34} />}
      </span>
      <p class="nut-fiche-nom">{nom}</p>
      <p class="nut-fiche-sous">{catN} · {aliment.kcal} kcal / 100 g</p>
    </div>
    <div class="nut-portion">
      <button type="button" class="nut-portion-bouton" aria-label={t09.quantite} onClick={() => { if (grammes) setGrammes(null); else setQte(Math.max(0.5, qte - 0.5)); }}><IcLoc d="M5 12h14" /></button>
      <div class="nut-portion-valeur">
        <b>{nombre(g)} g</b>
        <small>{qte} {portionLabel}</small>
      </div>
      <button type="button" class="nut-portion-bouton" aria-label={t09.quantite} onClick={() => setQte(qte + 0.5)}><IcLoc d="M12 5v14M5 12h14" /></button>
    </div>
    <div class="nut-valeurs">
      <div><b>{nombre(kcal, 0)}</b><small>{t09.energie}</small></div>
      <div><b>{nombre(p, 1)}</b><small>{t09.macroProteines}</small></div>
      <div><b>{nombre(c, 1)}</b><small>{t09.macroGlucides}</small></div>
      <div><b>{nombre(l, 1)}</b><small>{t09.macroLipides}</small></div>
      <div><b>{nombre(f, 1)}</b><small>{t09.fibres}</small></div>
      <div><b>{nombre(aliment.su * facteur, 1)}</b><small>{t09.sucres}</small></div>
      <div><b>{nombre(aliment.na * facteur, 0)}</b><small>{t09.sodium}</small></div>
      <div><b>{nombre(aliment.sat * facteur, 1)}</b><small>{t09.satures}</small></div>
    </div>
    {aliment.approx === 1 && <p class="nut-reste">{t09.approx}</p>}
  </Feuille>;
}

/* ===== Feuille plat prêt ===== */
function FeuillePlat({ ouvert, fermer, fermerTout, plat, repasCible }) {
  const t09 = T();
  const [qte, setQte] = useState(1);
  const id = plat[0];
  const nom = langue === 'en' ? plat[2] : plat[1];
  const ingrs = plat[3].split(' ').map((x) => {
    const [slug, g] = x.split(':');
    return { slug, g: Number(g) };
  });
  const tot = ingrs.reduce((s, ing) => {
    const a = getAliment(ing.slug);
    if (!a) return s;
    const fac = ing.g / 100;
    return { kcal: s.kcal + a.kcal * fac, p: s.p + a.p * fac, c: s.c + a.c * fac, l: s.l + a.l * fac };
  }, { kcal: 0, p: 0, c: 0, l: 0 });

  const ajouter = () => {
    if (!repasCible) return;
    for (const ing of ingrs) ajouterAuRepas(jourLocal(), repasCible, ing.slug, Math.round(ing.g * qte));
    afficher(`${nom}${dp()}${Math.round(tot.kcal * qte)} kcal`, 'ok');
    (fermerTout ?? fermer)();
  };

  return <Feuille ouverte={ouvert} fermer={fermer} titre={t09.repasPrets} sous={nom}
    pied={repasCible && <button type="button" class="btn pri" onClick={ajouter}>{t09.ajouterA(NOM_REPAS[repasCible]?.() ?? repasCible)}</button>}>
    <div class="nut-fiche">
      <span class="nut-vignette" style="width:88px;height:88px;border-radius:22px;background:var(--raised2);color:var(--accent)"><IcLoc d="M4 8h16M4 8c0 4 3 6 8 6s8-2 8-6M6 8l1 12h10l1-12" taille={34} /></span>
      <p class="nut-fiche-nom">{nom}</p>
    </div>
    <div class="nut-portion">
      <button type="button" class="nut-portion-bouton" onClick={() => setQte(Math.max(0.5, qte - 0.5))}><IcLoc d="M5 12h14" /></button>
      <div class="nut-portion-valeur"><b>{qte}</b><small>{t09.portions}</small></div>
      <button type="button" class="nut-portion-bouton" onClick={() => setQte(qte + 0.5)}><IcLoc d="M12 5v14M5 12h14" /></button>
    </div>
    <div class="nut-valeurs">
      <div><b>{nombre(tot.kcal * qte, 0)}</b><small>{t09.energie}</small></div>
      <div><b>{nombre(tot.p * qte, 1)}</b><small>{t09.macroProteines}</small></div>
      <div><b>{nombre(tot.c * qte, 1)}</b><small>{t09.macroGlucides}</small></div>
      <div><b>{nombre(tot.l * qte, 1)}</b><small>{t09.macroLipides}</small></div>
    </div>
    <p class="nut-etape-nom">{t09.ingredients}</p>
    <div class="nut-resultats">
      {ingrs.map((ing) => {
        const a = getAliment(ing.slug);
        if (!a) return null;
        const n = langue === 'en' ? a.nomEn : a.nomFr;
        return <div key={ing.slug} class="nut-resultat" style="cursor:default">
          <span class="nut-vignette" style="width:40px;height:40px;border-radius:12px;background:var(--raised2)"><Ic n={CAT_NOM[a.cat] ?? 'fork-knife'} taille={22} /></span>
          <span class="nut-resultat-texte"><b>{n}</b><small>{ing.g * qte} g</small></span>
        </div>;
      })}
    </div>
  </Feuille>;
}

/* ===== Feuille jeûne ===== */
function FeuilleJeune({ ouvert, fermer }) {
  const t09 = T();
  const j = jeuneEtat();
  const [but, setBut] = useState(nutritionStore.value.jeune.butH || 16);
  const [mode, setMode] = useState(j.actif ? 'stop' : 'start');

  return <Feuille ouverte={ouvert} fermer={fermer} titre={t09.jeune} sous={t09.fenetreJeune}
    pied={<>
      {mode === 'start'
        ? <button type="button" class="btn pri" onClick={() => { demarrerJeune(Number(but) || 16); afficher(t09.jeune, 'ok'); fermer(); }}>{t09.demarrer}</button>
        : <button type="button" class="btn danger-plein" onClick={() => { terminerJeune(); afficher(t09.terminer, 'ok'); fermer(); }}>{t09.terminer}</button>}
    </>}>
    <div class="nut-etapes">
      <label class="nut-etape-nom">{t09.butH}</label>
      <div class="nut-champs">
        <div class="nut-colonne"><label class="nut-label">h</label><input class="cellule" inputMode="numeric" value={but} onInput={(e) => setBut(e.target.value.replace(/[^\d]/g, ''))} /></div>
      </div>
      {j.actif && <>
        <div class="nut-jeune-ligne">
          <div class="nut-jeune-anneau"><AnneauCal part={j.part} taille={74} trait={6} couleur="var(--warn)" /></div>
          <div class="nut-jeune-texte">
            <small>{t09.enCours}</small>
            <b>{j.reste}</b>
            <span>{t09.debut} {new Date(j.debut).toLocaleTimeString()} · {t09.fin} {new Date(j.fin).toLocaleTimeString()}</span>
          </div>
        </div>
      </>}
    </div>
  </Feuille>;
}

/* Kcal brûlées un jour donné (burnedOn de GymMane) : MET 5 de musculation, moins le repos, sur la durée des séances du jour, en cours comprise. */
// shortcut: pas de cardio distance/temps dans Anatoly, donc pas de cardioKcal, à ajouter avec la mesure de distance.
export function kcalBrulees(jour, seances = etat.value?.seances ?? [], direct = enCours.value) {
  const kg = dernierPoidsKg() || 75;
  let sec = seances.filter((s) => jourSeance(s.debut) === jour).reduce((n, s) => n + (Number(s.duree_s) || 0), 0);
  if (direct?.debut && jourLocal(new Date(direct.debut)) === jour) sec += secondesEcouleesSession(direct);
  return Math.round((5 - 1) * kg * sec / 3600);
}

/* ===== Feuille compléments ===== */
const nombreSaisi = (v) => { const n = Number(String(v).trim().replace(',', '.')); return String(v).trim() === '' || !Number.isFinite(n) || n < 0 ? null : n; };
const texteNombre = (v) => (v == null ? '' : String(Math.round(v * 100) / 100).replace('.', langue === 'en' ? '.' : ','));

// Heure et dates d'un complément (nutrition/cards.dart _suppSchedule, _suppDays, _clock).
const heureTexte = (min) => new Intl.DateTimeFormat(langue === 'en' ? 'en-US' : 'fr-FR', { hour: 'numeric', minute: '2-digit' }).format(new Date(2000, 0, 1, Math.floor(min / 60), min % 60));
const dateCourteIso = (iso) => new Intl.DateTimeFormat(langue === 'en' ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'short' }).format(new Date(`${iso}T12:00`));
const nomJourCourt = (d) => new Intl.DateTimeFormat(langue === 'en' ? 'en-GB' : 'fr-FR', { weekday: 'short' }).format(new Date(2024, 0, d)).replace('.', '');
const initialeJour = (d) => (langue === 'en' ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : ['L', 'M', 'M', 'J', 'V', 'S', 'D'])[d - 1];
function joursDe(c) {
  const X = L26();
  if (c.chaque > 1) return X.suppChaqueN(c.chaque);
  if (!c.jours) return X.suppTousJours;
  return [1, 2, 3, 4, 5, 6, 7].filter((d) => c.jours & (1 << d)).map(nomJourCourt).join(' · ');
}
export function horaire(c, { quotidien = true } = {}) {
  const X = L26();
  const auj = jourLocal();
  return [
    (quotidien || c.chaque > 1 || c.jours) && joursDe(c),
    c.heure != null && heureTexte(c.heure),
    c.debut && c.debut > auj && X.aPartirDu(dateCourteIso(c.debut)),
    c.fin && X.jusquAu(dateCourteIso(c.fin)),
  ].filter(Boolean).join(' · ');
}

/** Puce « Choisir une date » : ouvre le calendrier du navigateur (showDatePicker de l'original). */
function PuceDate({ libelle, actif, min, valeur, choisir }) {
  const ref = useRef(null);
  return <span class="l26-puce-date">
    <button type="button" class={`nut-puce ${actif ? 'on' : ''}`} onClick={() => { const el = ref.current; try { el.showPicker(); } catch { el.focus(); el.click(); } }}>
      <Ic n="calendar-blank:bold" taille={13} />{libelle}</button>
    <input ref={ref} type="date" tabIndex={-1} aria-hidden="true" min={min} max={ajouterJours(jourLocal(), 730)} value={valeur ?? ''} onChange={(e) => e.target.value && choisir(e.target.value)} />
  </span>;
}

function Pas({ valeur, moins, plus, label }) {
  const X = L26();
  return <span class="l26-pas-grand">
    <button type="button" aria-label={`${X.diminuer} ${label}`} onClick={moins}>−</button>
    <b>{valeur}</b>
    <button type="button" aria-label={`${X.augmenter} ${label}`} onClick={plus}>+</button>
  </span>;
}

function FeuilleComplement({ ouvert, fermer, modifierId, nomInitial }) {
  const t09 = T();
  const X = L26();
  const existant = modifierId ? complementsDuJour().find((c) => c.id === modifierId) : null;
  const auj = jourLocal();
  const demain = ajouterJours(auj, 1);
  const [nom, setNom] = useState('');
  const [quantite, setQuantite] = useState('');
  const [stock, setStock] = useState('');
  const [unite, setUnite] = useState('');
  const [mode, setMode] = useState('tous');
  const [jours, setJours] = useState(0);
  const [chaque, setChaque] = useState(2);
  const [heure, setHeure] = useState(540);
  const [debut, setDebut] = useState(auj);
  const [fin, setFin] = useState(null);
  // La feuille reste montée : à chaque ouverture, repartir du complément choisi ou du préréglage touché.
  useEffect(() => {
    if (!ouvert) return;
    setNom(existant?.nom ?? nomInitial ?? '');
    setQuantite(texteNombre(existant?.quantite));
    setStock(texteNombre(existant?.stock));
    setUnite(existant?.unite ?? '');
    setMode(existant?.chaque > 1 ? 'n' : existant?.jours ? 'certains' : 'tous');
    setJours(existant?.jours ?? 0);
    setChaque(Math.max(2, existant?.chaque ?? 2));
    setHeure(existant ? existant.heure : 540);
    setDebut(existant?.debut ?? auj);
    setFin(existant?.fin ?? null);
  }, [ouvert, modifierId, nomInitial]);

  const q = nombreSaisi(quantite), st = nombreSaisi(stock);
  const plus = (n) => ajouterJours(debut, n);
  const finSemaine = plus(6), finMois = plus(29);
  const debutPerso = debut !== auj && debut !== demain;
  const finPerso = fin != null && fin !== finSemaine && fin !== finMois;
  const joursSauves = mode === 'certains' ? jours : 0;
  const chaqueSauve = mode === 'n' ? chaque : 1;
  const apercu = { jours: joursSauves, chaque: chaqueSauve, debut, fin, heure };
  const sauver = () => {
    if (!nom.trim()) { navigator.vibrate?.(30); afficher(t09.nomRequis, 'danger'); return; }
    const modeFinal = mode === 'certains' && !jours ? 'tous' : mode;
    const data = {
      nom: nom.trim(), quantite: q != null && q > 0 ? q : null, unite, stock: st, dose: q != null && q > 0 ? '' : existant?.dose ?? '',
      jours: modeFinal === 'certains' ? jours : 0, chaque: modeFinal === 'n' ? chaque : 1, heure,
      debut: debut > auj || modeFinal === 'n' ? debut : existant?.debut ?? null, fin,
    };
    if (modifierId) modifierComplement(modifierId, data);
    else ajouterComplement(data);
    afficher(nom.trim(), 'ok');
    fermer();
  };

  return <Feuille ouverte={ouvert} fermer={fermer} titre={modifierId ? existant?.nom || t09.modifierComplement : t09.ajouterComplement} sous={t09.complements}
    pied={<>
      {modifierId && <button type="button" class="btn danger-plein" onClick={() => { supprimerComplement(modifierId); fermer(); }}>{t09.supprimer}</button>}
      <button type="button" class="btn pri" onClick={sauver}>{t09.sauvegarder}</button>
    </>}>
    <div class="nut-etapes">
      <label class="nut-etape-nom" for="supp-nom">{t09.nom}</label>
      <input id="supp-nom" class="cellule" value={nom} onInput={(e) => setNom(e.target.value)} placeholder={t09.nom} />
      <div class="supp-champs">
        <label class="supp-champ"><span>{t09.dose.toUpperCase()}</span>
          <span class="supp-champ-ligne"><input inputMode="decimal" value={quantite} onInput={(e) => setQuantite(e.target.value)}
            placeholder={existant?.quantite == null && existant?.dose ? existant.dose : '1'} /><em>{libelleUnite(unite, q ?? 1)}</em></span></label>
        <label class="supp-champ"><span>{t09.reste.toUpperCase()}</span>
          <span class="supp-champ-ligne"><input inputMode="decimal" value={stock} onInput={(e) => setStock(e.target.value)} placeholder={t09.resteAide} />
            <em>{stock.trim() ? libelleUnite(unite, st ?? 2) : ''}</em></span></label>
      </div>
      <div class="supp-unites" role="radiogroup" aria-label={t09.dose}>
        {UNITES_SUPP.map((u) => <button key={u} type="button" role="radio" aria-checked={unite === u} class={`nut-puce ${unite === u ? 'on' : ''}`}
          onClick={() => setUnite(unite === u ? '' : u)}>{libelleUnite(u, q ?? 1) || u}</button>)}
      </div>

      <label class="nut-etape-nom">{X.suppQuand}</label>
      <div class="nut-filtres l26-supp-seg" role="radiogroup" aria-label={X.suppQuand}>
        {[['tous', X.suppTousJours], ['certains', X.suppCertains], ['n', X.suppChaqueX]].map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={mode === v}
          class={`nut-puce ${mode === v ? 'on' : ''}`} onClick={() => setMode(v)}>{l}</button>)}
      </div>
      {mode === 'certains' && <div class="l26-supp-jours">
        {[1, 2, 3, 4, 5, 6, 7].map((d) => <button key={d} type="button" aria-pressed={(jours & (1 << d)) !== 0} aria-label={nomJourCourt(d)}
          class={(jours & (1 << d)) ? 'on' : ''} onClick={() => setJours(jours ^ (1 << d))}>{initialeJour(d)}</button>)}
      </div>}
      {mode === 'n' && <div class="l26-supp-chaque">
        <span>{X.suppTousLes}</span>
        <Pas valeur={chaque} label={X.suppChaqueX} moins={() => setChaque(Math.max(2, chaque - 1))} plus={() => setChaque(Math.min(60, chaque + 1))} />
        <span>{X.suppJoursFin(chaque)}</span>
      </div>}

      <button type="button" class="nut-case" role="switch" aria-checked={heure != null} onClick={() => setHeure(heure == null ? 540 : null)}>
        <span class="nut-case-texte"><b>{X.suppRappel}</b></span>
        <span class={`nut-coche ${heure != null ? 'on' : ''}`}>{heure != null && <IcLoc d="M5 12l5 5 10-10" taille={16} />}</span>
      </button>
      {heure != null && <div class="l26-supp-heure">
        <Pas valeur={String(Math.floor(heure / 60)).padStart(2, '0')} label={X.heures} moins={() => setHeure((heure - 60 + 1440) % 1440)} plus={() => setHeure((heure + 60) % 1440)} />
        <b class="l26-supp-deux-points">:</b>
        <Pas valeur={String(heure % 60).padStart(2, '0')} label={X.minutes} moins={() => setHeure((heure - 5 + 1440) % 1440)} plus={() => setHeure((heure + 5) % 1440)} />
      </div>}

      <label class="nut-etape-nom">{X.suppDebut}</label>
      <div class="l26-supp-puces">
        <button type="button" class={`nut-puce ${debut === auj ? 'on' : ''}`} onClick={() => setDebut(auj)}>{X.aujourdhui}</button>
        <button type="button" class={`nut-puce ${debut === demain ? 'on' : ''}`} onClick={() => setDebut(demain)}>{X.demain}</button>
        <PuceDate libelle={debutPerso ? dateCourteIso(debut) : X.choisirDate} actif={debutPerso} min={auj} valeur={debut}
          choisir={(d) => { setDebut(d); if (fin && fin < d) setFin(null); }} />
      </div>
      <label class="nut-etape-nom">{X.suppFin}</label>
      <div class="l26-supp-puces">
        <button type="button" class={`nut-puce ${fin == null ? 'on' : ''}`} onClick={() => setFin(null)}>{X.jamais}</button>
        <button type="button" class={`nut-puce ${fin === finSemaine ? 'on' : ''}`} onClick={() => setFin(finSemaine)}>{X.dansSemaine}</button>
        <button type="button" class={`nut-puce ${fin === finMois ? 'on' : ''}`} onClick={() => setFin(finMois)}>{X.dansMois}</button>
        <PuceDate libelle={finPerso ? dateCourteIso(fin) : X.choisirDate} actif={finPerso} min={debut} valeur={fin ?? plus(13)} choisir={setFin} />
      </div>
      <p class="l26-supp-apercu"><Ic n={heure == null ? 'calendar-check:fill' : 'bell-simple-ringing:fill'} taille={15} /><span>{horaire(apercu)}</span></p>
    </div>
  </Feuille>;
}

/** Ligne d'un complément : toucher coche, appui long (ou clic droit) ouvre la modification (GymMane, onLongPress). */
function LigneComplement({ c, jour, modifier }) {
  const t09 = T();
  const minuterie = useRef(null);
  const long = useRef(false);
  const restant = joursRestants(c, { prisAujourdhui: c.pris });
  const bas = restant == null || restant > 7 ? null : restant === 0 ? t09.epuise : t09.restePour(restant);
  const detail = [libelleDose(c), horaire(c, { quotidien: false })].filter(Boolean).join(' · ');
  const lacher = () => clearTimeout(minuterie.current);
  return <button type="button" class={`nut-supp-ligne ${c.pris ? 'pris' : ''}`}
    onClick={() => { if (long.current) { long.current = false; return; } toggleComplement(jour, c.id); }}
    onContextMenu={(e) => { e.preventDefault(); lacher(); modifier(c.id); }}
    onTouchStart={() => { long.current = false; minuterie.current = setTimeout(() => { long.current = true; modifier(c.id); }, 500); }}
    onTouchMove={lacher} onTouchEnd={lacher} onTouchCancel={lacher}>
    <span style="width:46px;display:grid;place-items:center"><Photo src={`${IMG}supp-bar.webp`} nom={c.nom} taille={40} incline={false} ombre={false} /></span>
    <span class="nut-supp-texte"><b>{c.nom}</b><small><Ic n="calendar-blank:fill" taille={11} /><span class="supp-detail">{bas && <strong>{detail ? `${bas} · ` : bas}</strong>}{detail}</span></small></span>
    <span class={`nut-coche ${c.pris ? 'on' : ''}`}>{c.pris && <Ic n="check:bold" taille={14} />}</span>
  </button>;
}

/* ===== Feuille semaine ===== */
function FeuilleSemaine({ ouvert, fermer }) {
  const t09 = T();
  const obj = getObjectifs();
  const sem = totauxSemaine();
  const moyenne = Math.round(sem.reduce((s, d) => s + d.kcal, 0) / 7);
  const joursCible = sem.filter((d) => obj.kcal > 0 && d.kcal >= obj.kcal * 0.9).length;
  const max = Math.max(...sem.map((d) => d.kcal), obj.kcal, 1);

  return <Feuille ouverte={ouvert} fermer={fermer} titre={t09.moyenneSemaine} sous={`${moyenne} ${t09.parJour}`}>
    <div class="nut-graphe-valeur">
      <b>{nombre(moyenne, 0)}<small> {t09.parJour}</small></b>
      <div class="nut-graphe-lignes"><small>{t09.joursCible(joursCible, 7)}</small><small>{t09.proteinesMoy(Math.round(sem.reduce((s, d) => s + d.p, 0) / 7))}</small></div>
    </div>
    <div class="nut-etagere" style="display:flex;gap:6px;padding-top:8px">
      {sem.map((d, i) => <div key={d.jour} style="flex:1;display:flex;flex-direction:column;gap:4px;align-items:center">
        <div style={`width:100%;height:60px;border-radius:8px;background:var(--raised2);display:flex;align-items:flex-end;overflow:hidden`}>
          <div style={`width:100%;background:var(--accent);height:${Math.max(4, (d.kcal / max) * 100)}%;border-radius:6px`} />
        </div>
        <small style="font-size:10px;color:var(--text3)">{['L', 'M', 'M', 'J', 'V', 'S', 'D'][i]}</small>
      </div>)}
    </div>
  </Feuille>;
}

/* ===== Feuille poids ===== */
function FeuillePoids({ ouvert, fermer }) {
  const t09 = T();
  const poids = etat.value?.poids ?? [];
  const obj = getObjectifs();
  const dernier = dernierPoidsKg();
  const but = obj.poidsKg;
  const ecart = dernier !== null && but ? Math.round((dernier - but) * 10) / 10 : null;

  return <Feuille ouverte={ouvert} fermer={fermer} titre={t09.poids} sous={dernier !== null ? t09.dernierePesee(`${nombre(dernier, 1)} kg`) : null}>
    <div class="nut-graphe-valeur">
      <b>{dernier !== null ? nombre(dernier, 1) : '?'}<small> kg</small></b>
      <div class="nut-graphe-lignes">
        {but ? <small>{t09.objectifPoids(`${nombre(but, 1)} kg`)}</small> : <small>{t09.sansObjectifPoids}</small>}
        {ecart !== null && <small>{ecart > 0 ? t09.aPerdre(`${nombre(ecart, 1)} kg`) : ecart < 0 ? t09.aGagner(`${nombre(-ecart, 1)} kg`) : t09.objectifAtteint}</small>}
      </div>
    </div>
    <div class="nut-resultats">
      {poids.slice(-14).reverse().map((p) => <div key={p.jour} class="nut-resultat" style="cursor:default">
        <span class="nut-resultat-texte"><b>{nombre(p.kg, 1)} kg</b><small>{jourDe(p.jour)}</small></span>
      </div>)}
    </div>
  </Feuille>;
}

/* ===== Écran principal ===== */
/* Ligne d'un aliment noté : glisser vers la gauche pour retirer (comme GymMane). */
function LigneEntree({ e, ouvrir, retirer }) {
  const [dx, setDx] = useState(0);
  const x0 = useRef(null);
  const nom = e.nom || G().ajoutRapide;
  const a = getAliment(e.alimentId);
  const g = G();
  return <div class="gm-entree-cadre">
    <div class="gm-entree-fond" aria-hidden="true"><Ic n="trash:bold" taille={18} /></div>
    <button type="button" class="gm-entree" style={`transform:translateX(${dx}px)${x0.current === null ? '' : ';transition:none'}`} onClick={() => { if (Math.abs(dx) < 6) ouvrir(); }}
      onTouchStart={(ev) => { x0.current = ev.touches[0].clientX; }}
      onTouchMove={(ev) => { if (x0.current !== null) setDx(Math.min(0, ev.touches[0].clientX - x0.current)); }}
      onTouchEnd={() => { x0.current = null; if (dx < -90) retirer(); else setDx(0); }}>
      <span class="gm-entree-photo">{a ? <Photo src={photoAliment(a)} nom={nom} taille={46} incline={false} /> : <Ic n="lightning:bold" taille={18} />}</span>
      <span class="gm-entree-texte">
        <b>{nom}</b>
        <small>{e.g} g  <i style="color:var(--accent)">{g.lettreP}</i> {Math.round(e.p)}  <i style="color:var(--warn)">{g.lettreG}</i> {Math.round(e.c)}  <i style="color:var(--sage)">{g.lettreL}</i> {Math.round(e.l)}</small>
      </span>
      <span class="gm-entree-kcal">{e.kcal} kcal</span>
    </button>
  </div>;
}

/* Feuille Personnaliser : cartes et suivis affichés sur l'écran. */
function FeuilleSuivis({ ouverte, fermer }) {
  const g = G();
  const groupes = [[g.trResume, ['calories', 'protein', 'carbs', 'fat']], [g.trDetail, ['animal', 'quality', 'fats', 'fiber', 'sugarSodium']],
    [g.trCartes, ['water', 'shake', 'supplements', 'fasting', 'weight', 'week', 'prep', 'plans', 'foods']]];
  const ICONES = { calories: 'fire', protein: 'egg', carbs: 'grains', fat: 'drop', animal: 'lightning', quality: 'dna', fats: 'drop', fiber: 'leaf', sugarSodium: 'cube',
    water: 'drop', shake: 'egg', supplements: 'pill', fasting: 'hourglass-medium', weight: 'scales', week: 'chart-line-up', prep: 'cooking-pot', plans: 'calendar-blank', foods: 'bookmark-simple' };
  // Couleur de l'icône quand le suivi est actif (showTrackersSheet).
  const COULEURS = { calories: 'var(--warn)', protein: MACRO_COULEUR.proteines, carbs: MACRO_COULEUR.glucides, fat: MACRO_COULEUR.lipides, animal: 'var(--warn)', quality: 'var(--sage)', fats: MACRO_COULEUR.lipides, fiber: 'var(--sage)', sugarSodium: MACRO_COULEUR.glucides,
    water: 'var(--info)', shake: MACRO_COULEUR.proteines, supplements: 'var(--sage)', fasting: 'var(--warn)', weight: 'var(--info)', week: 'var(--sage)', prep: 'var(--warn)', plans: 'var(--accent)', foods: 'var(--accent)' };
  return <Feuille ouverte={ouverte} fermer={fermer} titre={g.personnaliser} sous={g.trackersIndice}>
    <div class="gm-reglages">
      {groupes.map(([titre, cles]) => <div key={titre}>
        <h3>{titre}</h3>
        <div class="gm-groupe">
          {cles.filter((k) => SUIVIS.includes(k)).map((k) => <div key={k} class="gm-ligne">
            <span>{g.tr[k]}</span><span class="gm-ligne-ic" style={`color:${suiviActif(k) ? COULEURS[k] : 'var(--text3)'}`}><Ic n={ICONES[k]} taille={15} /></span>
            <Interrupteur actif={suiviActif(k)} onChange={() => basculerSuivi(k)} label={g.tr[k]} id={`suivi-${k}`} />
          </div>)}
        </div>
      </div>)}
    </div>
  </Feuille>;
}

export function Jour() {
  const t09 = T();
  const g = G();
  const [, forcer] = useState(0);
  useEffect(() => versionPrep.subscribe(() => forcer((x) => x + 1)), []);
  const glisse = useRef(null);
  const [suivisOp, setSuivisOp] = useState(false);
  const [nouvelAliment, setNouvelAliment] = useState(false);
  const [jour, setJour] = useState(jourLocal());
  const [repasActif, setRepasActif] = useState(() => repasDeLHeure());
  const [rapideOp, setRapideOp] = useState(false);
  const [optionsRepasOp, setOptionsRepasOp] = useState(false);
  const [shakeOp, setShakeOp] = useState(false);
  const [nouvelShake, setNouvelShake] = useState(false);
  const [nomNouvel, setNomNouvel] = useState('');
  const [platPersoOp, setPlatPersoOp] = useState(false);
  const [recherche, setRecherche] = useState(false);
  const [objectifs, setObjectifs] = useState(false);
  const [eauOp, setEauOp] = useState(false);
  const [jeuneOp, setJeuneOp] = useState(false);
  const [complementOp, setComplementOp] = useState(false);
  const [complementId, setComplementId] = useState(null);
  const [complementNom, setComplementNom] = useState('');
  const [detailRapide, setDetailRapide] = useState(null);
  const [semaineOp, setSemaineOp] = useState(false);
  const [poidsOp, setPoidsOp] = useState(false);
  const [repasCible, setRepasCible] = useState(null);

  const tot = totalsJour(jour);
  const brule = kcalBrulees(jour);
  const obj = getObjectifs(jour);
  const budget = obj.kcal + (obj.ajouterBrule ? brule : 0); // kcalBudgetOn : objectif plus calories brûlées si demandé

  const partKcal = budget > 0 ? tot.kcal / budget : 0;
  const over = partKcal > 1;
  const reste = Math.round(budget - tot.kcal);
  const pPart = obj.p > 0 ? Math.min(1, tot.p / obj.p) : 0;
  const cPart = obj.c > 0 ? Math.min(1, tot.c / obj.c) : 0;
  const lPart = obj.l > 0 ? Math.min(1, tot.l / obj.l) : 0;

  const qualite = calculerQualiteProteines(tot.aaTot, tot.aaProt);
  const sat = tot.sat;
  const mono = tot.mono;
  const poly = tot.poly;
  const satLim = obj.satLim ?? calculerObjectifsSuggeres().satLim;
  const eauMlV = eauMl(jour);
  const eauObj = eauObjectifMl();
  const eauPart = eauProgression(jour);

  const shake = getShake();
  const j = jeuneEtat();
  const sem = totauxSemaine();
  const caloriesS = sem.map((d) => d.kcal);
  const semMoy = Math.round(caloriesS.reduce((s, v) => s + v, 0) / 7);
  const joursCible = sem.filter((d) => obj.kcal > 0 && d.kcal >= obj.kcal * 0.9).length;
  const dernier = dernierPoidsKg();
  const butPoids = obj.poidsKg;
  const ecart = dernier !== null && butPoids ? Math.round((dernier - butPoids) * 10) / 10 : null;

  const aujIso = jourLocal();
  const hier = new Date(); hier.setDate(hier.getDate() - 1);
  const fin = (() => { const d = new Date(); d.setDate(d.getDate() + 7); return jourLocal(d); })();
  const pivot = new Date(`${jour}T00:00:00`);
  const lundi = new Date(pivot); lundi.setDate(pivot.getDate() - ((pivot.getDay() + 6) % 7));
  const LETTRES = jours();
  const semaine = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lundi); d.setDate(lundi.getDate() + i);
    const iso = jourLocal(d);
    const part = obj.kcal > 0 ? totalsJour(iso).kcal / obj.kcal : 0;
    return { jour: iso, num: d.getDate(), label: LETTRES[i], auj: iso === aujIso, futur: iso > aujIso, apres: iso > fin, part: Math.min(1, part),
      couleur: part > 1.1 ? 'var(--danger)' : part >= 0.9 ? 'var(--sage)' : 'var(--accent)' };
  });
  const decaler = (n) => { const d = new Date(pivot); d.setDate(d.getDate() + n); const iso = jourLocal(d); setJour(iso > fin ? fin : iso); };
  const libelleJour = jour === aujIso ? g.aujourdhui : jour === jourLocal(hier) ? g.hier : dateLongue(`${jour}T00:00:00`);

  const repasKeys = ['petit-dejeuner', 'dejeuner', 'diner', 'collations'];
  const repas = getRepasJour(jour);
  const repasLabelPhrase = g.repasPhrase[repasActif];
  const entreeActives = repas[repasActif] || [];
  const totalRepas = entreeActives.reduce((s, e) => ({ kcal: s.kcal + e.kcal, p: s.p + e.p, c: s.c + e.c, l: s.l + e.l }), { kcal: 0, p: 0, c: 0, l: 0 });
  const verre = verreMl();
  const favs = nutritionStore.value.favoris.map(getAliment).filter(Boolean);
  const raccourcis = [...new Set([...nutritionStore.value.recents, ...nutritionStore.value.favoris])].map(getAliment).filter(Boolean).slice(0, 12);
  const nbPlats = Object.keys(nutritionStore.value.platsPerso ?? {}).length;
  const fournees = lotsPrep();
  const nbPlans = plansTous().length;

  const complementsTous = complementsDuJour(jour);
  // À prendre ce jour-là, puis « Autres jours » (cards.dart _SupplementsCard : due / later).
  const complements = complementsTous.filter((c) => aPrendreLe(c, jour));
  const complementsAutres = complementsTous.filter((c) => !aPrendreLe(c, jour));
  const complementsPris = complements.filter((c) => c.pris).length;

  const ouvrirRecherche = (repas) => { setRepasCible(repas); setRecherche(true); };

  return <main class="ecran avec-nav">
    <div class="nut nut-nu gm">
      <header class="en-tete">
        <Rond n="chevron" label={g.retour} href="#/" />
        <div class="en-tete-titre">
          <div class="nut-titre-jour"><h1>{g.titre}</h1><span class="nut-beta"><Ic n="flask:fill" taille={10} />{g.beta}</span></div>
          <p class="muted">{libelleJour}</p>
        </div>
        <div class="en-tete-actions">
          <Rond n="sliders-horizontal" label={g.personnaliser} taille={36} icone={17} onClick={() => setSuivisOp(true)} />
          <Rond n="target" label={g.objectifsJour} taille={36} icone={17} onClick={() => setObjectifs(true)} />
        </div>
      </header>

      {/* Bande de semaine : initiale puis pastille, glisser pour changer de semaine */}
      <div class="gm-semaine m16" role="tablist" aria-label={t09.semaine}
        onTouchStart={(e) => { glisse.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => { if (glisse.current === null) return; const dx = e.changedTouches[0].clientX - glisse.current; glisse.current = null; if (dx > 60) decaler(-7); else if (dx < -60) decaler(7); }}>
        {semaine.map((s) => <button key={s.jour} type="button" class="gm-jour" role="tab" aria-selected={jour === s.jour} disabled={s.apres}
          onClick={() => setJour(s.jour)}>
          <small class={s.auj ? 'auj' : ''}>{s.auj ? g.aujourdhui : s.label}</small>
          <span class={`gm-pastille ${jour === s.jour ? 'choisi' : ''} ${s.futur ? 'futur' : ''}`}>
            {jour !== s.jour && !s.futur && <svg class="gm-mini" viewBox="0 0 40 40" aria-hidden="true">
              <circle cx="20" cy="20" r="16" fill="none" stroke="var(--raised2)" stroke-width="4" />
              {s.part > 0 && <circle cx="20" cy="20" r="16" fill="none" stroke={s.couleur} stroke-width="4" stroke-linecap="round"
                stroke-dasharray={`${2 * Math.PI * 16 * s.part} ${2 * Math.PI * 16}`} transform="rotate(-90 20 20)" />}
            </svg>}
            <span>{s.num}</span>
          </span>
        </button>)}
      </div>

      {/* Carte du jour : anneau calorique et macros */}
      {(suiviActif('calories') || suiviActif('protein') || suiviActif('carbs') || suiviActif('fat')) && <div class="gm-carte gm-hero m12">
        {suiviActif('calories') && <div class="gm-hero-ligne">
          <div class="gm-cote">
            <span style="color:var(--accent);display:flex"><Ic n="fork-knife:fill" taille={16} /></span>
            <b>{energie(tot.kcal)}</b>
            <small>{g.mange}</small>
          </div>
          <Anneau part={partKcal} taille={148} trait={12} centre={<>
            <small class={over ? 'trop' : ''}>{over ? g.enTrop : g.reste}</small>
            <b>{energie(Math.abs(reste))}</b>
            <small class="sur">{g.surObjectif(energie(budget), uniteEnergie())}</small>
          </>} />
          <div class="gm-cote">
            <span style="color:var(--warn);display:flex"><Ic n="fire:fill" taille={16} /></span>
            <b>{energie(brule)}</b>
            <small>{g.brule}</small>
          </div>
        </div>}
        <div class="gm-macros" style={suiviActif('calories') ? '' : 'margin-top:0'}>
          {[['carbs', g.glucides, tot.c, obj.c, cPart, MACRO_COULEUR.glucides, 'grains:fill'],
            ['protein', g.proteines, tot.p, obj.p, pPart, MACRO_COULEUR.proteines, 'egg:fill'],
            ['fat', g.lipides, tot.l, obj.l, lPart, MACRO_COULEUR.lipides, 'drop:fill']].filter(([k]) => suiviActif(k)).map(([k, nomM, val, but, part, couleur, ic]) =>
            <div key={k} class="gm-macro">
              <div class="gm-macro-val"><b>{Math.round(val)}</b><small>/{but}g</small></div>
              <Piste part={part} couleur={couleur} />
              <div class="gm-macro-nom"><span style={`color:${couleur};display:flex`}><Ic n={ic} taille={13} /></span>{nomM}</div>
            </div>)}
        </div>
      </div>}

      {/* Recherche et nouvel aliment */}
      <div class="gm-barre m12">
        <button type="button" class="gm-recherche" onClick={() => ouvrirRecherche(repasActif)}>
          <Ic n="magnifying-glass:bold" taille={17} /><span>{g.rechercher}</span>
        </button>
        <button type="button" class="gm-rond52" aria-label={g.nouvelAliment} onClick={() => setNouvelAliment(true)}><Ic n="plus:bold" taille={20} /></button>
      </div>

      {suiviActif('foods') && <>
        {/* Étagère : les aliments les plus utilisés, en autocollants */}
        <div class="m14">
          {raccourcis.length > 0
            ? <div class="gm-etagere" aria-label={t09.raccourcis}>
              {raccourcis.map((a) => <button key={a.id} type="button" class="gm-aliment" onClick={() => { setRepasCible(repasActif); setDetailRapide(a.id); }}>
                <span class="gm-aliment-case"><Photo src={photoAliment(a)} nom={nomDe(a)} taille={62} /></span>
                <span class="gm-aliment-nom">{nomDe(a)}</span>
              </button>)}
            </div>
            : <button type="button" class="gm-etagere-vide" onClick={() => ouvrirRecherche(repasActif)}>
              <span>{['banana', 'chicken-breast', 'rolled-oats'].map((c, i) => <span key={c} style={`left:${i * 30}px`}><Photo src={photoSlug(c)} nom={c} taille={54} /></span>)}</span>
              <p>{g.etagereVide}</p>
            </button>}
        </div>

        {/* Dossiers : favoris et repas enregistrés */}
        <div class="gm-dossiers m16">
          <Dossier titre={g.favoris} detail={favs.length ? g.nAliments(favs.length) : g.favoriIndice}
            peek={<Coup photos={favs.slice(0, 3).map((a) => ({ src: photoAliment(a), nom: nomDe(a) }))} vide="star:fill" />}
            onClick={() => setRecherche(true)} />
          <Dossier titre={g.repasEnregistres} detail={nbPlats ? g.nRepas(nbPlats) : g.creerPlat}
            peek={<Coup photos={[]} vide="cooking-pot:fill" />}
            onClick={() => setRecherche(true)} />
        </div>
      </>}

      {/* Repas : onglets en grand texte, point quand il y a des aliments */}
      <div class="gm-onglets m22" role="tablist" aria-label={t09.repas}>
        {repasKeys.map((k) => <button key={k} type="button" class={`gm-onglet ${repasActif === k ? 'on' : ''}`} role="tab" aria-selected={repasActif === k} onClick={() => setRepasActif(k)}>
          {g.repas[k]}
          {(repas[k] || []).length > 0 && k !== repasActif && <i aria-hidden="true" />}
        </button>)}
      </div>

      <div class="gm-carte gm-repas m14">
        <div class="gm-repas-tete">
          <button type="button" class="gm-repas-plat" onClick={() => ouvrirRecherche(repasActif)} aria-label={g.ajouterAu(repasLabelPhrase)}>
            <Assiette taille={112} items={[...entreeActives].reverse().map((e) => ({ src: photoAliment(getAliment(e.alimentId)), nom: e.nom }))}
              vide={<span class="gm-assiette-plus"><Ic n="plus:bold" taille={24} /></span>} />
          </button>
          <div class="gm-repas-infos">
            <div class="gm-repas-kcal"><b>{nombre(totalRepas.kcal, 0)}</b><span>kcal</span></div>
            <span class="gm-repas-sous">{entreeActives.length === 0 ? g.rienNote : g.nAliments(entreeActives.length)}</span>
            <div class="gm-pilules">
              {[[g.lettreP, totalRepas.p, MACRO_COULEUR.proteines], [g.lettreG, totalRepas.c, MACRO_COULEUR.glucides], [g.lettreL, totalRepas.l, MACRO_COULEUR.lipides]].map(([l, v, coul]) =>
                <span key={l} class="gm-pilule" style={`--c:${coul}`}><i>{l}</i>{Math.round(v)}g</span>)}
            </div>
          </div>
          <button type="button" class="gm-rond34" aria-label={g.optionsRepas} onClick={() => setOptionsRepasOp(true)}><Ic n="dots-three:bold" taille={15} /></button>
        </div>

        {entreeActives.length > 0 && <div class="gm-entrees">
          {[...entreeActives].map((e) => <LigneEntree key={e.id} e={e} ouvrir={() => { setRepasCible(repasActif); setDetailRapide(e.alimentId); }}
            retirer={() => { supprimerEntree(jour, repasActif, e.id); afficher(`${g.supprime}${dp()}${e.nom}`, 'ok', { libelle: g.annuler, fn: () => { const r = getRepasJour(jour); setRepasJour(jour, { ...r, [repasActif]: [...(r[repasActif] || []), e] }); } }); }} />)}
        </div>}

        <div class="gm-ajout">
          <button type="button" class="btn pri" onClick={() => ouvrirRecherche(repasActif)}>{g.ajouterAu(repasLabelPhrase)}</button>
          <button type="button" class="gm-rond50" aria-label={g.ajoutRapide} onClick={() => setRapideOp(true)}><Ic n="lightning:bold" taille={19} /></button>
        </div>
      </div>

      {/* Jeûne (suivi facultatif) */}
      {suiviActif('fasting') && <div class="m12">
      <div class="nut-jeune">
        <div class="nut-jeune-ligne">
          <div class="nut-jeune-anneau">
            <AnneauCal part={j.actif ? j.part : 0} taille={74} trait={6} couleur="var(--warn)" />
          </div>
          <div class="nut-jeune-texte">
            <small>{j.actif ? t09.enCours : t09.jeune}</small>
            <b>{j.actif ? j.reste : `${nutritionStore.value.jeune.butH}h`}</b>
            <span>{j.actif ? `${t09.debut} ${new Date(j.debut).toLocaleTimeString()}` : t09.aucunJeune}</span>
          </div>
          <button type="button" class="rond" style="width:44px;height:44px" aria-label={t09.jeune} onClick={() => setJeuneOp(true)}><Ic n={j.actif ? 'pause' : 'play'} taille={18} /></button>
        </div>
      </div>
      </div>}

      {/* Eau et protéines (shaker) */}
      {(suiviActif('water') || suiviActif('shake')) && <div class="gm-paire m12" style={suiviActif('water') && suiviActif('shake') ? '' : 'grid-template-columns:1fr'}>
        {suiviActif('water') && <div class="gm-tuile" style="--glow:var(--info)">
          <div class="gm-tuile-tete"><p>{g.eau}</p><button type="button" class="gm-rond34" aria-label={g.optionsEau} onClick={() => setEauOp(true)}><Ic n="dots-three:bold" taille={15} /></button></div>
          <button type="button" class="gm-vaisseau" aria-label={g.toucheVerre(`${verre} ml`)} onClick={() => ajouterEau(verre, jour)}>
            <Flacon type="eau" niveau={eauPart} />
          </button>
          <div class="gm-tuile-bas">
            <div class="gm-tuile-valeur"><b>{nombre(eauMlV / 1000, 2)}</b><small>/ {nombre(eauObj / 1000, 2)} L</small></div>
            <div class="gm-tuile-indice" style={`color:${eauPart >= 1 ? 'var(--sage)' : 'var(--info)'}`}>{eauPart >= 1 ? g.objectifAtteint : g.toucheVerre(`${verre} ml`)}</div>
          </div>
        </div>}
        {suiviActif('shake') && <div class="gm-tuile" style="--glow:var(--accent)">
          <div class="gm-tuile-tete"><p>{g.proteines}</p><button type="button" class="gm-rond34" aria-label={g.ton_shake} onClick={() => setShakeOp(true)}><Ic n="dots-three:bold" taille={15} /></button></div>
          <button type="button" class="gm-vaisseau" aria-label={shake ? g.toucheShake(nomDe(shake)) : g.shakeVide} onClick={() => {
            if (!shake) { setShakeOp(true); return; }
            ajouterAuRepas(jour, repasActif, shake.id, shake.gPortion || 100);
            afficher(g.ajouteAu(g.repasPhrase[repasActif]), 'ok');
          }}>
            <Flacon type="shake" niveau={pPart} />
          </button>
          <div class="gm-tuile-bas">
            <div class="gm-tuile-valeur"><b>{Math.round(tot.p)}</b><small>/ {obj.p} g</small></div>
            <div class="gm-tuile-indice" style="color:var(--accent)">{shake ? g.toucheShake(nomDe(shake)) : g.shakeVide}</div>
          </div>
        </div>}
      </div>}

      {/* Compléments */}
      {suiviActif('supplements') && <div class="gm-carte gm-supp m12">
        <div class="gm-supp-tete">
          <img src={`${IMG}peek-protein.webp`} alt="" />
          <p>{g.complements}</p>
          {complements.length > 0 && <b class={complementsPris === complements.length ? 'fait' : ''}>{complementsPris}/{complements.length}</b>}
        </div>
        {complementsTous.length === 0
          ? <>
            <div class="gm-puces">
              {g.suppPresets.map((nomP) => <button key={nomP} type="button" class="gm-puce" onClick={() => { setComplementId(null); setComplementNom(nomP); setComplementOp(true); }}>
                <Ic n="plus:bold" taille={16} />{nomP}
              </button>)}
            </div>
            <p class="gm-supp-note">{g.videComplements}</p>
          </>
          : <>
            {complements.length === 0 && <p class="gm-supp-note">{L26().suppRienAujourdhui}</p>}
            {complements.length > 0 && <div class="gm-supp-liste">{complements.map((c) => <LigneComplement key={c.id} c={c} jour={jour} modifier={(id) => { setComplementId(id); setComplementNom(''); setComplementOp(true); }} />)}</div>}
            {complementsAutres.length > 0 && <>
              <p class="l26-supp-autres">{L26().suppAutresJours}</p>
              <div class="gm-supp-liste">{complementsAutres.map((c) => <LigneComplement key={c.id} c={c} jour={jour} modifier={(id) => { setComplementId(id); setComplementNom(''); setComplementOp(true); }} />)}</div>
            </>}
          </>}
        <button type="button" class="gm-supp-pied" onClick={() => { setComplementId(null); setComplementNom(''); setComplementOp(true); }}>
          <Ic n="plus:bold" taille={13} />{g.nouveauComplement}
          {complements.length > 0 && complementsPris === 0 && <span>{g.indiceComplement}</span>}
        </button>
      </div>}

      {/* Meal prep */}
      {suiviActif('prep') && <>
        <div class="gm-titre m26"><p>{g.prepTitre}</p><a href="#/nutrition-prep"><Ic n="plus:bold" taille={12} />{g.nouvelleFournee}</a></div>
        <div class="m12">
          {fournees.length === 0
            ? <a class="gm-prep-vide" href="#/nutrition-prep">
              <Assiette taille={64} items={['rice', 'chicken-breast', 'broccoli'].map((s) => ({ src: photoSlug(s), nom: s }))} />
              <p>{g.prepVide}</p>
            </a>
            : <div class="gm-fournees">{fournees.map((b) => {
              const total = poidsTotal(b);
              const m = macrosLot(b);
              const part = total > 0 ? b.reste / total : 0;
              return <a key={b.id} class={`gm-fournee ${fournees.length === 1 ? 'seule' : ''}`} href="#/nutrition-prep">
                <div class="gm-fournee-tete">
                  <Assiette taille={46} items={(b.elements ?? []).slice(0, 5).map((e) => ({ src: photoSlug(e.alimentId), nom: e.nom ?? '' }))} />
                  <b>{b.nom}</b>
                </div>
                <div class="gm-fournee-reste">{Math.round(b.reste)} <small>/ {Math.round(total)} g</small></div>
                <span class="gm-barre-fine"><i style={`width:${Math.max(0, Math.min(1, part)) * 100}%`} /></span>
                <small>{Math.round(total > 0 ? (m.k * 100) / total : 0)} kcal · {g.pour100('g')}</small>
              </a>;
            })}</div>}
        </div>
      </>}

      {/* Plans de repas */}
      {suiviActif('plans') && <>
        <div class="gm-titre m26"><p>{g.plansTitre}</p><a href="#/nutrition-plans"><Ic n="plus:bold" taille={12} />{g.nouveauPlan}</a></div>
        <a class="gm-plans-ligne m12" href="#/nutrition-plans">
          <span><Ic n={nbPlans ? 'calendar-blank' : 'plus:bold'} taille={18} /></span>
          <p>{nbPlans ? g.nPlans(nbPlans) : g.plansIndice}</p>
        </a>
      </>}

      {/* En détail */}
      {(suiviActif('quality') || suiviActif('fats') || suiviActif('week') || suiviActif('weight')) && <div class="gm-titre m26"><p>{g.detail}</p></div>}
      {suiviActif('quality') && <div class="m12">
      <div class="nut-analyse">
        <div class="nut-analyse-tete"><Kicker>{t09.qualiteProteines}</Kicker></div>
        {tot.aaProt === 0
          ? <p class="nut-message">{t09.sansDonneesIndice}</p>
          : <>
            <div class="nut-qualite">
              <RadarAmino scores={qualite.scores} />
              <div class="nut-score">
                <b>{Math.round(qualite.score * 100)}<small>/100</small></b>
                <span class="nut-verdict" style={`background:color-mix(in srgb, ${qualite.score >= 0.95 ? 'var(--sage)' : qualite.score >= 0.75 ? 'var(--warn)' : 'var(--danger)'} 18%, transparent);color:${qualite.score >= 0.95 ? 'var(--sage)' : qualite.score >= 0.75 ? 'var(--warn)' : 'var(--danger)'}`}>
                  {labelQualite(qualite.score)}
                </span>
                <p class="nut-note">{qualite.limitant ? t09.limite(qualite.limitant) : t09.tousCouverts}</p>
                <p class="nut-note">{t09.couverture(tot.p > 0 ? Math.round((tot.aaProt / tot.p) * 100) : 0)}</p>
              </div>
            </div>
            <div class="nut-sources">
              <div class="nut-source">
                <i style="background:var(--accent-soft);color:var(--accent)"><IcLoc d="M4 8h16M6 8v10M18 8v10M9 8v10M15 8v10M7 18h14M3 18h2" taille={16} /></i>
                <span>{t09.animaux}</span><b>{nombre(tot.pAnimal, 0)} g</b>
              </div>
              <div class="nut-source">
                <i style="background:var(--sage-soft);color:var(--sage)"><IcLoc d="M12 3c3 4 6 6 6 10a6 6 0 0 1-12 0c0-4 3-6 6-10z" taille={16} /></i>
                <span>{t09.vegetaux}</span><b>{nombre(tot.pVegetal, 0)} g</b>
              </div>
            </div>
          </>}
      </div>
      </div>}
      {suiviActif('fats') && <div class="m12">
      <div class="nut-analyse">
        <div class="nut-analyse-tete"><Kicker>{t09.typesLipides}</Kicker></div>
        <div class="nut-duo">
          {[['sat', t09.satures, 'var(--danger)'], ['mono', t09.mono, 'var(--accent)'], ['poly', t09.poly, 'var(--info)'], ['trans', t09.trans, 'var(--warn)']].map(([k, label, couleur]) => {
            const v = k === 'sat' ? sat : k === 'mono' ? mono : k === 'poly' ? poly : 0;
            const max = k === 'sat' ? Math.max(satLim, v, 1) : Math.max(sat + mono + poly, v, 1);
            return <div key={k} class="nut-rond-carte">
              <div class="nut-anneau-petit">
                <svg viewBox="0 0 56 56" aria-hidden="true">
                  <circle cx="28" cy="28" r="23" fill="none" stroke="var(--raised2)" stroke-width="5" />
                  <circle cx="28" cy="28" r="23" fill="none" stroke={couleur} stroke-width="5" stroke-linecap="round"
                    stroke-dasharray={`${(2 * Math.PI * 23) * Math.min(1, v / max)} ${2 * Math.PI * 23}`} transform="rotate(-90 28 28)" />
                </svg>
              </div>
              <div class="nut-rond-carte-txt">
                <b>{nombre(v, 1)}<small> g</small></b>
                <small>{label}</small>
              </div>
            </div>;
          })}
        </div>
        <p class="nut-note">{t09.ligneSat(nombre(sat, 1), satLim)}</p>
      </div>
      </div>}
      {suiviActif('week') && <div class="m12">
      <button type="button" class="nut-graphe" onClick={() => setSemaineOp(true)}>
        <div class="nut-graphe-tete"><Kicker>{G().semaineMoy}</Kicker><Ic n="caret-right" taille={14} /></div>
        {/* Semaine vide (cards.dart _WeekTile, weekNoData) : un tiret et « Rien de noté », sans graphique. */}
        {caloriesS.every((v) => !v) ? <div class="nut-graphe-valeur"><b>-</b><div class="nut-graphe-lignes"><small>{L26().rienEnregistre}</small></div></div> : <>
        <div class="nut-graphe-valeur">
          <b>{nombre(semMoy, 0)}<small> {t09.parJour}</small></b>
          <div class="nut-graphe-lignes"><small>{t09.joursCible(joursCible, 7)}</small></div>
        </div>
        <div class="nut-etagere" style="display:flex;gap:6px;padding-top:8px">
          {caloriesS.map((v, i) => <div key={i} style="flex:1;display:flex;flex-direction:column;gap:4px;align-items:center">
            <div style={`width:100%;height:48px;border-radius:6px;background:var(--raised2);display:flex;align-items:flex-end;overflow:hidden`}>
              <div style={`width:100%;background:var(--accent);height:${Math.max(4, (v / Math.max(obj.kcal, 1)) * 100)}%;border-radius:4px`} />
            </div>
          </div>)}
        </div></>}
      </button>
      </div>}
      {suiviActif('weight') && <div class="m12">
      <button type="button" class="nut-graphe" onClick={() => setPoidsOp(true)}>
        <div class="nut-graphe-tete"><Kicker>{t09.poids}</Kicker><Ic n="caret-right" taille={14} /></div>
        <div class="nut-graphe-valeur">
          <b>{dernier !== null ? nombre(dernier, 1) : '?'}<small> kg</small></b>
          <div class="nut-graphe-lignes">
            {butPoids ? <small>{t09.objectifPoids(`${nombre(butPoids, 1)} kg`)}</small> : <small>{t09.sansObjectifPoids}</small>}
            {ecart !== null && <small>{ecart > 0 ? t09.aPerdre(`${nombre(ecart, 1)} kg`) : ecart < 0 ? t09.aGagner(`${nombre(-ecart, 1)} kg`) : t09.objectifAtteint}</small>}
          </div>
        </div>
      </button>
      </div>}
    </div>

    {/* Feuilles */}
    <FeuilleRecherche ouvert={recherche} fermer={() => setRecherche(false)} repasCible={repasCible} jour={jour}
      ouvrirRapide={() => setRapideOp(true)} ouvrirNouvel={(nom) => { setNomNouvel(nom); setNouvelAliment(true); }} ouvrirPlatPerso={() => setPlatPersoOp(true)} />
    <FeuilleSuivis ouverte={suivisOp} fermer={() => setSuivisOp(false)} />
    {(nouvelAliment || nouvelShake) && <FeuilleNouvelAliment nomInitial={nomNouvel} shake={nouvelShake} fermer={() => { setNouvelAliment(false); setNouvelShake(false); setNomNouvel(''); }} />}
    {objectifs && <FeuilleObjectifs fermer={() => setObjectifs(false)} />}
    {eauOp && <FeuilleEau jour={jour} fermer={() => setEauOp(false)} />}
    {rapideOp && <FeuilleAjoutRapide jour={jour} repas={repasActif} fermer={() => setRapideOp(false)} />}
    {optionsRepasOp && <FeuilleOptionsRepas jour={jour} repas={repasActif} fermer={() => setOptionsRepasOp(false)} />}
    {shakeOp && <FeuilleShake fermer={() => setShakeOp(false)} nouveau={() => { setShakeOp(false); setNouvelShake(true); }} />}
    {platPersoOp && <FeuillePlatPerso fermer={() => setPlatPersoOp(false)} />}
    <FeuilleJeune ouvert={jeuneOp} fermer={() => setJeuneOp(false)} />
    <FeuilleComplement ouvert={complementOp} fermer={() => setComplementOp(false)} modifierId={complementId} nomInitial={complementNom} />
    {detailRapide && (() => {
      const a = getAliment(detailRapide);
      return a ? <FeuilleAliment ouvert fermer={() => setDetailRapide(null)} fermerTout={() => setDetailRapide(null)} aliment={a} repasCible={repasCible} /> : null;
    })()}
    <FeuilleSemaine ouvert={semaineOp} fermer={() => setSemaineOp(false)} />
    <FeuillePoids ouvert={poidsOp} fermer={() => setPoidsOp(false)} />
  </main>;
}
