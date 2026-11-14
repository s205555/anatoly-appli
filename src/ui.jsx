// Composants communs : en-têtes, feuilles modales, toasts, champs.
import { signal } from '@preact/signals';
import { useEffect, useRef, useState } from 'preact/hooks';
import { drapeau } from '../../app/src/drapeaux.mjs';
import { ICONES } from '../../app/src/icones.mjs';
import { afficher, nombre, toast } from './donnees.js';
import { m24 } from './i18n/m24.js';
import { langue, t, dp } from './i18n.js';

export function Ic({ n, taille = 20, classe = '' }) {
  return <svg class={`ic ${classe}`} width={taille} height={taille} viewBox="0 0 256 256" fill="currentColor" aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: ICONES[n] ?? '' }} />;
}

export const Drapeau = ({ langue }) => <span class="drapeau-boite" dangerouslySetInnerHTML={{ __html: drapeau(langue) }} />;

export const Kicker = ({ children, classe = '' }) => <p class={`kicker ${classe}`}>{children}</p>;

// RoundAction de l'original : 36 px par défaut. Sous 44 px, ::before (.zone44) étend la zone tactile sans changer le rendu.
// n = 'chevron' : chevron de ScreenHeader (svg_icon.dart Ic.chevronLeft, trait 2,5 sur 24).
const CHEVRON = <svg class="ic" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M15 18l-6-6 6-6" /></svg>;
export function Rond({ n, label, onClick, href, plein, taille = 36, icone = 16, classe = '', desactive = false }) {
  const p = { class: `rond ${taille < 44 ? 'zone44' : ''} ${plein ? 'plein' : ''} ${desactive ? 'desactive' : ''} ${classe}`, 'aria-label': label, title: label, style: `width:${taille}px;height:${taille}px;--rt:${taille}px` };
  const ic = n === 'chevron' ? CHEVRON : <Ic n={n} taille={icone} />;
  return href ? <a {...p} href={href}>{ic}</a> : <button type="button" {...p} onClick={onClick} disabled={desactive}>{ic}</button>;
}

export function EnTete({ titre, retour = '#/', onRetour = null, actions = null, sous = null }) {
  return <header class="en-tete">
    <Rond n="chevron" label={t.commun.retour} href={onRetour ? undefined : retour} onClick={onRetour} />
    <div class="en-tete-titre"><h1>{titre}</h1>{sous && <p class="muted">{sous}</p>}</div>
    {actions && <div class="en-tete-actions">{actions}</div>}
  </header>;
}

export function Section({ titre, lien, action, children }) {
  return <section class="section">
    <div class="section-tete"><Kicker>{titre}</Kicker>{lien && <a class="voir" href={lien[0]}>{lien[1]}</a>}{action}</div>
    {children}
  </section>;
}

export function Vide({ n = 'calendar-blank', titre, texte, children }) {
  return <div class="vide-carte"><Ic n={n} taille={30} /><p class="vide-titre">{titre}</p>{texte && <p class="vide-texte">{texte}</p>}{children}</div>;
}

// Feuille « Démarrer » de l'accueil, ouverte aussi par le bouton ▶ de la barre du bas (app_shell.dart _play).
export const feuilleDemarrage = signal(false);

// Écran qui recule derrière une feuille (glass.dart _recede, app_shell.dart) : échelle 0,92, coins 32, voile noir 38 %.
// Pendant le recul, .vue devient une boîte fixe à la taille de l'écran et .vue-in défile à la place de la page :
// la mise à l'échelle ne déplace ni les éléments fixes ni les en-têtes collants.
let feuillesOuvertes = 0;
let finRecul = 0;
function reculer() {
  feuillesOuvertes += 1;
  if (feuillesOuvertes > 1) return;
  clearTimeout(finRecul);
  const b = document.body;
  if (b.classList.contains('recul-fixe')) { b.classList.add('recul'); return; }
  const vue = document.querySelector('.vue'), dedans = vue?.querySelector('.vue-in'), app = document.getElementById('app');
  if (!dedans) return;
  const y = window.scrollY;
  // La page garde sa hauteur : la fenêtre ne défile pas, aucun écran ne croit être revenu en haut.
  app.style.minHeight = `${document.documentElement.scrollHeight}px`;
  b.classList.add('recul-fixe');
  dedans.scrollTop = y;
  void vue.offsetWidth; // la transition part de l'échelle 1
  b.classList.add('recul');
}
function revenir() {
  feuillesOuvertes = Math.max(0, feuillesOuvertes - 1);
  if (feuillesOuvertes) return;
  const b = document.body;
  b.classList.remove('recul');
  clearTimeout(finRecul);
  finRecul = setTimeout(() => {
    if (feuillesOuvertes) return;
    b.classList.remove('recul-fixe');
    document.getElementById('app')?.style.removeProperty('min-height');
  }, 340);
}

// Feuille basse : voile, poignée (fermeture par glissement), Échap, focus gardé dedans.
// Hauteur selon le contenu (isScrollControlled de Flutter) ; `large={0.92}` impose cette part de l'écran, comme les feuilles de l'original à hauteur fixe.
export function Feuille({ ouverte, fermer, titre, sous, children, pied, large, sansFocus = false, classe = '' }) {
  const ref = useRef(null);
  const precedent = useRef(null);
  const glisser = useRef(null);
  useEffect(() => {
    if (!ouverte) return undefined;
    precedent.current = document.activeElement;
    const el = ref.current;
    // Premier champ, sinon la feuille elle-même : un bouton focalisé d'office affichait l'anneau de focus, absent de l'original.
    if (!sansFocus) requestAnimationFrame(() => (el?.querySelector('input:not([type=hidden]), select, textarea') ?? el)?.focus({ preventScroll: true }));
    const touche = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); fermer(); }
      if (e.key === 'Tab') {
        const f = [...el.querySelectorAll('button, [href], input, select, textarea')].filter((x) => !x.disabled && x.offsetParent !== null);
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); }
        else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
      }
    };
    document.addEventListener('keydown', touche);
    document.body.classList.add('fige');
    reculer();
    return () => { document.removeEventListener('keydown', touche); revenir(); if (!feuillesOuvertes) document.body.classList.remove('fige'); precedent.current?.focus?.({ preventScroll: true }); };
  }, [ouverte]);
  if (!ouverte) return null;
  const poignee = {
    style: 'touch-action: none',
    onPointerDown: (e) => { glisser.current = { y: e.clientY }; e.currentTarget.setPointerCapture(e.pointerId); },
    onPointerMove: (e) => {
      if (!glisser.current) return;
      const dy = e.clientY - glisser.current.y;
      if (dy <= 0) return;
      const el = ref.current;
      el.style.transition = 'none';
      el.style.transform = `translateY(${Math.min(dy * 0.5, 400)}px)`;
    },
    onPointerUp: (e) => {
      if (!glisser.current) return;
      const dy = e.clientY - glisser.current.y;
      const el = ref.current;
      el.style.transition = '';
      el.style.transform = '';
      glisser.current = null;
      if (dy > 72) fermer();
    },
  };
  const haute = typeof large === 'number' ? `height:${large * 100}dvh;max-height:${large * 100}dvh` : undefined;
  return <div class="voile" onClick={(e) => e.target === e.currentTarget && fermer()}>
    <div class={classe ? `feuille ${classe}` : 'feuille'} style={haute} role="dialog" aria-modal="true" aria-label={titre} ref={ref} tabIndex={-1}>
      <span class="poignee" aria-hidden="true" {...poignee} />
      {titre && <h2 class="feuille-titre">{titre}</h2>}
      {sous && <p class="feuille-sous">{sous}</p>}
      <div class="feuille-corps">{children}</div>
      {pied && <div class="feuille-pied">{pied}</div>}
    </div>
  </div>;
}

export function Dialogue({ ouvert, fermer, titre, texte, confirmer, libelle, danger, children }) {
  const [occupe, setOccupe] = useState(false);
  return <Feuille ouverte={ouvert} fermer={fermer} titre={titre} sous={texte}
    pied={<>
      <button class="btn large" type="button" onClick={fermer}>{t.commun.annuler}</button>
      <button class={`btn pri large ${danger ? 'danger-plein' : ''}`} type="button" disabled={occupe}
        onClick={async () => { setOccupe(true); try { await confirmer(); } finally { setOccupe(false); } }}>{libelle}</button>
    </>}>{children}</Feuille>;
}

// Toast en pilule qui glisse depuis le haut de l'écran.
export function Toast() {
  const v = toast.value;
  useEffect(() => {
    if (!v) return undefined;
    const id = setTimeout(() => { if (toast.value?.id === v.id) toast.value = null; }, v.action ? 5000 : 2600);
    return () => clearTimeout(id);
  }, [v?.id]);
  if (!v) return <div class="toast-zone" role="status" aria-live="polite" />;
  return <div class="toast-zone" role="status" aria-live="polite">
    <div class={`toast ${v.genre}`} key={v.id}>
      <span class="toast-pastille"><Ic n={v.genre === 'danger' ? 'warning:fill' : v.genre === 'record' ? 'trophy:fill' : 'check-circle:fill'} taille={18} /></span>
      <span class="toast-texte">{v.message}</span>
      {v.action && <button type="button" class="toast-action" onClick={() => { v.action.fn(); toast.value = null; }}>{v.action.libelle}</button>}
    </div>
  </div>;
}

export function Interrupteur({ actif, onChange, label, id }) {
  return <button type="button" role="switch" id={id} aria-checked={actif} aria-label={label} class={`inter ${actif ? 'on' : ''}`} onClick={() => onChange(!actif)}><span /></button>;
}

export function Segment({ options, valeur, onChange, label }) {
  return <div class="seg" role="radiogroup" aria-label={label}>
    {options.map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={v === valeur} aria-pressed={v === valeur} onClick={() => onChange(v)}>{l}</button>)}
  </div>;
}

// Champ numérique : clavier décimal, virgule acceptée, valeur vide autorisée.
// Avec `pas`, boutons moins/plus de part et d'autre (comme les mini-compteurs de GymMane) ; `max` borne la saisie et prévient si la valeur est refusée.
// `arrondir(valeur, sens)` (facultatif) remplace le pas des boutons, par exemple la pile de poids d'une machine.
// Avec `regle` (options de demanderRegle), la valeur est un bouton qui ouvre la règle, comme les compteurs de la séance de l'original.
export function Nombre({ valeur, onChange, label, decimales = true, classe = '', placeholder = '', pas = 0, max = null, arrondir = null, regle = null }) {
  const [texte, setTexte] = useState(valeur ?? '');
  const ref = useRef(null);
  useEffect(() => { if (document.activeElement !== ref.current) setTexte(valeur ?? ''); }, [valeur]);
  const refus = () => afficher(max === null ? t.commun.horsPlage : t.commun.horsPlageMax(max), 'danger');
  const pousser = (n) => { setTexte(n === null ? '' : n); onChange(n); };
  const bouger = (dir) => {
    const base = Math.round((Number(valeur) || 0) / pas) * pas;
    const nv = arrondir ? arrondir(Number(valeur) || 0, dir) : Math.max(0, Math.round((base + dir * pas) * 1000) / 1000);
    if (max !== null && nv > max) { refus(); return; }
    pousser(nv);
  };
  const ouvrir = async () => {
    const v = await demanderRegle({ titre: label, max: max ?? 1000, pas: pas || 1, ...regle, valeur: valeur === null || valeur === undefined || valeur === '' ? regle.valeurDefaut ?? 0 : Number(valeur) });
    if (v !== undefined) pousser(v === null ? null : decimales ? v : Math.round(v));
  };
  const montre = valeur === null || valeur === undefined || valeur === '' ? '' : regle?.format ? regle.format(Number(valeur)) : nombre(Number(valeur), 2);
  const champ = regle ? <button type="button" class={`cellule cellule-regle ${classe}`} aria-label={`${label}${dp()}${montre || placeholder}`} onClick={ouvrir}>
    {montre || <span class="cellule-vide">{placeholder}</span>}</button> : <input ref={ref} class={`cellule ${classe}`} inputMode={decimales ? 'decimal' : 'numeric'} enterKeyHint="next" aria-label={label} placeholder={placeholder} value={langue === 'fr' ? String(texte).replace('.', ',') : String(texte)}
    onFocus={(e) => e.target.select()}
    onInput={(e) => {
      const brut = e.target.value.replace(',', '.').replace(/[^\d.]/g, '');
      if (e.target.value.includes('-')) refus();
      let n = brut === '' ? null : Number(brut);
      if (n !== null && !Number.isFinite(n)) return;
      if (n !== null && max !== null && n > max) { refus(); n = max; setTexte(String(max)); onChange(max); return; }
      setTexte(brut);
      if (brut === '' || n !== null) onChange(n === null ? null : decimales ? n : Math.round(n));
    }} />;
  if (!pas) return champ;
  const dis = classe.includes('desactive');
  return <div class={`pas-nombre ${dis ? 'desactive' : ''}`}>
    <button type="button" class="pas-btn" tabIndex={-1} aria-label={`${t.commun.diminuer}${dp()}${label}`} onClick={() => bouger(-1)} disabled={dis}><Ic n="minus:bold" taille={12} /></button>
    {champ}
    <button type="button" class="pas-btn" tabIndex={-1} aria-label={`${t.commun.augmenter}${dp()}${label}`} onClick={() => bouger(1)} disabled={dis}><Ic n="plus:bold" taille={12} /></button>
  </div>;
}

// Règle graduée : bande défilante, une graduation tous les 11 px, aimant dû au scroll-snap.
export function Regle({ valeur, min, max, pas, majeur, onChange, label, etiquette = null }) {
  const nb = Math.round((max - min) / pas) + 1;
  const ref = useRef(null);
  const dernier = useRef(-1);
  const animation = useRef(0);

  const poser = (i) => {
    const el = ref.current;
    const c = el?.children[i];
    if (!el || !c) return;
    el.scrollTo({ left: c.offsetLeft - el.clientWidth / 2 + c.offsetWidth / 2, behavior: 'instant' });
  };

  useEffect(() => {
    const i = Math.round((valeur - min) / pas);
    dernier.current = i;
    poser(i);
  }, []);

  useEffect(() => {
    const i = Math.round((valeur - min) / pas);
    if (i === dernier.current) return undefined;
    dernier.current = i;
    // Placement immédiat : un défilement doux passerait par des graduations intermédiaires que defile renverrait à onChange.
    poser(i);
    return undefined;
  }, [valeur]);

  const defile = () => {
    cancelAnimationFrame(animation.current);
    animation.current = requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      const centre = el.scrollLeft + el.clientWidth / 2;
      let meilleur = 0;
      let ecart = Infinity;
      for (let i = 0; i < el.children.length; i += 1) {
        const c = el.children[i];
        const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - centre);
        if (d < ecart) { ecart = d; meilleur = i; }
      }
      if (meilleur !== dernier.current) {
        dernier.current = meilleur;
        onChange(arrondi3(min + meilleur * pas));
      }
    });
  };

  const clavier = (e) => {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    onChange(Math.min(max, Math.max(min, arrondi3(valeur + delta * pas))));
  };

  return <div class="m08-regle-boite">
    <span class="m08-curseur" aria-hidden="true" />
    <div class="m08-regle" ref={ref} onScroll={defile} tabIndex={0} role="slider" onKeyDown={clavier}
      aria-label={label} aria-valuemin={min} aria-valuemax={max} aria-valuenow={valeur} aria-valuetext={etiquette ? etiquette(valeur) : nombre(valeur, 2)}>
      {Array.from({ length: nb }, (_, i) => {
        const maj = i % majeur === 0;
        const demi = !maj && majeur % 2 === 0 && i % (majeur / 2) === 0;
        return <span key={i} class={`m08-trait ${maj ? 'maj' : demi ? 'demi' : ''}`}>
          {maj && <em>{etiquette ? etiquette(min + i * pas) : nombre(arrondi3(min + i * pas), 2)}</em>}
        </span>;
      })}
    </div>
  </div>;
}


const arrondi3 = (n) => Math.round(n * 1000) / 1000;

// Saisie d'une valeur (askRuler et askNumber de l'original) : une feuille à la fois, posée au-dessus de tout par <Saisie />.
// La promesse rend le nombre choisi, null pour « effacer », undefined si la saisie est abandonnée.
export const saisie = signal(null);
let saisieN = 0;
export const demanderRegle = (o) => new Promise((res) => { saisie.value = { min: 0, majeur: 10, ...o, genre: 'regle', res, n: ++saisieN }; });
export const demanderNombre = (o) => new Promise((res) => { saisie.value = { ...o, genre: 'nombre', res, n: ++saisieN }; });

export function Saisie() {
  const s = saisie.value;
  if (!s) return null;
  const finir = (v) => { if (saisie.value === s) saisie.value = null; s.res(v); };
  return s.genre === 'regle' ? <FeuilleRegle key={s.n} o={s} finir={finir} /> : <DialogueNombre key={s.n} o={s} finir={finir} />;
}

/** askNumber : champ centré en grand, clavier numérique, virgule acceptée. */
function DialogueNombre({ o, finir }) {
  const x = m24();
  const [texte, setTexte] = useState(() => (o.valeur === undefined || o.valeur === null || o.valeur === '' ? '' : String(o.valeur).replace('.', langue === 'fr' ? ',' : '.')));
  const lire = () => { const n = Number(texte.trim().replace(',', '.')); finir(texte.trim() === '' || !Number.isFinite(n) ? undefined : n); };
  return <Feuille ouverte fermer={() => finir(undefined)} titre={o.titre} classe="saisie-feuille"
    pied={<><button type="button" class="btn large" onClick={() => finir(undefined)}>{x.annuler}</button>
      <button type="button" class="btn pri large" onClick={lire}>{x.valider}</button></>}>
    <input class="saisie-nombre" inputMode={o.decimales === false ? 'numeric' : 'decimal'} enterKeyHint="done" aria-label={o.titre} value={texte}
      onFocus={(e) => e.target.select()} onInput={(e) => setTexte(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); lire(); } }} />
  </Feuille>;
}

/** askRuler : lecture en grand, règle graduée, icône clavier pour la valeur exacte, Valider (et « effacer » si prévu). */
function FeuilleRegle({ o, finir }) {
  const x = m24();
  const borne = (v) => Math.min(o.max, Math.max(o.min, v));
  const [v, setV] = useState(() => borne(Number(o.valeur) || 0));
  const [clavier, setClavier] = useState(false);
  const decimales = o.pas === Math.round(o.pas) ? 0 : 2;
  const montre = (n) => (o.format ? o.format(n) : nombre(n, decimales || 2));
  return <Feuille ouverte fermer={() => finir(undefined)} titre={o.titre} classe="saisie-feuille saisie-regle"
    pied={<><button type="button" class="btn pri large" onClick={() => finir(v)}>{x.valider}</button>
      {o.effacer && <button type="button" class="btn lien" onClick={() => finir(null)}>{o.effacer}</button>}</>}>
    <button type="button" class="saisie-clavier" aria-label={x.clavier(o.titre)} onClick={() => setClavier(true)}><Ic n="keyboard" taille={20} /></button>
    <p class="saisie-lecture" aria-live="polite"><strong>{montre(v)}</strong>{o.unite && <small>{o.unite}</small>}</p>
    <Regle valeur={v} min={o.min} max={o.max} pas={o.pas} majeur={o.majeur} onChange={setV} label={o.titre} etiquette={o.etiquette ?? o.format} />
    {o.aide && <p class="saisie-aide">{o.aide}</p>}
    {clavier && <DialogueNombre o={{ titre: o.titre, valeur: o.format ? Math.round(v) : arrondi3(v), decimales: Boolean(decimales) }}
      finir={(n) => { setClavier(false); if (n !== undefined) setV(Math.round(borne(n) * 100) / 100); }} />}
  </Feuille>;
}

// Anneau d'objectif : rayon 16, trait 4, piste raised2, arc accent depuis le haut.
export function Anneau({ part, taille = 44 }) {
  const c = 2 * Math.PI * 16, p = Math.max(0, Math.min(1, part));
  return <svg width={taille} height={taille} viewBox="0 0 40 40" class="anneau" aria-hidden="true">
    <circle cx="20" cy="20" r="16" fill="none" stroke="var(--raised2)" stroke-width="4" />
    <circle cx="20" cy="20" r="16" fill="none" stroke="var(--accent)" stroke-width="4" stroke-linecap="round" stroke-dasharray={`${c * p} ${c}`} transform="rotate(-90 20 20)" style="transition: stroke-dasharray 700ms var(--ease-out)" />
  </svg>;
}

// Courbe simple : ligne accent, aire douce, point final cerclé.
export function Courbe({ points, hauteur = 116, label }) {
  if (points.length < 2) return null;
  const w = 320, h = hauteur, pad = 8;
  const ys = points.map((p) => p.y), min = Math.min(...ys), max = Math.max(...ys), et = max - min || 1;
  const x = (i) => pad + (i / (points.length - 1)) * (w - 2 * pad);
  const y = (v) => h - pad - ((v - min) / et) * (h - 2 * pad);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join(' ');
  const der = points.at(-1);
  return <svg class="courbe" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label={label} style={`height:${h}px`}>
    <path d={`${d} L${x(points.length - 1)},${h} L${x(0)},${h} Z`} fill="var(--accent-soft)" />
    <path d={d} fill="none" stroke="var(--accent)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
    <circle cx={x(points.length - 1)} cy={y(der.y)} r="5" fill="var(--raised)" stroke="var(--accent)" stroke-width="3" vector-effect="non-scaling-stroke" />
  </svg>;
}

// Carte souple : fond raised, rayon 22, padding 20 (SoftCard du kit Flutter).
export function Carte({ children, classe = '', style = '', onClick }) {
  const props = { class: `carte ${classe}`, style };
  return onClick ? <button type="button" {...props} onClick={onClick}>{children}</button> : <div {...props}>{children}</div>;
}

// Champ de recherche arrondi (réutilise .recherche de app.css).
export function Recherche({ valeur, onChange, placeholder, label }) {
  return <div class="recherche" role="search" aria-label={label}>
    {/* SearchField (ui_kit.dart) : Ic.search de svg_icon.dart, 16 px, trait 2 sur 24. */}
    <svg class="ic" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" /></svg>
    <input type="search" value={valeur} onInput={(e) => onChange(e.target.value)} placeholder={placeholder} />
  </div>;
}

// Pilule (pill) : arrondi 100px, compacte.
export function Pilule({ children, classe = '', style = '', onClick }) {
  const props = { class: `pilule ${classe}`, style: `border-radius:var(--r-pill);padding:0 14px;min-height:36px;display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;background:var(--raised2);color:var(--text);${style}` };
  return onClick ? <button type="button" {...props} onClick={onClick}>{children}</button> : <span {...props}>{children}</span>;
}

// Bouton pressable principal / secondaire / danger / lien (reprend .btn / .btn.pri / .btn.lien de anatoly.css).
export function Bouton({ children, variante = 'secondaire', taille = 'normal', classe = '', onClick, disabled, href, ...reste }) {
  const cl = `btn ${variante === 'primaire' ? 'pri' : variante === 'danger' ? 'danger' : variante === 'lien' ? 'lien' : ''} ${taille === 'large' ? 'large' : ''} ${classe}`;
  if (href) return <a href={href} class={cl} {...reste}>{children}</a>;
  return <button type="button" class={cl} disabled={disabled} onClick={onClick} {...reste}>{children}</button>;
}
