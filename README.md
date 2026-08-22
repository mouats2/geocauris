# GeoCauris

Plateforme Next.js de revente de crédits IA (« cauris »), connectée à Firebase, FedaPay et Imọlẹ.

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

Le prestataire de paiement retenu est **FedaPay**. La route `/api/payments/fedapay` crée une transaction XOF côté serveur et les routes `/api/fedapay/webhook` et `/api/webhooks/fedapay` reçoivent les confirmations. Le fournisseur IA est **Imọlẹ** ; le site fourni est https://imole.app/ et l'URL API est `https://api.imole.app/v1`.

Le projet Firebase configuré est `geocauris`. Firebase Auth et Firestore sont utilisés pour les profils, wallets, transactions, consommations et clés API.

Les règles Firestore sont dans `firestore.rules`. Déploiement avec Firebase CLI : `firebase deploy --only firestore:rules`.

## API Imọlẹ confirmée

Le proxy GeoCauris transmet les requêtes au format `POST https://api.imole.app/v1/responses` avec un header `Authorization: Bearer ...` et un corps JSON de type :

```json
{"model":"gpt-5.6-luna","input":"Explique ce projet en trois points."}
```

La clé maître reste uniquement côté serveur. Le compte administrateur configuré est `oliviergnacadja693@gmail.com` et le support est joignable au `01 42 54 70 85` ou à `supportgeocauris@gmail.com`.

## Fonctionnalités

- Authentification Firebase et espace utilisateur.
- Achat de cauris par packs via FedaPay ; le crédit est confirmé par webhook.
- Pages Consommation, Ma clé API, Documentation et Centre d’aide.
- Proxy Imọlẹ avec réservation, débit et remboursement des cauris selon l’utilisation.
- Interface d’administration séparée à `/admin`.
- Pool de clés Imọlẹ côté serveur : ajout chiffré, activation, recalibrage du solde et seuil d’alerte.
- Alertes e-mail administrateur via Resend lorsque le solde Imọlẹ approche du seuil configuré.

## Démarrage

```bash
npm install
npm run dev
```

Ouvrir http://localhost:3000.

## Variables d’environnement

Copier `.env.example` vers `.env.local`, puis renseigner les valeurs correspondant à l’environnement utilisé. Les clés privées FedaPay, Imọlẹ, Firebase Admin, Resend et le secret webhook doivent rester côté serveur et ne doivent jamais être commités.

Pour un test FedaPay, utiliser les clés `sandbox` et l’URL API sandbox. Pour la production, utiliser les clés `live`, le webhook de production et un domaine autorisé dans FedaPay.

## Routes principales

- `POST /api/payments/fedapay` : crée une transaction de paiement.
- `POST /api/fedapay/webhook` : traite les événements FedaPay approuvés, transférés ou échoués.
- `GET/POST /api/wallet` : consulte le wallet et prépare une recharge.
- `POST /api/keys` : génère une clé API GeoCauris.
- `POST /api/proxy` : exécute une requête Imọlẹ avec débit des cauris.
- `GET/POST/PATCH /api/admin/imole-keys` : administre le pool de clés Imọlẹ.

## Déploiement

Le projet est prévu pour Vercel : importer le dépôt GitHub, configurer les variables d’environnement dans les environnements Preview et Production, puis redéployer. Le webhook doit pointer vers l’URL correspondant au même environnement.

Avant d’activer les paiements réels, vérifier les clés FedaPay live, le secret webhook live, le domaine autorisé et la réception de `transaction.approved` ou `transaction.transferred`.
