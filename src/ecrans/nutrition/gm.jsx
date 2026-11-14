/* Briques visuelles de l'écran Nutrition (portage GymMane, GPLv3) : autocollant photo, assiette, dossier, flacon, anneau. */
import { useEffect, useRef, useState } from 'preact/hooks';
import { Ic } from '../../ui.jsx';
import './gm.css';

export const IMG = '/statique/nutrition/img/';

/* FoodSticker : photo détourée sur fond transparent, ombre douce, repli en pastille à fourchette. */
export function Photo({ src, nom = '', taille = 72, incline = true, ombre = true, estompee = false }) {
  const [casse, setCasse] = useState(false);
  useEffect(() => setCasse(false), [src]);
  let h = 0;
  for (const c of nom) h = (h * 31 + c.charCodeAt(0)) | 0;
  const angle = incline ? ((Math.abs(h) % 9) - 4) * 0.012 : 0;
  return <span class="gm-photo" style={`width:${taille}px;height:${taille}px;transform:rotate(${angle}rad)`}>
    {src && !casse
      ? <>
        {ombre && <i class="gm-photo-ombre" />}
        <img src={src} alt="" loading="lazy" draggable="false" style={estompee ? 'opacity:.45' : ''} onError={() => setCasse(true)} />
      </>
      : <span class="gm-photo-vide" style={`padding:${taille * 0.04}px`}><span><Ic n="fork-knife:fill" taille={Math.round(taille * 0.34)} /></span></span>}
  </span>;
}

/* FoodPlate : assiette ronde avec jusqu'à cinq autocollants. */
const MISES = [[], [[0, 0, 0.62]], [[-0.2, 0.04, 0.48], [0.2, -0.04, 0.48]], [[-0.2, 0.12, 0.42], [0.2, 0.12, 0.42], [0, -0.18, 0.42]],
  [[-0.19, -0.17, 0.38], [0.19, -0.17, 0.38], [-0.19, 0.19, 0.38], [0.19, 0.19, 0.38]],
  [[-0.22, -0.18, 0.34], [0.22, -0.18, 0.34], [-0.24, 0.2, 0.34], [0.24, 0.2, 0.34], [0, 0.01, 0.36]]];
export function Assiette({ items = [], taille = 150, vide = null }) {
  const vus = items.slice(0, 5);
  const mise = MISES[vus.length];
  return <span class="gm-assiette" style={`width:${taille}px;height:${taille}px;--s:${taille}px`}>
    <i class="gm-assiette-fond" />
    {vus.map((it, i) => {
      const [x, y, k] = mise[i];
      return <span key={i} class="gm-assiette-pos" style={`left:${taille / 2 + x * taille - k * taille / 2}px;top:${taille / 2 + y * taille - k * taille / 2}px`}>
        <Photo src={it.src} nom={it.nom} taille={k * taille} />
      </span>;
    })}
    {vus.length === 0 && vide}
  </span>;
}

/* Contour de dossier : tracé identique à _folderPath de GymMane. */
function tracerDossier(w, h, languetteGauche, tab = 12) {
  const r = 16, split = w * 0.48;
  let p;
  if (languetteGauche) {
    p = `M0 ${r} Q0 0 ${r} 0 L${split - 10} 0 C${split + 2} 0 ${split + 4} ${tab} ${split + 18} ${tab} L${w - r} ${tab} Q${w} ${tab} ${w} ${tab + r}`;
  } else {
    p = `M0 ${tab + r} Q0 ${tab} ${r} ${tab} L${w - split - 18} ${tab} C${w - split - 4} ${tab} ${w - split - 2} 0 ${w - split + 10} 0 L${w - r} 0 Q${w} 0 ${w} ${r}`;
  }
  return `${p} L${w} ${h - r - 2} Q${w} ${h} ${w - r - 2} ${h} L${r + 2} ${h} Q0 ${h} 0 ${h - r - 2} Z`;
}

let nDossier = 0;
export function Dossier({ titre, detail, peek, onClick }) {
  const ref = useRef(null);
  const [w, setW] = useState(169);
  const [id] = useState(() => `gmd${nDossier++}`);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    setW(el.getBoundingClientRect().width || 169);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width || 169));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const morceaux = String(detail).split('☆');
  return <button type="button" class="gm-dossier" ref={ref} onClick={onClick} aria-label={`${titre}, ${String(detail).replace('☆', '')}`}>
    <svg class="gm-dossier-dos" width={w} height="124" viewBox={`0 0 ${w} 124`} aria-hidden="true"><path d={tracerDossier(w, 124, false, 10)} /></svg>
    <span class="gm-dossier-peek">{peek}</span>
    <svg class="gm-dossier-face" width={w} height="90" viewBox={`0 0 ${w} 90`} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="gm-s1" /><stop offset="1" class="gm-s2" /></linearGradient>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="gm-b1" /><stop offset=".6" class="gm-b2" /></linearGradient>
      </defs>
      <path d={tracerDossier(w, 90, true)} fill={`url(#${id}f)`} />
      <path d={tracerDossier(w, 90, true)} fill="none" stroke={`url(#${id}b)`} stroke-width="1" />
    </svg>
    <span class="gm-dossier-texte">
      <strong>{titre}</strong>
      <small>{morceaux.map((m, i) => <>{i > 0 && <Ic n="star" taille={11} />}{m}</>)}</small>
    </span>
  </button>;
}

/* _StickerPeek : jusqu'à trois autocollants qui dépassent du dossier. */
const POINTS = [[-0.24, 12, -0.14, 42], [0.24, 10, 0.12, 42], [0, 4, 0, 48]];
export function Coup({ photos = [], vide = 'star:fill' }) {
  const ref = useRef(null);
  const [w, setW] = useState(149);
  useEffect(() => { if (ref.current) setW(ref.current.getBoundingClientRect().width || 149); }, []);
  return <span class="gm-coup" ref={ref}>
    {photos.length === 0
      ? <span class="gm-coup-vide"><Ic n={vide} taille={26} /></span>
      : photos.slice(0, 3).map((p, i) => {
        const [dx, top, rot, s] = POINTS[i];
        return <span key={i} class="gm-coup-pos" style={`left:${w / 2 + dx * w - s / 2}px;top:${top}px;transform:rotate(${rot}rad)`}>
          <Photo src={p.src} nom={p.nom} taille={s} incline={false} />
        </span>;
      })}
  </span>;
}

/* PhotoVessel : flacon photo, liquide découpé par le masque alpha, niveau animé. */
const FLACONS = {
  eau: { img: 'vessel-water', ratio: 202 / 640, haut: 0.269, bas: 0.989, couleur: '79,180,242' },
  shake: { img: 'vessel-shake', ratio: 241 / 640, haut: 0.407, bas: 0.975, couleur: '226,213,188', texture: 'shake-texture' },
};
export function Flacon({ type, niveau = 0, hauteur = 158, couleur }) {
  const f = FLACONS[type];
  const n = Math.max(0, Math.min(1, niveau));
  const surface = f.bas - (f.bas - f.haut) * n;
  const c = couleur ?? f.couleur;
  const masque = `url(${IMG}${f.img}-mask.webp)`;
  return <span class={`gm-flacon ${type}`} style={`width:${Math.round(hauteur * f.ratio)}px;height:${hauteur}px`} aria-hidden="true">
    <span class="gm-flacon-liquide" style={`-webkit-mask-image:${masque};mask-image:${masque}`}>
      <i style={`top:${surface * 100}%;--c:${c}${f.texture ? `;background-image:url(${IMG}${f.texture}.webp)` : ''}`} />
    </span>
    <img src={`${IMG}${f.img}.webp`} alt="" draggable="false" />
  </span>;
}

/* CalorieRing : anneau à dégradé conique, halo, bouts arrondis ; rouge au-delà de l'objectif. */
export function Anneau({ part = 0, taille = 148, trait = 12, couleur = 'var(--accent)', centre = null }) {
  const p = Math.max(0, Math.min(2, part));
  const premier = Math.min(1, p);
  const r = taille / 2 - trait / 2;
  const c = taille / 2;
  const ang = premier * 2 * Math.PI;
  const bout = { x: c + r * Math.sin(ang), y: c - r * Math.cos(ang) };
  const ring = `radial-gradient(farthest-side, transparent calc(100% - ${trait}px), #000 calc(100% - ${trait}px + 0.6px))`;
  const sweep = `conic-gradient(#000 0turn ${premier}turn, transparent ${premier}turn)`;
  return <div class="gm-anneau" style={`width:${taille}px;height:${taille}px;--col:${couleur}`}>
    <svg width={taille} height={taille} viewBox={`0 0 ${taille} ${taille}`} aria-hidden="true">
      <circle cx={c} cy={c} r={r} fill="none" stroke="var(--raised2)" stroke-width={trait} />
      {p > 0.002 && <circle class="gm-halo" cx={c} cy={c} r={r} fill="none" stroke-width={trait * 1.9} stroke-linecap="round"
        stroke-dasharray={`${r * ang} ${2 * Math.PI * r}`} transform={`rotate(-90 ${c} ${c})`} />}
      {p > 1 && <circle cx={c} cy={c} r={r} fill="none" stroke="var(--danger)" stroke-width={trait * 0.55} stroke-linecap="round"
        stroke-dasharray={`${r * 2 * Math.PI * (p - 1)} ${2 * Math.PI * r}`} transform={`rotate(-90 ${c} ${c})`} />}
    </svg>
    {p > 0.002 && <>
      <i class="gm-arc" style={`-webkit-mask-image:${ring},${sweep};mask-image:${ring},${sweep}`} />
      <i class="gm-bout gm-bout-a" style={`left:${c}px;top:${trait / 2}px;width:${trait}px;height:${trait}px`} />
      <i class="gm-bout gm-bout-b" style={`left:${bout.x}px;top:${bout.y}px;width:${trait}px;height:${trait}px`} />
    </>}
    {centre && <div class="gm-anneau-centre">{centre}</div>}
  </div>;
}

/* MacroTrack : piste de 7 px, remplissage en dégradé. */
export function Piste({ part = 0, couleur }) {
  return <span class="gm-piste"><i style={`width:${Math.max(0, Math.min(1, part)) * 100}%;--c:${couleur}`} /></span>;
}
