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
# Installer Git : https://git-scm.com
git init
git add marketplace-backend/
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
5. Ajoute la variable d'environnement :
   - **MONGO_URI** : `mongodb+srv://admin:MotDePasse123@cluster0.xxxxx.mongodb.net/easy-market?retryWrites=true&w=majority`
6. Clique **Apply** → Render construit et déploie

## 4. Tester

```bash
curl https://TON_PROJECT.onrender.com/ping
# → {"ok":true,"db":"mongodb","status":"connected"}
```

## 5. Connecter le site Firebase

Ajoute `?mongo=https://TON_PROJECT.onrender.com` à l'URL Firebase :
```
https://easy-market-96c4a.web.app/?mongo=https://marketplace-backend.onrender.com
```

Ou configure définitivement en modifiant `app.js` :
```js
const MONGO_API = 'https://marketplace-backend.onrender.com';
```

## 6. Utilisateurs de test

Après le déploiement, crée des comptes via l'onglet **🍃 MongoDB** sur le site :
- Onglet "Connexion MongoDB"
- **Inscription** : email + mot de passe + nom
- **Connexion** : `demo@marketplace.com` / `demo123` (si tu relances `seed.py`)

---

## Architecture finale

```
Firebase Hosting (easy-market-96c4a.web.app)
  └── Onglet 🍃 MongoDB → API → Render (marketplace-backend.onrender.com)
                                     └── MongoDB Atlas (cluster gratuit)
```
