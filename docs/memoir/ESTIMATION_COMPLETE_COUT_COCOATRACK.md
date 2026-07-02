# ESTIMATION COMPLÈTE DU COÛT DU PROJET COCOATRACK

**Projet** : Plateforme de traçabilité intelligente et monitoring environnemental par télédétection satellitaire pour la conformité ESG — Application à la filière cacao de la SCPB (CocoaTrack)

**Contexte** : Mémoire de Master 2 — Analyse budgétaire complète

**Date** : 27 juin 2026

**Auteur** : Étudiant Master 2 en Ingénierie Logicielle

---

## Table des Matières

- [Section A : Hypothèses de calcul](#section-a--hypothèses-de-calcul)
- [Section B : Coût de développement initial](#section-b--coût-de-développement-initial)
- [Section C : Coût d'infrastructure cloud](#section-c--coût-dinfrastructure-cloud)
- [Section D : Coût matériel terrain](#section-d--coût-matériel-terrain)
- [Section E : Coût formation et accompagnement](#section-e--coût-formation-et-accompagnement)
- [Section F : Coût de maintenance annuelle](#section-f--coût-de-maintenance-annuelle)
- [Section G : Synthèse globale](#section-g--synthèse-globale)
- [Section H : Analyse CAPEX / OPEX](#section-h--analyse-capex--opex)
- [Section I : Risques budgétaires](#section-i--risques-budgétaires)
- [Section J : Recommandation finale](#section-j--recommandation-finale)

---

## SECTION A : HYPOTHÈSES DE CALCUL

### A.1 Scénarios d'utilisation

Trois scénarios ont été définis pour modéliser les différentes phases de déploiement :

| Paramètre | MVP Mémoire | Pilote SCPB | Production Réelle |
|-----------|-------------|-------------|-------------------|
| **Utilisateurs actifs** | 10 | 25 | 100 |
| - Administrateurs | 1 | 2 | 5 |
| - Gestionnaires | 2 | 5 | 15 |
| - Agents terrain | 5 | 15 | 70 |
| - Auditeurs/Viewers | 2 | 3 | 10 |
| **Producteurs** | 150 | 500 | 2 500 |
| - Chef planteurs | 30 | 100 | 500 |
| - Planteurs individuels | 120 | 400 | 2 000 |
| **Parcelles** | 600 | 2 000 | 10 000 |
| **Livraisons mensuelles** | 200 | 800 | 4 000 |
| **Documents OCR/mois** | 20 | 80 | 400 |
| **Stockage fichiers** | 5 GB | 50 GB | 500 GB |
| **Requêtes API/mois** | 50 000 | 200 000 | 1 000 000 |
| **Analyses satellite/mois** | 100 | 300 | 1 500 |
| **Rapports EUDR/mois** | 10 | 30 | 150 |
| **Durée développement** | 6 mois | 6 mois + 2 mois pilote | 6 mois + 4 mois production |
| **Durée maintenance** | N/A (projet académique) | 12 mois | 36 mois+ |

**Tableau A.1** : Scénarios d'utilisation CocoaTrack

### A.2 Taux de conversion utilisés

Les montants sont présentés en trois devises pour faciliter la lecture :

| Devise | Taux de conversion | Date de référence |
|--------|-------------------|-------------------|
| **FCFA (XAF)** | 1 EUR = 655,957 FCFA | 27 juin 2026 |
| **EUR (€)** | 1 EUR = 1 EUR | - |
| **USD ($)** | 1 EUR = 1,09 USD | 27 juin 2026 |

**Tableau A.2** : Taux de conversion monétaires

**Note** : Les taux de conversion sont basés sur les taux officiels de la Banque Centrale Européenne au 27 juin 2026. Pour les calculs budgétaires académiques, nous utilisons l'EUR comme devise de référence, puis convertissons en FCFA (devise locale camerounaise) et USD (référence internationale).

### A.3 Période de référence

- **Développement initial** : Janvier 2026 - Juin 2026 (6 mois)
- **Phase pilote** : Juillet 2026 - Août 2026 (2 mois)
- **Année 1** : Juillet 2026 - Juin 2027 (12 mois)
- **Année 2** : Juillet 2027 - Juin 2028 (12 mois)
- **Année 3** : Juillet 2028 - Juin 2029 (12 mois)

### A.4 Hypothèses sur les tarifs

**Développement** :
- Tarifs basés sur le marché camerounais et ouest-africain
- Profils juniors : développement académique et stage
- Mix junior/senior pour expertise technique spécialisée

**Infrastructure cloud** :
- Tarifs officiels vérifiés le 27 juin 2026
- Sources : Vercel Pricing, Supabase Pricing, AWS Pricing, GEE Pricing

**Matériel** :
- Prix marché camerounais (Douala, Yaoundé)
- Forfaits data : opérateurs MTN Cameroun, Orange Cameroun

---

## SECTION B : COÛT DE DÉVELOPPEMENT INITIAL

### B.1 Équipe de développement

| Profil | Qualification | TJM (EUR) | TJM (FCFA) | Durée (jours) | Coût total (EUR) | Coût total (FCFA) |
|--------|---------------|-----------|------------|---------------|------------------|-------------------|
| **Développeur Full-Stack** | Senior | 300 | 196 787 | 120 | 36 000 | 23 614 452 |
| **Développeur Backend/DB** | Intermédiaire | 200 | 131 191 | 60 | 12 000 | 7 871 484 |
| **Expert SIG/Géospatial** | Senior | 350 | 229 585 | 40 | 14 000 | 9 183 398 |
| **Data Analyst/Scientist** | Intermédiaire | 250 | 163 989 | 30 | 7 500 | 4 919 678 |
| **UI/UX Designer** | Junior | 150 | 98 394 | 20 | 3 000 | 1 967 871 |
| **Chef de Projet** | Senior | 280 | 183 668 | 50 | 14 000 | 9 183 398 |
| **Testeur QA** | Junior | 120 | 78 715 | 25 | 3 000 | 1 967 871 |
| **Formateur** | Intermédiaire | 180 | 118 072 | 10 | 1 800 | 1 180 722 |
| **TOTAL** | - | - | - | **355 jours** | **91 300 EUR** | **59 888 874 FCFA** |

**Tableau B.1** : Coûts de développement par profil

**Détail des tâches par profil** :

**1. Développeur Full-Stack (120 jours)**
- Configuration projet Next.js 15 + TypeScript (5 jours)
- Module authentification et gestion utilisateurs (10 jours)
- Module gestion coopératives et producteurs (15 jours)
- Module gestion parcelles avec cartographie (20 jours)
- Module traçabilité livraisons (15 jours)
- Module facturation et génération PDF (15 jours)
- Mode offline avec Service Workers (15 jours)
- Tests unitaires et intégration (15 jours)
- Optimisations performance (10 jours)

**2. Développeur Backend/DB (60 jours)**
- Architecture base de données PostgreSQL + PostGIS (10 jours)
- Migrations SQL et schéma (15 jours)
- Configuration Row Level Security (RLS) sur 25 tables (10 jours)
- RPC et fonctions stockées (10 jours)
- Configuration Supabase (Auth, Storage, Realtime) (5 jours)
- API Routes Next.js et validation (10 jours)

**3. Expert SIG/Géospatial (40 jours)**
- Intégration Leaflet et cartographie interactive (8 jours)
- Parsing fichiers géospatiaux (Shapefile, KML, GeoJSON, GPX) (10 jours)
- Calculs géométriques avec Turf.js (5 jours)
- Intégration Google Earth Engine (10 jours)
- Service NDVI et détection déforestation (7 jours)

**4. Data Analyst/Scientist (30 jours)**
- Analyse des exigences EUDR (5 jours)
- Calibration seuils NDVI pour cacao (7 jours)
- Algorithme détection déforestation (8 jours)
- Modèle prédiction rendement (10 jours)

**5. UI/UX Designer (20 jours)**
- Wireframes et maquettes (8 jours)
- Charte graphique et design system (5 jours)
- Tests utilisabilité (7 jours)

**6. Chef de Projet (50 jours)**
- Planification et roadmap (5 jours)
- Gestion des sprints Agile (30 jours, 2 semaines × 15 sprints)
- Coordination équipe et parties prenantes (10 jours)
- Documentation technique (5 jours)

**7. Testeur QA (25 jours)**
- Tests manuels exploratoires (10 jours)
- Tests E2E avec Playwright (10 jours)
- Tests de performance avec k6 (5 jours)

**8. Formateur (10 jours)**
- Préparation supports de formation (5 jours)
- Sessions de formation utilisateurs (5 jours)

### B.2 Justification des tarifs

**Contexte marché ouest-africain** :

Les tarifs journaliers moyens (TJM) appliqués sont alignés sur le marché ouest-africain francophone (Cameroun, Côte d'Ivoire, Sénégal) pour des profils qualifiés avec expérience internationale :

- **Développeurs juniors** : 120-150 EUR/jour (80 000 - 100 000 FCFA/jour)
- **Développeurs intermédiaires** : 200-250 EUR/jour (130 000 - 165 000 FCFA/jour)
- **Développeurs seniors** : 300-350 EUR/jour (195 000 - 230 000 FCFA/jour)

Ces tarifs sont **inférieurs aux tarifs européens** (où un développeur senior facture 500-800 EUR/jour) mais **supérieurs aux tarifs juniors locaux** (60-100 EUR/jour) car le projet nécessite des compétences spécialisées :
- Maîtrise Next.js 15, TypeScript, PostgreSQL/PostGIS
- Expertise géospatiale (GIS) et télédétection
- Connaissance Google Earth Engine et AWS Textract

**Source des tarifs** : Étude de marché basée sur des plateformes de freelancing (Malt Africa, Upwork, LinkedIn) et agences de développement camerounaises (consultées en juin 2026).

### B.3 Synthèse développement initial

| Poste | Coût (EUR) | Coût (FCFA) | Coût (USD) |
|-------|------------|-------------|------------|
| **Équipe développement** | 91 300 | 59 888 874 | 99 517 |
| **Licences et outils** (Git, Figma, Notion) | 500 | 327 979 | 545 |
| **Infrastructure de test** (Supabase local, seeds) | 0 | 0 | 0 |
| **Contingence 10%** | 9 180 | 6 021 665 | 10 006 |
| **TOTAL DÉVELOPPEMENT** | **100 980 EUR** | **66 238 518 FCFA** | **110 068 USD** |

**Tableau B.2** : Synthèse du coût de développement initial

**Note** : La contingence de 10% est appliquée pour couvrir :
- Révisions et ajustements non prévus
- Bugs complexes nécessitant du temps supplémentaire
- Extension de périmètre mineur demandée par la SCPB

---

## SECTION C : COÛT D'INFRASTRUCTURE CLOUD

### C.1 Services d'hébergement et infrastructure

#### C.1.1 Vercel (Hébergement Frontend)

| Plan | MVP Mémoire | Pilote SCPB | Production Réelle |
|------|-------------|-------------|-------------------|
| **Plan** | Hobby (gratuit) | Pro | Pro |
| **Coût mensuel (USD)** | 0 | 20 | 20 |
| **Coût mensuel (EUR)** | 0 | 18,35 | 18,35 |
| **Coût mensuel (FCFA)** | 0 | 12 037 | 12 037 |
| **Inclus** | - 100 GB bande passante<br>- Déploiements illimités<br>- SSL automatique | - 1 TB bande passante<br>- Analytics avancés<br>- Support prioritaire | Idem |
| **Dépassement bande passante** | N/A | 40 USD/TB | 40 USD/TB |
| **Coût annuel (EUR)** | **0** | **220,20** | **220,20** |
| **Coût annuel (FCFA)** | **0** | **144 444** | **144 444** |

**Source** : [Vercel Pricing](https://vercel.com/pricing) — Consultée le 27 juin 2026

#### C.1.2 Supabase (Backend-as-a-Service)

| Service | MVP Mémoire | Pilote SCPB | Production Réelle |
|---------|-------------|-------------|-------------------|
| **Plan** | Free | Pro | Pro |
| **Coût mensuel (USD)** | 0 | 25 | 25 |
| **Coût mensuel (EUR)** | 0 | 22,94 | 22,94 |
| **Coût mensuel (FCFA)** | 0 | 15 046 | 15 046 |
| **Database** | 500 MB | 8 GB inclus | 8 GB + add-ons |
| **Storage fichiers** | 1 GB | 100 GB inclus | 100 GB + add-ons |
| **Bande passante** | 2 GB | 250 GB inclus | 250 GB + add-ons |
| **Add-on stockage** (si dépassement) | - | 0,125 USD/GB/mois | 50 GB × 0,125 = 6,25 USD/mois |
| **Coût add-on (EUR)** | - | - | 5,73 EUR/mois |
| **Coût add-on (FCFA)** | - | - | 3 759 FCFA/mois |
| **Coût annuel base (EUR)** | **0** | **275,28** | **275,28** |
| **Coût annuel add-ons (EUR)** | **0** | **0** | **68,76** |
| **TOTAL annuel (EUR)** | **0** | **275,28** | **344,04** |
| **TOTAL annuel (FCFA)** | **0** | **180 552** | **225 672** |

**Source** : [Supabase Pricing](https://supabase.com/pricing) — Consultée le 27 juin 2026

**Détail du calcul production** :
- Plan Pro : 25 USD/mois (base)
- Add-on stockage : 50 GB supplémentaires pour atteindre 150 GB total (photos parcelles, factures PDF)
- Formule : (100 GB inclus) + (50 GB × 0,125 USD/GB) = 6,25 USD/mois add-on

#### C.1.3 Cloudflare (CDN, WAF, SSL)

| Service | MVP Mémoire | Pilote SCPB | Production Réelle |
|---------|-------------|-------------|-------------------|
| **Plan** | Free | Pro | Business |
| **Coût mensuel (USD)** | 0 | 20 | 200 |
| **Coût mensuel (EUR)** | 0 | 18,35 | 183,49 |
| **Coût mensuel (FCFA)** | 0 | 12 037 | 120 366 |
| **Inclus** | - SSL universel<br>- CDN global<br>- DDoS protection | - WAF avancé<br>- Image Optimization<br>- Support 24/7 | - WAF ultra<br>- Compliance<br>- SLA 100% |
| **Coût annuel (EUR)** | **0** | **220,20** | **2 201,88** |
| **Coût annuel (FCFA)** | **0** | **144 444** | **1 444 392** |

**Source** : [Cloudflare Pricing](https://www.cloudflare.com/plans/) — Consultée le 27 juin 2026

**Justification du plan Business pour production** :
- WAF (Web Application Firewall) renforcé pour protection contre attaques
- Conformité RGPD et certifications de sécurité requises
- SLA 100% uptime garanti (critique pour traçabilité EUDR)

### C.2 Services de traitement et analyse

#### C.2.1 Google Earth Engine (GEE)

| Usage | MVP Mémoire | Pilote SCPB | Production Réelle |
|-------|-------------|-------------|-------------------|
| **Type d'usage** | Non-commercial | Non-commercial | Non-commercial |
| **Coût mensuel** | 0 USD | 0 USD | 0 USD |
| **Coût annuel (EUR)** | **0** | **0** | **0** |
| **Quotas** | 250 000 requêtes/jour | 250 000 requêtes/jour | 250 000 requêtes/jour |
| **Volume estimé** | 100 analyses/mois<br>(~3/jour) | 300 analyses/mois<br>(~10/jour) | 1 500 analyses/mois<br>(~50/jour) |
| **Dépassement** | Non | Non | Non |

**Source** : [Google Earth Engine Pricing](https://earthengine.google.com/noncommercial/) — Consultée le 27 juin 2026

**Note critique** : L'usage de GEE est **gratuit pour usage non-commercial** (recherche, éducation, organisations à but non lucratif). La SCPB étant une coopérative agricole (organisation à but non lucratif au sens juridique camerounais), l'usage reste non-commercial. Si CocoaTrack devait être commercialisé comme SaaS, un passage à **GEE Commercial** serait nécessaire (coût : nous contacter, estimation 500-2 000 USD/mois selon usage).

#### C.2.2 AWS Textract (OCR)

| Paramètre | MVP Mémoire | Pilote SCPB | Production Réelle |
|-----------|-------------|-------------|-------------------|
| **Documents OCR/mois** | 20 pages | 80 pages | 400 pages |
| **Coût par page** | 1,50 USD/1000 pages | 1,50 USD/1000 pages | 1,50 USD/1000 pages |
| **Coût mensuel (USD)** | 0,03 | 0,12 | 0,60 |
| **Coût mensuel (EUR)** | 0,03 | 0,11 | 0,55 |
| **Coût mensuel (FCFA)** | 20 | 72 | 361 |
| **Coût annuel (EUR)** | **0,36** | **1,32** | **6,60** |
| **Coût annuel (FCFA)** | **236** | **866** | **4 329** |

**Source** : [AWS Textract Pricing](https://aws.amazon.com/textract/pricing/) (Région EU-West-1) — Consultée le 27 juin 2026

**Calcul détaillé** :
- MVP : 20 pages/mois × 1,50 USD/1000 = 0,03 USD/mois
- Pilote : 80 pages/mois × 1,50 USD/1000 = 0,12 USD/mois
- Production : 400 pages/mois × 1,50 USD/1000 = 0,60 USD/mois

### C.3 Services annexes

#### C.3.1 Sentry (Monitoring erreurs)

| Plan | MVP Mémoire | Pilote SCPB | Production Réelle |
|------|-------------|-------------|-------------------|
| **Plan** | Developer (gratuit) | Team | Team |
| **Coût mensuel (USD)** | 0 | 26 | 26 |
| **Coût mensuel (EUR)** | 0 | 23,85 | 23,85 |
| **Coût mensuel (FCFA)** | 0 | 15 645 | 15 645 |
| **Events/mois inclus** | 5 000 | 50 000 | 50 000 |
| **Coût annuel (EUR)** | **0** | **286,20** | **286,20** |
| **Coût annuel (FCFA)** | **0** | **187 740** | **187 740** |

**Source** : [Sentry Pricing](https://sentry.io/pricing/) — Consultée le 27 juin 2026

#### C.3.2 Domaine et SSL

| Service | Coût annuel (EUR) | Coût annuel (FCFA) |
|---------|-------------------|-------------------|
| **Nom de domaine** (.com ou .cm) | 12 | 7 871 |
| **Certificat SSL** | 0 (inclus Cloudflare) | 0 |
| **TOTAL** | **12** | **7 871** |

### C.4 Synthèse des coûts d'infrastructure cloud

#### Tableau récapitulatif mensuel

| Service | MVP (EUR/mois) | Pilote (EUR/mois) | Production (EUR/mois) |
|---------|----------------|-------------------|----------------------|
| Vercel | 0 | 18,35 | 18,35 |
| Supabase | 0 | 22,94 | 28,67 |
| Cloudflare | 0 | 18,35 | 183,49 |
| Google Earth Engine | 0 | 0 | 0 |
| AWS Textract | 0,03 | 0,11 | 0,55 |
| Sentry | 0 | 23,85 | 23,85 |
| **TOTAL MENSUEL** | **0,03 EUR** | **83,60 EUR** | **254,91 EUR** |
| **TOTAL MENSUEL (FCFA)** | **20 FCFA** | **54 831 FCFA** | **167 231 FCFA** |
| **TOTAL MENSUEL (USD)** | **0,03 USD** | **91,12 USD** | **277,85 USD** |

**Tableau C.1** : Coûts mensuels d'infrastructure par scénario

#### Tableau récapitulatif annuel

| Service | MVP (EUR/an) | Pilote (EUR/an) | Production (EUR/an) |
|---------|--------------|-----------------|---------------------|
| Vercel | 0 | 220,20 | 220,20 |
| Supabase | 0 | 275,28 | 344,04 |
| Cloudflare | 0 | 220,20 | 2 201,88 |
| Google Earth Engine | 0 | 0 | 0 |
| AWS Textract | 0,36 | 1,32 | 6,60 |
| Sentry | 0 | 286,20 | 286,20 |
| Domaine | 12 | 12 | 12 |
| **TOTAL ANNUEL** | **12,36 EUR** | **1 015,20 EUR** | **3 070,92 EUR** |
| **TOTAL ANNUEL (FCFA)** | **8 108 FCFA** | **666 011 FCFA** | **2 014 482 FCFA** |
| **TOTAL ANNUEL (USD)** | **13,47 USD** | **1 106,57 USD** | **3 347,30 USD** |

**Tableau C.2** : Coûts annuels d'infrastructure par scénario

---

## SECTION D : COÛT MATÉRIEL TERRAIN

### D.1 Équipement pour agents de terrain

| Matériel | Quantité MVP | Quantité Pilote | Quantité Production | Prix unitaire (EUR) | Prix unitaire (FCFA) | Coût MVP (EUR) | Coût Pilote (EUR) | Coût Production (EUR) |
|----------|--------------|-----------------|---------------------|---------------------|----------------------|----------------|-------------------|----------------------|
| **Smartphones Android** (8 Go RAM, GPS, 4G) | 2 | 5 | 20 | 180 | 118 072 | 360 | 900 | 3 600 |
| **Batteries externes** (20 000 mAh) | 2 | 5 | 20 | 25 | 16 399 | 50 | 125 | 500 |
| **Cartes SIM + forfait data** (10 Go/mois, 12 mois) | 2 | 5 | 20 | 60 | 39 357 | 120 | 300 | 1 200 |
| **GPS externes Garmin** (eTrex 20) | 1 | 2 | 5 | 150 | 98 394 | 150 | 300 | 750 |
| **Protection smartphones** (coques étanches) | 2 | 5 | 20 | 15 | 9 839 | 30 | 75 | 300 |
| **TOTAL TERRAIN** | - | - | - | - | - | **710 EUR** | **1 700 EUR** | **6 350 EUR** |
| **TOTAL TERRAIN (FCFA)** | - | - | - | - | - | **465 729 FCFA** | **1 115 127 FCFA** | **4 165 325 FCFA** |

**Tableau D.1** : Coût matériel terrain par scénario

### D.2 Équipement pour gestionnaires et administrateurs

| Matériel | Quantité MVP | Quantité Pilote | Quantité Production | Prix unitaire (EUR) | Coût MVP (EUR) | Coût Pilote (EUR) | Coût Production (EUR) |
|----------|--------------|-----------------|---------------------|---------------------|----------------|-------------------|----------------------|
| **Ordinateurs portables** (i5, 8 Go RAM, 256 Go SSD) | 1 | 3 | 10 | 450 | 450 | 1 350 | 4 500 |
| **Imprimantes multifonction** | 0 | 1 | 3 | 180 | 0 | 180 | 540 |
| **Onduleurs** (protection coupures électriques) | 0 | 2 | 5 | 80 | 0 | 160 | 400 |
| **TOTAL BUREAU** | - | - | - | - | **450 EUR** | **1 690 EUR** | **5 440 EUR** |
| **TOTAL BUREAU (FCFA)** | - | - | - | - | **295 181 FCFA** | **1 108 567 FCFA** | **3 568 405 FCFA** |

**Tableau D.2** : Coût matériel bureau par scénario

### D.3 Justification des choix matériels

**Smartphones Android** : 
- Préférence pour Android vs. iOS en raison du coût (rapport qualité/prix)
- Caractéristiques minimales : 8 Go RAM, GPS précis (< 10m), compatibilité 4G, Android 9+
- Modèles recommandés : Samsung Galaxy A33, Xiaomi Redmi Note 12 (disponibles Cameroun)
- Prix moyen constaté : 120 000 - 150 000 FCFA (180-230 EUR) sur le marché camerounais

**Batteries externes** :
- Autonomie critique en zone rurale sans accès électricité
- Capacité 20 000 mAh = 4-5 recharges complètes smartphone

**Forfaits data** :
- Opérateurs : MTN Cameroun, Orange Cameroun
- Forfait 10 Go/mois suffisant pour synchronisation données (mode offline en journée)
- Coût estimé : 5 000 FCFA/mois (7,60 EUR) × 12 mois = 60 EUR/an

**GPS externes Garmin** :
- Précision supérieure (3-5m vs. 10-15m smartphones)
- Réservé aux parcelles nécessitant géolocalisation précise (> 5 ha)
- Usage optionnel : 20% des cas (parcelles critiques pour EUDR)

**Ordinateurs portables** :
- Configuration minimale suffisante pour usage bureautique et consultation dashboards
- Préférence modèles HP, Dell, Lenovo disponibles localement avec support SAV

### D.4 Synthèse matériel

| Scénario | Coût terrain (EUR) | Coût bureau (EUR) | **TOTAL (EUR)** | **TOTAL (FCFA)** | **TOTAL (USD)** |
|----------|-------------------|-------------------|-----------------|------------------|-----------------|
| **MVP Mémoire** | 710 | 450 | **1 160** | **760 910** | **1 264** |
| **Pilote SCPB** | 1 700 | 1 690 | **3 390** | **2 223 694** | **3 695** |
| **Production Réelle** | 6 350 | 5 440 | **11 790** | **7 733 730** | **12 851** |

**Tableau D.3** : Synthèse coûts matériels

**Note** : Le matériel a une durée de vie estimée de **3 ans**. Un renouvellement partiel (30% par an) est à prévoir dès l'année 2 pour maintenir les performances et remplacer les équipements défaillants.

---

## SECTION E : COÛT FORMATION ET ACCOMPAGNEMENT

### E.1 Formation initiale des utilisateurs

#### E.1.1 Formation agents de terrain

| Poste | Quantité | Durée unitaire | Coût unitaire (EUR) | Coût total (EUR) | Coût total (FCFA) |
|-------|----------|----------------|---------------------|------------------|-------------------|
| **Formateur** | 1 | 16 heures (2 jours × 8h) | 180 EUR/jour | 360 | 236 145 |
| **Supports pédagogiques** (impression, vidéos) | - | - | - | 100 | 65 596 |
| **Location salle** (si externe) | 1 | 2 jours | 50 EUR/jour | 100 | 65 596 |
| **Rafraîchissements** | 5-20 participants | 2 jours | 5 EUR/participant/jour | 100 | 65 596 |
| **TOTAL FORMATION AGENTS** | - | - | - | **660 EUR** | **432 933 FCFA** |

**Tableau E.1** : Coût formation agents de terrain

**Contenu de la formation agents** :
- Jour 1 : Utilisation application mobile, enregistrement livraisons, géolocalisation parcelles, mode offline
- Jour 2 : Gestion des erreurs courantes, synchronisation données, bonnes pratiques terrain

#### E.1.2 Formation gestionnaires et administrateurs

| Poste | Quantité | Durée unitaire | Coût unitaire (EUR) | Coût total (EUR) | Coût total (FCFA) |
|-------|----------|----------------|---------------------|------------------|-------------------|
| **Formateur** | 1 | 16 heures (2 jours × 8h) | 180 EUR/jour | 360 | 236 145 |
| **Supports pédagogiques** | - | - | - | 100 | 65 596 |
| **Location salle** | 1 | 2 jours | 50 EUR/jour | 100 | 65 596 |
| **TOTAL FORMATION MANAGERS** | - | - | - | **560 EUR** | **367 337 FCFA** |

**Tableau E.2** : Coût formation gestionnaires

**Contenu de la formation gestionnaires** :
- Jour 1 : Gestion producteurs et parcelles, import fichiers CSV/géospatiaux, validation données, génération factures
- Jour 2 : Analyse satellitaire NDVI, détection déforestation, génération rapports EUDR, dashboards et KPIs

### E.2 Documentation utilisateur

| Livrable | Effort (jours) | Coût (EUR) | Coût (FCFA) |
|----------|----------------|------------|-------------|
| **Manuel utilisateur agents** (PDF, 30 pages) | 3 | 540 | 354 217 |
| **Manuel utilisateur gestionnaires** (PDF, 40 pages) | 4 | 720 | 472 289 |
| **Guides vidéo** (10 vidéos × 5 min) | 5 | 900 | 590 361 |
| **FAQ et base de connaissances** (wiki) | 2 | 360 | 236 145 |
| **TOTAL DOCUMENTATION** | 14 jours | **2 520 EUR** | **1 653 012 FCFA** |

**Tableau E.3** : Coût documentation utilisateur

### E.3 Support et accompagnement post-déploiement

#### E.3.1 Accompagnement initial (3 premiers mois)

| Service | Quantité | Coût unitaire (EUR) | Coût total (EUR) | Coût total (FCFA) |
|---------|----------|---------------------|------------------|-------------------|
| **Support technique à distance** (hotline) | 40 heures | 80 EUR/h | 3 200 | 2 099 062 |
| **Visites terrain** (accompagnement agents) | 4 jours | 300 EUR/jour | 1 200 | 787 149 |
| **Maintenance corrective urgente** (bugs critiques) | 10 jours | 300 EUR/jour | 3 000 | 1 967 871 |
| **TOTAL ACCOMPAGNEMENT INITIAL** | - | - | **7 400 EUR** | **4 854 082 FCFA** |

**Tableau E.4** : Coût accompagnement initial (3 mois)

#### E.3.2 Support annuel continu (à partir du 4e mois)

| Service | Fréquence | Coût mensuel (EUR) | Coût annuel (EUR) | Coût annuel (FCFA) |
|---------|-----------|-------------------|-------------------|-------------------|
| **Support technique niveau 1** (hotline, email) | Illimité | 400 | 4 800 | 3 148 594 |
| **Support technique niveau 2** (bugs, investigations) | 10 heures/mois | 800 | 9 600 | 6 297 187 |
| **Visites terrain trimestrielles** | 4/an | 300 (par visite) | 1 200 | 787 149 |
| **TOTAL SUPPORT ANNUEL** | - | - | **15 600 EUR** | **10 232 930 FCFA** |

**Tableau E.5** : Coût support annuel continu

### E.4 Synthèse formation et accompagnement

#### Coûts par scénario

| Poste | MVP (EUR) | Pilote (EUR) | Production (EUR) |
|-------|-----------|--------------|------------------|
| **Formation initiale** | 660 + 560 = 1 220 | 1 220 | 1 220 |
| **Documentation** | 2 520 | 2 520 | 2 520 |
| **Accompagnement initial (3 mois)** | 0 (académique) | 7 400 | 7 400 |
| **Support annuel (9 mois année 1)** | 0 | 11 700 | 11 700 |
| **TOTAL ANNÉE 1** | **3 740 EUR** | **22 840 EUR** | **22 840 EUR** |
| **TOTAL ANNÉE 1 (FCFA)** | **2 453 779 FCFA** | **14 988 161 FCFA** | **14 988 161 FCFA** |

**Tableau E.6** : Synthèse coûts formation et accompagnement année 1

**Support années suivantes** :
- Année 2 : 15 600 EUR (10 232 930 FCFA) — Support annuel complet
- Année 3 : 15 600 EUR (10 232 930 FCFA) — Support annuel complet

---

