# Notes de développement

Le même code produit deux versions du jeu :

| Version | Fichier construit | Jeu en ligne |
|---|---|---|
| Publique (GitHub Pages) | `index.html` à la racine | Relais MQTT publics gratuits, plusieurs serveurs à la fois (aucun compte) |
| Claude (artifact https://claude.ai/artifact/NBjETXSs8XWkMJmXhwCmmK) | `src/out/backgammon.html` | Base de données de l'artifact (`db`, `user`, `room`) |

## Sources
- `head.part` : styles, balisage et `/*__ENGINE__*/` (emplacement du moteur)
- `engine.js` : règles, coups légaux, IA (3 niveaux), variante 5 pions max (`setMaxStack`)
- `app.js` : plateau Marine (`THEMES`, textures bois/feutre/ivoire générées sur canvas), rendu SVG, animations, sons synthétisés, interface, modes de jeu, lancer automatique, règles maison (5 pions max, relance à l'ouverture), jeu en ligne (adaptateur `makeRelay` hors de Claude, `db` dans Claude)
- `vendor/mqtt.min.js` : mqtt.js 5.10.4 (navigateur), intégré dans `index.html`

## Construire
`python3 src/build.py` régénère `index.html` et `src/out/backgammon.html`.
Après une modification : republier l'artifact avec `src/out/backgammon.html` (mêmes capacités : db, user, room) et pousser `index.html` sur `main` (GitHub Pages se met à jour tout seul).

## Tester
`cd src && npm install && npm test` (jsdom, serveurs MQTT locaux aedes). `tests/browser_relay.js` et `tests/shot.js` utilisent Playwright.
