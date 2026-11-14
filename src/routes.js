// Manifeste des écrans de l'application : une ligne par route. nav:false masque la barre flottante.
import { Accueil } from './ecrans/accueil.jsx';
import { Bilan } from './ecrans/bilan.jsx';
import { Exercice } from './ecrans/exercice.jsx';
import { Exercices } from './ecrans/exercices.jsx';
import { Historique, SeanceDetail } from './ecrans/historique.jsx';
import { Programme, Programmes } from './ecrans/programmes.jsx';
import { Progres } from './ecrans/progres.jsx';
import { Reglages } from './ecrans/reglages.jsx';
import { Seance } from './ecrans/seance.jsx';
import { Entrain } from './ecrans/entrain.jsx';
import { EcranCalculatrices } from './calculatrices.js';
import { Plans } from './ecrans/nutrition/plans.jsx';
import { Prep } from './ecrans/nutrition/prep.jsx';

export const ROUTES = [
  { chemin: '/', Composant: Accueil },
  { chemin: '/progres', Composant: Progres },
  { chemin: '/historique', Composant: Historique, nav: false },
  { chemin: '/historique/:id', Composant: SeanceDetail, nav: false },
  { chemin: '/exercices', Composant: Exercices },
  { chemin: '/exercice/:id', Composant: Exercice, nav: false },
  { chemin: '/programmes', Composant: Programmes, nav: false },
  { chemin: '/programme/:id', Composant: Programme, nav: false },
  { chemin: '/reglages', Composant: Reglages },
  { chemin: '/profil', Composant: Reglages },
  { chemin: '/seance', Composant: Seance, nav: false },
  { chemin: '/bilan/:cle', Composant: Bilan, nav: false },
  { chemin: '/entrain', Composant: Entrain, nav: false },
  { chemin: '/entrainer', Composant: Entrain, nav: false },
  { chemin: '/calculatrices', Composant: EcranCalculatrices, nav: false },
  { chemin: '/nutrition-plans', Composant: Plans, nav: false },
  { chemin: '/nutrition-prep', Composant: Prep, nav: false },
];
