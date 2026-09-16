# GeoCauris

Plateforme Next.js de revente de crédits IA (« cauris »), connectée à Firebase, SasPay (paiement) et Imọlẹ.

- Production : https://geocauris.vercel.app
- Administration : https://geocauris.vercel.app/admin

## Paramètres commerciaux confirmés

| Pack | Prix |
| --- | ---: |
| 250 cauris | 350 FCFA |
| 500 cauris | 700 FCFA |
| 1 000 cauris | 1 400 FCFA |
| 2 500 cauris | 3 500 FCFA |
| 5 000 cauris | 7 000 FCFA |

Le projet Firebase configuré est `geocauris`. Firebase Auth et Firestore sont utilisés pour les profils, wallets, transactions, consommations et clés API.

Les règles Firestore sont dans `firestore.rules`. Déploiement avec Firebase CLI : `firebase deploy --only firestore:rules`.

## Paiement (SasPay)

L'achat de cauris passe par le checkout hébergé de SasPay :

1. Le client choisit un pack ; `POST /api/payments/saspay` authentifie l'utilisateur, fixe le montant côté serveur (jamais depuis le navigateur) et crée une session de checkout SasPay (`POST /checkout-sessions/`). L'intention est journalisée dans Firestore (`checkoutSessions`).
2. Le client est redirigé vers `checkout_url` où il choisit lui-même son réseau mobile money ou sa carte.
3. SasPay notifie `POST /api/webhooks/saspay` (event `transaction.success`), signé en HMAC SHA-256 (`X-Webhook-Signature` / `X-Webhook-Timestamp`, tolérance de 5 minutes). Le webhook retrouve la session de checkout correspondante, vérifie la cohérence (uid, pack, montant) puis crédite le wallet de façon idempotente.

Variables requises : `SASPAY_SECRET_KEY` (clé secrète marchand, jamais exposée au client) et `SASPAY_WEBHOOK_SECRET` (secret de signature, généré une seule fois dans le tableau de bord SasPay lors de la création du webhook `transaction.success` pointant vers `/api/webhooks/saspay`).

## API Imọlẹ confirmée

Le proxy GeoCauris transmet les requêtes au format `POST https://api.imole.app/v1/responses` avec un header `Authorization: Bearer ...` et un corps JSON de type :

```json
{"model":"gpt-5.6-luna","input":"Explique ce projet en trois points."}
```

La clé maître reste uniquement côté serveur. Le compte administrateur configuré est `oliviergnacadja693@gmail.com` et le support est joignable au `01 42 54 70 85` ou à `supportgeocauris@gmail.com`.

## Fonctionnalités

- Authentification Firebase et espace utilisateur.
- Achat de cauris via checkout hébergé SasPay (mobile money / carte), confirmé par webhook signé.
- Pages Consommation, Ma clé API, Documentation et Centre d'aide.
- Proxy Imọlẹ avec réservation, débit et remboursement des cauris selon l'utilisation.
- Interface d'administration séparée à `/admin`.
- Pool de clés Imọlẹ côté serveur : ajout chiffré, activation, recalibrage du solde et seuil d'alerte.
- Alertes e-mail administrateur via Resend lorsque le solde Imọlẹ approche du seuil configuré.

## Démarrage

```bash
npm install
npm run dev
```

Ouvrir http://localhost:3000.

## Variables d'environnement

Copier `.env.example` vers `.env.local`, puis renseigner les valeurs correspondant à l'environnement utilisé. Les clés privées Imọlẹ, Firebase Admin, SasPay, Resend et le secret webhook doivent rester côté serveur et ne doivent jamais être commités.

## Routes principales

- `GET/POST /api/wallet` : consulte le wallet.
- `POST /api/payments/saspay` : crée une session de checkout SasPay pour un pack donné.
- `POST /api/webhooks/saspay` : reçoit et vérifie les events SasPay, crédite le wallet.
- `POST /api/keys` : génère une clé API GeoCauris.
- `POST /api/proxy` : exécute une requête Imọlẹ avec débit des cauris.
- `GET/POST/PATCH /api/admin/imole-keys` : administre le pool de clés Imọlẹ.

## Déploiement

Le projet est prévu pour Vercel : importer le dépôt GitHub, configurer les variables d'environnement dans les environnements Preview et Production, puis redéployer. Penser à créer le webhook SasPay (event `transaction.success`) pointant vers `https://<votre-domaine>/api/webhooks/saspay` depuis le tableau de bord SasPay, et à reporter le secret de signature généré dans `SASPAY_WEBHOOK_SECRET`.
