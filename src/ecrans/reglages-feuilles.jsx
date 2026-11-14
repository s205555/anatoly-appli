// Feuilles des réglages absentes de la démo : sauvegarde automatique (auto_backup_sheet.dart),
// coach vocal (voice_sheet.dart), rapport (report_sheet.dart) et données de santé (health_cards.dart).
import { useEffect, useState } from 'preact/hooks';
import { afficher, enDate, etat, jourLocal, nomExercice, poids as poidsTexte, recordsDe, unite, volume } from '../donnees.js';
import { langue, t } from '../i18n.js';
import { exportCsv, telecharger } from '../exporter.js';
import { arreterVoix, dire, voixDisponible } from '../sons.js';
import { Feuille, Ic } from '../ui.jsx';
import { M03 } from '../i18n/m03.js';
import { derniereSauvegardeAuto, sauvegardeAuto } from './onboarding.jsx';
import { ecrireM13, lireM13 } from './reglages-m13.js';

const T = {
  fr: {
    sauv: {
      titre: 'Sauvegarde auto',
      sous: 'Enregistre un ZIP avec toutes vos données dans ce navigateur. Gardez aussi une copie hors de l’appareil avec « Exporter une sauvegarde (ZIP) ».',
      modes: { off: 'Désactivée', workout: 'Après chaque séance', daily: 'Une fois par jour', weekly: 'Une fois par semaine' },
      enQuittant: 'En quittant l’appli', lieu: 'Ce navigateur', jamais: 'Aucune sauvegarde', derniere: (q) => `Dernière sauvegarde ${q}`,
      perdue: 'La dernière sauvegarde a échoué. Le stockage du navigateur est peut-être plein ou bloqué.',
      garder: 'Copies à garder', maintenant: 'Sauvegarder maintenant', ok: 'Sauvegarde enregistrée', termine: 'Terminé',
    },
    voix: {
      titre: 'Comment fonctionne la voix',
      points: ['Quand vous cochez une série, elle annonce le temps de repos et la suite.', 'Elle compte 3, 2, 1 à la fin du repos et vous rappelle.', 'Elle utilise la voix de votre appareil et passe par-dessus votre musique.'],
      sansLangue: 'Aucune voix française n’est installée. Ajoutez-en une dans les réglages de voix de votre appareil.',
      sansMoteur: 'Votre navigateur ne propose pas de voix de synthèse.',
      essayer: 'Essayer la voix', termine: 'Terminé',
    },
    rapport: {
      titre: 'Rapport', sous: 'Choisissez les dates et partagez-le en PDF ou CSV',
      j30: '30 J', j90: '90 J', a1: '1 A', autre: 'Autre', choisir: 'Choisir les dates', du: 'Du', au: 'Au',
      vide: 'Rien d’enregistré entre ces dates.', seances: 'SÉANCES', series: 'SÉRIES', volume: 'VOLUME',
      records: (n) => (n === 1 ? '1 nouveau record' : `${n} nouveaux records`), exos: (n) => (n === 1 ? '1 exercice' : `${n} exercices`),
      pdf: 'Partager le PDF', csv: 'Exporter le CSV', titrePdf: 'Rapport d’entraînement', exercice: 'Exercice', meilleure: 'Meilleure série',
    },
    sante: {
      titre: 'Données de santé',
      texte: 'Les pas, le sommeil et les autres données de santé du téléphone (Health Connect, Santé) ne sont pas accessibles depuis un navigateur. Anatoly ne les affiche donc pas.',
      ok: 'Compris',
    },
  },
  en: {
    sauv: {
      titre: 'Auto backup',
      sous: 'Saves a ZIP with all your data in this browser. Keep a copy off the device too with "Export backup (ZIP)".',
      modes: { off: 'Off', workout: 'After each workout', daily: 'Once a day', weekly: 'Once a week' },
      enQuittant: 'When you leave the app', lieu: 'This browser', jamais: 'No backup yet', derniere: (q) => `Last backup ${q}`,
      perdue: 'Couldn’t save the last backup. The browser storage may be full or blocked.',
      garder: 'Copies to keep', maintenant: 'Back up now', ok: 'Backup saved', termine: 'Done',
    },
    voix: {
      titre: 'How the voice works',
      points: ['When you tick a set, it tells you the rest time and what comes next.', 'It counts 3, 2, 1 at the end of the rest and calls you back.', 'It uses your device’s voice and plays over your music.'],
      sansLangue: 'No English voice is installed. Add one in your device’s voice settings.',
      sansMoteur: 'Your browser has no speech voice.',
      essayer: 'Try the voice', termine: 'Done',
    },
    rapport: {
      titre: 'Report', sous: 'Pick the dates and share it as a PDF or CSV',
      j30: '30D', j90: '90D', a1: '1Y', autre: 'Other', choisir: 'Choose dates', du: 'From', au: 'To',
      vide: 'Nothing logged between these dates.', seances: 'WORKOUTS', series: 'SETS', volume: 'VOLUME',
      records: (n) => (n === 1 ? '1 new record' : `${n} new records`), exos: (n) => (n === 1 ? '1 exercise' : `${n} exercises`),
      pdf: 'Share PDF', csv: 'Export CSV', titrePdf: 'Training report', exercice: 'Exercise', meilleure: 'Best set',
    },
    sante: {
      titre: 'Health data',
      texte: 'Steps, sleep and the other health data on your phone (Health Connect, Apple Health) can’t be read from a browser, so Anatoly doesn’t show them.',
      ok: 'Got it',
    },
  },
};
const X = () => T[langue] ?? T.fr;
const loc = () => (langue === 'en' ? 'en-GB' : 'fr-FR');
const GARDER = [1, 3, 5, 10, 20];

// ===== Sauvegarde automatique =====
export function FeuilleSauvegarde({ ouverte, fermer }) {
  const x = X().sauv;
  const [r, setR] = useState(lireM13);
  const [derniere, setDerniere] = useState(null);
  const [echec, setEchec] = useState(false);
  const [occupe, setOccupe] = useState(false);
  useEffect(() => { if (ouverte) { setR(lireM13()); derniereSauvegardeAuto().then((v) => setDerniere(v?.date ?? null)); } }, [ouverte]);
  const mode = ['workout', 'daily', 'weekly'].includes(r.sauvegardeAutoMode) ? r.sauvegardeAutoMode : 'off';
  const garder = GARDER.includes(r.sauvegardeAutoGarder) ? r.sauvegardeAutoGarder : 5;
  const poser = (m) => { const n = { ...lireM13(), ...m }; setR(n); ecrireM13(n); };
  const lancer = async () => {
    setOccupe(true);
    try { const d = await sauvegardeAuto('workout', null, garder); setDerniere(d); setEchec(false); afficher(x.ok); return true; }
    catch { setEchec(true); afficher(x.perdue, 'danger'); return false; } finally { setOccupe(false); }
  };
  const choisir = async (m) => { poser({ sauvegardeAutoMode: m }); if (m !== 'off' && !derniere) await lancer(); };
  const statut = echec ? x.perdue : derniere ? x.derniere(new Intl.DateTimeFormat(loc(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(derniere))) : x.jamais;
  const i = GARDER.indexOf(garder);
  return <Feuille ouverte={ouverte} fermer={fermer} titre={x.titre} sous={x.sous}
    pied={<button type="button" class="btn pri large" onClick={fermer}>{x.termine}</button>}>
    <div class="options" role="radiogroup" aria-label={x.titre}>
      {Object.entries(x.modes).map(([v, l]) => <button type="button" role="radio" aria-checked={v === mode} key={v} class={`option ${v === mode ? 'choisie' : ''}`} onClick={() => choisir(v)}>
        <span><strong>{l}</strong>{(v === 'daily' || v === 'weekly') && <small>{x.enQuittant}</small>}</span>{v === mode && <Ic n="check-circle:fill" taille={18} classe="option-coche" />}
      </button>)}
    </div>
    <div class="options">
      <div class={`option rgf-statut ${echec ? 'danger' : ''}`}><Ic n="folder-simple" taille={18} /><span><strong>{x.lieu}</strong><small>{statut}</small></span></div>
    </div>
    <div class="rgf-garder">
      <span>{x.garder}</span>
      <span class="rg-pas">
        <button type="button" aria-label={`${x.garder} −`} disabled={i <= 0} onClick={() => poser({ sauvegardeAutoGarder: GARDER[i - 1] })}><Ic n="minus" taille={14} /></button>
        <output class="rg-pas-val" aria-live="polite">{garder}</output>
        <button type="button" aria-label={`${x.garder} +`} disabled={i >= GARDER.length - 1} onClick={() => poser({ sauvegardeAutoGarder: GARDER[i + 1] })}><Ic n="plus" taille={14} /></button>
      </span>
    </div>
    <div class="rgf-centre">
      {occupe ? <span class="rond-attente" role="img" aria-label={t.commun.chargement} />
        : <button type="button" class="rgf-fantome" onClick={lancer}><Ic n="file-zip" taille={17} />{x.maintenant}</button>}
    </div>
  </Feuille>;
}

// ===== Coach vocal =====
const echantillon = () => {
  const v = (M03[langue] ?? M03.fr).sx.voix;
  const p = `${poidsTexte(60)} ${unite()}`;
  return `${v.repos(`${v.minutes(1)} ${v.et} ${v.secondes(30)}`)} ${v.suivant(nomExercice('developpe-couche-a-la-barre'), v.charge(8, p))}`;
};

export function FeuilleVoix({ ouverte, fermer }) {
  const x = X().voix;
  const [lecture, setLecture] = useState(false);
  const [statut, setStatut] = useState('ok');
  useEffect(() => {
    if (!ouverte) return undefined;
    const verifier = () => {
      if (!voixDisponible()) return setStatut('moteur');
      const voix = speechSynthesis.getVoices();
      setStatut(voix.length && !voix.some((v) => v.lang?.toLowerCase().startsWith(langue)) ? 'langue' : 'ok');
    };
    verifier();
    if (voixDisponible()) speechSynthesis.addEventListener?.('voiceschanged', verifier);
    return () => { if (voixDisponible()) { speechSynthesis.removeEventListener?.('voiceschanged', verifier); arreterVoix(); } };
  }, [ouverte]);
  const essayer = () => {
    if (lecture) { arreterVoix(); setLecture(false); return; }
    const u = dire(echantillon());
    if (!u) return;
    setLecture(true);
    u.onend = () => setLecture(false); u.onerror = () => setLecture(false);
  };
  return <Feuille ouverte={ouverte} fermer={() => { arreterVoix(); fermer(); }} titre={x.titre}
    pied={<button type="button" class="btn pri large" onClick={() => { arreterVoix(); fermer(); }}>{x.termine}</button>}>
    <div class="rgf-points">
      {x.points.map((p, i) => <p key={i}><Ic n={['timer', 'hourglass-medium', 'speaker-high'][i]} taille={16} />{p}</p>)}
      {statut !== 'ok' && <p class="rgf-alerte"><Ic n="warning-circle" taille={16} />{statut === 'langue' ? x.sansLangue : x.sansMoteur}</p>}
    </div>
    {statut !== 'moteur' && <div class="rgf-centre">
      <button type="button" class="rgf-fantome" aria-pressed={lecture} onClick={essayer}><Ic n={lecture ? 'pause' : 'play'} taille={17} />{x.essayer}</button>
    </div>}
  </Feuille>;
}

// ===== Rapport =====
const debutJour = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
function rapport(du, au) {
  const e = etat.value;
  const fin = new Date(au.getFullYear(), au.getMonth(), au.getDate() + 1);
  const toutes = [...(e?.seances ?? [])].sort((a, b) => (a.debut < b.debut ? -1 : 1));
  const seances = toutes.filter((s) => { const d = enDate(s.debut); return d >= du && d < fin; });
  let series = 0, vol = 0;
  const lifts = new Map();
  for (const s of seances) for (const ex of s.donnees?.exercices ?? []) for (const x of ex.series ?? []) {
    if (x.fait === false || x.type === 'e') continue;
    series++; vol += (Number(x.kg) || 0) * (Number(x.r) || 0);
    const m = lifts.get(ex.ex);
    if ((Number(x.kg) || 0) > 0 && (!m || x.kg > m.kg || (x.kg === m.kg && x.r > m.r))) lifts.set(ex.ex, { kg: x.kg, r: x.r });
    else if (!m) lifts.set(ex.ex, { kg: 0, r: x.r });
  }
  const records = seances.flatMap((s) => recordsDe(s, toutes));
  const pesees = (e?.poids ?? []).filter((w) => { const d = enDate(String(w.jour).slice(0, 10)); return d >= du && d < fin; }).sort((a, b) => (a.jour < b.jour ? -1 : 1));
  return { seances, series, vol, lifts, records, de: pesees[0]?.kg ?? null, a: pesees.at(-1)?.kg ?? null, nbPesees: pesees.length };
}

export function FeuilleRapport({ ouverte, fermer }) {
  const x = X().rapport;
  const auj = debutJour(new Date());
  const [prereglage, setPrereglage] = useState(30);
  const [plage, setPlage] = useState(() => ({ du: new Date(auj.getFullYear(), auj.getMonth(), auj.getDate() - 29), au: auj }));
  const [choix, setChoix] = useState(false);
  const poserJours = (n) => { setPrereglage(n); setPlage({ du: new Date(auj.getFullYear(), auj.getMonth(), auj.getDate() - (n - 1)), au: auj }); };
  const r = rapport(plage.du, plage.au);
  const fmt = (d) => new Intl.DateTimeFormat(loc(), { day: 'numeric', month: 'short', year: plage.du.getFullYear() !== plage.au.getFullYear() || plage.au.getFullYear() !== auj.getFullYear() ? 'numeric' : undefined }).format(d);
  const v = volume(r.vol);
  const csv = () => telecharger(new Blob([exportCsv({ ...etat.value, seances: r.seances })], { type: 'text/csv' }), `anatoly-rapport-${jourLocal(plage.du)}-${jourLocal(plage.au)}.csv`);
  const pdf = () => {
    // Le navigateur produit le PDF depuis sa fenêtre d'impression (« Enregistrer au format PDF »).
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const lignes = [...r.lifts].map(([id, m]) => `<tr><td>${esc(nomExercice(id))}</td><td>${m.kg ? `${esc(poidsTexte(m.kg))} ${unite()} × ${m.r ?? 0}` : `${m.r ?? 0}`}</td></tr>`).join('');
    const html = `<!doctype html><html lang="${langue}"><head><meta charset="utf-8"><title>${esc(x.titrePdf)}</title><style>body{font:14px/1.5 system-ui,sans-serif;margin:32px;color:#111}h1{font-size:22px;margin:0}p{margin:4px 0 18px;color:#555}.s{display:flex;gap:24px;margin:0 0 18px}.s b{display:block;font-size:20px}.s span{font-size:11px;letter-spacing:.4px;color:#555}table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:6px 4px;border-bottom:1px solid #ddd}</style></head><body>
<h1>Anatoly · ${esc(x.titrePdf)}</h1><p>${esc(fmt(plage.du))} · ${esc(fmt(plage.au))}</p>
<div class="s"><div><span>${x.seances}</span><b>${r.seances.length}</b></div><div><span>${x.series}</span><b>${r.series}</b></div><div><span>${x.volume}</span><b>${esc(v.val)} ${esc(v.unite)}</b></div></div>
${r.records.length ? `<p>${esc(x.records(r.records.length))}</p>` : ''}${r.de != null ? `<p>${esc(poidsTexte(r.de))} ${unite()} → ${esc(poidsTexte(r.a))} ${unite()}</p>` : ''}
<table><thead><tr><th>${esc(x.exercice)}</th><th>${esc(x.meilleure)}</th></tr></thead><tbody>${lignes}</tbody></table></body></html>`;
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;width:0;height:0;border:0;opacity:0';
    document.body.appendChild(f);
    f.contentDocument.open(); f.contentDocument.write(html); f.contentDocument.close();
    setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch { /* impression bloquée */ } setTimeout(() => f.remove(), 1500); }, 150);
  };
  return <Feuille ouverte={ouverte} fermer={fermer} titre={x.titre} sous={x.sous}>
    <div class="seg rgf-seg" role="radiogroup" aria-label={x.titre}>
      {[[30, x.j30], [90, x.j90], [365, x.a1], [0, x.autre]].map(([n, l]) => <button key={n} type="button" role="radio" aria-checked={prereglage === n} aria-pressed={prereglage === n}
        onClick={() => (n ? poserJours(n) : (setPrereglage(0), setChoix(true)))}>{l}</button>)}
    </div>
    <button type="button" class="rgf-plage" aria-label={x.choisir} onClick={() => { setPrereglage(0); setChoix(!choix); }}>
      <Ic n="calendar-blank" taille={16} /><strong>{fmt(plage.du)} · {fmt(plage.au)}</strong>
    </button>
    {choix && <div class="rgf-dates">
      <label>{x.du}<input type="date" class="form-input" value={jourLocal(plage.du)} max={jourLocal(plage.au)} onInput={(e) => e.target.value && setPlage({ ...plage, du: enDate(e.target.value) })} /></label>
      <label>{x.au}<input type="date" class="form-input" value={jourLocal(plage.au)} min={jourLocal(plage.du)} max={jourLocal(auj)} onInput={(e) => e.target.value && setPlage({ ...plage, au: enDate(e.target.value) })} /></label>
    </div>}
    {!r.seances.length && r.de == null ? <p class="rgf-vide">{x.vide}</p> : <>
      <div class="rgf-stats">
        <span><small>{x.seances}</small><strong>{r.seances.length}</strong></span>
        <span><small>{x.series}</small><strong>{r.series}</strong></span>
        <span><small>{x.volume}</small><strong>{v.val} {v.unite}</strong></span>
      </div>
      {r.records.length > 0 && <p class="rgf-ligne"><Ic n="trophy" taille={16} />{x.records(r.records.length)}</p>}
      {r.lifts.size > 0 && <p class="rgf-ligne"><Ic n="barbell" taille={16} />{x.exos(r.lifts.size)}</p>}
      {r.nbPesees > 1 && <p class="rgf-ligne"><Ic n="scales" taille={16} />{poidsTexte(r.de)} {unite()} → {poidsTexte(r.a)} {unite()}</p>}
      <button type="button" class="btn pri large rgf-pdf" onClick={pdf}>{x.pdf}</button>
      <button type="button" class="rgf-fantome rgf-large" onClick={csv}>{x.csv}</button>
    </>}
  </Feuille>;
}

// ===== Données de santé =====
export function FeuilleSante({ ouverte, fermer }) {
  const x = X().sante;
  return <Feuille ouverte={ouverte} fermer={fermer} titre={x.titre}
    pied={<button type="button" class="btn pri large" onClick={fermer}>{x.ok}</button>}>
    <p class="rgf-texte"><Ic n="footprints" taille={18} />{x.texte}</p>
  </Feuille>;
}
