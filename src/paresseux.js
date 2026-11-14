// Composant chargé à la demande (morceau JS séparé). Rien ne s'affiche le temps du chargement.
import { h } from 'preact';
import { useEffect, useState } from 'preact/hooks';

const CLE_RECHARGE = 'an_recharge_morceau';

export function paresseux(charge, nom) {
  let comp, prom;
  const lot = () => (prom ??= charge().then((m) => { comp = m[nom]; try { sessionStorage.removeItem(CLE_RECHARGE); } catch { /* rien */ } }).catch((e) => {
    prom = undefined;
    // Morceau introuvable : la page date d'une version précédente. Un seul rechargement pour prendre la nouvelle.
    try {
      if (!sessionStorage.getItem(CLE_RECHARGE)) { sessionStorage.setItem(CLE_RECHARGE, '1'); location.reload(); }
    } catch { /* stockage indisponible */ }
    throw e;
  }));
  return (props) => {
    const [, tic] = useState(0);
    // Toujours s'abonner : le morceau peut finir de charger entre l'affichage et cet effet.
    useEffect(() => { let vivant = true; lot().then(() => { if (vivant) tic((x) => x + 1); }, () => {}); return () => { vivant = false; }; }, []);
    return comp ? h(comp, props) : null;
  };
}
