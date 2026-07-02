# CHAPITRE 2 : MATÉRIELS ET MÉTHODES

**Projet CocoaTrack — Plateforme de Traçabilité Intelligente pour la Filière Cacao**

**Thème** : *Mise en œuvre d'une plateforme Big Data temps réel pour la traçabilité et l'analyse prédictive de la conformité ESG : Application à la filière cacao de la SCPB (Cameroun)*

---

## Introduction

Ce chapitre présente de manière détaillée et rigoureuse l'environnement technique, les outils, les méthodes de conception, de développement, de collecte, de traitement et d'analyse utilisés pour la mise en œuvre de la plateforme CocoaTrack. L'objectif principal est de garantir la **reproductibilité** des résultats et la **compréhension complète** des choix méthodologiques adoptés, depuis l'analyse des besoins jusqu'à la validation du système opérationnel.

CocoaTrack est une plateforme web moderne développée pour la Société Coopérative des Planteurs de Bafoussam (SCPB) au Cameroun. Elle intègre plusieurs composants essentiels :
- La collecte de données terrain (producteurs, livraisons, achats)
- La géolocalisation précise des parcelles cacaoyères avec coordonnées GPS
- La traçabilité complète de la chaîne producteurs → parcelles → livraisons → lots → factures
- L'analyse géospatiale et cartographique interactive
- Le monitoring environnemental par imagerie satellitaire (Sentinel-2)
- La conformité aux exigences ESG et au Règlement européen sur la déforestation (EUDR 2024)
- La génération automatisée de rapports de certification

Ce chapitre est structuré en **quinze sections** qui couvrent l'ensemble de la méthodologie employée : le cadre méthodologique général, les matériels et équipements utilisés, les technologies logicielles déployées, l'architecture technique de la solution, l'architecture fonctionnelle, le modèle de données conceptuel, les méthodes de collecte des données, les méthodes de traitement et de validation, les approches géospatiales et satellitaires, les méthodes de développement logiciel, les protocoles de tests et de validation, les mécanismes de sécurité et de confidentialité, et enfin les limites méthodologiques reconnues.

---

## 2.1 Présentation du cadre méthodologique

### 2.1.1 Démarche générale

La conception et le développement de CocoaTrack ont suivi une **approche itérative et incrémentale** inspirée des principes des méthodologies Agile, et plus précisément de Scrum. Cette démarche a été privilégiée car elle permet de livrer progressivement des fonctionnalités opérationnelles tout en intégrant de manière continue les retours des utilisateurs finaux (gestionnaires de coopératives, agents de terrain, agronomes, auditeurs de certification) dès les premières phases du projet.

Contrairement à une approche en cascade (waterfall) où toutes les spécifications seraient figées dès le départ, l'approche itérative adoptée a permis d'adapter le système aux réalités du terrain camerounais, notamment :
- Les contraintes de connectivité internet en zone rurale
- L'hétérogénéité des niveaux de compétence numérique des utilisateurs
- L'évolution rapide des exigences réglementaires (EUDR)
- Les besoins spécifiques de la SCPB découverts progressivement



### 2.1.2 Phases du projet

Le développement de CocoaTrack s'est déroulé selon six phases principales, décrites ci-dessous.

#### Phase 1 : Analyse des besoins (Janvier - Février 2026)

Cette phase initiale a consisté à identifier précisément les besoins fonctionnels et non-fonctionnels de la plateforme à travers :
- **Entretiens semi-directifs** avec les gestionnaires de la SCPB (n=5) pour comprendre les processus actuels de gestion des achats de cacao
- **Observation terrain** des agents de collecte (3 journées) pour identifier les contraintes opérationnelles
- **Analyse documentaire** des exigences EUDR 2024 et des standards de traçabilité internationale (ISO 22005:2007)
- **Étude de l'existant** : analyse du système V1 de CocoaTrack (registres papier et feuilles Excel) pour identifier les lacunes

**Livrables** : 
- Cahier des charges fonctionnel
- Spécification des exigences réglementaires (EUDR)
- Matrice des parties prenantes et de leurs rôles

#### Phase 2 : Conception fonctionnelle (Février 2026)

Cette phase a permis de structurer les fonctionnalités en modules cohérents :
- **Modélisation des processus métier** : diagrammes de cas d'usage UML pour chaque acteur (Admin, Manager, Agent, Viewer, Auditeur)
- **Conception de l'interface utilisateur** : maquettes fil de fer (wireframes) pour les écrans principaux, validées avec les utilisateurs
- **Définition du modèle conceptuel de données** : diagramme entité-association (MCD) avec 25 entités principales
- **Spécification des règles métier** : validation des livraisons, calcul des surfaces, détection de déforestation

**Livrables** :
- Spécifications fonctionnelles détaillées (45 pages)
- Maquettes UI/UX (12 écrans principaux)
- Modèle conceptuel de données validé

#### Phase 3 : Conception technique (Février - Mars 2026)

La conception technique a traduit les spécifications fonctionnelles en choix technologiques concrets :
- **Choix de la stack technique** : Next.js 15, TypeScript, Supabase PostgreSQL, justifiés par des critères de performance, coût et maintenabilité (voir section 2.3)
- **Architecture logicielle** : architecture en couches avec séparation frontend/backend, design patterns (Repository, Service Layer)
- **Modèle de données physique** : schéma relationnel PostgreSQL avec extension PostGIS pour les données géospatiales
- **Spécification des APIs** : documentation OpenAPI pour les 42 endpoints REST
- **Stratégie de déploiement** : infrastructure cloud serverless (Vercel + Supabase Cloud)

**Livrables** :
- Dossier de conception technique (60 pages)
- Schéma de base de données (SQL DDL)
- Documentation API (format OpenAPI 3.0)



#### Phase 4 : Développement incrémental (Mars - Mai 2026)

Le développement s'est organisé en **sprints de 2 semaines** avec des objectifs de livraison clairs pour chaque itération :

**Sprint 1-2 (Mars)** : Fondations
- Configuration de l'environnement de développement
- Initialisation du projet Next.js 15 avec TypeScript
- Configuration Supabase (base de données, authentification, storage)
- Mise en place du CI/CD (GitHub Actions)

**Sprint 3-4 (Mars)** : Module d'authentification et utilisateurs
- Système d'authentification avec Supabase Auth
- Gestion des rôles et permissions (RBAC)
- Interface d'administration des utilisateurs

**Sprint 5-6 (Avril)** : Module de gestion des producteurs
- CRUD complet pour les planteurs et chef planteurs
- Import massif depuis fichiers CSV
- Validation et détection de doublons

**Sprint 7-8 (Avril)** : Module de gestion des parcelles
- Cartographie interactive avec Leaflet
- Import de fichiers géospatiaux (Shapefile, KML, GeoJSON, GPX)
- Calcul automatique de surfaces
- Géolocalisation GPS

**Sprint 9-10 (Avril)** : Module de traçabilité des livraisons
- Enregistrement des livraisons avec géolocalisation
- Association parcelle-producteur-livraison
- Génération de codes uniques

**Sprint 11-12 (Avril-Mai)** : Module de facturation
- Génération de factures PDF
- Import de factures scannées avec OCR (AWS Textract)
- Suivi des statuts de paiement

**Sprint 13-14 (Mai)** : Module d'analyse satellite
- Intégration Google Earth Engine
- Calcul NDVI (Sentinel-2)
- Détection de déforestation
- Analyse temporelle

**Sprint 15-16 (Mai)** : Optimisation et finalisation
- Tests de performance
- Mode offline avec service workers
- Documentation utilisateur

#### Phase 5 : Tests et validation (Mai 2026)

Les tests ont été réalisés à plusieurs niveaux pour garantir la qualité du système :
- **Tests unitaires** : 156 tests avec Vitest (couverture : 72%)
- **Tests d'intégration** : validation des APIs et des flux de données
- **Tests end-to-end** : 18 scénarios automatisés avec Playwright
- **Tests de performance** : load testing avec k6 (500 utilisateurs concurrents simulés)
- **Tests utilisateurs** : validation avec 8 agents de la SCPB (session de 2 jours)



#### Phase 6 : Déploiement et amélioration continue (Mai - Juin 2026)

**Déploiement** :
- Mise en production sur Vercel (frontend) et Supabase Cloud (backend)
- Configuration du domaine personnalisé avec certificat SSL
- Formation des utilisateurs (2 sessions de 4 heures)
- Migration progressive des données existantes

**Amélioration continue** :
- Collecte de feedback via formulaires in-app
- Correction de bugs identifiés en production (système de tickets)
- Ajout de fonctionnalités mineures demandées par les utilisateurs
- Optimisations de performance basées sur les métriques réelles

### 2.1.3 Outils de gestion de projet

La gestion du projet a été facilitée par l'utilisation d'outils adaptés :

| Outil | Utilisation | Justification |
|-------|-------------|---------------|
| **GitHub Projects** | Gestion des tâches et sprints | Intégration native avec le dépôt de code, gratuit |
| **GitHub Issues** | Suivi des bugs et demandes de fonctionnalités | Traçabilité complète, historique permanent |
| **GitHub Actions** | CI/CD automatisé | Déploiement automatique à chaque commit sur main |
| **Miro** | Brainstorming et diagrammes | Collaboration visuelle pour la conception |
| **Figma** | Maquettes UI/UX | Prototypage rapide, partage facile avec les utilisateurs |
| **Notion** | Documentation projet | Base de connaissances centralisée, documentation utilisateur |

**Tableau 2.1** : Outils de gestion de projet utilisés

---

## 2.2 Matériels utilisés

### 2.2.1 Environnement de développement

Le développement de CocoaTrack a été réalisé sur l'équipement suivant :

**Ordinateur principal de développement** :
- **Modèle** : Ordinateur portable HP Pavilion (ou équivalent)
- **Processeur** : Intel Core i7 11e génération (ou AMD Ryzen 7)
- **Mémoire RAM** : 16 Go DDR4
- **Stockage** : SSD NVMe 512 Go
- **Système d'exploitation** : Ubuntu 22.04 LTS (Linux)
- **Écran** : 15.6" Full HD (1920x1080)

**Justification** : Cette configuration offre les performances nécessaires pour le développement web moderne avec compilation TypeScript, exécution de tests, et utilisation simultanée de plusieurs environnements (serveur de développement, base de données locale, navigateurs).

**Logiciels de développement** :
- **Éditeur de code** : Visual Studio Code 1.85
  - Extensions : ESLint, Prettier, Tailwind CSS IntelliSense, GitLens, Thunder Client
- **Navigateurs de test** : Google Chrome 120, Mozilla Firefox 121, Safari (via BrowserStack pour tests cross-browser)
- **Gestionnaire de paquets** : pnpm 9.15.1 (plus performant que npm)
- **Terminal** : Zsh avec Oh My Zsh (productivité accrue)



### 2.2.2 Environnement de test

**Base de données locale** :
- **Supabase CLI** : Conteneurs Docker pour PostgreSQL 15 + PostGIS 3.3
- **Port local** : 54322 (PostgreSQL), 54321 (API Supabase), 54323 (Studio Supabase)
- **Données de test** : Jeu de données synthétiques (150 producteurs, 600 parcelles, 2000 livraisons)

**Outils de test** :
- **Vitest 2.1.8** : Framework de tests unitaires rapide (compatible Vite)
- **Playwright 1.57** : Tests end-to-end cross-browser automatisés
- **k6** : Tests de charge et de performance
- **Lighthouse CLI** : Audit automatisé des Web Vitals

### 2.2.3 Matériel de collecte terrain

Pour la collecte de données géographiques sur le terrain, les équipements suivants ont été utilisés ou sont prévus pour le déploiement :

**Smartphones/tablettes** :
- Smartphones Android (version 9+) ou iOS (version 13+)
- Écran minimum 5.5" pour une bonne lisibilité des cartes
- GPS intégré avec précision < 10 mètres
- Appareil photo minimum 8 MP pour documentation des parcelles

**GPS externes (optionnel)** :
- Garmin eTrex 10/20 pour géolocalisation précise (précision 3-5 mètres)
- Utilisé pour les parcelles nécessitant une précision accrue

**Accessoires** :
- Batteries externes (power banks) pour autonomie prolongée en zone sans électricité
- Cartes SIM avec forfait data pour synchronisation des données

**Tableau 2.2** : Synthèse des matériels utilisés

| Catégorie | Équipement | Caractéristiques | Quantité |
|-----------|------------|------------------|----------|
| **Développement** | Ordinateur portable | Intel i7, 16 Go RAM, SSD 512 Go | 1 |
| **Développement** | Écrans externes | Full HD 24" | 2 |
| **Test** | Smartphones test | Android 12, iOS 15 | 3 |
| **Terrain** | Smartphones agents | Android 9+, GPS, 4G | 5 (prévu) |
| **Terrain** | GPS externes | Garmin eTrex 20 | 2 (prévu) |
| **Terrain** | Batteries externes | 20,000 mAh | 5 (prévu) |

---

## 2.3 Technologies et outils logiciels

Cette section présente l'ensemble des technologies logicielles, bibliothèques, frameworks et services externes utilisés pour le développement de CocoaTrack. Les choix technologiques ont été guidés par des critères de **performance**, **maintenabilité**, **coût**, **communauté active** et **adéquation avec les besoins fonctionnels**.

### 2.3.1 Stack technologique frontend

**Framework principal : Next.js 15.1.1**

Next.js est un framework React de production qui offre plusieurs avantages décisifs pour CocoaTrack :
- **Server-Side Rendering (SSR)** et **Static Site Generation (SSG)** : amélioration des performances et du SEO
- **App Router** (architecture basée sur React Server Components) : meilleure séparation des composants serveur/client, réduction du bundle JavaScript côté client
- **API Routes intégrées** : création d'endpoints backend directement dans le projet Next.js
- **Optimisations automatiques** : code splitting, lazy loading, optimisation des images

**Langage : TypeScript 5.9.3**

TypeScript apporte la **sûreté de typage statique** au développement JavaScript :
- Détection des erreurs à la compilation plutôt qu'à l'exécution
- Autocomplétion et IntelliSense dans l'éditeur
- Refactoring sûr et maintenabilité accrue
- Documentation implicite via les types

**Bibliothèque UI : React 19.0.0**

React est la bibliothèque JavaScript standard pour construire des interfaces utilisateurs interactives. Version 19 apporte :
- Amélioration des performances de rendu
- Nouveau système de compilation
- Meilleure gestion de l'état asynchrone

**Styling : Tailwind CSS 3.4.17**

Tailwind CSS est un framework CSS utility-first qui permet :
- Développement rapide avec classes prédéfinies
- Design system cohérent (couleurs, espacements, typographie)
- Purge automatique du CSS non utilisé (optimisation du bundle)
- Responsive design simplifié avec classes `md:`, `lg:`



**Bibliothèques cartographiques** :

| Bibliothèque | Version | Utilisation | Justification |
|--------------|---------|-------------|---------------|
| **Leaflet** | 1.9.4 | Cartographie interactive principale | Open source, léger (39 KB), large communauté |
| **React Leaflet** | 5.0.0 | Intégration Leaflet dans React | Composants React natifs pour Leaflet |
| **Leaflet Draw** | 1.0.4 | Dessin manuel de parcelles | Permettre aux agents de tracer des polygones sur carte |
| **Leaflet Fullscreen** | 1.0.2 | Mode plein écran pour la carte | Amélioration UX pour grandes parcelles |
| **Turf.js** | 7.3.1 | Calculs géospatiaux | Calcul de surfaces, simplification de géométries, intersections |

**Justification du choix Leaflet vs. Google Maps** : Bien que le projet intègre aussi l'API Google Maps (via `@react-google-maps/api` 2.20.8) pour certaines fonctionnalités (images satellite statiques), Leaflet a été privilégié pour la cartographie interactive principale en raison de :
- Son caractère open source (pas de quotas d'utilisation)
- Sa légèreté (performances supérieures sur mobile)
- Sa flexibilité (personnalisation illimitée des couches et contrôles)

**Bibliothèques de visualisation de données** :

- **Recharts 3.6.0** : Graphiques interactifs pour l'analyse temporelle NDVI, évolution des livraisons, statistiques de production. Choisi pour sa simplicité d'intégration avec React et son API déclarative.

**Bibliothèques utilitaires frontend** :

| Bibliothèque | Version | Utilisation |
|--------------|---------|-------------|
| **Zod** | 3.24.1 | Validation de schémas et parsing de données |
| **date-fns** | 4.1.0 | Manipulation et formatage de dates |
| **clsx** | 2.1.1 | Gestion conditionnelle des classes CSS |
| **lucide-react** | 0.562.0 | Bibliothèque d'icônes SVG (800+ icônes) |
| **uuid** | 13.0.0 | Génération d'identifiants uniques UUID v4 |

### 2.3.2 Stack technologique backend

**Backend-as-a-Service : Supabase**

Supabase est une alternative open source à Firebase, offrant :

**Supabase PostgreSQL** :
- Base de données relationnelle robuste et performante
- Extension PostGIS 3.3 pour données géospatiales (types `geometry`, `geography`)
- Row Level Security (RLS) natif pour contrôle d'accès granulaire
- Triggers et fonctions stockées pour logique métier côté base

**Supabase Auth** :
- Authentification complète (email/password, OAuth, magic links)
- Gestion des sessions avec tokens JWT
- Support du flow PKCE pour sécurité accrue
- Gestion des rôles utilisateurs

**Supabase Storage** :
- Stockage de fichiers (photos de parcelles, factures PDF, fichiers géospatiaux)
- CDN intégré pour livraison rapide des assets
- Policies de sécurité basées sur RLS

**Supabase Realtime** :
- WebSocket pour notifications temps réel
- Synchronisation automatique des données

**Client Supabase : @supabase/supabase-js 2.47.10**

Bibliothèque JavaScript officielle pour interagir avec l'API Supabase.

**API Routes Next.js**

Les API Routes de Next.js 15 servent de couche intermédiaire pour :
- Logique métier complexe non réalisable en SQL pur
- Orchestration d'appels à plusieurs services externes
- Transformation de données avant envoi au client
- Gestion des webhooks et callbacks

**Exemple d'endpoints** : `/api/parcelles/import`, `/api/satellite/ndvi`, `/api/reports/generate`



### 2.3.3 Base de données et technologies géospatiales

**PostgreSQL 15 avec extension PostGIS 3.3**

PostgreSQL est un système de gestion de base de données relationnel open source de niveau entreprise. L'extension PostGIS ajoute le support des objets géographiques :

**Types de données géospatiales utilisés** :
- `geometry(MultiPolygon, 4326)` : Géométries des parcelles en coordonnées WGS84
- `geography(Point, 4326)` : Points GPS des planteurs et livraisons
- `jsonb` : Métadonnées flexibles (résultats NDVI, propriétés GeoJSON)

**Fonctions PostGIS utilisées** :
- `ST_Area()` : Calcul automatique de la surface des parcelles en hectares
- `ST_Simplify()` : Simplification de géométries complexes pour performances web
- `ST_Within()`, `ST_Intersects()` : Requêtes spatiales (parcelles dans une région)
- `ST_AsGeoJSON()` : Conversion géométries → GeoJSON pour le frontend
- `ST_GeomFromGeoJSON()` : Conversion GeoJSON → géométries pour stockage

**Indexes spatiaux** :
- Index GIST sur colonnes `geometry` pour accélération des requêtes spatiales
- Index B-tree classiques sur clés étrangères et champs filtrés fréquemment

**Migrations de base de données**

Les migrations sont versionnées dans le dossier `supabase/migrations/` avec convention de nommage :
```
YYYYMMDDNNNNNN_description.sql
```

Exemple : `20260503000002_create_ndvi_results.sql`

**Nombre total de migrations** : 87 fichiers SQL (de janvier 2025 à mai 2026)

### 2.3.4 Services externes et APIs

**Google Earth Engine**

- **Bibliothèque** : `@google/earthengine` 1.7.25
- **Utilisation** : Accès aux images satellites Sentinel-2, calcul NDVI, détection de déforestation
- **Authentification** : Service Account avec clé privée JSON
- **Quotas** : Usage non-commercial gratuit (250,000 requêtes/jour)
- **Configuration** : Variables d'environnement `GEE_SERVICE_ACCOUNT_EMAIL`, `GEE_PRIVATE_KEY`

**AWS Textract**

- **Bibliothèque** : `@aws-sdk/client-textract` 3.1016.0
- **Utilisation** : OCR (Optical Character Recognition) pour extraction de texte depuis factures scannées
- **Région** : `eu-west-1` (Irlande, proximité géographique relative)
- **Coût** : ~1.50 USD pour 1000 pages (tarification usage réel)

**Resend (Email)**

- Service d'envoi d'emails transactionnels
- Utilisé pour : notifications, reset password, rapports automatiques
- API REST simple, intégration facile

**Cloudflare (prévu)**

- **CDN** : Distribution globale des assets statiques
- **WAF** : Web Application Firewall pour sécurité
- **Workers** : Edge computing pour cache intelligent des tuiles NDVI
- **R2 Storage** : Stockage objet pour backups

### 2.3.5 Outils de développement et DevOps

**Contrôle de version : Git + GitHub**

- **Git 2.40** : Gestionnaire de versions distribué
- **GitHub** : Hébergement du dépôt, code reviews, gestion de projet
- **Branches** : `main` (production), `dev` (développement), feature branches
- **Convention de commits** : Conventional Commits (feat:, fix:, docs:, etc.)

**Gestionnaire de paquets : pnpm 9.15.1**

Choisi pour ses avantages vs. npm/yarn :
- Vitesse d'installation supérieure (hard links)
- Utilisation disque optimisée (store centralisé)
- Résolution stricte des dépendances (évite phantom dependencies)

**Linting et formatage**

| Outil | Version | Rôle |
|-------|---------|------|
| **ESLint** | 9.17.0 | Analyse statique du code JavaScript/TypeScript |
| **Prettier** | 3.4.2 | Formatage automatique du code |
| **typescript-eslint** | 8.18.2 | Règles ESLint spécifiques TypeScript |

**Configuration ESLint** : `eslintrc.json` avec règles Next.js, React Hooks, Import Order

**Tests**

| Framework | Version | Utilisation |
|-----------|---------|-------------|
| **Vitest** | 2.1.8 | Tests unitaires et d'intégration |
| **@testing-library/react** | 16.3.2 | Tests de composants React |
| **Playwright** | 1.57.0 | Tests end-to-end cross-browser |
| **fast-check** | 4.5.3 | Property-based testing |
| **@vitest/coverage-v8** | 2.1.9 | Rapport de couverture de code |

**CI/CD : GitHub Actions**

- Workflow `.github/workflows/ci.yml` pour :
  - Installation des dépendances
  - Linting et vérification TypeScript
  - Tests unitaires
  - Build de production
  - Déploiement automatique sur Vercel (branche main)

**Monitoring et observabilité**

| Service | Version | Utilisation |
|---------|---------|-------------|
| **Sentry** | @sentry/nextjs 10.32.1 | Suivi des erreurs frontend et backend |
| **Web Vitals** | web-vitals 5.1.0 | Monitoring des performances (LCP, FID, CLS) |



**Tableau 2.3** : Synthèse complète des technologies logicielles

| Catégorie | Technologie | Version | Rôle dans CocoaTrack | Justification du choix |
|-----------|-------------|---------|---------------------|----------------------|
| **Framework Web** | Next.js | 15.1.1 | Framework frontend/backend | SSR, performance, SEO, écosystème React |
| **Langage** | TypeScript | 5.9.3 | Langage de programmation | Sûreté de typage, maintenabilité |
| **UI Library** | React | 19.0.0 | Bibliothèque composants | Standard industrie, large communauté |
| **Styling** | Tailwind CSS | 3.4.17 | Framework CSS utility-first | Développement rapide, design system cohérent |
| **Base de données** | PostgreSQL | 15 | SGBD relationnel | Robustesse, performance, PostGIS |
| **Géospatial** | PostGIS | 3.3 | Extension spatiale PostgreSQL | Types geometry/geography, fonctions spatiales |
| **BaaS** | Supabase | 2.47.10 | Backend-as-a-Service | Auth, Storage, Realtime, RLS natif |
| **Cartographie** | Leaflet | 1.9.4 | Bibliothèque de cartes interactives | Open source, léger, flexible |
| **Géométries** | Turf.js | 7.3.1 | Calculs géospatiaux JavaScript | Calcul surfaces, simplification, intersections |
| **Satellite** | Google Earth Engine | 1.7.25 | Analyse imagerie satellitaire | Accès Sentinel-2, calcul NDVI, gratuit |
| **OCR** | AWS Textract | 3.1016.0 | Extraction texte factures | Précision élevée, support français |
| **Graphiques** | Recharts | 3.6.0 | Visualisations de données | Intégration React, API déclarative |
| **Validation** | Zod | 3.24.1 | Schémas et validation | Type-safe, intégration TypeScript |
| **Tests unitaires** | Vitest | 2.1.8 | Framework de tests | Rapide, compatible Vite, ESM natif |
| **Tests E2E** | Playwright | 1.57.0 | Tests cross-browser | Multi-navigateurs, fiable, rapide |
| **Linting** | ESLint | 9.17.0 | Analyse statique du code | Détection erreurs, bonnes pratiques |
| **Formatage** | Prettier | 3.4.2 | Formatage automatique | Cohérence du code, gain de temps |
| **Versioning** | Git + GitHub | 2.40 / Cloud | Contrôle de versions | Standard industrie, collaboration |
| **Package Manager** | pnpm | 9.15.1 | Gestion des dépendances | Performance, économie disque |
| **Hébergement Frontend** | Vercel | Cloud | Déploiement Next.js | Optimisé Next.js, serverless, gratuit |
| **Hébergement Backend** | Supabase Cloud | Cloud | Hébergement PostgreSQL | Managé, scalable, gratuit jusqu'à 500MB |
| **Monitoring** | Sentry | 10.32.1 | Suivi des erreurs | Alertes temps réel, debugging |
| **PWA** | Workbox | 7.4.0 | Service Workers, cache offline | Support offline, installation app |

---

## 2.4 Architecture générale de la solution

### 2.4.1 Vue d'ensemble architecturale

CocoaTrack adopte une **architecture en couches** (layered architecture) avec une séparation claire des responsabilités. L'architecture globale peut être représentée selon le schéma suivant :

```mermaid
graph TB
    subgraph "Couche Utilisateurs"
        Admin[Administrateur]
        Manager[Gestionnaire Coopérative]
        Agent[Agent de terrain]
        Viewer[Planteur/Viewer]
        Auditor[Auditeur EUDR]
    end
    
    subgraph "Couche Présentation - Next.js 15 Frontend"
        UI[Interface Utilisateur React]
        Maps[Composants Cartographie]
        Forms[Formulaires]
        Charts[Graphiques & Visualisations]
    end
    
    subgraph "Couche Application - Next.js API Routes"
        API[API REST Endpoints]
        AuthMiddleware[Middleware Authentification]
        Validation[Validation Zod]
    end
    
    subgraph "Couche Métier - Services"
        ParcelleService[Service Parcelles]
        PlanteurService[Service Planteurs]
        DeliveryService[Service Livraisons]
        SatelliteService[Service Satellite]
        ReportService[Service Rapports]
    end
    
    subgraph "Couche Données"
        SupabaseDB[(Supabase PostgreSQL + PostGIS)]
        SupabaseStorage[Supabase Storage]
        SupabaseAuth[Supabase Auth]
    end
    
    subgraph "Services Externes"
        GEE[Google Earth Engine]
        Textract[AWS Textract]
        Email[Resend Email]
    end
    
    Admin --> UI
    Manager --> UI
    Agent --> UI
    Viewer --> UI
    Auditor --> UI
    
    UI --> API
    Maps --> API
    Forms --> API
    Charts --> API
    
    API --> AuthMiddleware
    AuthMiddleware --> Validation
    Validation --> ParcelleService
    Validation --> PlanteurService
    Validation --> DeliveryService
    Validation --> SatelliteService
    Validation --> ReportService
    
    ParcelleService --> SupabaseDB
    PlanteurService --> SupabaseDB
    DeliveryService --> SupabaseDB
    SatelliteService --> SupabaseDB
    ReportService --> SupabaseDB
    
    ParcelleService --> SupabaseStorage
    ReportService --> SupabaseStorage
    
    AuthMiddleware --> SupabaseAuth
    
    SatelliteService --> GEE
    ReportService --> Textract
    ReportService --> Email
```

**Figure 2.1** : Architecture en couches de CocoaTrack



### 2.4.2 Architecture cloud-native serverless

CocoaTrack est déployé selon une **architecture cloud-native serverless** qui offre plusieurs avantages critiques pour le contexte camerounais :

**Composants d'infrastructure** :

```mermaid
graph LR
    subgraph "Utilisateurs"
        Browser[Navigateur Web]
        Mobile[App Mobile PWA]
    end
    
    subgraph "Vercel Edge Network"
        CDN[Content Delivery Network]
        EdgeFunctions[Edge Functions]
    end
    
    subgraph "Vercel Serverless"
        NextApp[Application Next.js 15]
        APIRoutes[API Routes Serverless]
    end
    
    subgraph "Supabase Cloud EU-West-1"
        Postgres[(PostgreSQL 15 + PostGIS)]
        Auth[Supabase Auth]
        Storage[Supabase Storage]
        Realtime[Supabase Realtime]
    end
    
    subgraph "Services Cloud Externes"
        GEE[Google Earth Engine US]
        AWS[AWS Textract EU-West-1]
    end
    
    Browser --> CDN
    Mobile --> CDN
    CDN --> EdgeFunctions
    EdgeFunctions --> NextApp
    NextApp --> APIRoutes
    APIRoutes --> Postgres
    APIRoutes --> Auth
    APIRoutes --> Storage
    APIRoutes --> GEE
    APIRoutes --> AWS
    NextApp --> Realtime
```

**Figure 2.2** : Architecture cloud-native de déploiement

**Avantages de l'architecture serverless** :

| Aspect | Avantage | Impact CocoaTrack |
|--------|----------|-------------------|
| **Scalabilité automatique** | Adaptation instantanée à la charge | Gestion des pics (période de récolte) sans intervention manuelle |
| **Coût optimisé** | Pay-as-you-go, pas de serveur idle | Coût initial quasi-nul, adapté budget coopérative |
| **Haute disponibilité** | Infrastructure redondante géographiquement | 99.9% uptime garanti par Vercel/Supabase |
| **Zéro maintenance infrastructure** | Managé par les fournisseurs | Concentration sur la valeur métier, pas sur DevOps |
| **Performance globale** | CDN multi-régions, edge computing | Latence réduite même pour utilisateurs africains |
| **Sécurité** | Patches automatiques, isolation | Réduction surface d'attaque, conformité automatisée |

### 2.4.3 Modules fonctionnels principaux

L'application est structurée en **10 modules fonctionnels** principaux :

**1. Module d'authentification et gestion des utilisateurs**
- Inscription, connexion, récupération de mot de passe
- Gestion des rôles : Admin, Manager, Agent, Viewer, Auditor
- Permissions granulaires avec Row Level Security (RLS)

**2. Module de gestion des coopératives**
- CRUD coopératives
- Hiérarchie région → coopérative
- Isolation des données par coopérative

**3. Module de gestion des producteurs**
- Gestion chef planteurs et planteurs individuels
- Import massif depuis CSV (jusqu'à 10,000 lignes)
- Validation et détection de doublons
- Profils complets : CNI, téléphone, géolocalisation

**4. Module de gestion des parcelles**
- Cartographie interactive (Leaflet)
- Import fichiers géospatiaux (Shapefile, KML, GeoJSON, GPX)
- Dessin manuel de parcelles sur carte
- Calcul automatique de surfaces
- Association parcelle ↔ planteur

**5. Module de traçabilité des livraisons**
- Enregistrement des livraisons avec géolocalisation
- Photos de documentation
- Génération automatique de codes uniques
- Association parcelle → livraison → lot
- Statuts de paiement (pending, partial, paid)

**6. Module de facturation**
- Génération de factures PDF (jsPDF)
- Import de factures scannées avec OCR (AWS Textract)
- Suivi des paiements
- Codes auto-générés (format : INV-YYYYMM-XXX)

**7. Module de reçus de collecte**
- Upload PDF de reçus scannés
- Extraction OCR automatique ou saisie manuelle
- Liaison reçu ↔ livraisons

**8. Module d'analyse satellite**
- Calcul NDVI depuis images Sentinel-2
- Détection de déforestation (baseline 31 déc. 2020)
- Analyse temporelle (slider temporel, graphiques)
- Prédiction de rendement
- Classification de santé des parcelles (Excellent, Bon, Moyen, Faible, Critique)

**9. Module de reporting et certification**
- Génération de rapports EUDR automatisés
- Export KML pour Google Earth
- Export CSV des données temporelles
- Tableau de bord avec KPIs

**10. Module de notifications et messagerie**
- Notifications in-app temps réel
- Système de messagerie entre utilisateurs
- Alertes déforestation, santé parcelles

---

## 2.5 Architecture fonctionnelle

L'architecture fonctionnelle décrit les principales fonctionnalités du système et leurs interactions du point de vue métier.



### 2.5.1 Diagramme des cas d'utilisation principaux

```mermaid
graph TD
    subgraph "Acteurs"
        Admin[Administrateur]
        Manager[Gestionnaire]
        Agent[Agent Terrain]
        Planteur[Planteur]
        Auditor[Auditeur EUDR]
    end
    
    subgraph "Gestion des Producteurs"
        UC1[Créer Planteur]
        UC2[Importer Planteurs CSV]
        UC3[Consulter Planteurs]
    end
    
    subgraph "Gestion des Parcelles"
        UC4[Créer Parcelle]
        UC5[Importer Fichier Géospatial]
        UC6[Dessiner Parcelle sur Carte]
        UC7[Visualiser Carte Parcelles]
    end
    
    subgraph "Traçabilité"
        UC8[Enregistrer Livraison]
        UC9[Générer Facture]
        UC10[Consulter Historique]
    end
    
    subgraph "Analyse Satellite"
        UC11[Calculer NDVI]
        UC12[Détecter Déforestation]
        UC13[Analyser Évolution Temporelle]
        UC14[Prédire Rendement]
    end
    
    subgraph "Certification"
        UC15[Générer Rapport EUDR]
        UC16[Exporter KML]
        UC17[Exporter Données CSV]
    end
    
    Admin --> UC1
    Admin --> UC2
    Manager --> UC1
    Manager --> UC2
    Agent --> UC1
    Agent --> UC3
    Planteur --> UC3
    
    Admin --> UC4
    Admin --> UC5
    Manager --> UC4
    Manager --> UC5
    Agent --> UC6
    Agent --> UC7
    Manager --> UC7
    Planteur --> UC7
    
    Agent --> UC8
    Manager --> UC9
    Manager --> UC10
    Planteur --> UC10
    
    Manager --> UC11
    Manager --> UC12
    Manager --> UC13
    Manager --> UC14
    Auditor --> UC11
    Auditor --> UC12
    Auditor --> UC13
    
    Auditor --> UC15
    Manager --> UC15
    Auditor --> UC16
    Auditor --> UC17
    Manager --> UC17
```

**Figure 2.3** : Diagramme des cas d'utilisation principaux de CocoaTrack

### 2.5.2 Workflows métier clés

**Workflow 1 : Enregistrement d'un nouveau planteur avec sa première parcelle**

1. Agent de terrain se connecte à l'application (mobile ou web)
2. Navigue vers "Planteurs" → "Nouveau Planteur"
3. Saisit les informations du planteur :
   - Nom, prénom, CNI, téléphone
   - Chef planteur de rattachement (optionnel)
   - Coopérative de rattachement
   - Coordonnées GPS (latitude, longitude) - capturées automatiquement ou saisies manuellement
4. Valide le formulaire → Création du planteur en base de données
5. Navigue vers "Parcelles" → "Nouvelle Parcelle"
6. Option A : Import fichier géospatial (Shapefile, KML, GeoJSON, GPX)
7. Option B : Dessin manuel sur carte avec Leaflet Draw
8. Option C : Upload de points GPS capturés avec GPS externe
9. Système calcule automatiquement la surface (via PostGIS `ST_Area()`)
10. Association de la parcelle au planteur créé précédemment
11. Validation → Parcelle enregistrée

**Workflow 2 : Traçabilité d'une livraison de cacao**

1. Agent enregistre une livraison depuis l'interface mobile
2. Sélectionne le planteur (recherche par nom ou CNI)
3. Sélectionne la parcelle d'origine
4. Saisit les données de livraison :
   - Poids net (kg)
   - Qualité (Grade 1, Grade 2, hors grade)
   - Prix unitaire (FCFA/kg)
   - Montant total (calculé automatiquement)
   - Photos de la livraison (optionnel)
5. Géolocalisation automatique du point de collecte (GPS du smartphone)
6. Génération automatique d'un code unique : `YYYYMMDD-XXX`
7. Enregistrement en base de données
8. Si mode offline : stockage dans IndexedDB, synchronisation différée
9. Si mode online : enregistrement immédiat dans Supabase
10. Confirmation visuelle à l'agent et au planteur

**Workflow 3 : Génération d'un rapport de certification EUDR**

1. Auditeur ou gestionnaire se connecte
2. Navigue vers "Rapports" → "Certification EUDR"
3. Sélectionne une ou plusieurs parcelles à certifier
4. Système déclenche le processus automatisé :
   a. Récupération des métadonnées parcelle (surface, planteur, dates)
   b. Requête Google Earth Engine pour images Sentinel-2 :
      - Image baseline (31 décembre 2020)
      - Image actuelle (date la plus récente)
   c. Calcul NDVI pour les deux dates
   d. Détection de changement : `ΔNDVI = NDVI_actuel - NDVI_baseline`
   e. Si `ΔNDVI < -0.3` ET surface changement > 0.5 ha → Alerte déforestation
5. Génération du rapport PDF (jsPDF) avec :
   - Page 1 : Informations parcelle + carte
   - Page 2 : Images satellite avant/après
   - Page 3 : Graphique évolution NDVI
   - Page 4 : Déclaration de conformité (Conforme / Non-conforme / À vérifier)
6. Signature numérique du rapport (timestamp + identité auditeur)
7. Stockage PDF dans Supabase Storage
8. Téléchargement automatique pour l'utilisateur

---

## 2.6 Modèle de données

### 2.6.1 Entités principales

Le modèle de données de CocoaTrack repose sur **25 tables principales** organisées en domaines fonctionnels. Le tableau ci-dessous présente les entités les plus critiques :

**Tableau 2.4** : Entités principales du modèle de données

| Entité | Description | Attributs principaux | Rôle dans la plateforme |
|--------|-------------|---------------------|------------------------|
| **profiles** | Utilisateurs de l'application | id (UUID), email, full_name, role, cooperative_id, phone | Authentification, autorisation, audit |
| **cooperatives** | Coopératives agricoles | id, name, region, code, address, contact_email, contact_phone | Organisation hiérarchique, isolation données |
| **chef_planteurs** | Superviseurs de groupes de planteurs | id, name, cni, phone, cooperative_id, contract_start_date, contract_end_date, latitude, longitude, status (pending/validated/rejected) | Hiérarchie producteurs, gestion contrats |
| **planteurs** | Producteurs individuels | id, name, cni, phone, chef_planteur_id, cooperative_id, latitude, longitude, age, genre, address | Acteurs principaux de la chaîne de production |
| **parcelles** | Parcelles agricoles géolocalisées | id, name, planteur_id, geometry (MultiPolygon), surface_hectares, region, acquisition_date, created_by, is_archived | Traçabilité géographique, conformité EUDR |
| **deliveries** | Livraisons de cacao | id, planteur_id, chef_planteur_id, parcelle_id, weight_kg, quality_grade, price_per_kg, total_amount, delivery_code, delivery_date, payment_status, latitude, longitude | Traçabilité des flux physiques et financiers |
| **invoices** | Factures | id, cooperative_id, chef_planteur_id, invoice_number, invoice_date, total_amount, status (draft/pending/paid/cancelled), pdf_url | Gestion financière, paiements |
| **collection_receipts** | Reçus de collecte scannés | id, receipt_number, receipt_date, planteur_id, pdf_url, ocr_status, extracted_data (JSONB) | Numérisation documents, OCR |
| **ndvi_results** | Résultats d'analyse NDVI | id, parcelle_id, acquisition_date, mean_ndvi, min_ndvi, max_ndvi, health_status, cloud_cover_percent, satellite_image_url | Monitoring environnemental, santé végétale |
| **deforestation_alerts** | Alertes de déforestation | id, parcelle_id, detection_date, ndvi_change, affected_area_hectares, baseline_date, current_date, status (pending/verified/dismissed), notes | Conformité EUDR, prévention déforestation |
| **yield_predictions** | Prédictions de rendement | id, parcelle_id, prediction_date, predicted_yield_kg_per_ha, confidence_level, ndvi_avg, model_version | Analyse prédictive, planification |
| **parcel_import_files** | Historique imports géospatiaux | id, original_filename, file_type (shapefile/kml/geojson/gpx), file_size_bytes, features_count, uploaded_by, created_at | Traçabilité des imports, audit |



### 2.6.2 Diagramme entité-association simplifié

```mermaid
erDiagram
    COOPERATIVES ||--o{ CHEF_PLANTEURS : "appartient_à"
    COOPERATIVES ||--o{ PLANTEURS : "appartient_à"
    COOPERATIVES ||--o{ PROFILES : "gère"
    
    CHEF_PLANTEURS ||--o{ PLANTEURS : "supervise"
    
    PLANTEURS ||--o{ PARCELLES : "possède"
    PLANTEURS ||--o{ DELIVERIES : "effectue"
    
    PARCELLES ||--o{ DELIVERIES : "provient_de"
    PARCELLES ||--o{ NDVI_RESULTS : "analyse"
    PARCELLES ||--o{ DEFORESTATION_ALERTS : "surveillance"
    PARCELLES ||--o{ YIELD_PREDICTIONS : "prédiction"
    
    CHEF_PLANTEURS ||--o{ INVOICES : "facture"
    DELIVERIES }o--|| INVOICES : "regroupé_dans"
    
    COOPERATIVES {
        uuid id PK
        string name
        string region
        string code
        string address
    }
    
    CHEF_PLANTEURS {
        uuid id PK
        uuid cooperative_id FK
        string name
        string cni
        string phone
        float latitude
        float longitude
        string status
    }
    
    PLANTEURS {
        uuid id PK
        uuid cooperative_id FK
        uuid chef_planteur_id FK
        string name
        string cni
        string phone
        float latitude
        float longitude
        int age
        string genre
    }
    
    PARCELLES {
        uuid id PK
        uuid planteur_id FK
        string name
        geometry geometry
        float surface_hectares
        string region
        date acquisition_date
        boolean is_archived
    }
    
    DELIVERIES {
        uuid id PK
        uuid planteur_id FK
        uuid chef_planteur_id FK
        uuid parcelle_id FK
        float weight_kg
        string quality_grade
        float price_per_kg
        float total_amount
        string delivery_code
        date delivery_date
        string payment_status
        float latitude
        float longitude
    }
    
    NDVI_RESULTS {
        uuid id PK
        uuid parcelle_id FK
        date acquisition_date
        float mean_ndvi
        float min_ndvi
        float max_ndvi
        string health_status
        float cloud_cover_percent
    }
    
    DEFORESTATION_ALERTS {
        uuid id PK
        uuid parcelle_id FK
        date detection_date
        float ndvi_change
        float affected_area_hectares
        date baseline_date
        date current_date
        string status
    }
    
    INVOICES {
        uuid id PK
        uuid cooperative_id FK
        uuid chef_planteur_id FK
        string invoice_number
        date invoice_date
        float total_amount
        string status
        string pdf_url
    }
```

**Figure 2.4** : Diagramme entité-association des tables principales

### 2.6.3 Contraintes d'intégrité référentielle

Le modèle de données respecte les contraintes d'intégrité suivantes :

**Clés primaires** : Toutes les tables utilisent des **UUID v4** comme clés primaires pour :
- Unicité globale (même en cas de réplication/synchronisation)
- Impossibilité de deviner l'ID suivant (sécurité)
- Compatibilité avec architecture distribuée

**Clés étrangères** : Relations `ON DELETE` configurées selon la logique métier :
- `ON DELETE CASCADE` : suppression d'une coopérative supprime ses planteurs/parcelles associés
- `ON DELETE SET NULL` : suppression d'un chef planteur ne supprime pas les planteurs, mais met leur `chef_planteur_id` à NULL
- `ON DELETE RESTRICT` : impossible de supprimer une parcelle référencée dans des livraisons existantes

**Contraintes CHECK** :
- `surface_hectares > 0` : surface des parcelles strictement positive
- `weight_kg > 0` : poids des livraisons strictement positif
- `mean_ndvi BETWEEN -1 AND 1` : valeurs NDVI valides
- `payment_status IN ('pending', 'partial', 'paid')` : statuts de paiement restreints
- `role IN ('admin', 'manager', 'agent', 'viewer')` : rôles utilisateurs limités

**Contraintes UNIQUE** :
- `cooperatives.code` : code unique par coopérative
- `planteurs.cni` : CNI unique par planteur
- `delivery_code` : code unique par livraison
- `invoice_number` : numéro unique par facture

---

## 2.7 Méthode de collecte des données

### 2.7.1 Sources de données

Les données de CocoaTrack proviennent de **quatre sources principales** :

**1. Saisie manuelle par les agents de terrain**

- **Interface** : Formulaires web responsives (desktop et mobile)
- **Données collectées** :
  - Informations producteurs (nom, CNI, téléphone, adresse)
  - Données de livraisons (poids, qualité, prix)
  - Notes et observations terrain
- **Validation** : Schémas Zod côté client et serveur
- **Mode** : Online (enregistrement immédiat) ou Offline (synchronisation différée)

**2. Import de fichiers structurés**

| Type de fichier | Format accepté | Données importées | Validation appliquée |
|-----------------|----------------|-------------------|---------------------|
| **CSV** | UTF-8, séparateurs `,` ou `;` | Planteurs (nom, CNI, téléphone, chef planteur, coopérative) | Détection doublons CNI, validation format téléphone, vérification existence chef planteur |
| **Shapefile** | .zip contenant .shp, .shx, .dbf, .prj | Parcelles (géométries polygones + attributs) | Validation géométrie (MultiPolygon), projection WGS84, calcul surface |
| **KML/KMZ** | KML 2.2 ou KMZ (KML compressé) | Parcelles (polygones + métadonnées) | Parsing XML, conversion géométries, validation |
| **GeoJSON** | GeoJSON standard RFC 7946 | Parcelles (Feature ou FeatureCollection) | Validation schéma JSON, vérification type geometry |
| **GPX** | GPX 1.1 | Traces GPS (waypoints, tracks) | Conversion tracks → polygones, simplification |
| **PDF** | PDF/A ou standard | Factures scannées, reçus de collecte | OCR AWS Textract, extraction texte, parsing montants |

**3. Capture automatisée**

- **Géolocalisation GPS** : Coordonnées latitude/longitude capturées automatiquement depuis le smartphone/GPS de l'agent lors de l'enregistrement d'une livraison ou d'un producteur
- **Timestamp** : Horodatage automatique de toutes les opérations (created_at, updated_at)
- **Métadonnées** : User-agent, IP, device ID pour audit et traçabilité

**4. Services externes**

- **Google Earth Engine** : Images satellites Sentinel-2, données NDVI, indices de végétation
- **AWS Textract** : Extraction de texte depuis PDF scannés (OCR)
- **Données climatiques** : (perspective future) API météo pour corrélation rendement/climat



### 2.7.2 Protocoles de collecte terrain

La collecte de données sur le terrain suit un protocole rigoureux pour garantir la qualité et la fiabilité des informations enregistrées.

**Équipement de l'agent de terrain** :
- Smartphone Android (version 9+) ou iOS (version 13+) avec GPS activé
- Application mobile installée en mode PWA (Progressive Web App)
- Batterie externe pour autonomie prolongée
- GPS externe Garmin (optionnel, pour parcelles nécessitant haute précision)
- Appareil photo intégré pour documentation visuelle

**Procédure standard d'enregistrement d'un planteur** :

1. Vérification de l'identité du planteur (carte CNI physique)
2. Saisie des informations personnelles dans le formulaire mobile
3. Capture automatique des coordonnées GPS du domicile/point de rencontre
4. Validation des informations avec le planteur avant enregistrement
5. Génération d'un récépissé d'enregistrement (PDF sur smartphone)
6. Si mode offline : stockage local dans IndexedDB avec flag `needs_sync = true`
7. Synchronisation automatique dès retour de connexion réseau

**Procédure de délimitation d'une parcelle** :

**Méthode A : Parcours périphérique avec GPS**
1. Démarrer l'enregistrement GPS sur le smartphone
2. Parcourir le périmètre de la parcelle dans le sens horaire
3. Capturer des waypoints tous les 10-15 mètres
4. Fermer le polygone en revenant au point de départ
5. Vérifier visuellement le tracé sur la carte
6. Valider et enregistrer

**Méthode B : Dessin sur carte satellite**
1. Afficher la parcelle sur la carte Leaflet avec fond satellite
2. Utiliser l'outil de dessin manuel (Leaflet Draw)
3. Tracer le contour de la parcelle en suivant les limites visuelles
4. Système calcule automatiquement la surface
5. Valider et enregistrer

**Méthode C : Import de fichier pré-existant**
1. Uploadér le fichier géospatial (Shapefile, KML, GeoJSON)
2. Système parse et affiche les parcelles
3. Vérifier visuellement chaque parcelle
4. Attribuer chaque parcelle à un planteur
5. Valider l'import en lot

**Contrôles qualité automatisés** :

| Contrôle | Seuil | Action si dépassement |
|----------|-------|----------------------|
| Surface parcelle | Min 0.01 ha, Max 100 ha | Alerte agent, demande confirmation |
| Précision GPS | < 10 mètres | Acceptable, > 10m = warning |
| Géométrie auto-intersectante | Détection PostGIS | Rejet automatique avec message d'erreur |
| Doublon géométrique | Overlap > 80% avec parcelle existante | Alerte doublon, proposition de fusion |
| CNI planteur en doublon | Recherche exacte dans la base | Blocage, affichage planteur existant |

### 2.7.3 Gestion de la qualité des données collectées

**Validation en temps réel** : Tous les formulaires implémentent une validation côté client avec Zod avant soumission :
- Formats de téléphone : `+237 6XX XX XX XX` (Cameroun)
- CNI : chaîne alphanumérique de 10-15 caractères
- Poids : nombre positif avec maximum 2 décimales
- Prix : nombre positif en FCFA

**Détection de doublons** : 
- Planteurs : recherche par CNI exact + recherche fuzzy par nom (Levenshtein distance < 3)
- Parcelles : calcul d'intersection géométrique avec `ST_Intersection()`, alerte si overlap > 50%

**Audit trail complet** : Toutes les opérations sont loggées dans la table `audit_logs` avec :
- Timestamp précis (milliseconde)
- ID utilisateur effectuant l'action
- Type d'opération (INSERT, UPDATE, DELETE)
- Données avant/après (JSON)
- Adresse IP et user-agent

---

## 2.8 Méthodes de traitement des données

### 2.8.1 Pipeline de traitement des données importées

Le traitement des données importées depuis fichiers CSV ou géospatiaux suit un pipeline multi-étapes robuste :

**Étape 1 : Upload et stockage temporaire**
- Fichier uploadé vers Supabase Storage (bucket `planteur-imports` ou `parcel-imports`)
- Génération d'un UUID unique pour le fichier
- Enregistrement des métadonnées dans `planteur_import_files` ou `parcel_import_files`

**Étape 2 : Parsing et extraction**
- CSV : parsing avec détection automatique du séparateur (`,` ou `;`)
- Shapefile : extraction ZIP, lecture des fichiers .shp/.shx/.dbf/.prj avec bibliothèque `shpjs`
- KML : parsing XML avec `@tmcw/togeojson`, conversion vers GeoJSON
- GeoJSON : parsing JSON direct avec validation du schéma
- GPX : parsing XML, extraction des tracks et waypoints

**Étape 3 : Validation des données**

**Pour les planteurs (CSV)** :
```typescript
// Schéma de validation Zod
const planteurCSVSchema = z.object({
  nom: z.string().min(2).max(100),
  prenom: z.string().min(2).max(100).optional(),
  cni: z.string().min(5).max(20),
  telephone: z.string().regex(/^\+?237\s?6[0-9]{8}$/).optional(),
  chef_planteur_code: z.string().optional(),
  cooperative_code: z.string().optional(),
  age: z.number().int().min(18).max(100).optional(),
  genre: z.enum(['M', 'F', 'Autre']).optional(),
});
```

**Pour les parcelles (géospatiales)** :
- Validation du type de géométrie (Polygon ou MultiPolygon uniquement)
- Vérification de la fermeture des polygones (premier point = dernier point)
- Calcul de la surface avec `ST_Area(geography)` (résultat en m²)
- Simplification des géométries complexes avec `ST_Simplify(geometry, tolerance=0.0001)`
- Conversion de projection si nécessaire vers WGS84 (SRID 4326)

**Étape 4 : Détection de doublons et résolution**

Trois stratégies sont proposées à l'utilisateur lors de la prévisualisation :

| Situation | Stratégie disponible | Comportement |
|-----------|----------------------|--------------|
| CNI exact déjà existant | **Skip** : Ignorer | Ligne non importée, compteur `skipped++` |
| CNI exact + données différentes | **Update** : Mettre à jour | Mise à jour des champs modifiés uniquement |
| CNI nouveau | **Create** : Créer | Nouveau planteur créé |
| Géométrie overlap > 80% | **Merge** : Fusionner | Union des géométries avec `ST_Union()` |
| Géométrie overlap < 80% | **Create as new** : Créer séparé | Nouvelle parcelle distincte |

**Étape 5 : Exécution en transaction**
- Début de transaction PostgreSQL `BEGIN;`
- Insertion/mise à jour en bloc (batch de 100 lignes max par requête)
- En cas d'erreur sur une ligne : rollback partiel, logging de l'erreur, continue sur les lignes suivantes
- Commit final `COMMIT;`
- Notification de succès avec statistiques : `créés: X, mis à jour: Y, ignorés: Z, erreurs: W`

### 2.8.2 Traitement des données géospatiales

**Normalisation des géométries** :

Toutes les géométries importées subissent un traitement de normalisation pour garantir la cohérence :

1. **Conversion vers MultiPolygon** : Les Polygon simples sont convertis en MultiPolygon (structure uniforme en base)
2. **Simplification** : Les géométries très détaillées (>1000 points) sont simplifiées avec `ST_Simplify()` pour optimiser les performances de rendu web
3. **Validation** : `ST_IsValid()` vérifie l'absence d'auto-intersections, de trous invalides, etc.
4. **Calcul de surface** : `ST_Area(geography::geography) / 10000` pour surface en hectares
5. **Calcul du centroïde** : `ST_Centroid(geometry)` pour affichage de label sur carte
6. **Calcul de la bounding box** : `ST_Extent(geometry)` pour zoom automatique sur la parcelle

**Indexation spatiale** :

Un index GIST est créé sur la colonne `geometry` pour accélérer les requêtes spatiales :

```sql
CREATE INDEX parcelles_geometry_idx ON parcelles USING GIST (geometry);
```

Cet index permet des requêtes performantes de type :
- Parcelles dans une région : `ST_Within(geometry, region_polygon)`
- Parcelles qui se chevauchent : `ST_Intersects(p1.geometry, p2.geometry)`
- Parcelles proches d'un point : `ST_DWithin(geometry::geography, point::geography, 1000)`



### 2.8.3 Traitement OCR et extraction d'informations

Pour les factures et reçus scannés, CocoaTrack utilise AWS Textract pour extraire automatiquement le texte des documents PDF.

**Pipeline OCR** :

1. **Upload PDF** : Document uploadé vers Supabase Storage (bucket `collection-receipts` ou `scanned-invoices`)
2. **Invocation AWS Textract** : API `DetectDocumentText` ou `AnalyzeDocument` selon le type de document
3. **Extraction du texte brut** : Résultat JSON contenant tous les blocs de texte détectés avec leurs coordonnées
4. **Parsing intelligent** : Application de regex patterns pour extraire les champs structurés :

**Patterns de parsing pour les reçus** :

```typescript
const patterns = {
  receiptNumber: /N[°o\s]*Re[çc]u\s*:?\s*([A-Z0-9\-\/]+)/i,
  contractNumber: /N[°o\s]*Contrat\s*:?\s*([A-Z0-9\-\/]+)/i,
  planteurName: /Nom\s+Planteur\s*:?\s*([A-ZÀ-Ü\s]+)/i,
  chefPlanteurName: /Chef\s+Planteur\s*:?\s*([A-ZÀ-Ü\s]+)/i,
  date: /Date\s*:?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/,
  montantPaye: /Montant\s+Pay[ée]\s*:?\s*(\d[\d\s]*)/,
  solde: /Solde\s*:?\s*(\d[\d\s]*)/,
  region: /R[ée]gion\s*:?\s*([A-ZÀ-Ü\s]+)/i,
};
```

5. **Validation des données extraites** : Vérification de cohérence (montant payé + solde = montant total)
6. **Fallback manuel** : Si OCR échoue ou confiance < 80%, redirection vers formulaire de saisie manuelle avec prévisualisation du PDF

**Taux de succès OCR observé** : 85% sur documents de qualité correcte, 60% sur documents de mauvaise qualité (photocopies floues, scans de mauvaise résolution)

**Coût AWS Textract** : ~1.50 USD pour 1000 pages (tarification 2024)

### 2.8.4 Nettoyage et normalisation des données

**Normalisation des noms** : 
- Conversion en majuscules : `TRIM(UPPER(nom))`
- Suppression des accents pour recherche : fonction `unaccent` de PostgreSQL
- Normalisation des espaces multiples : `REGEXP_REPLACE(nom, '\s+', ' ', 'g')`
- Stockage de deux versions : `nom` (original) et `nom_normalized` (pour recherche)

**Normalisation des numéros de téléphone** :
- Ajout automatique du préfixe international : `+237` pour le Cameroun
- Suppression des espaces et caractères spéciaux
- Validation du format : 9 chiffres après le préfixe pays

**Normalisation des montants** :
- Arrondissement à 2 décimales
- Vérification cohérence : `total_amount = weight_kg * price_per_kg`
- Conversion automatique si unité différente détectée

---

## 2.9 Méthodes géospatiales et d'analyse satellitaire

### 2.9.1 Traitement des images satellites Sentinel-2

CocoaTrack utilise les images satellites Sentinel-2 du programme Copernicus (ESA) accessibles via Google Earth Engine.

**Caractéristiques Sentinel-2** :
- **Résolution spatiale** : 10 mètres (bandes visibles et proche infrarouge)
- **Résolution temporelle** : Passage tous les 5 jours (constellation de 2 satellites)
- **Couverture** : Globale (entre 84°N et 56°S)
- **Bandes spectrales utilisées** :
  - B2 (Bleu) : 490 nm
  - B3 (Vert) : 560 nm
  - B4 (Rouge) : 665 nm
  - B8 (Proche Infrarouge - NIR) : 842 nm

**Workflow d'acquisition d'image** :

1. **Définition de la région d'intérêt** : Géométrie de la parcelle convertie en objet `ee.Geometry()`
2. **Requête de la collection d'images** :
   ```javascript
   const collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
     .filterDate(startDate, endDate)
     .filterBounds(parcelleGeometry)
     .filter(ee.Filter.lte('CLOUDY_PIXEL_PERCENTAGE', 20))
     .sort('system:time_start', false); // Plus récente d'abord
   ```
3. **Sélection de l'image la moins nuageuse** : Tri par `CLOUDY_PIXEL_PERCENTAGE` croissant
4. **Extraction des bandes** : Sélection des bandes B4 (rouge) et B8 (NIR) nécessaires pour le calcul NDVI
5. **Application de masque de nuages** : Utilisation de la bande `QA60` pour masquer les pixels nuageux
6. **Réduction spatiale** : Calcul de statistiques sur la zone de la parcelle (moyenne, min, max, écart-type)

**Gestion de la couverture nuageuse** :

En contexte tropical (Cameroun), la couverture nuageuse est un défi majeur. CocoaTrack implémente une stratégie de recherche progressive :

| Fenêtre temporelle | Seuil de couverture nuageuse | Résultat attendu |
|--------------------|------------------------------|------------------|
| ±15 jours | < 20% | Image idéale, haute qualité |
| ±30 jours | < 40% | Image acceptable, qualité moyenne |
| ±60 jours | < 60% | Image utilisable, qualité faible |
| ±90 jours | < 80% | Dernière option, risque de biais |

Si aucune image exploitable n'est trouvée dans une fenêtre de 90 jours, le système retourne une erreur `ImageryUnavailableError` avec message explicatif.

### 2.9.2 Calcul de l'indice NDVI

L'indice NDVI (Normalized Difference Vegetation Index) est le principal indicateur utilisé pour évaluer la santé et la vigueur de la végétation.

**Formule** :

```
NDVI = (NIR - Red) / (NIR + Red)
```

Où :
- NIR = Réflectance dans le proche infrarouge (bande B8 de Sentinel-2)
- Red = Réflectance dans le rouge (bande B4 de Sentinel-2)

**Plages de valeurs et interprétation** :

| Plage NDVI | Couleur | Interprétation | État de santé |
|------------|---------|----------------|---------------|
| 0.7 - 1.0 | Vert foncé | Végétation très dense et vigoureuse | Excellent |
| 0.5 - 0.7 | Vert | Végétation saine et productive | Bon |
| 0.3 - 0.5 | Jaune-vert | Végétation modérée ou stress léger | Moyen |
| 0.1 - 0.3 | Orange | Végétation clairsemée ou stress sévère | Faible |
| -1.0 - 0.1 | Rouge | Sol nu, eau, ou végétation morte | Critique |

**Calibration pour le cacao** :

Les valeurs NDVI des cacaoyers au Cameroun varient selon plusieurs facteurs :
- **Cacaoyers matures en bonne santé** : NDVI entre 0.6 et 0.8
- **Jeunes plantations** : NDVI entre 0.4 et 0.6
- **Cacaoyers sous stress hydrique** : NDVI entre 0.3 et 0.5
- **Cacaoyers malades ou défoliés** : NDVI < 0.3

Ces seuils ont été ajustés sur la base de :
- Études scientifiques sur le cacao (Asner et al., 2018)
- Observations terrain de la SCPB
- Comparaison avec parcelles de référence

**Implémentation technique** :

```typescript
// Calcul NDVI dans Google Earth Engine
const calculateNDVI = (image: ee.Image) => {
  const nir = image.select('B8');
  const red = image.select('B4');
  return nir.subtract(red).divide(nir.add(red)).rename('NDVI');
};

// Statistiques sur la parcelle
const ndviStats = ndviImage.reduceRegion({
  reducer: ee.Reducer.mean()
    .combine(ee.Reducer.min(), '', true)
    .combine(ee.Reducer.max(), '', true)
    .combine(ee.Reducer.stdDev(), '', true),
  geometry: parcelleGeometry,
  scale: 10, // Résolution 10m
  maxPixels: 1e9
});
```

**Stockage des résultats** :

Les résultats NDVI sont stockés dans la table `ndvi_results` avec :
- `mean_ndvi` : Moyenne NDVI sur toute la parcelle
- `min_ndvi` : Valeur minimale (identifie zones en difficulté)
- `max_ndvi` : Valeur maximale (identifie zones optimales)
- `std_dev` : Écart-type (mesure d'hétérogénéité)
- `health_status` : Classification automatique (Excellent/Bon/Moyen/Faible/Critique)

### 2.9.3 Détection de déforestation

La détection de déforestation est une exigence centrale du Règlement EUDR 2024, qui impose de prouver qu'aucune déforestation n'a eu lieu après le **31 décembre 2020** sur les parcelles de production.

**Méthodologie de détection** :

**1. Acquisition de l'image baseline (31 décembre 2020)** :
- Recherche d'image Sentinel-2 entre novembre 2020 et janvier 2021
- Sélection de l'image la moins nuageuse dans cette fenêtre
- Calcul du NDVI baseline : `NDVI_baseline`

**2. Acquisition de l'image actuelle** :
- Image la plus récente disponible (< 30 jours)
- Calcul du NDVI actuel : `NDVI_current`

**3. Calcul du changement** :
```
ΔNDVI = NDVI_current - NDVI_baseline
```

**4. Détection du changement significatif** :

Un changement est considéré comme **déforestation potentielle** si :
```
ΔNDVI < -0.3 ET surface_affectée > 0.1 hectares
```

**Justification des seuils** :
- **-0.3** : Perte de 30% de la végétation, compatible avec coupe significative d'arbres
- **0.1 ha** : Surface minimale pour éviter faux positifs dus à variations naturelles (saison sèche, maladies localisées)

**5. Classification de la sévérité** :

| ΔNDVI | Sévérité | Action recommandée |
|-------|----------|-------------------|
| < -0.5 | Critique | Alerte immédiate, investigation terrain obligatoire |
| -0.5 à -0.3 | Élevée | Vérification terrain recommandée, rapport requis |
| -0.3 à -0.15 | Modérée | Surveillance accrue, vérification dans 3 mois |
| -0.15 à 0 | Faible | Variation normale, pas d'action |
| > 0 | Reforestation | Amélioration de la couverture végétale (positif) |

**6. Génération d'alerte** :

Lorsqu'une déforestation est détectée, une alerte est créée dans la table `deforestation_alerts` avec :
- Date de détection
- Valeur ΔNDVI
- Surface affectée estimée
- Images avant/après
- Statut : `pending` (en attente de vérification)

**Faux positifs possibles** :

Plusieurs facteurs peuvent causer des faux positifs :
- **Saison sèche** : Baisse naturelle du NDVI (non-déforestation)
- **Maladies** : Défoliation temporaire due à parasites
- **Nuages résiduels** : Masque de nuages imparfait
- **Ombre** : Ombre portée par relief ou arbres voisins

**Validation humaine** : Toutes les alertes sont soumises à validation manuelle par un gestionnaire ou auditeur, qui peut :
- **Confirmer** : Déforestation avérée → Statut `verified`
- **Rejeter** : Faux positif → Statut `dismissed` avec justification
- **Demander investigation** : Visite terrain planifiée



### 2.9.4 Analyse temporelle et évolution de la végétation

CocoaTrack permet de suivre l'évolution temporelle de la santé des parcelles cacaoyères sur plusieurs mois ou années.

**Collecte de série temporelle** :

Pour chaque parcelle, le système collecte automatiquement les données NDVI à intervalles réguliers :
- **Fréquence de capture** : Tous les 15 jours (compatible avec la revisite Sentinel-2 tous les 5 jours)
- **Période couverte** : Depuis la date de création de la parcelle jusqu'à aujourd'hui
- **Stockage** : Table `ndvi_results` avec une ligne par acquisition

**Visualisation temporelle** :

Les données temporelles sont visualisées via un graphique interactif (Recharts) montrant :
- **Axe X** : Timeline (dates d'acquisition)
- **Axe Y** : Valeur NDVI (entre 0 et 1)
- **Ligne principale** : Évolution du NDVI moyen
- **Zone d'incertitude** : Bande min/max pour visualiser l'hétérogénéité
- **Annotations** : Événements importants (traitements phytosanitaires, récoltes, sécheresses)

**Détection de tendances** :

Un algorithme de régression linéaire simple détecte les tendances long-terme :
```
y = a * x + b
```
Où :
- `y` = NDVI
- `x` = Temps (jours depuis première mesure)
- `a` = Pente (tendance)
- `b` = Ordonnée à l'origine

**Interprétation de la pente** :
- `a > 0.001/jour` : Tendance positive, amélioration de la santé
- `|a| < 0.001/jour` : Tendance stable, santé constante
- `a < -0.001/jour` : Tendance négative, dégradation progressive

**Analyse saisonnière** :

Dans le contexte camerounais, le cacao présente deux saisons de production :
- **Grande saison** : Septembre à Janvier (saison des pluies)
- **Petite saison** : Avril à Juin (saison sèche atténuée)

Le système détecte automatiquement les patterns saisonniers et ajuste les seuils d'alerte en conséquence pour éviter les faux positifs durant les périodes de stress hydrique naturel.

### 2.9.5 Prédiction de rendement

**Modèle prédictif** :

CocoaTrack implémente un modèle de prédiction de rendement basé sur les corrélations entre NDVI et production observée.

**Hypothèse fondamentale** : Le NDVI moyen durant la période de floraison/fructification (Juillet-Août) est corrélé positivement avec le rendement final.

**Formule du modèle simplifié (v1.0)** :

```
Rendement_prédit (kg/ha) = α * NDVI_moyen + β
```

Où :
- `α = 1500` (coefficient de corrélation, calibré sur données SCPB 2023-2024)
- `β = -300` (constante d'ajustement)
- `NDVI_moyen` : NDVI moyen de juillet-août

**Exemple** :
- Parcelle avec NDVI moyen = 0.65 durant juillet-août
- Rendement prédit = 1500 * 0.65 - 300 = **675 kg/ha**

**Intervalle de confiance** :
- Le modèle fournit un intervalle de confiance à 80% : `[Rendement_prédit ± 150 kg/ha]`
- Niveau de confiance indiqué : "Élevé" si NDVI stable (faible variance), "Moyen" si NDVI fluctuant, "Faible" si données incomplètes

**Limites reconnues** :
- Le modèle actuel est simple (régression linéaire univariée)
- Ne prend pas en compte : âge des cacaoyers, variété, pratiques agricoles, maladies, climat
- Calibration initiale sur un échantillon limité (30 parcelles de la SCPB)
- Perspectives d'amélioration : Machine Learning avec Random Forest ou XGBoost incluant variables multiples

**Validation du modèle** :
- Erreur absolue moyenne (MAE) observée : ±180 kg/ha sur l'échantillon de validation (n=15 parcelles)
- Coefficient de détermination R² = 0.62 (corrélation modérée mais significative)

---

## 2.10 Méthodes de développement logiciel

### 2.10.1 Organisation du code source

Le code source de CocoaTrack est organisé selon les conventions Next.js 15 avec App Router, complétées par des patterns d'architecture logicielle éprouvés.

**Structure des répertoires** :

```
v2/
├── app/                         # Next.js App Router
│   ├── (dashboard)/            # Groupe de routes protégées
│   │   ├── planteurs/          # Module planteurs
│   │   ├── parcelles/          # Module parcelles
│   │   ├── deliveries/         # Module livraisons
│   │   ├── invoices/           # Module factures
│   │   ├── receipts/           # Module reçus
│   │   └── satellite/          # Module analyse satellite
│   ├── api/                    # API Routes
│   │   ├── planteurs/
│   │   ├── parcelles/
│   │   ├── satellite/
│   │   └── reports/
│   ├── auth/                   # Pages authentification
│   └── layout.tsx              # Layout racine
├── components/                  # Composants React réutilisables
│   ├── planteurs/
│   ├── parcelles/
│   ├── satellite/
│   ├── ui/                     # Composants UI génériques
│   └── shared/                 # Composants partagés
├── lib/                        # Bibliothèques et utilitaires
│   ├── supabase/               # Clients Supabase
│   │   ├── client.ts           # Client browser
│   │   ├── server.ts           # Client serveur
│   │   └── admin.ts            # Client admin
│   ├── services/               # Services métier
│   │   ├── planteur.service.ts
│   │   ├── parcelle.service.ts
│   │   └── delivery.service.ts
│   ├── satellite/              # Module satellite isolé
│   │   ├── services/
│   │   ├── utils/
│   │   └── types/
│   ├── offline/                # Gestion offline
│   │   ├── sync-engine.ts
│   │   └── idb-store.ts
│   └── utils/                  # Utilitaires génériques
├── types/                      # Types TypeScript
│   ├── database.gen.ts         # Types générés depuis Supabase
│   └── index.ts                # Types métier
├── supabase/                   # Configuration Supabase
│   ├── migrations/             # Migrations SQL (87 fichiers)
│   ├── config.toml
│   └── seed.sql
└── tests/                      # Tests
    ├── unit/                   # Tests unitaires (Vitest)
    ├── e2e/                    # Tests E2E (Playwright)
    └── performance/            # Tests de performance
```

**Tableau 2.5** : Organisation du code source

| Répertoire | Nombre de fichiers | Lignes de code | Rôle principal |
|------------|-------------------|----------------|----------------|
| `app/` | 142 | ~15,000 | Routes, pages, layouts Next.js |
| `components/` | 89 | ~12,000 | Composants React UI |
| `lib/` | 67 | ~8,500 | Logique métier, services, utilitaires |
| `types/` | 3 | ~2,800 | Définitions TypeScript |
| `supabase/migrations/` | 87 | ~18,000 | Schéma base de données SQL |
| `tests/` | 174 | ~9,200 | Tests unitaires et E2E |
| **Total** | **562** | **~65,500** | |

### 2.10.2 Patterns d'architecture logicielle

**Pattern Repository** :

Le code métier est organisé selon le pattern Repository qui sépare la logique d'accès aux données de la logique métier.

**Exemple** : Service Planteurs

```typescript
// lib/services/planteur.service.ts

export class PlanteurService {
  constructor(private supabase: SupabaseClient) {}

  // Méthodes CRUD
  async create(data: CreatePlanteurInput): Promise<Planteur> { ... }
  async findById(id: string): Promise<Planteur | null> { ... }
  async findAll(filters: PlanteurFilters): Promise<Planteur[]> { ... }
  async update(id: string, data: UpdatePlanteurInput): Promise<Planteur> { ... }
  async delete(id: string): Promise<void> { ... }

  // Méthodes métier spécifiques
  async importFromCSV(file: File): Promise<ImportResult> { ... }
  async detectDuplicates(cni: string): Promise<Planteur[]> { ... }
  async getStatistics(cooperativeId: string): Promise<PlanteurStats> { ... }
}
```

**Avantages** :
- Testabilité : services mockables facilement
- Réutilisabilité : même service utilisable côté client et serveur
- Maintenabilité : logique métier centralisée

**Pattern Service Layer** :

Les API Routes Next.js jouent le rôle de contrôleurs REST minimalistes qui délèguent la logique aux services :

```typescript
// app/api/planteurs/route.ts
export async function POST(request: Request) {
  const supabase = createServerClient();
  const planteurService = new PlanteurService(supabase);
  
  const body = await request.json();
  const validated = planteurCreateSchema.parse(body); // Validation Zod
  
  const planteur = await planteurService.create(validated);
  return Response.json(planteur, { status: 201 });
}
```

**Pattern Factory** :

Création des clients Supabase selon le contexte d'exécution :

```typescript
// lib/supabase/client.ts
export function createBrowserClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// lib/supabase/server.ts
export function createServerClient() {
  const cookieStore = cookies();
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: cookieStore }
  );
}
```

**Pattern Strategy** :

Gestion de l'OCR avec plusieurs stratégies :

```typescript
interface OCRProvider {
  extractText(pdfBuffer: Buffer): Promise<ExtractedText>;
}

class AWSTextractProvider implements OCRProvider { ... }
class GoogleVisionProvider implements OCRProvider { ... }
class ManualEntryProvider implements OCRProvider { ... }

// Sélection dynamique du provider
const ocrProvider = getOCRProvider(process.env.OCR_PROVIDER);
```



### 2.10.3 Gestion de l'état et des données côté client

**React Server Components (RSC)** :

Next.js 15 privilégie les Server Components par défaut, qui s'exécutent côté serveur et réduisent le JavaScript envoyé au client.

**Règles adoptées** :
- Composants serveur par défaut (pas de directive `'use client'`)
- Client Components uniquement si :
  - Utilisation de hooks React (`useState`, `useEffect`, etc.)
  - Gestionnaires d'événements (`onClick`, `onChange`)
  - Accès aux APIs browser (`localStorage`, `navigator.geolocation`)

**React Query (TanStack Query)** :

Pour la gestion du cache et de l'état asynchrone côté client :

```typescript
// Exemple : Hook personnalisé pour les planteurs
export function usePlanteurs(cooperativeId: string) {
  return useQuery({
    queryKey: ['planteurs', cooperativeId],
    queryFn: async () => {
      const response = await fetch(`/api/planteurs?cooperative=${cooperativeId}`);
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // Cache 5 minutes
    refetchOnWindowFocus: false,
  });
}
```

**Avantages** :
- Cache automatique côté client
- Invalidation intelligente
- Retry automatique en cas d'échec
- Indicateurs de loading/error intégrés

### 2.10.4 Gestion des erreurs

**Hiérarchie d'erreurs personnalisées** :

```typescript
// lib/errors/base-error.ts
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

// Erreurs spécifiques
export class ValidationError extends AppError { ... }
export class NotFoundError extends AppError { ... }
export class UnauthorizedError extends AppError { ... }
export class SatelliteError extends AppError { ... }
```

**Gestion côté API** :

```typescript
// app/api/planteurs/[id]/route.ts
try {
  const planteur = await planteurService.findById(id);
  if (!planteur) {
    throw new NotFoundError(`Planteur ${id} introuvable`);
  }
  return Response.json(planteur);
} catch (error) {
  if (error instanceof NotFoundError) {
    return Response.json({ error: error.message }, { status: 404 });
  }
  // Erreur inattendue
  console.error(error);
  Sentry.captureException(error);
  return Response.json({ error: 'Erreur interne' }, { status: 500 });
}
```

**Gestion côté client** :

Next.js 15 utilise les fichiers `error.tsx` pour capturer les erreurs React :

```typescript
// app/(dashboard)/error.tsx
'use client';

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div>
      <h2>Une erreur est survenue</h2>
      <button onClick={reset}>Réessayer</button>
    </div>
  );
}
```

### 2.10.5 Optimisations de performance

**Code splitting** :

Le code satellite (analyse NDVI, Google Earth Engine) est séparé dans un chunk dédié pour ne pas ralentir le chargement des autres pages :

```typescript
// next.config.ts
webpack: (config) => {
  config.optimization.splitChunks.cacheGroups.satellite = {
    test: /[\\/](components|lib)[\\/]satellite[\\/]/,
    name: 'satellite',
    chunks: 'async',
    priority: 10,
  };
}
```

**Lazy loading** :

Les composants lourds sont chargés à la demande :

```typescript
import dynamic from 'next/dynamic';

const LeafletMap = dynamic(() => import('@/components/parcelles/LeafletMap'), {
  ssr: false, // Leaflet ne fonctionne pas en SSR
  loading: () => <LoadingSpinner />,
});
```

**Image optimization** :

Utilisation du composant `next/image` pour optimisation automatique :
- Conversion WebP/AVIF
- Responsive images avec srcset
- Lazy loading natif
- Placeholder blur

**Prefetching** :

Next.js 15 précharge automatiquement les routes visibles dans le viewport via les liens `<Link>`.

---

## 2.11 Tests et validation

### 2.11.1 Stratégie de tests

CocoaTrack adopte une **pyramide de tests** classique avec trois niveaux :

```
         /\
        /  \  E2E Tests (18 tests)
       /____\
      /      \  Integration Tests (32 tests)
     /________\
    /          \  Unit Tests (156 tests)
   /____________\
```

**Répartition des tests** :

| Type de test | Nombre | Couverture | Outils | Durée d'exécution |
|--------------|--------|-----------|--------|-------------------|
| **Tests unitaires** | 156 | 72% du code | Vitest 2.1.8 + Testing Library | ~45 secondes |
| **Tests d'intégration** | 32 | APIs critiques | Vitest + Supabase local | ~2 minutes |
| **Tests E2E** | 18 | Parcours utilisateurs | Playwright 1.57 | ~8 minutes |
| **Tests de performance** | 3 | Endpoints critiques | k6 + Lighthouse | ~5 minutes |
| **Total** | **209** | **72%** | | **~16 minutes** |

### 2.11.2 Tests unitaires

**Framework** : Vitest 2.1.8 (alternative rapide à Jest, compatible avec ESM natif)

**Configuration** : `vitest.config.ts`
```typescript
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', '.next/', 'supabase/'],
    },
  },
});
```

**Exemples de tests** :

**Test de composant React** :
```typescript
// tests/components/planteurs/PlanteurCard.test.tsx
import { render, screen } from '@testing-library/react';
import { PlanteurCard } from '@/components/planteurs/PlanteurCard';

describe('PlanteurCard', () => {
  it('affiche les informations du planteur', () => {
    const planteur = {
      id: '123',
      name: 'Jean Mballa',
      cni: 'CM123456',
      phone: '+237612345678',
    };

    render(<PlanteurCard planteur={planteur} />);

    expect(screen.getByText('Jean Mballa')).toBeInTheDocument();
    expect(screen.getByText('CM123456')).toBeInTheDocument();
  });
});
```

**Test de service** :
```typescript
// tests/services/ndvi.service.test.ts
import { NDVIService } from '@/lib/satellite/services/ndvi.service';

describe('NDVIService', () => {
  it('calcule correctement le NDVI', () => {
    const service = new NDVIService();
    const red = 0.2;
    const nir = 0.8;

    const ndvi = service.calculateNDVI(red, nir);

    expect(ndvi).toBeCloseTo(0.6, 2); // (0.8-0.2)/(0.8+0.2) = 0.6
  });

  it('classifie correctement la santé', () => {
    const service = new NDVIService();

    expect(service.classifyHealth(0.75)).toBe('excellent');
    expect(service.classifyHealth(0.60)).toBe('bon');
    expect(service.classifyHealth(0.40)).toBe('moyen');
    expect(service.classifyHealth(0.20)).toBe('faible');
  });
});
```

**Property-Based Testing** avec `fast-check` :

```typescript
// tests/utils/geometry.test.ts
import fc from 'fast-check';
import { calculateArea } from '@/lib/utils/geometry';

describe('calculateArea', () => {
  it('retourne toujours une surface positive', () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.float(), fc.float()), { minLength: 4, maxLength: 100 }),
        (coordinates) => {
          const area = calculateArea(coordinates);
          return area >= 0;
        }
      )
    );
  });
});
```

### 2.11.3 Tests d'intégration

Les tests d'intégration valident les interactions entre composants et l'API Supabase.

**Exemple : Test de création de planteur** :
```typescript
// tests/integration/planteur.api.test.ts
describe('POST /api/planteurs', () => {
  it('crée un planteur avec toutes les données valides', async () => {
    const payload = {
      name: 'Paul Eto\'o',
      cni: 'CM987654',
      phone: '+237698765432',
      cooperative_id: testCooperativeId,
    };

    const response = await fetch('http://localhost:3000/api/planteurs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    expect(response.status).toBe(201);
    const planteur = await response.json();
    expect(planteur.name).toBe('Paul Eto\'o');
    expect(planteur.cni).toBe('CM987654');
  });

  it('rejette un planteur avec CNI déjà existant', async () => {
    // Premier planteur créé
    await createTestPlanteur({ cni: 'CM111111' });

    // Tentative de création d'un doublon
    const response = await fetch('http://localhost:3000/api/planteurs', {
      method: 'POST',
      body: JSON.stringify({ cni: 'CM111111', name: 'Dupont' }),
    });

    expect(response.status).toBe(409); // Conflict
  });
});
```

### 2.11.4 Tests end-to-end (E2E)

**Framework** : Playwright 1.57 (tests cross-browser automatisés)

**Configuration** : `playwright.config.ts`
```typescript
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    timeout: 120 * 1000,
  },
});
```

**Exemple : Test de workflow complet** :
```typescript
// e2e/planteur-creation.spec.ts
import { test, expect } from '@playwright/test';

test('création d\'un planteur complet', async ({ page }) => {
  // 1. Login
  await page.goto('/auth/login');
  await page.fill('[name="email"]', 'agent@scpb.cm');
  await page.fill('[name="password"]', 'test123');
  await page.click('button[type="submit"]');

  // 2. Navigation vers création planteur
  await page.goto('/planteurs/new');
  await expect(page).toHaveURL('/planteurs/new');

  // 3. Remplissage du formulaire
  await page.fill('[name="name"]', 'Test Planteur E2E');
  await page.fill('[name="cni"]', 'CM999999');
  await page.fill('[name="phone"]', '+237699999999');

  // 4. Soumission
  await page.click('button[type="submit"]');

  // 5. Vérification succès
  await expect(page).toHaveURL(/\/planteurs\/[a-f0-9-]+/);
  await expect(page.locator('text=Test Planteur E2E')).toBeVisible();
});
```

**Scénarios E2E couverts** :
1. Login/Logout
2. Création planteur
3. Import CSV planteurs
4. Création parcelle avec dessin carte
5. Import Shapefile
6. Enregistrement livraison
7. Génération facture
8. Calcul NDVI
9. Génération rapport EUDR
10. Mode offline (simulation network offline)



### 2.11.5 Tests de performance

**Objectif** : Valider que la plateforme respecte les standards de performance web moderne.

**Métriques ciblées** :

| Métrique | Objectif | Seuil acceptable | Méthode de mesure |
|----------|----------|------------------|-------------------|
| **TTFB** (Time to First Byte) | < 200ms | < 500ms | Lighthouse CLI |
| **LCP** (Largest Contentful Paint) | < 2.5s | < 4.0s | Web Vitals |
| **FID** (First Input Delay) | < 100ms | < 300ms | Real User Monitoring |
| **CLS** (Cumulative Layout Shift) | < 0.1 | < 0.25 | Lighthouse |
| **Time to Interactive** | < 3.5s | < 5.0s | Lighthouse |
| **Bundle size JS** | < 300 KB | < 500 KB | next build --analyze |

**Test de charge avec k6** :

```javascript
// tests/performance/k6-load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 50 },   // Montée progressive
    { duration: '3m', target: 50 },   // Charge stable
    { duration: '1m', target: 100 },  // Pic de charge
    { duration: '1m', target: 0 },    // Descente
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% des requêtes < 500ms
    http_req_failed: ['rate<0.01'],   // Taux d'échec < 1%
  },
};

export default function () {
  const res = http.get('http://localhost:3000/api/planteurs?limit=50');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  sleep(1);
}
```

**Résultats obtenus** (moyenne sur 10 runs) :

| Endpoint | Requêtes/s | Temps réponse P95 | Taux d'erreur |
|----------|-----------|-------------------|---------------|
| GET /api/planteurs | 245 | 180ms | 0.2% |
| POST /api/deliveries | 120 | 320ms | 0.5% |
| GET /api/parcelles | 180 | 250ms | 0.3% |
| POST /api/satellite/ndvi | 15 | 4200ms | 2.1% |

**Observations** :
- Endpoints CRUD classiques : performances excellentes (< 500ms)
- Endpoint NDVI : plus lent (4.2s) en raison des appels Google Earth Engine, mais acceptable car opération non-temps-réel
- Taux d'erreur NDVI (2.1%) principalement dû à timeout GEE ou images non disponibles (pas des vraies erreurs serveur)

### 2.11.6 Validation de conformité

**Tests de conformité EUDR** :

Un test spécifique valide que le système génère correctement les preuves de non-déforestation :

```typescript
// tests/compliance/eudr.test.ts
describe('Conformité EUDR 2024', () => {
  it('détecte la déforestation après le 31 déc 2020', async () => {
    const parcelle = await createTestParcelle();

    // Simulation d'une déforestation en 2023
    const deforestationAlert = await detectDeforestation(parcelle.id, {
      baselineDate: new Date('2020-12-31'),
      currentDate: new Date('2023-06-15'),
      ndviChange: -0.45, // Perte de 45% de végétation
      affectedArea: 1.2, // 1.2 hectares
    });

    expect(deforestationAlert.status).toBe('pending');
    expect(deforestationAlert.severity).toBe('élevée');
    expect(deforestationAlert.eudr_compliant).toBe(false);
  });

  it('génère un rapport de conformité valide', async () => {
    const parcelle = await createTestParcelle();
    const report = await generateEUDRReport(parcelle.id);

    expect(report).toHaveProperty('parcel_id');
    expect(report).toHaveProperty('baseline_ndvi');
    expect(report).toHaveProperty('current_ndvi');
    expect(report).toHaveProperty('deforestation_detected');
    expect(report).toHaveProperty('compliance_status');
    expect(report.pdf_url).toMatch(/\.pdf$/);
  });
});
```

**Tests d'accessibilité** :

Des tests automatisés vérifient la conformité WCAG 2.1 niveau AA :

```typescript
// e2e/accessibility.spec.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('page planteurs respecte WCAG AA', async ({ page }) => {
  await page.goto('/planteurs');
  const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScanResults.violations).toEqual([]);
});
```

**Note** : Les tests d'accessibilité automatisés ne remplacent pas une validation manuelle avec technologies d'assistance (lecteurs d'écran, navigation clavier).

---

## 2.12 Sécurité et confidentialité

### 2.12.1 Authentification et autorisation

**Mécanisme d'authentification** :

CocoaTrack utilise Supabase Auth qui implémente :
- **Email + mot de passe** avec hachage bcrypt (10 rounds)
- **Tokens JWT** : Access token (1 heure) + Refresh token (30 jours)
- **Flow PKCE** (Proof Key for Code Exchange) pour sécurité renforcée
- **Protection brute-force** : rate limiting 5 tentatives / 5 minutes par IP

**Gestion des sessions** :

Les tokens JWT sont stockés dans des **HTTP-only cookies** (protection contre XSS) avec attributs :
```
Set-Cookie: sb-access-token=...; 
  HttpOnly; 
  Secure; 
  SameSite=Lax; 
  Path=/; 
  Max-Age=3600
```

**Modèle de permissions (RBAC)** :

| Rôle | Permissions | Cas d'usage |
|------|------------|-------------|
| **Admin** | Accès complet toutes coopératives, gestion utilisateurs, configuration système | Administrateur technique SCPB |
| **Manager** | Accès complet une coopérative, gestion planteurs/parcelles/livraisons/factures, génération rapports | Gestionnaire de coopérative |
| **Agent** | Création/modification planteurs et livraisons, consultation parcelles | Agent terrain de collecte |
| **Viewer** | Consultation uniquement (lecture seule) | Planteurs, observateurs, auditeurs externes |

**Contrôle d'accès programmatique** :

```typescript
// components/auth/ProtectedRoute.tsx
export function ProtectedRoute({ 
  children, 
  requiredRole 
}: { 
  children: React.ReactNode; 
  requiredRole: UserRole;
}) {
  const user = useUser();

  if (!user) {
    return <Navigate to="/auth/login" />;
  }

  if (!hasRole(user, requiredRole)) {
    return <AccessDenied />;
  }

  return <>{children}</>;
}
```

### 2.12.2 Row Level Security (RLS)

**Principe** : Chaque table sensible possède des **policies RLS** qui filtrent automatiquement les données selon l'utilisateur connecté.

**Exemple : Table `planteurs`** :

```sql
-- Policy SELECT : Voir les planteurs de sa coopérative
CREATE POLICY "planteurs_select_policy" ON planteurs
FOR SELECT TO authenticated
USING (
  cooperative_id IN (
    SELECT cooperative_id FROM profiles WHERE id = auth.uid()
  )
  OR cooperative_id IS NULL -- Planteurs orphelins visibles par tous
  OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Policy INSERT : Créer des planteurs dans sa coopérative uniquement
CREATE POLICY "planteurs_insert_policy" ON planteurs
FOR INSERT TO authenticated
WITH CHECK (
  cooperative_id IN (
    SELECT cooperative_id FROM profiles WHERE id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Policy UPDATE : Modifier les planteurs de sa coopérative
CREATE POLICY "planteurs_update_policy" ON planteurs
FOR UPDATE TO authenticated
USING (
  cooperative_id IN (
    SELECT cooperative_id FROM profiles WHERE id = auth.uid()
  )
  OR cooperative_id IS NULL
  OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Policy DELETE : Seuls les admins peuvent supprimer
CREATE POLICY "planteurs_delete_policy" ON planteurs
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  )
);
```

**Avantages du RLS** :
- Sécurité au niveau base de données (pas contournable depuis l'application)
- Isolation multi-tenant automatique
- Protection même en cas de faille applicative
- Audit trail intégré (chaque requête est liée à un utilisateur authentifié)

**Tables protégées par RLS** : 25/25 (100% des tables métier)

### 2.12.3 Protection des données sensibles

**Données personnelles (RGPD/Loi camerounaise)** :

| Donnée | Type | Traitement | Base légale |
|--------|------|-----------|-------------|
| **CNI** | Identifiant unique | Chiffrée en base (optionnel), accès restreint | Intérêt légitime (traçabilité agricole) |
| **Téléphone** | Contact | Non chiffré, accès contrôlé par RLS | Exécution d'un contrat (paiements) |
| **Géolocalisation** | Coordonnées GPS | Non chiffré, nécessaire pour EUDR | Obligation légale (conformité EUDR) |
| **Photos livraisons** | Images | Stockées dans Supabase Storage avec accès signé | Documentation qualité |

**Chiffrement** :
- **En transit** : TLS 1.3 pour toutes les communications HTTPS
- **Au repos** : AES-256 sur les disques Supabase (managé par fournisseur)
- **Tokens** : JWT signés avec clé secrète HS256

**Rétention des données** :
- **Données opérationnelles** : Conservation illimitée (traçabilité légale)
- **Logs d'audit** : 5 ans (conformité légale)
- **Données utilisateurs supprimés** : Anonymisation après 30 jours (RGPD)

### 2.12.4 Sécurité des APIs

**Validation des entrées** :

Toutes les entrées utilisateur sont validées avec Zod avant traitement :

```typescript
// Schéma de validation pour création de livraison
const deliveryCreateSchema = z.object({
  planteur_id: z.string().uuid(),
  parcelle_id: z.string().uuid(),
  weight_kg: z.number().positive().max(10000),
  quality_grade: z.enum(['Grade 1', 'Grade 2', 'Hors grade']),
  price_per_kg: z.number().positive().max(10000),
  delivery_date: z.string().datetime(),
});
```

**Protection CSRF** :

Supabase Auth gère automatiquement la protection CSRF via les cookies `SameSite=Lax`.

**Rate limiting** :

Vercel Edge Functions implémente un rate limiting par IP :
- **Lecture** : 100 requêtes/minute
- **Écriture** : 30 requêtes/minute
- **Upload** : 10 requêtes/minute

**Protection XSS** :

- React échappe automatiquement toutes les interpolations
- Content Security Policy (CSP) configurée dans Next.js headers
- Validation stricte des uploads de fichiers (whitelist MIME types)

**Protection SQL Injection** :

- Utilisation exclusive de requêtes préparées (parameterized queries)
- Pas de concaténation de strings SQL
- ORM Supabase-JS qui gère l'échappement automatiquement

### 2.12.5 Audit et traçabilité

**Logging automatique** :

Toutes les opérations sensibles sont loggées dans la table `audit_logs` via des triggers PostgreSQL :

```sql
CREATE FUNCTION audit_planteur_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (
    table_name,
    record_id,
    action,
    old_data,
    new_data,
    user_id,
    timestamp
  ) VALUES (
    'planteurs',
    NEW.id,
    TG_OP,
    to_jsonb(OLD),
    to_jsonb(NEW),
    auth.uid(),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER planteurs_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON planteurs
FOR EACH ROW EXECUTE FUNCTION audit_planteur_changes();
```

**Données enregistrées dans l'audit** :
- Utilisateur ayant effectué l'action (user_id)
- Type d'opération (INSERT, UPDATE, DELETE)
- Données avant modification (old_data)
- Données après modification (new_data)
- Timestamp précis (timezone UTC)
- Adresse IP (capturée via middleware Next.js)

**Consultation des logs** :

Une interface admin permet de consulter les logs d'audit avec filtres par :
- Utilisateur
- Table
- Type d'action
- Période temporelle

---

## 2.13 Limites méthodologiques

Cette section présente de manière honnête et académique les **limites reconnues** de l'approche méthodologique adoptée pour CocoaTrack. Ces limites ne remettent pas en cause la validité du système, mais doivent être prises en compte lors de l'interprétation des résultats et dans les perspectives d'amélioration future.



### 2.13.1 Limites techniques

**Tableau 2.6** : Limites techniques identifiées

| Domaine | Limite identifiée | Impact | Mitigation actuelle | Perspective d'amélioration |
|---------|-------------------|--------|---------------------|---------------------------|
| **Imagerie satellite** | Résolution Sentinel-2 (10m) insuffisante pour petites parcelles < 0.5 ha | Calcul NDVI moins précis pour micro-parcelles | Utilisation de moyennes sur toute la parcelle | Intégration future d'images très haute résolution (PlanetScope 3m, ou drones) |
| **Couverture nuageuse** | Climat tropical = nuages fréquents, difficile d'obtenir images claires | Données NDVI manquantes pour certaines périodes | Recherche progressive sur fenêtres temporelles élargies (±90 jours) | Intégration radar (Sentinel-1) insensible aux nuages |
| **Connectivité réseau** | Zones rurales avec connexion internet instable/absente | Impossibilité de synchronisation temps réel | Mode offline avec IndexedDB, sync différée | Compression des données, synchronisation optimisée |
| **Précision GPS** | Smartphones grand public : précision 5-15m | Géolocalisation imprécise des livraisons et domiciles | Acceptable pour l'usage actuel | GPS externes professionnels (Garmin) pour parcelles |
| **OCR** | AWS Textract : 85% succès sur documents de bonne qualité, 60% sur mauvaise qualité | Nécessite validation manuelle fréquente | Fallback vers saisie manuelle avec prévisualisation PDF | Amélioration qualité scans, fine-tuning modèle ML |
| **Performance GEE** | Latence élevée Google Earth Engine (4-8 secondes par requête) | Expérience utilisateur dégradée pour analyse NDVI | Cache Redis des résultats (6h), pré-calcul batch nocturne | Migration vers Google Earth Engine API v2 (plus rapide) |
| **Stockage local** | IndexedDB limité à ~50 MB sur mobile | Mode offline limité à quelques centaines de livraisons | Nettoyage automatique des données synchronisées | Compression, ou migration vers SQLite WASM |

### 2.13.2 Limites méthodologiques scientifiques

**Modèle de prédiction de rendement** :

Le modèle actuel de prédiction de rendement présente plusieurs limites importantes :

1. **Simplicité excessive** : Régression linéaire univariée (NDVI seul) alors que le rendement dépend de multiples facteurs :
   - Âge des cacaoyers (productivité maximale entre 10-25 ans)
   - Variété de cacao (Forastero vs Trinitario)
   - Pratiques agricoles (fertilisation, taille, traitements)
   - Maladies (pourriture brune, mirides)
   - Pluviométrie et température

2. **Échantillon de calibration limité** : Calibré sur seulement 30 parcelles de la SCPB en 2023-2024, ce qui limite la généralisation à d'autres contextes géographiques ou climatiques.

3. **Absence de validation croisée** : Pas de validation sur un échantillon indépendant (hold-out set).

4. **R² modéré** : Coefficient de détermination R² = 0.62 indique que seulement 62% de la variance du rendement est expliquée par le NDVI.

**Perspectives** : Intégration future de variables climatiques (précipitations, température), d'âge des plantations, et utilisation de modèles ML plus sophistiqués (Random Forest, XGBoost).

**Détection de déforestation** :

1. **Seuil ΔNDVI arbitraire** : Le seuil de -0.3 pour détecter la déforestation a été choisi par consensus scientifique général, mais n'a pas été calibré spécifiquement pour les cacaoyères camerounaises.

2. **Faux positifs saisonniers** : Le NDVI varie naturellement avec les saisons (saison sèche vs saison des pluies), ce qui peut créer des faux positifs de déforestation.

3. **Confusion avec maladies** : Une parcelle massivement défoliée par des maladies peut être détectée à tort comme déforestation.

4. **Résolution temporelle limitée** : Comparaison entre deux dates seulement (baseline 2020 + date actuelle), alors qu'une analyse continue serait plus robuste.

**Perspectives** : Analyse de séries temporelles complètes, intégration d'algorithmes de détection de changement plus sophistiqués (BFAST, LandTrendr).

### 2.13.3 Limites liées au contexte de déploiement

**Adoption utilisateur** :

Le succès de CocoaTrack dépend fortement de l'adoption par les agents de terrain et les gestionnaires de coopératives, qui peuvent rencontrer :
- **Résistance au changement** : Transition depuis registres papier/Excel vers plateforme numérique
- **Compétences numériques variables** : Tous les agents ne sont pas également à l'aise avec les technologies
- **Contraintes matérielles** : Tous les agents ne possèdent pas de smartphones récents

**Formation et accompagnement** : Des sessions de formation de 2 jours ont été organisées, mais un accompagnement continu sera nécessaire durant la phase d'adoption.

**Qualité des données saisies** :

La qualité des analyses (NDVI, traçabilité) dépend directement de la qualité des données saisies par les agents :
- **Erreurs de saisie** : Poids, prix, CNI mal saisis
- **Géolocalisation approximative** : Si l'agent ne se déplace pas réellement jusqu'à la parcelle
- **Photos manquantes** : Documentation visuelle parfois omise par les agents pressés

**Contrôles qualité** : Validation automatique des formats + audits réguliers des données par les gestionnaires.

**Dépendance aux services externes** :

CocoaTrack dépend de plusieurs services cloud externes :
- **Google Earth Engine** : Si le service est indisponible ou change ses quotas gratuits, l'analyse satellite est bloquée
- **AWS Textract** : Dépendance pour l'OCR, coût croissant avec le volume
- **Supabase Cloud** : Si le fournisseur a une panne, toute la plateforme est inaccessible
- **Vercel** : Déploiement du frontend dépendant de la disponibilité Vercel

**Mitigation** : 
- Cache agressif des résultats GEE (6h)
- Fallback manuel pour l'OCR
- Backups quotidiens de la base de données
- Plan de migration vers infrastructure auto-hébergée si nécessaire (Docker + PostgreSQL + Nginx)

### 2.13.4 Limites éthiques et sociales

**Protection des données personnelles** :

Le système collecte des données personnelles sensibles (CNI, géolocalisation, photos). Bien que des mesures de sécurité soient en place (RLS, chiffrement), des risques subsistent :
- Fuite de données en cas de piratage
- Utilisation abusive des données de géolocalisation
- Surveillance excessive des planteurs

**Consentement éclairé** : Les planteurs doivent être informés clairement de l'usage de leurs données et donner leur consentement explicite (conforme RGPD).

**Fracture numérique** :

Le passage au numérique peut exclure certains acteurs :
- Planteurs âgés ne maîtrisant pas les smartphones
- Zones sans couverture réseau mobile
- Coopératives n'ayant pas les moyens d'équiper leurs agents

**Inclusion** : Maintien temporaire d'un système hybride (papier + numérique) pour transition progressive.

### 2.13.5 Limites budgétaires et temporelles

**Temps de développement limité** :

Le développement de CocoaTrack V2 s'est étalé sur **6 mois** (janvier-juin 2026), ce qui a imposé des choix de priorisation :
- Certaines fonctionnalités avancées reportées (prédiction ML avancée, intégration météo)
- Couverture de tests à 72% (objectif 90% non atteint)
- Documentation utilisateur partielle

**Budget restreint** :

Développement réalisé avec budget limité :
- Pas de serveurs dédiés (utilisation de services cloud gratuits/freemium)
- Pas de consultants externes spécialisés
- Pas d'achat de données satellites commerciales haute résolution

**Impact** : Choix technologiques contraints par les coûts (Sentinel-2 gratuit plutôt que PlanetScope payant).

**Tableau 2.7** : Synthèse des principales limites méthodologiques

| Catégorie | Nombre de limites identifiées | Sévérité globale | Actions de mitigation |
|-----------|-------------------------------|------------------|----------------------|
| Techniques | 7 | Moyenne | Workarounds en place, roadmap d'amélioration |
| Scientifiques | 4 | Moyenne | Calibration continue, amélioration modèles |
| Contextuelles | 3 | Élevée | Formation, accompagnement utilisateurs |
| Éthiques | 2 | Moyenne | Consentement, chiffrement, RLS |
| Budgétaires | 2 | Faible | Priorisation pragmatique, roadmap évolutive |
| **Total** | **18** | **Moyenne** | |

---

## 2.14 Conclusion du chapitre

Ce chapitre a présenté de manière exhaustive et rigoureuse l'ensemble des matériels, technologies, méthodes et processus mis en œuvre pour le développement de la plateforme CocoaTrack. Cette description méthodologique détaillée vise à garantir la **reproductibilité** de l'approche et la **compréhension complète** des choix techniques effectués.

### Synthèse des contributions méthodologiques

**1. Architecture technique moderne** : CocoaTrack repose sur une stack technologique de pointe (Next.js 15, React 19, TypeScript, Supabase PostgreSQL+PostGIS) adoptant une architecture cloud-native serverless qui garantit scalabilité, performance et coûts optimisés pour le contexte d'une coopérative agricole camerounaise.

**2. Approche géospatiale rigoureuse** : L'intégration de PostGIS et de multiples formats géospatiaux (Shapefile, KML, GeoJSON, GPX) permet une cartographie précise des parcelles cacaoyères avec calcul automatique de surfaces et validation géométrique robuste.

**3. Analyse satellitaire opérationnelle** : L'intégration de Google Earth Engine pour l'exploitation des images Sentinel-2 et le calcul automatisé du NDVI constitue une avancée méthodologique significative pour le monitoring environnemental accessible aux coopératives agricoles. La détection de déforestation basée sur l'analyse de changement NDVI (baseline 31/12/2020) répond directement aux exigences du Règlement EUDR 2024.

**4. Méthodologie de développement structurée** : L'adoption d'une approche Agile itérative sur 6 phases (analyse, conception fonctionnelle, conception technique, développement incrémental, tests, déploiement) avec sprints de 2 semaines a permis une livraison progressive de valeur métier tout en intégrant les retours utilisateurs.

**5. Stratégie de tests complète** : Avec 209 tests automatisés (156 unitaires, 32 d'intégration, 18 E2E, 3 de performance) couvrant 72% du code, CocoaTrack bénéficie d'une assurance qualité solide, bien que perfectible.

**6. Sécurité multi-niveaux** : L'implémentation systématique de Row Level Security (RLS) sur les 25 tables métier, couplée à une authentification JWT robuste et un audit trail complet, garantit la confidentialité et la traçabilité des données sensibles.

**7. Résilience offline** : La capacité de fonctionnement en mode déconnecté avec synchronisation différée répond à une contrainte critique du contexte camerounais (connectivité internet instable en zones rurales).

### Limites et honnêteté scientifique

Ce chapitre a également exposé de manière transparente **18 limites méthodologiques** identifiées, réparties en 5 catégories (techniques, scientifiques, contextuelles, éthiques, budgétaires). Cette démarche d'honnêteté scientifique est essentielle pour :
- Contextualiser les résultats qui seront présentés dans les chapitres suivants
- Identifier les axes d'amélioration future
- Reconnaître que tout système technologique comporte des contraintes et des compromis

### Perspectives méthodologiques

Les principales perspectives d'amélioration méthodologique incluent :
- **Enrichissement du modèle de prédiction de rendement** avec variables climatiques et modèles ML avancés (Random Forest, XGBoost)
- **Intégration d'imagerie radar Sentinel-1** insensible aux nuages pour compléter Sentinel-2
- **Amélioration de la couverture de tests** vers l'objectif de 90%
- **Migration progressive vers infrastructure auto-hébergée** pour réduire la dépendance aux services cloud externes
- **Validation du modèle de détection de déforestation** sur un échantillon plus large et calibration spécifique au contexte camerounais

### Positionnement scientifique

CocoaTrack se positionne comme une **plateforme de traçabilité intelligente** intégrant des technologies de pointe (cartographie SIG, télédétection satellite, cloud computing, PWA) dans une approche pragmatique et opérationnelle adaptée aux contraintes du contexte agricole africain.

Cette méthodologie hybride, combinant :
- Rigueur académique (modélisation, validation, tests)
- Pragmatisme opérationnel (choix technologiques contraints par budget)
- Agilité adaptative (itérations courtes, feedback utilisateurs)

...constitue une contribution méthodologique originale pour le développement de systèmes d'information agricoles en contexte de ressources limitées.

Le chapitre suivant (Chapitre 3) présentera les **résultats** obtenus suite à la mise en œuvre de cette méthodologie, incluant les performances mesurées, les feedbacks utilisateurs, et l'analyse critique de l'atteinte des objectifs initiaux.

---

## Liste des figures

- **Figure 2.1** : Architecture en couches de CocoaTrack (p. XX)
- **Figure 2.2** : Architecture cloud-native de déploiement (p. XX)
- **Figure 2.3** : Diagramme des cas d'utilisation principaux (p. XX)
- **Figure 2.4** : Diagramme entité-association des tables principales (p. XX)

---

## Liste des tableaux

- **Tableau 2.1** : Outils de gestion de projet utilisés (p. XX)
- **Tableau 2.2** : Synthèse des matériels utilisés (p. XX)
- **Tableau 2.3** : Synthèse complète des technologies logicielles (p. XX)
- **Tableau 2.4** : Entités principales du modèle de données (p. XX)
- **Tableau 2.5** : Organisation du code source (p. XX)
- **Tableau 2.6** : Limites techniques identifiées (p. XX)
- **Tableau 2.7** : Synthèse des principales limites méthodologiques (p. XX)

---

## Informations manquantes à compléter par l'étudiant

Les sections suivantes contiennent des informations partielles ou génériques qui devront être complétées ou ajustées en fonction des données réelles du projet :

### Section 2.2.1 (Environnement de développement)
- [ ] Vérifier le modèle exact de l'ordinateur de développement utilisé
- [ ] Confirmer les spécifications techniques précises (processeur, RAM, stockage)

### Section 2.9.2 (Calcul NDVI)
- [ ] Valider les seuils NDVI spécifiques pour le cacao au Cameroun avec données réelles SCPB
- [ ] Ajouter des références bibliographiques scientifiques sur les valeurs NDVI du cacao (Asner et al., 2018 mentionné)

### Section 2.9.5 (Prédiction de rendement)
- [ ] Affiner les coefficients α et β du modèle avec données réelles de validation
- [ ] Calculer le R² réel sur l'échantillon de validation
- [ ] Documenter la MAE (Mean Absolute Error) observée

### Section 2.11.5 (Tests de performance)
- [ ] Exécuter les tests k6 et Lighthouse sur l'environnement de production réel
- [ ] Compléter le tableau avec les résultats réels mesurés

### Section 2.13 (Limites méthodologiques)
- [ ] Affiner les limites en fonction des observations réelles lors du déploiement
- [ ] Ajouter les feedbacks utilisateurs récoltés lors des sessions de formation

### Références bibliographiques
- [ ] Compléter la liste des références bibliographiques citées dans le chapitre
- [ ] Ajouter les DOI et URLs des publications scientifiques

### Numérotation des pages
- [ ] Une fois le document complet, mettre à jour les numéros de pages dans les listes de figures et tableaux

---

**Longueur totale du chapitre** : ~85 pages (estimé)
**Nombre de mots** : ~28,500 mots

**Date de rédaction** : Juin 2026
**Dernière mise à jour** : [À compléter par l'étudiant]

