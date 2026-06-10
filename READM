# MyBank - Système à deux sites connectés

## Architecture

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│   Site 1        │◄────────│   PostgreSQL    │◄────────│   Site 2        │
│  (MyBank)       │  API    │   Render.com    │  API    │   (Admin)       │
│  Interface      │         │   Base de       │         │  Interface      │
│  Client         │         │   données       │         │  Administration │
└─────────────────┘         └─────────────────┘         └─────────────────┘
```

## Site 1 - MyBank (Interface Client)

**URL Render.com** : `https://mybank-client.onrender.com`

**Fichiers** :
- `server.js` - Serveur Express avec proxy API
- `index.html` - Interface utilisateur
- `style.css` - Styles
- `script.js` - Récupération dynamique des données (toutes les 30 secondes)

**Variables d'environnement** :
```
ADMIN_API_URL=https://mybank-admin.onrender.com/api/data
```

## Site 2 - Admin (Interface Administration)

**URL Render.com** : `https://mybank-admin.onrender.com`

**Fichiers** :
- `server.js` - Serveur Express + API REST + PostgreSQL
- `index.html` - Interface admin pour modifier les données

**Variables d'environnement** :
```
DATABASE_URL=postgresql://user:password@host:5432/dbname
```

## Déploiement sur Render.com

### Étape 1 : Créer la base de données PostgreSQL

1. Connecte-toi à [Render.com](https://render.com)
2. Clique sur **"New"** → **"PostgreSQL"**
3. Nom : `mybank-db`
4. Region : `Frankfurt (EU Central)`
5. Plan : **Free**
6. Clique sur **"Create Database"**
7. Copie l'**Internal Database URL** :
   ```
   postgresql://mybank_user:password@dpg-xxx.render.com:5432/mybank_db
   ```

### Étape 2 : Déployer le Site 2 (Admin)

1. Sur Render.com, clique sur **"New"** → **"Web Service"**
2. Connecte ton repo GitHub ou upload les fichiers
3. Nom : `mybank-admin`
4. Region : `Frankfurt (EU Central)`
5. Runtime : `Node`
6. Build Command : `npm install`
7. Start Command : `node server.js`
8. Plan : **Free**
9. Dans **Environment Variables**, ajoute :
   ```
   DATABASE_URL = postgresql://mybank_user:password@dpg-xxx.render.com:5432/mybank_db
   ```
10. Clique sur **"Create Web Service"**

### Étape 3 : Déployer le Site 1 (MyBank)

1. Sur Render.com, clique sur **"New"** → **"Web Service"**
2. Connecte ton repo GitHub ou upload les fichiers
3. Nom : `mybank-client`
4. Region : `Frankfurt (EU Central)`
5. Runtime : `Node`
6. Build Command : `npm install`
7. Start Command : `node server.js`
8. Plan : **Free**
9. Dans **Environment Variables**, ajoute :
   ```
   ADMIN_API_URL = https://mybank-admin.onrender.com/api/data
   ```
   (Remplace par l'URL réelle du Site 2)
10. Clique sur **"Create Web Service"**

## Utilisation

### Site 2 (Admin) - Modifier les données

Accède à `https://mybank-admin.onrender.com`

Tu peux modifier :
- **Alerte** : Montant à payer pour débloquer
- **Compte** : N°, Date, Montant, Statut (Gelé/Actif)
- **Titulaire** : Nom, Prénom, Date de naissance, Pays, Ville, Région
- **Transactions** : 3 transactions avec nom, date, montant, statut
- **Synthèse** : Total des comptes
- **Gestionnaire** : Nom du conseiller

Clique sur **"Sauvegarder"** après chaque modification.

### Site 1 (MyBank) - Voir les données

Accède à `https://mybank-client.onrender.com`

Les données se mettent à jour automatiquement toutes les **30 secondes**.
Tu peux aussi rafraîchir la page pour voir les changements immédiatement.

## API Endpoints (Site 2)

| Méthode | URL | Description |
|---------|-----|-------------|
| GET | `/api/data` | Récupérer toutes les données |
| GET | `/api/data/:key` | Récupérer une valeur |
| POST | `/api/data/:key` | Modifier une valeur |
| POST | `/api/data` | Modifier plusieurs valeurs |

## Clés de données disponibles

| Clé | Description |
|-----|-------------|
| `alert_amount` | Montant à payer pour débloquer |
| `account_number` | N° de compte |
| `account_date` | Date du compte |
| `account_balance` | Solde du compte |
| `account_frozen` | Gelé (true/false) |
| `account_pending` | À venir |
| `holder_lastname` | Nom |
| `holder_firstname` | Prénom |
| `holder_birthdate` | Date de naissance |
| `holder_country` | Pays |
| `holder_city` | Ville |
| `holder_region` | Région |
| `manager_name` | Nom du gestionnaire |
| `transaction1_name` | Transaction 1 - Nom |
| `transaction1_date` | Transaction 1 - Date |
| `transaction1_status` | Transaction 1 - Statut |
| `transaction1_amount` | Transaction 1 - Montant |
| `transaction2_*` | Transaction 2 (même format) |
| `transaction3_*` | Transaction 3 (même format) |
| `synthese_total` | Total des comptes |

## Notes

- Le Site 1 fonctionne même si le Site 2 est indisponible (données par défaut)
- La base de données PostgreSQL est persistante sur Render.com
- Les deux services sont gratuits (Free tier) mais s'endorment après 15 min d'inactivité
- Le premier chargement peut prendre 30-60 secondes si le service était endormi
