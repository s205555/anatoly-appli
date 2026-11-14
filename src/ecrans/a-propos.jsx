// À propos : portage 1:1 de about_screen.dart (en-tête, héros, promesses, contenu, phrase, crédits),
// puis les blocs propres à Anatoly (illustrations, mentions légales, contact).
import { etat } from '../donnees.js';
import { langue } from '../i18n.js';
import { EXERCICES } from '../exercices.js';
import { EnTete, Ic, Kicker } from '../ui.jsx';
import { textes } from '../i18n/m13.js';
import { m14fr, m14en } from '../i18n/m14.js';
import './m13.css';

const VERSION = '2.0.0';
const URL_ORIGINAL = 'https://github.com/InlitX/GymMane';
const URL_DEPOT = 'https://github.com/s205555/anatoly-appli';

const Ligne = ({ n, label, href }) => <a class="ligne-reglage" href={href}><span class="pastille-ic" aria-hidden="true"><Ic n={n} taille={17} /></span><span class="ligne-label">{label}</span><Ic n="caret-right" taille={15} classe="chevron" /></a>;

// _group : icône 19 px dans 22 px, titre 14,5 px, détail 12,5 px.
const Groupe = ({ lignes }) => <div class="ap-groupe">
  {lignes.map(([n, titre, detail]) => <div class="ap-ligne" key={titre}>
    <span class="ap-ic" aria-hidden="true"><Ic n={n} taille={19} /></span>
    <span><strong>{titre}</strong><small>{detail}</small></span>
  </div>)}
</div>;

export function APropos() {
  const x = textes[langue];
  const a = x.aPropos;
  const o = (langue === 'en' ? m14en : m14fr).onboarding;
  const fr = langue === 'fr';
  return <main class="ecran ap-ecran">
    <EnTete titre={a.titre} retour="#/reglages" />

    <section class="ap-hero">
      <span class="d1" aria-hidden="true" /><span class="d2" aria-hidden="true" />
      <img class="ap-coureur" src="/statique/app-img/runner.webp" alt="" aria-hidden="true" />
      <div class="ap-hero-texte">
        <h1>Anatoly</h1>
        <span class="m13-version">{a.version} {VERSION}</span>
      </div>
    </section>

    <Groupe lignes={[['gift', o.free, o.freeWhy], ['wifi-slash', o.offline, o.offlineWhy], ['export', o.yours, o.yoursWhy]]} />

    <div class="m13-section">
      <Kicker>{a.contenu}</Kicker>
      <Groupe lignes={[['barbell', a.exercices(EXERCICES.length), a.exercicesWhy], ['calculator', a.calculs, a.calculsWhy], ['chart-line-up', a.maths, a.mathsWhy]]} />
    </div>

    <p class="ap-phrase">{a.phrase}</p>

    <div class="ap-groupe">
      <a class="ap-credit" href={URL_ORIGINAL} target="_blank" rel="noopener">
        <span class="ap-ic accent" aria-hidden="true"><Ic n="heart:fill" taille={19} /></span>
        <span><small>{a.licence}</small><strong>{a.baseGymnane}</strong></span>
        <Ic n="arrow-up-right" taille={15} classe="ap-fleche" />
      </a>
      <a class="ap-credit" href={URL_DEPOT} target="_blank" rel="noopener">
        <span class="ap-ic" aria-hidden="true"><Ic n="github-logo" taille={19} /></span>
        <span><small>{a.licenceCode}</small><strong>s205555/anatoly-appli</strong></span>
        <Ic n="arrow-up-right" taille={15} classe="ap-fleche" />
      </a>
    </div>

    <div class="m13-section">
      <Kicker>{a.illustrations}</Kicker>
      <div class="carte" style="display:grid;gap:8px">
        <p class="texte-carte">{a.creditsIllustrations}</p>
        <a class="m13-lien-externe petit-texte" href="/statique/exercices/LICENCE.md">{a.licenceIllustrations}</a>
      </div>
    </div>

    <div class="m13-section">
      <Kicker>{a.legal}</Kicker>
      <div class="groupe">
        <Ligne n="squares-four" label={a.mentions} href={fr ? '/mentions-legales/' : '/en/legal-notice/'} />
        <Ligne n="notebook" label={a.cgv} href={fr ? '/cgv/' : '/en/terms/'} />
        <Ligne n="shield-check" label={a.confidentialite} href={fr ? '/confidentialite/' : '/en/privacy/'} />
        <Ligne n="envelope" label={a.contact} href="mailto:contact@anatoly.fr" />
        {etat.value?.profil?.role === 'admin' && <Ligne n="squares-four" label={fr ? 'Administration' : 'Admin'} href="/admin/" />}
      </div>
    </div>
  </main>;
}
