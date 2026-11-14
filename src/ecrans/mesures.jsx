// Mensurations : dix mesures, dernière valeur, écart, rappel, saisie par règle graduée.
import { useEffect, useRef, useState } from 'preact/hooks';
import { afficher, api, charger, dateComplete, etat, nombre } from '../donnees.js';
import { langue, t, dp } from '../i18n.js';
import { CLES_MESURE, LABELS_MESURE, m08 } from '../i18n/m08.js';
import { Dialogue, EnTete, Feuille, Ic, Kicker, Nombre, Regle } from '../ui.jsx';
import { ecrire, idJour, joursEntre, lire, Segment, signale } from './photos.jsx';
import './m08.css';

const T = () => m08(langue);

// Bornes de la règle en cm (masse grasse en %), valeur de départ : celles de GymMane.
const PLAGES = {
  cou: [15, 80, 38], epaules: [25, 200, 115], poitrine: [40, 200, 100], bras: [10, 80, 34], avant_bras: [10, 60, 28],
  taille: [30, 200, 84], hanches: [40, 200, 98], cuisse: [20, 120, 56], mollet: [15, 80, 38], masse_grasse: [3, 60, 20],
};
const PAS = 0.5;
const MAJEUR = 10;
const CLE_RAPPEL = 'an_m08_rappel';
const RAPPELS = [0, 7, 14, 30];

const arrondi = (n) => Math.round(n * 10) / 10;
const libelle = (cle) => LABELS_MESURE[cle]?.[langue === 'en' ? 'en' : 'fr'] ?? cle;
const uniteDe = (cle) => (cle === 'masse_grasse' ? '%' : 'cm');
const valeurAffichee = (cle, v) => (cle === 'masse_grasse' ? arrondi(v) : arrondi(v));

export function Mesures() {
  const txt = T().mesures;
  const mesures = etat.value.mesures ?? [];
  const [rappel, setRappel] = useState(() => lire(CLE_RAPPEL, { jours: 7 }).jours ?? 7);
  const [ouverte, setOuverte] = useState(null);

  useEffect(() => { ecrire(CLE_RAPPEL, { jours: rappel }); }, [rappel]);

  const parCle = (cle) => mesures.filter((m) => m.cle === cle).sort((a, b) => (a.prise_le < b.prise_le ? 1 : a.prise_le > b.prise_le ? -1 : b.id - a.id));
  const derniere = mesures[0];
  const prochaine = rappel > 0 && derniere ? joursEntre(idJour(new Date(derniere.prise_le)), idJour()) : null;
  const reste = prochaine === null ? null : rappel - prochaine;
  const due = reste !== null && reste <= 0;

  return <main class="ecran m08 m08-mesures">
    <EnTete titre={txt.titre} sous={txt.sous(mesures.length)} />
    <p class="m08-aide">{txt.aide}</p>

    <Rappel rappel={rappel} setRappel={setRappel} reste={reste} due={due} />

    <div class="m08-liste-mesures">
      {CLES_MESURE.map((cle) => {
        const serie = parCle(cle);
        const der = serie[0];
        const ecart = serie.length > 1 ? arrondi(valeurAffichee(cle, der.valeur) - valeurAffichee(cle, serie[1].valeur)) : null;
        const u = uniteDe(cle);
        return <button type="button" key={cle} class="m08-carte-mesure" onClick={() => setOuverte(cle)}
          aria-label={`${libelle(cle)}, ${der ? `${nombre(valeurAffichee(cle, der.valeur), 1)} ${u}` : txt.nonRenseigne}`}>
          <span class="m08-carte-texte">
            <span class="m08-carte-titre">{libelle(cle)}</span>
            {der
              ? <span class="m08-carte-valeur">
                <strong>{nombre(valeurAffichee(cle, der.valeur), 1)}</strong><small>{u}</small>
                {ecart !== null && ecart !== 0 && <em class={ecart > 0 ? 'haut' : 'bas'}>{`${ecart > 0 ? '+' : ''}${nombre(ecart, 1)}`}</em>}
              </span>
              : <span class="m08-carte-vide">{txt.nonRenseigne}</span>}
          </span>
          {serie.length > 1
            ? <Etincelle points={[...serie].reverse().map((m) => valeurAffichee(cle, m.valeur))} label={`${libelle(cle)}${dp()}${txt.ecart}`} />
            : <Ic n="plus-circle" taille={20} classe="m08-carte-plus" />}
        </button>;
      })}
    </div>

    {ouverte && <FeuilleMesure cle={ouverte} serie={parCle(ouverte)} fermer={() => setOuverte(null)} />}
  </main>;
}

// Rappel de mesure (measures_screen.dart _MeasureReminder) : Jamais, 7, 14, 30 ou une valeur saisie.
function Rappel({ rappel, setRappel, reste, due }) {
  const txt = T().mesures;
  const [saisie, setSaisie] = useState(null);
  const perso = rappel > 0 && !RAPPELS.includes(rappel);
  const valider = () => {
    const n = Math.round(Number(saisie));
    if (Number.isFinite(n) && n >= 1) setRappel(Math.min(365, n));
    setSaisie(null);
  };
  return <section class="m08-intervalle">
    <div class="m08-rappel-tete">
      <Kicker>{`${txt.rappel} · ${T().chronologie.jours}`.toUpperCase()}</Kicker>
      {reste !== null && <span class={due ? 'm08-due' : 'm08-reste'}>{due ? txt.due : txt.prochaine(reste)}</span>}
    </div>
    <div class="m08-segments" role="radiogroup" aria-label={txt.rappel}>
      {RAPPELS.map((j) => <Segment key={j} actif={rappel === j} onClick={() => setRappel(j)}>{j === 0 ? txt.jamais : j}</Segment>)}
      <Segment actif={perso} label={T().chronologie.personnalise} onClick={() => setSaisie(rappel > 0 ? rappel : 21)}>{perso ? rappel : T().chronologie.personnalise}</Segment>
    </div>
    <Dialogue ouvert={saisie !== null} fermer={() => setSaisie(null)} titre={txt.rappel} texte={T().chronologie.nbJours} libelle={t.commun.valider} confirmer={valider}>
      <Nombre valeur={saisie} onChange={setSaisie} label={T().chronologie.nbJours} decimales={false} classe="m08-saisie-jours" />
    </Dialogue>
  </section>;
}

// Feuille de saisie : la valeur vit ici, le pied peut donc l'enregistrer.
function FeuilleMesure({ cle, serie, fermer }) {
  const txt = T().mesures;
  const [min, max, depart] = PLAGES[cle] ?? [0, 200, 50];
  const u = uniteDe(cle);
  const der = serie[0];
  const [valeur, setValeur] = useState(() => (der ? arrondi(der.valeur) : depart));
  const [occupe, setOccupe] = useState(false);

  const enregistrer = async () => {
    if (!valeur || valeur <= 0) return;
    setOccupe(true);
    try {
      await api('POST', '/api/mesures', { cle, valeur: arrondi(valeur), prise_le: `${idJour()}T12:00:00` });
      await charger();
      afficher(txt.enregistree);
      fermer();
    } catch {
      afficher(txt.invalide, 'danger');
    } finally {
      setOccupe(false);
    }
  };

  return <Feuille ouverte fermer={fermer} titre={libelle(cle)}
    pied={<button type="button" class="btn pri large" disabled={occupe} onClick={enregistrer}>{txt.enregistrer}</button>}>
    <div class="m08-lecture" aria-live="polite">
      <strong>{nombre(valeur, 1)}</strong><small>{u}</small>
    </div>
    <Regle valeur={valeur} min={min} max={max} pas={PAS} majeur={MAJEUR} onChange={setValeur} label={txt.vue} />
    {serie.length > 0 && <section class="m08-historique">
      <Kicker>{txt.historique}</Kicker>
      <ul class="m08-historique-liste">
        {serie.slice(0, 6).map((m) => <li key={m.id}>
          <span>{dateComplete(m.prise_le)}</span>
          <strong>{nombre(arrondi(m.valeur), 1)} {u}</strong>
          <button type="button" class="m08-suppr" aria-label={txt.supprimer(dateComplete(m.prise_le))}
            onClick={async () => {
              try {
                await api('DELETE', `/api/mesures/${m.id}`);
                await charger();
                afficher(txt.supprimee);
              } catch (e) {
                signale(e);
              }
            }}><Ic n="x" taille={12} /></button>
        </li>)}
      </ul>
    </section>}
  </Feuille>;
}

function Etincelle({ points, label }) {
  if (points.length < 2) return null;
  const w = 108;
  const h = 38;
  const p = 3;
  const lo = Math.min(...points);
  const hi = Math.max(...points);
  const et = hi - lo || 1;
  const x = (i) => p + (i / (points.length - 1)) * (w - 2 * p);
  const y = (v) => h - p - ((v - lo) / et) * (h - 2 * p);
  const d = points.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return <svg class="m08-etincelle" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} width={w} height={h}>
    <path d={d} fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
  </svg>;
}
