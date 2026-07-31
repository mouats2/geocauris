# GeoCauris MVP

Prototype Next.js de la plateforme de revente de crédits IA décrite dans le cahier des charges.

## Paramètres commerciaux confirmés

| Pack | Prix |
| --- | ---: |
| 250 cauris | 350 FCFA |
| 500 cauris | 700 FCFA |
| 1 000 cauris | 1 400 FCFA |
| 2 500 cauris | 3 500 FCFA |
| 5 000 cauris | 7 000 FCFA |

Le prestataire de paiement retenu est **FedaPay**. La route `/api/payments/fedapay` crée une transaction XOF côté serveur et `/api/webhooks/fedapay` reçoit la confirmation. Le fournisseur IA est **Imọlẹ** ; le site fourni est https://imole.app/ et l'URL API est `https://api.imole.app/v1`.

Le projet Firebase configuré est `geocauris`. Le SDK Firebase est installé et les règles d'accès sont définies pour Auth/Firestore.

Les règles Firestore sont dans `firestore.rules`. Déploiement avec Firebase CLI : `firebase deploy --only firestore:rules`.

## API Imọlẹ confirmée

Le proxy GeoCauris transmet les requêtes au format `POST https://api.imole.app/v1/responses` avec un header `Authorization: Bearer ...` et un corps JSON de type :

```json
{"model":"gpt-5.6-luna","input":"Explique ce projet en trois points."}
```

La clé maître reste uniquement côté serveur. Le compte administrateur configuré est `oliviergnacadja693@gmail.com` et le support est joignable au `01 42 54 70 85` ou à `supportgeocauris@gmail.com`.

## Démarrage

```bash
npm install
npm run dev
```

Ouvrir http://localhost:3000.

## Ce qui est déjà présent

- Tableau de bord responsive avec solde, packs, activité et clé API.
- API `GET/POST /api/wallet` pour le solde et le début d’une recharge.
- API `POST /api/keys` pour générer une clé et son hash SHA-256.
- API `POST /api/proxy` avec validation minimale du bearer token.
- Variables serveur documentées dans `.env.example`.

## Passage en production

1. Remplacer les données de démonstration par Firebase Auth et Firestore.
2. Renseigner les clés FedaPay, puis finaliser le crédit atomique du wallet dans le webhook avec Firebase Admin.
3. Stocker uniquement le hash des clés API et ajouter rate limiting + révocation.
4. Ajouter une réservation atomique des cauris avant l’appel fournisseur, puis réconcilier le coût réel retourné.
5. La connexion serveur Imọlẹ est préparée via `IMOLÉ_API_BASE_URL=https://api.imole.app/v1` et `IMOLÉ_MASTER_API_KEY`. Vérifier les conditions de revente du fournisseur avant production.
