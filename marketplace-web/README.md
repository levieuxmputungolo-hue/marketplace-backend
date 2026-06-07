# marketplace-web (site web simple)

Fichier statique: `index.html`.

## Lancer
1) Lancer le backend (voir `marketplace-backend/README.md`).
2) Ouvrir dans un navigateur:
- `http://localhost:8000` si tu utilises un serveur statique partageant ce dossier
- ou directement ouvrir `index.html` (certains navigateurs peuvent bloquer les requêtes CORS si tu ouvres en file://)

Pour éviter CORS, lance un mini serveur statique:
- `python -m http.server 9000` dans `marketplace-web/`
Puis ouvre: http://localhost:9000

## Fonctionnalités
- register/login
- selection role client/vendor
- profil vendeur
- abonnement client (simulation paiement + bouton webhook)

