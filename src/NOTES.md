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
- `sw.js` : service worker de la version publique, copié à la racine par `build.py` (numéro de cache calculé sur son contenu et les polices). Page : réseau d'abord (toujours la dernière version publiée), copie en cache sans réseau ou si le réseau ne répond pas en 4 s. Polices : cache d'abord.
- `../fonts/` : Cormorant Garamond 500/600 et Manrope variable (sous-ensemble latin, licence OFL), servies par le site dans la version publique pour que le jeu s'affiche correctement hors connexion (la version Claude garde Google Fonts)

## Partie gardée en mémoire
Partie contre l'ordinateur ou à deux : sauvegardée dans `localStorage` (`nacre.partie`) à chaque étape stable (dés tirés, pion joué, annulation, fin de tour). À l'ouverture, le jeu reprend directement la partie, sauf si une partie en ligne a été ouverte depuis (le menu propose alors les deux reprises) ou si l'on arrive par un lien d'invitation. Un tour de l'ordinateur interrompu est rejoué en entier ; des dés en train de rouler restent les mêmes. Partie terminée ou abandonnée : sauvegarde effacée.

## Construire
`python3 src/build.py` régénère `index.html` et `src/out/backgammon.html`.
Après une modification : republier l'artifact avec `src/out/backgammon.html` (mêmes capacités : db, user, room) et pousser `index.html`, `sw.js` et `src/` sur `main` (GitHub Pages se met à jour tout seul).

## Historique et bilan
Chaque partie terminée (pas les parties abandonnées) est ajoutée à `nacre.historique` dans `localStorage` : un enregistrement par partie avec un identifiant unique (`id`, `at`, `mode`, `opp.key`/`opp.name`, `level`, `winner`, `won`, `pts`), prêt à être envoyé sur un compte plus tard. Partie locale : identifiant tiré au début de la partie (`G.gameId`, gardé dans la sauvegarde). Partie en ligne : identifiant calculé sur le code, la création et le score de la paire, identique chez les deux joueurs, donc la partie ne compte qu'une fois même si sa fin est revue. Amis reconnus à leur prénom. Écran Bilan (bouton dans le menu) et ligne « Contre … » sur l'écran de fin.

## Tester
`cd src && npm install && npm test` (jsdom, serveurs MQTT locaux aedes ; `tests/resume_test.js` couvre la reprise de partie, `tests/history_test.js` l'historique et le bilan). `tests/browser_relay.js`, `tests/offline_test.js` (service worker, mode avion, mise à jour de la page) et `tests/shot.js` utilisent Playwright.
