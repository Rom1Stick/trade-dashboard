# 🚀 Guide de Déploiement VPS — THE GRID

Ce guide détaille les étapes pour déployer la version **v3.4.0 (Intelligence V2)** sur votre propre VPS en utilisant Docker.

## Pré-requis
- Docker & Docker Compose installés sur le VPS.
- Un nom de domaine ou une IP publique.

## Méthode 1 : Docker Compose (Recommandé)

1. **Cloner le repository** (ou transférer les fichiers) sur le VPS.
2. **Lancer les containers** :
   ```bash
   docker-compose up -d --build
   ```
3. **Accès** :
   - Frontend : `http://VOTRE_IP:8084`
   - API Proxy : `http://VOTRE_IP:3001` (Géré automatiquement par Nginx)

## Configuration Nginx
Le container `trade-grid` utilise son propre serveur Nginx (`nginx.conf`) pour :
- Servir les fichiers statiques du dossier `dist/`.
- Rediriger les appels `/api/*` vers le container `bingx-api`.

## Maintenance & Logs

- **Vérifier les logs** :
  ```bash
  docker-compose logs -f
  ```
- **Mise à jour** :
  ```bash
  git pull
  docker-compose up -d --build
  ```

## Sécurité
- Le backend utilise le chiffrement local **AES-256** (Vault).
- Les clés API BingX ne sont jamais stockées sur le serveur, elles transitent uniquement par le proxy pour contourner les problèmes de CORS et sont stockées dans l'IndexedDB chiffré de votre navigateur.

---
*THE GRID — Powered by BMad Architecture.*
