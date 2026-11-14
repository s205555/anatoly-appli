// Aperçus en collage des réglages (settings_showcase.dart : LookShowcase, AlertsShowcase, HomeExtrasShowcase).
export const vitrines = {
  fr: {
    marque: 'Anatoly', aujourdhui: 'Aujourd’hui', reposFini: 'Repos terminé', reposFiniTexte: 'C’est reparti, la prochaine série vous attend.',
    developpe: 'Développé couché à la barre', serie: (n, total) => `Série ${n} sur ${total}`, enCours: 'Séance en cours',
    serieFaite: 'Série faite', passerRepos: 'Passer le repos', programmeAttend: 'Votre programme vous attend.', repos: 'Repos',
    photoTitre: 'C’est l’heure de votre photo de progression', photoTexte: (n) => `${n} jours depuis la dernière. Même pose, même lumière.`,
    creatine: 'Créatine', mesure: 'C’est l’heure de vous mesurer',
    pas: 'Pas', fcRepos: 'Fréquence cardiaque au repos', bpm: 'bpm', serieJours: 'Série', heures: 'h',
    calendrier: 'Calendrier d’activité', theme: 'Thème', clair: 'Clair', sombre: 'Sombre',
  },
  en: {
    marque: 'Anatoly', aujourdhui: 'Today', reposFini: 'Rest over', reposFiniTexte: 'Back to it, next set is waiting.',
    developpe: 'Barbell Bench Press', serie: (n, total) => `Set ${n} of ${total}`, enCours: 'Ongoing workout',
    serieFaite: 'Set done', passerRepos: 'Skip rest', programmeAttend: 'Your program is waiting.', repos: 'Resting',
    photoTitre: 'Time for your progress photo', photoTexte: (n) => `${n} days since the last one. Same pose, same light.`,
    creatine: 'Creatine', mesure: 'Time to measure',
    pas: 'Steps', fcRepos: 'Resting heart rate', bpm: 'bpm', serieJours: 'Streak', heures: 'h',
    calendrier: 'Activity calendar', theme: 'Theme', clair: 'Light', sombre: 'Dark',
  },
};
