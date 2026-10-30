# Backgammon — consignes pour Claude

Jeu de Thomas, publié à deux endroits à partir des mêmes sources (`src/`) :
- version publique : `index.html` à la racine, servie par GitHub Pages (https://lebackgammondepapa.github.io/)
- version Claude : artifact https://claude.ai/artifact/NBjETXSs8XWkMJmXhwCmmK (capacités db, user, room), construite dans `src/out/backgammon.html`

Après toute modification : `python3 src/build.py`, republier l'artifact avec `src/out/backgammon.html`, puis commit et push de `index.html` + `src/` sur `main`.
Détails techniques et tests : `src/NOTES.md`. Plateau unique choisi par Thomas : Marine (feutre bleu marine, cadre et barre en noyer moyen, charnières laiton, flèches ivoire / bleu acier, pions ivoire / ébène gravés). Il a rejeté le choix entre plusieurs plateaux et l'ancien plateau bleu nacré. Thomas déteste les rendus « jeu vidéo » : viser le réalisme d'un vrai plateau. Sons doux, paysage plein écran sur téléphone, lancer de dés automatique.
