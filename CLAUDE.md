# Backgammon — consignes pour Claude

Jeu de Thomas, publié à deux endroits à partir des mêmes sources (`src/`) :
- version publique : `index.html` à la racine, servie par GitHub Pages (https://lebackgammondepapa.github.io/)
- version Claude : artifact https://claude.ai/artifact/NBjETXSs8XWkMJmXhwCmmK (capacités db, user, room), construite dans `src/out/backgammon.html`

Après toute modification : `python3 src/build.py`, republier l'artifact avec `src/out/backgammon.html`, puis commit et push de `index.html` + `sw.js` + `src/` (et `fonts/` si les polices changent) sur `main`.
La version publique marche hors connexion (service worker `src/sw.js`, polices dans `fonts/`) et la partie locale est gardée en mémoire à chaque coup : ne pas casser ces deux points (tests `src/tests/resume_test.js` et `src/tests/offline_test.js`).
Détails techniques et tests : `src/NOTES.md`. Plateau unique choisi par Thomas : fond et cadre en noyer (fond un peu plus clair que le cadre), charnières laiton, flèches ivoire / bleu acier, casiers en feutre marine, pions ivoire / ébène gravés, interface bleu nuit. Il a rejeté le choix entre plusieurs plateaux et l'ancien plateau bleu nacré. Thomas déteste les rendus « jeu vidéo » : viser le réalisme d'un vrai plateau. Sons doux, paysage plein écran sur téléphone, lancer de dés automatique. Fluidité : plateau fixe dans un SVG à part (#boardBg) sous le SVG animé (#board), aucune ombre en filtre SVG sur les pions ou les dés (mesurer avec src/tests/perf2.js).
