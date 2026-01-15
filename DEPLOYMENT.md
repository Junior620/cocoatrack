# CocoaTrack V2 - Guide de Déploiement Production

## Prérequis

1. Compte Vercel (https://vercel.com)
2. Projet Supabase en production (https://supabase.com)
3. Compte Mapbox avec token (https://mapbox.com)
4. Compte Sentry pour le monitoring (https://sentry.io)

## Étapes de Déploiement

### 1. Préparer Supabase Production

```bash
# Lier le projet Supabase
supabase link --project-ref your-project-ref

# Appliquer les migrations
supabase db push

# Vérifier les migrations
supabase db diff
```

### 2. Configurer Vercel

1. Connecter le repository GitHub à Vercel
2. Sélectionner le dossier `v2` comme root directory
3. Framework preset: Next.js
4. Build command: `pnpm build`
5. Install command: `pnpm install`

### 3. Variables d'Environnement

Configurer dans Vercel Dashboard > Settings > Environment Variables:

| Variable | Description | Environnement |
|----------|-------------|---------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase | Production |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé anonyme Supabase | Production |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Token Mapbox | Production |
| `NEXT_PUBLIC_SENTRY_DSN` | DSN Sentry | Production |
| `NEXT_PUBLIC_APP_URL` | URL de l'application | Production |

### 4. Domaine Custom

1. Aller dans Vercel Dashboard > Settings > Domains
2. Ajouter votre domaine custom
3. Configurer les DNS selon les instructions Vercel

### 5. Vérification Post-Déploiement

- [ ] Login/logout fonctionne
- [ ] Dashboard affiche les données
- [ ] Création de livraison fonctionne
- [ ] Mode offline fonctionne
- [ ] Notifications push fonctionnent
- [ ] Génération de factures fonctionne
- [ ] Sentry capture les erreurs

## Monitoring

### Sentry

- Vérifier les erreurs dans le dashboard Sentry
- Configurer les alertes email pour les erreurs critiques

### Web Vitals

- Vérifier les métriques dans Vercel Analytics
- Cibles:
  - TTFB < 200ms
  - LCP < 2.5s
  - FID < 100ms
  - CLS < 0.1

### Supabase

- Monitorer l'utilisation dans le dashboard Supabase
- Vérifier les logs de la base de données

## Rollback

En cas de problème:

1. Aller dans Vercel Dashboard > Deployments
2. Sélectionner le déploiement précédent
3. Cliquer sur "Promote to Production"

## Support

Pour toute question, contacter l'équipe de développement.
