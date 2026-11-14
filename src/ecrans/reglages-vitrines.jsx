// Aperçus en collage en bas des pages de réglages (settings_showcase.dart) : tuiles posées sur trois colonnes,
// le tout tourné de -0,16 rad, réduit à 0,66 et décalé de (22, -8) dans un cadre de 380 px aux coins de 28.
import { langue } from '../i18n.js';
import { vitrines } from '../i18n/vitrines.js';
import { Ic } from '../ui.jsx';
import { IcMedaille } from '../distinctions.js';
import { CartePass } from './profil.jsx';

const lettre = (j) => new Intl.DateTimeFormat(langue, { weekday: 'narrow' }).format(new Date(2024, 0, j)).toUpperCase(); // 1 = lundi
const SEMAINE = [1, 2, 3, 4, 5, 6, 7];

function Collage({ colonnes }) {
  return <div class="rv-cadre" aria-hidden="true">
    <div class="rv-plan">{colonnes.map(([haut, tuiles], i) => <div key={i} class="rv-col" style={{ paddingTop: `${haut}px` }}>{tuiles}</div>)}</div>
  </div>;
}

const Tuile = ({ w = 150, h, pad = 16, classe = '', children }) => <div class={`rv-tuile ${classe}`} style={{ width: `${w}px`, height: h ? `${h}px` : undefined, padding: `${pad}px` }}>{children}</div>;
const Kicker = ({ children }) => <span class="rv-kicker">{children}</span>;
const Grand = ({ children, taille = 30, couleur }) => <span class="rv-grand" style={{ fontSize: `${taille}px`, color: couleur }}>{children}</span>;
const TuileIcone = ({ n, valeur, label, ton, h = 120 }) => <Tuile h={h}>
  <div class="rv-pile"><span style={{ color: ton }}><Ic n={n} taille={24} /></span><span class="rv-ressort" />{valeur && <Grand taille={24}>{valeur}</Grand>}{label && <Kicker>{label}</Kicker>}</div>
</Tuile>;
const Anneau = ({ part, couleur, taille = 112, children }) => {
  const r = (taille - 9) / 2, c = 2 * Math.PI * r;
  return <div class="rv-anneau" style={{ width: `${taille}px`, height: `${taille}px` }}>
    <svg viewBox={`0 0 ${taille} ${taille}`}><circle cx={taille / 2} cy={taille / 2} r={r} fill="none" stroke="var(--raised)" stroke-width="9" />
      <circle cx={taille / 2} cy={taille / 2} r={r} fill="none" stroke={couleur} stroke-width="9" stroke-linecap="round" stroke-dasharray={`${c * part} ${c}`} transform={`rotate(-90 ${taille / 2} ${taille / 2})`} /></svg>
    <div class="rv-anneau-in">{children}</div>
  </div>;
};

function Note({ n, ton, titre, texte, quand = '', extra = null }) {
  const V = vitrines[langue];
  return <div class="rv-tuile rv-note">
    <div class="rv-note-tete"><span class="rv-note-ic" style={{ color: ton, background: `color-mix(in srgb, ${ton} 18%, transparent)` }}><Ic n={n} taille={12} /></span>
      <strong>{V.marque}</strong>{quand && <span>{` · ${quand}`}</span>}</div>
    <p class="rv-note-titre">{titre}</p>
    <p class="rv-note-texte">{texte}</p>
    {extra}
  </div>;
}

// AlertsShowcase : page « Rappels et alarme ».
export function VitrineAlertes() {
  const V = vitrines[langue];
  const colonne1 = [
    <Tuile h={170}><div class="rv-pile"><span style={{ color: 'var(--sage)' }}><Ic n="bell-ringing" taille={44} /></span><span class="rv-ressort" /><Grand>18:30</Grand><span style={{ height: '4px' }} /><Kicker>{`${lettre(1)} · ${lettre(3)} · ${lettre(5)}`}</Kicker></div></Tuile>,
    <Tuile h={130}><div class="rv-pile"><Ic n="speaker-high" taille={30} /><span class="rv-ressort" />
      <div class="rv-barres">{[0.3, 0.6, 1.0, 0.7, 0.45, 0.85, 0.5, 0.3, 0.65, 0.4].map((v, i) => <i key={i} style={{ height: `${36 * v}px`, background: i < 6 ? 'var(--accent)' : 'var(--raised)' }} />)}</div></div></Tuile>,
    <Tuile h={110} classe="rv-centre"><span style={{ color: 'var(--text2)' }}><Ic n="vibrate" taille={48} /></span></Tuile>,
    <TuileIcone n="bell-slash" valeur="22:00" ton="var(--text2)" />,
    <TuileIcone n="alarm" valeur="7:00" ton="var(--accent)" />,
  ];
  const colonne2 = [
    <Note n="timer:fill" ton="var(--accent)" titre={V.reposFini} texte={V.reposFiniTexte} quand={V.aujourdhui} />,
    <Note n="barbell:fill" ton="var(--accent)" titre={V.developpe} texte={`${V.serie(3, 4)} · 80 kg × 8`} quand={V.enCours}
      extra={<div class="rv-pilules"><span class="fort">{V.serieFaite}</span><span>{V.passerRepos}</span></div>} />,
    <div class="rv-ilot"><span class="rv-ilot-ic"><Ic n="check-circle:fill" taille={22} /></span><strong>{V.programmeAttend}</strong></div>,
    <Note n="camera:fill" ton="var(--info)" titre={V.photoTitre} texte={V.photoTexte(14)} quand="9:00" />,
    <Tuile w={330} h={100}><div class="rv-ligne rv-autour">{[['speaker-slash', false], ['vibrate', true], ['speaker-high', false]].map(([n, on]) => <span key={n} class={`rv-mode ${on ? 'on' : ''}`}><Ic n={n} taille={24} /></span>)}</div></Tuile>,
    <Tuile w={330} h={104}><div class="rv-ligne"><span style={{ color: 'var(--sage)' }}><Ic n="bell-simple-ringing" taille={26} /></span>
      <div class="rv-jours">{SEMAINE.map((d) => <span key={d} class={[1, 3, 5].includes(d) ? 'on' : ''}>{lettre(d)}</span>)}</div></div></Tuile>,
  ];
  const colonne3 = [
    <Tuile h={190} classe="rv-centre"><Anneau part={0.62} couleur="var(--accent)"><Grand taille={28}>1:24</Grand><span class="rv-sous" style={{ color: 'var(--accent)' }}>{V.repos}</span></Anneau></Tuile>,
    <Tuile h={140}><div class="rv-pile"><div class="rv-ligne"><span style={{ color: 'var(--brass)' }}><Ic n="pill" taille={26} /></span><span class="rv-ressort" /><span class="rv-heure">10:00</span></div>
      <span class="rv-ressort" /><strong class="rv-nom">{V.creatine}</strong><span class="rv-dose">5 g</span></div></Tuile>,
    <Tuile h={110}><div class="rv-ligne rv-plein"><span style={{ color: 'var(--sage)' }}><Ic n="hourglass-medium" taille={30} /></span><span style={{ width: '10px' }} /><Grand taille={26}>16 h</Grand></div></Tuile>,
    <TuileIcone n="ruler" valeur="14" label={V.mesure} ton="var(--warn)" />,
    <TuileIcone n="drop" valeur={langue === 'fr' ? '1,5 L' : '1.5 L'} ton="var(--info)" />,
  ];
  return <Collage colonnes={[[20, colonne1], [0, colonne2], [40, colonne3]]} />;
}

// HomeExtrasShowcase : page « Accueil ».
export function VitrineAccueil({ nomMembre }) {
  const V = vitrines[langue];
  const pass = { id: 'demo', nom: 'Anatoly Fit', code: 'ANATOLY-2026-0042', format: 'code128', teinte: 0, membre: '' };
  const pouls = [64, 62, 63, 60, 61, 59, 60, 57, 58, 56, 58];
  // _Pulse : marges 16 / 24 / 8 / 14, courbe lissée, aire en dégradé, point final cerclé.
  const W = 330, H = 96, lo = Math.min(...pouls) - 2, hi = Math.max(...pouls) + 2, w = W - 40, h = H - 22;
  const pt = (i) => [16 + (w * i) / (pouls.length - 1), 8 + h * (1 - (pouls[i] - lo) / (hi - lo))];
  let d = `M${pt(0).join(' ')}`;
  for (let i = 1; i < pouls.length; i += 1) { const [px, py] = pt(i - 1), [qx, qy] = pt(i), mx = (px + qx) / 2; d += ` C${mx} ${py} ${mx} ${qy} ${qx} ${qy}`; }
  const [fx, fy] = pt(pouls.length - 1);
  const colonne1 = [
    <Tuile h={170} classe="rv-centre"><Anneau part={0.78} couleur="var(--sage)"><span style={{ color: 'var(--sage)' }}><Ic n="footprints" taille={18} /></span><Grand taille={22}>{langue === 'fr' ? '6 240' : '6,240'}</Grand><span class="rv-sous">{V.pas}</span></Anneau></Tuile>,
    <Tuile h={130}><div class="rv-pile"><div class="rv-ligne"><span style={{ color: 'var(--accent)' }}><Ic n="medal" taille={22} /></span><span class="rv-ressort" /><Grand>7</Grand></div><span class="rv-ressort" />
      <div class="rv-niveau"><i style={{ width: '64%' }} /></div></div></Tuile>,
    <Tuile h={150} classe="rv-centre rv-medaille"><IcMedaille id="firstWorkout" /></Tuile>,
    <TuileIcone n="fire" valeur="520" label="kcal" ton="var(--accent)" />,
    <TuileIcone n="scales" valeur={langue === 'fr' ? '78,4' : '78.4'} label="kg" ton="var(--text2)" />,
  ];
  const colonne2 = [
    <div class="rv-pass"><CartePass pass={pass} nomMembre={nomMembre} /></div>,
    <Tuile w={330} h={130} pad={0} classe="rv-pouls">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ top: '34px' }}>
        <defs><linearGradient id="rv-aire" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".32" /><stop offset="1" stop-color="var(--accent)" stop-opacity="0" /></linearGradient></defs>
        {[0, 1, 2].map((k) => <line key={k} x1="16" x2={W - 24} y1={8 + (h * k) / 2} y2={8 + (h * k) / 2} stroke="color-mix(in srgb, var(--text) 6%, transparent)" />)}
        <path d={`${d} L${fx} ${H} L${pt(0)[0]} ${H} Z`} fill="url(#rv-aire)" />
        <path d={d} fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round" />
        <circle cx={fx} cy={fy} r="9" fill="color-mix(in srgb, var(--accent) 22%, transparent)" /><circle cx={fx} cy={fy} r="5.5" fill="var(--accent)" /><circle cx={fx} cy={fy} r="2.5" fill="var(--raised2)" />
      </svg>
      <div class="rv-ligne rv-pouls-tete"><span style={{ color: 'var(--accent)' }}><Ic n="heart:fill" taille={16} /></span><span style={{ width: '6px' }} /><span class="rv-ressort-h"><Kicker>{V.fcRepos}</Kicker></span>
        <Grand taille={26}>56</Grand><span class="rv-bpm">{V.bpm}</span></div>
    </Tuile>,
    <Tuile w={330} h={96}><div class="rv-ligne rv-entre">{SEMAINE.map((j) => <span key={j} class="rv-jour"><small>{lettre(j)}</small><i class={[1, 3, 4, 6].includes(j) ? 'on' : ''}>{[1, 3, 4, 6].includes(j) && <Ic n="check:bold" taille={14} />}</i></span>)}</div></Tuile>,
    <Tuile w={330} h={120} classe="rv-medailles"><div class="rv-ligne rv-autour">{[['firstRoutine', false], ['firstRecord', false], ['streak3', false], ['streak7', true]].map(([id, v]) => <span key={id}><IcMedaille id={id} verrou={v} /></span>)}</div></Tuile>,
    <Tuile w={330} h={120}><div class="rv-histo">{[0.45, 0.8, 0.3, 1.0, 0.0, 0.65, 0.0].map((v, i) => <span key={i}><i style={{ height: `${8 + 62 * v}px`, background: v === 0 ? 'var(--raised)' : i === 3 ? 'var(--accent)' : 'color-mix(in srgb, var(--text) 55%, transparent)' }} /><small>{lettre(i + 1)}</small></span>)}</div></Tuile>,
  ];
  const colonne3 = [
    <Tuile h={130}><div class="rv-pile"><span style={{ color: 'var(--accent)' }}><Ic n="flame:fill" taille={24} /></span><span class="rv-ressort" /><Grand>12</Grand><Kicker>{V.serieJours}</Kicker></div></Tuile>,
    <Tuile h={130}><div class="rv-pile"><span style={{ color: 'var(--warn)' }}><Ic n="moon-stars" taille={24} /></span><span class="rv-ressort" /><Grand>7:42</Grand><Kicker>{V.heures}</Kicker></div></Tuile>,
    <Tuile h={150} classe="rv-centre rv-medaille"><IcMedaille id="workouts10" verrou /></Tuile>,
    <TuileIcone n="path" valeur={langue === 'fr' ? '4,2' : '4.2'} label="km" ton="var(--sage)" />,
    <TuileIcone n="trophy" valeur="3" ton="var(--brass)" />,
  ];
  return <Collage colonnes={[[20, colonne1], [0, colonne2], [40, colonne3]]} />;
}

// LookShowcase : page « Général ».
const NIVEAUX = Array.from({ length: 7 * 16 }, (_, i) => [0, 2, 0, 3, 1, 4, 0, 0, 2, 3, 0, 1, 4, 2][(i * 5 + Math.floor(i / 7)) % 14]);
const THEMES = [['#0A0A0A', '#1C1C1C', '#D9A184'], ['#000000', '#111111', '#D9A184'], ['#F7F4F0', '#FFFFFF', '#9E4E27']];

export function VitrineApparence() {
  const V = vitrines[langue];
  const auj = new Date();
  const premier = new Date(auj.getFullYear(), auj.getMonth(), auj.getDate() - ((auj.getDay() + 6) % 7) - 7 * 15);
  const mois = Array.from({ length: 16 }, (_, s) => { const d = new Date(premier); d.setDate(d.getDate() + s * 7); return d; });
  const nomMois = (d) => new Intl.DateTimeFormat(langue, { month: 'short' }).format(d).replace('.', '');
  const colonne1 = [
    <Tuile h={130}><div class="rv-pile"><div class="rv-ligne rv-entre">{THEMES.map(([bg, haut, acc]) => <span key={bg} class="rv-nuancier" style={{ background: bg }}><i style={{ background: haut }} /><b style={{ background: acc }} /></span>)}</div><span class="rv-ressort" /><Kicker>{V.theme}</Kicker></div></Tuile>,
    <Tuile h={110} classe="rv-centre"><span class="rv-unites"><b>kg</b><span>lb</span></span></Tuile>,
    <Tuile h={130}><div class="rv-ligne rv-autour rv-bas">{[[17, 'var(--text3)'], [26, 'var(--text2)'], [37, 'var(--text)']].map(([t, c]) => <span key={t} class="rv-aa" style={{ fontSize: `${t}px`, color: c }}>Aa</span>)}</div></Tuile>,
    <TuileIcone n="translate" valeur="A文" ton="var(--accent)" />,
    <TuileIcone n="clock" valeur="18:30" label="24 h" ton="var(--text2)" />,
  ];
  const colonne2 = [
    <div class="rv-tuile rv-chaleur" style={{ width: '330px' }}>
      <div class="rv-chaleur-mois">{mois.map((d, s) => <span key={s}>{d.getDate() <= 7 ? nomMois(d) : ''}</span>)}</div>
      <div class="rv-chaleur-grille">{mois.map((_, s) => <div key={s}>{[0, 1, 2, 3, 4, 5, 6].map((j) => { const n = NIVEAUX[s * 7 + j]; return <i key={j} style={{ background: n ? `color-mix(in srgb, var(--accent) ${25 + n * 18}%, transparent)` : 'var(--heat-empty)' }} />; })}</div>)}</div>
    </div>,
    <Tuile w={330} h={104}><div class="rv-langues">{['Hola', 'Hello', 'Bonjour', 'Hallo', 'Ciao', 'Olá', 'Привет', '你好', 'مرحبا'].map((m) => <span key={m} class={m === 'Hola' ? 'on' : ''}>{m}</span>)}</div></Tuile>,
    <Tuile w={330} h={84}><div class="rv-ligne rv-entre rv-plein">{SEMAINE.map((j) => <span key={j} class={`rv-debut ${j === 1 ? 'on' : ''}`}>{lettre(j)}</span>)}</div></Tuile>,
    <Tuile w={330} h={110}><div class="rv-ligne rv-plein"><span style={{ color: 'var(--text2)' }}><Ic n="calendar-dots" taille={26} /></span><span style={{ width: '14px' }} /><Grand taille={28}>12</Grand><span style={{ width: '6px' }} /><span class="rv-ressort-h"><Kicker>{V.calendrier}</Kicker></span></div></Tuile>,
    <Tuile w={330} h={120}><div class="rv-fonds"><span class="rv-points" /><span /><span class="rv-photo"><Ic n="image" taille={22} /></span></div></Tuile>,
  ];
  const colonne3 = [
    <Tuile h={150} pad={0} classe="rv-points rv-points-tuile" />,
    <Tuile h={130} pad={0} classe="rv-flou"><i class="a" /><i class="b" /><span /></Tuile>,
    <Tuile h={110} classe="rv-centre"><span style={{ color: 'var(--text2)' }}><Ic n="wave-sine" taille={48} /></span></Tuile>,
    <TuileIcone n="sun-horizon" label={V.clair} ton="var(--warn)" />,
    <TuileIcone n="moon" label={V.sombre} ton="var(--text2)" />,
  ];
  return <Collage colonnes={[[20, colonne1], [0, colonne2], [40, colonne3]]} />;
}
