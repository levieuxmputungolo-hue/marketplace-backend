# Déploiement Render + MongoDB Atlas

## 1. Créer un cluster MongoDB Atlas (gratuit)

1. Va sur https://atlas.mongodb.com → **Sign up** (compte gratuit)
2. Crée un **cluster gratuit** (M0, 512 Mo, région proche de toi)
3. Dans **Database Access** → crée un utilisateur (ex: `admin` / `MotDePasse123`)
4. Dans **Network Access** → **Add IP Address** → `0.0.0.0/0` (autoriser tout)
5. Clique **Connect** → **Drivers** → copie la chaîne :
   ```
   mongodb+srv://admin:<password>@cluster0.xxxxx.mongodb.net/easy-market?retryWrites=true&w=majority
   ```
   Remplace `<password>` par ton mot de passe

## 2. Pousser le code sur GitHub

```bash
git init
git add .
git commit -m "Initial backend"
# Créer un repo sur https://github.com/new
git remote add origin https://github.com/TON_USER/marketplace-backend.git
git push -u origin main
```

## 3. Déployer sur Render

1. Va sur https://dashboard.render.com → **New +** → **Blueprint**
2. Connecte ton GitHub
3. Sélectionne le repo `marketplace-backend`
4. Render détecte automatiquement `render.yaml`
5. Ajoute la variable d'environnement obligatoire :
   - **MONGO_URI** : `mongodb+srv://admin:MotDePasse123@cluster0.xxxxx.mongodb.net/easy-market?retryWrites=true&w=majority`
6. Clique **Apply** → Render construit et déploie

## 4. Tester

```bash
curl https://TON_PROJECT.onrender.com/ping
# → {"ok":true,"db":"mongodb","status":"connected"}
```

## 5. Upload d'images

Les images uploadées sont stockées dans le dossier `uploads/` du serveur.
**Attention** : Render a un système de fichiers éphémère → les uploads disparaissent après un redéploiement.
Pour une solution persistante, utilisez un service comme Cloudinary ou AWS S3.

## 6. Paiement Mobile (Orange Money / M-Pesa / Airtel Money)

L'API de paiement mobile est simulée. Endpoints disponibles :
- `POST /api/payments/mobile/initiate` — Initier un paiement
- `POST /api/payments/mobile/callback` — Simuler la confirmation
- `GET /api/payments/status/{reference}` — Vérifier le statut
- `GET /api/payments/history/{user_id}` — Historique des paiements
- `GET /api/payments/operators` — Liste des opérateurs

## 7. Messagerie Temps Réel

- `POST /api/articles` — Créer un article (annonce)
- `GET /api/articles` — Lister les articles
- `POST /api/articles/{id}/messages` — Envoyer un message
- `GET /api/articles/messages/inbox?user_id=...` — Boîte de réception
- `GET /api/articles/messages/outbox?user_id=...` — Messages envoyés
- `GET /api/articles/messages/conversation/{article_id}?user_id=...` — Conversation
- `GET /api/articles/messages/stream?user_id=...` — SSE temps réel

## 8. Connecter le site Firebase / Web

Pour le site web statique (Firebase, Vercel, Netlify) :
```
API_BASE=https://TON_PROJECT.onrender.com
```

Ou en local :
```
API_BASE=http://localhost:8000
```

## Architecture finale

```
Firebase Hosting (easy-market-96c4a.web.app)
  └── API → Render (marketplace-backend.onrender.com)
              ├── MongoDB Atlas (cluster gratuit)
              ├── Uploads (/) locale (éphémère)
              ├── Paiement Mobile simulé
              └── Messagerie temps réel (SSE)
```
