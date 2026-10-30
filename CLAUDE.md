# Backgammon — consignes pour Claude

Jeu de Thomas, publié à deux endroits à partir des mêmes sources (`src/`) :
- version publique : `index.html` à la racine, servie par GitHub Pages (https://tombrullefert-droid.github.io/Backgammon/)
- version Claude : artifact https://claude.ai/artifact/NBjETXSs8XWkMJmXhwCmmK (capacités db, user, room), construite dans `src/out/backgammon.html`

Après toute modification : `python3 src/build.py`, republier l'artifact avec `src/out/backgammon.html`, puis commit et push de `index.html` + `src/` sur `main`.
Détails techniques et tests : `src/NOTES.md`. Esthétique validée par Thomas : plateau bleu profond, cadre nacré gris bleuté, pions nacre / marbre bleu, sons doux, paysage plein écran sur téléphone.
