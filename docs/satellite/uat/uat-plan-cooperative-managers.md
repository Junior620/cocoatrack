# UAT Plan: Satellite Imagery Analysis — Cooperative Managers
# Plan de Test d'Acceptation Utilisateur : Analyse d'Imagerie Satellitaire — Gestionnaires de Coopératives

**Document Version / Version du document**: 1.0  
**Date**: 2025  
**Feature / Fonctionnalité**: Satellite Imagery Analysis Integration  
**Platform / Plateforme**: CocoaTrack  
**Prepared by / Préparé par**: CocoaTrack Development Team  

---

## 1. Overview / Vue d'ensemble

### 1.1 Purpose / Objectif

This User Acceptance Testing (UAT) plan defines the approach for validating the satellite imagery analysis feature of CocoaTrack with real cooperative managers. The goal is to confirm that the feature meets business requirements and is usable by the target audience before production release.

*Ce plan de Test d'Acceptation Utilisateur (TAU) définit l'approche pour valider la fonctionnalité d'analyse d'imagerie satellitaire de CocoaTrack avec de vrais gestionnaires de coopératives. L'objectif est de confirmer que la fonctionnalité répond aux exigences métier et est utilisable par le public cible avant la mise en production.*

### 1.2 Scope / Périmètre

The UAT covers the following capabilities:

- **Satellite imagery display** on parcelle maps (overlay, opacity control, toggle)
- **Health status indicators** (badges, color coding, filtering)
- **Map interactions** (Leaflet and Google Maps with satellite overlay)
- **Temporal slider** for historical imagery navigation
- **Error states and offline behavior**

*Le TAU couvre les fonctionnalités suivantes :*

- *Affichage de l'imagerie satellitaire sur les cartes de parcelles (superposition, contrôle d'opacité, activation/désactivation)*
- *Indicateurs d'état de santé (badges, code couleur, filtrage)*
- *Interactions cartographiques (Leaflet et Google Maps avec superposition satellitaire)*
- *Curseur temporel pour la navigation dans les images historiques*
- *États d'erreur et comportement hors ligne*

### 1.3 Out of Scope / Hors périmètre

- NDVI calculation internals and algorithm validation (covered by technical testing)
- Deforestation detection accuracy (covered by agronomist UAT)
- KML export and certification reports (covered by auditor UAT)
- Backend API performance testing (covered by load testing)

---

## 2. Objectives / Objectifs

### 2.1 Primary Objectives / Objectifs principaux

1. Validate that cooperative managers can successfully view satellite imagery overlays on parcelle maps.
2. Confirm that health status indicators are understandable and actionable without technical knowledge.
3. Verify that the temporal slider enables effective monitoring of vegetation changes over time.
4. Identify usability issues that could prevent adoption by cooperative managers in Cameroon.
5. Collect quantitative and qualitative feedback to prioritize improvements.

### 2.2 Success Criteria / Critères de succès

| Criterion | Target |
|-----------|--------|
| Task completion rate | ≥ 80% of test scenarios completed successfully |
| User satisfaction score | Average ≥ 4.0 / 5.0 |
| Critical issues found | 0 blocking issues at release |
| Health status comprehension | ≥ 90% of participants correctly interpret all 5 status levels |
| Feature adoption intent | ≥ 80% of participants indicate they would use the feature monthly |

---

## 3. Participant Recruitment / Recrutement des participants

### 3.1 Target Profile / Profil cible

**Number of participants / Nombre de participants**: 3 to 5 cooperative managers  
**Role / Rôle**: Cooperative Manager (Gestionnaire de Coopérative) in CocoaTrack  
**Location / Localisation**: Cameroon (Centre, Sud, Littoral, or Ouest regions preferred)

### 3.2 Inclusion Criteria / Critères d'inclusion

Participants must meet ALL of the following criteria:

- [ ] Active CocoaTrack account with Cooperative Manager role
- [ ] Responsible for at least 10 parcelles in the system
- [ ] Uses CocoaTrack at least twice per month
- [ ] Has access to a smartphone or computer with internet connectivity
- [ ] Available for a 90-minute testing session
- [ ] Willing to provide honest feedback (signed consent form)

*Les participants doivent répondre à TOUS les critères suivants :*

- [ ] *Compte CocoaTrack actif avec le rôle de Gestionnaire de Coopérative*
- [ ] *Responsable d'au moins 10 parcelles dans le système*
- [ ] *Utilise CocoaTrack au moins deux fois par mois*
- [ ] *Dispose d'un smartphone ou d'un ordinateur avec connexion internet*
- [ ] *Disponible pour une session de test de 90 minutes*
- [ ] *Prêt à fournir des retours honnêtes (formulaire de consentement signé)*

### 3.3 Exclusion Criteria / Critères d'exclusion

- Members of the CocoaTrack development or product team
- Participants who have already seen the satellite imagery feature in a demo
- Participants with less than 3 months of CocoaTrack experience

### 3.4 Recruitment Process / Processus de recrutement

1. **Identify candidates** from the CocoaTrack user database (filter by role = cooperative_manager, last_login within 30 days).
2. **Contact candidates** via email or phone with a brief description of the UAT session.
3. **Screen candidates** using the inclusion/exclusion criteria checklist.
4. **Confirm participation** with a calendar invitation and pre-session instructions.
5. **Send reminder** 24 hours before the session.

**Recruitment timeline**: Begin recruitment at least 2 weeks before the first UAT session.

### 3.5 Incentives / Incitatifs

Participants will receive:
- Priority access to the satellite imagery feature upon release
- A summary report of the UAT findings (anonymized)
- Recognition in the CocoaTrack release notes (optional, with consent)

---

## 4. Test Environment / Environnement de test

### 4.1 Environment Setup / Configuration de l'environnement

**Environment**: UAT / Staging (not production)  
**URL**: `https://staging.cocoatrack.app` (or as configured)  
**Data**: Pre-loaded test parcelles with satellite imagery data for Cameroon

### 4.2 Pre-Session Setup Checklist / Liste de vérification avant la session

**For the test facilitator / Pour le facilitateur de test**:

- [ ] Staging environment is deployed and accessible
- [ ] Test user accounts created for each participant (with Cooperative Manager role)
- [ ] Test parcelles loaded with satellite imagery data (at least 20 parcelles per account)
- [ ] NDVI data pre-calculated for all test parcelles
- [ ] Health status badges visible on parcelle list
- [ ] At least one parcelle with a deforestation alert (for error state testing)
- [ ] At least one parcelle with no satellite data (for fallback message testing)
- [ ] Temporal slider data available for the past 12 months
- [ ] Screen recording software configured (with participant consent)
- [ ] Feedback forms printed or available digitally
- [ ] Backup device available in case of technical issues

**For participants / Pour les participants**:

- [ ] Stable internet connection (minimum 5 Mbps recommended)
- [ ] Modern web browser installed (Chrome 90+, Firefox 88+, Safari 14+, or Edge 90+)
- [ ] Browser cache cleared before the session
- [ ] Login credentials provided by the facilitator

### 4.3 Test Data Requirements / Exigences en données de test

| Data Type | Requirement |
|-----------|-------------|
| Parcelles with satellite imagery | Minimum 15 per test account |
| Parcelles without satellite data | Minimum 2 per test account (to test fallback) |
| Parcelles with health status = Critical | Minimum 2 per test account |
| Parcelles with health status = Excellent | Minimum 2 per test account |
| Temporal data (12 months) | Available for at least 5 parcelles |
| Deforestation alerts | At least 1 pending alert per test account |

---

## 5. Schedule and Logistics / Calendrier et logistique

### 5.1 Session Structure / Structure de la session

Each UAT session is **90 minutes** structured as follows:

| Time | Activity | Duration |
|------|----------|----------|
| 0:00 – 0:10 | Welcome, introduction, and consent | 10 min |
| 0:10 – 0:20 | Context setting and warm-up tasks | 10 min |
| 0:20 – 1:00 | Guided test scenarios (Scenarios 1–6) | 40 min |
| 1:00 – 1:20 | Free exploration and additional scenarios | 20 min |
| 1:20 – 1:30 | Feedback form completion and debrief | 10 min |

### 5.2 Session Modes / Modes de session

**Preferred**: In-person at cooperative offices or CocoaTrack regional offices  
**Alternative**: Remote session via video call (Zoom, Google Meet, or WhatsApp Video)

For remote sessions, participants share their screen so the facilitator can observe interactions.

### 5.3 Roles / Rôles

| Role | Responsibility |
|------|---------------|
| **Facilitator** | Guides the session, reads scenario instructions, observes behavior |
| **Note-taker** | Records observations, issues, and participant comments |
| **Technical support** | Available on standby to resolve environment issues |
| **Participant** | Performs test tasks and provides feedback |

### 5.4 Proposed Schedule / Calendrier proposé

| Session | Date | Participant | Mode |
|---------|------|-------------|------|
| Session 1 | TBD | Participant A | In-person |
| Session 2 | TBD | Participant B | In-person |
| Session 3 | TBD | Participant C | Remote |
| Session 4 | TBD | Participant D | Remote |
| Session 5 | TBD | Participant E | In-person |

*Sessions should be scheduled at least 2 days apart to allow time for issue triage between sessions.*

---

## 6. Facilitation Guidelines / Directives de facilitation

### 6.1 Introduction Script / Script d'introduction

*Read to participants at the start of each session:*

> "Thank you for participating in this testing session for CocoaTrack. Today, we are testing a new feature that shows satellite imagery of your parcelles. We want to understand how easy it is to use and whether it provides useful information for your work.
>
> Important: we are testing the software, not you. There are no right or wrong answers. If something is confusing or doesn't work as you expect, that is valuable feedback for us.
>
> Please think out loud as you work through the tasks — tell us what you are looking at, what you are trying to do, and what you are thinking. We will be taking notes and may record the session (with your permission).
>
> Do you have any questions before we begin?"

*French version / Version française :*

> « Merci de participer à cette session de test pour CocoaTrack. Aujourd'hui, nous testons une nouvelle fonctionnalité qui affiche des images satellitaires de vos parcelles. Nous voulons comprendre si elle est facile à utiliser et si elle fournit des informations utiles pour votre travail.
>
> Important : nous testons le logiciel, pas vous. Il n'y a pas de bonnes ou mauvaises réponses. Si quelque chose est confus ou ne fonctionne pas comme vous l'attendez, c'est un retour précieux pour nous.
>
> Veuillez penser à voix haute pendant les tâches — dites-nous ce que vous regardez, ce que vous essayez de faire et ce que vous pensez. Nous prendrons des notes et pourrons enregistrer la session (avec votre permission).
>
> Avez-vous des questions avant de commencer ? »

### 6.2 Observer Guidelines / Directives pour les observateurs

- Do NOT help participants unless they are completely stuck and ask for help.
- Record exact quotes when participants express confusion or satisfaction.
- Note the time when issues occur.
- Do not react visibly to participant mistakes or confusion.
- If a participant asks "Am I doing this right?", respond: "What do you think you should do?"

---

## 7. Issue Classification / Classification des problèmes

| Severity | Definition | Example |
|----------|-----------|---------|
| **Critical** | Prevents task completion; blocks release | Satellite overlay crashes the browser |
| **High** | Significantly impairs task completion | Health status colors are indistinguishable |
| **Medium** | Causes confusion but task can be completed | Opacity slider label is unclear |
| **Low** | Minor cosmetic or wording issue | Button text could be more descriptive |
| **Enhancement** | Suggestion for improvement beyond current scope | Add a "compare two dates" feature |

---

## 8. Exit Criteria / Critères de sortie

UAT is considered complete when:

- [ ] All 3–5 participants have completed their sessions
- [ ] All test scenarios have been executed at least 3 times
- [ ] All Critical and High severity issues have been logged
- [ ] Feedback forms collected from all participants
- [ ] UAT results document completed
- [ ] Issue log reviewed by product owner
- [ ] Go/No-Go decision made by product owner

---

## 9. Deliverables / Livrables

| Deliverable | Owner | Due Date |
|-------------|-------|----------|
| UAT Test Scenarios document | Dev Team | Before first session |
| Feedback Form | Dev Team | Before first session |
| UAT Results Template | Dev Team | Before first session |
| Session recordings (if consented) | Facilitator | After each session |
| Issue log | Note-taker | Within 24h of each session |
| UAT Results Report | Product Owner | Within 1 week of last session |
| Go/No-Go recommendation | Product Owner | Within 1 week of last session |

---

## 10. References / Références

- CocoaTrack Satellite Imagery Analysis — Requirements Document
- CocoaTrack Satellite Imagery Analysis — Design Document
- Test Scenarios: `docs/satellite/uat/test-scenarios-cooperative-managers.md`
- Feedback Form: `docs/satellite/uat/feedback-form-cooperative-managers.md`
- Results Template: `docs/satellite/uat/uat-results-template.md`
