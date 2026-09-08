# GeoCauris

Plateforme Next.js de revente de crédits IA (« cauris »), connectée à Firebase et Imọlẹ.

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

La recharge en ligne est temporairement indisponible : le moyen de paiement précédent (FedaPay) a été retiré du projet. Un nouveau prestataire de paiement reste à choisir et à intégrer avant de réactiver l'achat de cauris depuis l'interface.

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
- Packs de cauris affichés à titre indicatif ; l'achat en ligne est désactivé en attendant un nouveau moyen de paiement.
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

Copier `.env.example` vers `.env.local`, puis renseigner les valeurs correspondant à l'environnement utilisé. Les clés privées Imọlẹ, Firebase Admin, Resend et le secret webhook doivent rester côté serveur et ne doivent jamais être commités.

## Routes principales

- `GET/POST /api/wallet` : consulte le wallet et prépare une recharge.
- `POST /api/keys` : génère une clé API GeoCauris.
- `POST /api/proxy` : exécute une requête Imọlẹ avec débit des cauris.
- `GET/POST/PATCH /api/admin/imole-keys` : administre le pool de clés Imọlẹ.

## Déploiement

Le projet est prévu pour Vercel : importer le dépôt GitHub, configurer les variables d'environnement dans les environnements Preview et Production, puis redéployer.

## Prochaine étape : paiement

Avant de réactiver la recharge en ligne, choisir un nouveau prestataire de paiement, l'intégrer (création de transaction + webhook de confirmation signé), et mettre à jour la fonction `buy()` dans `app/page.tsx` ainsi que ce README en conséquence.
