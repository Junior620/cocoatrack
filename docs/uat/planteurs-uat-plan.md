# UAT Plan: Planteurs - Satellite Imagery Analysis
# Plan de Tests d'Acceptation Utilisateur : Planteurs

**Feature**: Satellite Imagery Analysis Integration  
**Target Users**: Planteurs (Cocoa Farmers / Agriculteurs de Cacao)  
**Date**: May 2026  
**Version**: 1.0  
**Status**: Ready for Execution

---

## 1. Objectives / Objectifs

### English
The purpose of this UAT is to validate that the satellite imagery analysis features meet the needs of planteurs (cocoa farmers) for monitoring their parcelle health in the field. Specifically, we will test:

1. **Mobile Responsiveness**: Ability to view satellite imagery and health status on mobile devices in the field
2. **Health Status Display**: Clarity and usefulness of the simple health status indicators (Excellent/Good/Fair/Poor/Critical)
3. **Offline Mode**: Ability to access cached satellite data and health information without internet connectivity

### Français
L'objectif de ce test d'acceptation est de valider que les fonctionnalités d'analyse d'imagerie satellitaire répondent aux besoins des planteurs pour surveiller la santé de leurs parcelles sur le terrain. Nous testerons spécifiquement :

1. **Réactivité Mobile**: Capacité à visualiser l'imagerie satellitaire et le statut de santé sur des appareils mobiles sur le terrain
2. **Affichage du Statut de Santé**: Clarté et utilité des indicateurs simples de statut de santé (Excellent/Bon/Moyen/Mauvais/Critique)
3. **Mode Hors Ligne**: Capacité à accéder aux données satellitaires en cache et aux informations de santé sans connexion internet

---

## 2. Participant Recruitment / Recrutement des Participants

### Target Profile / Profil Cible

**Ideal Participants / Participants Idéaux:**
- 3-5 planteurs who own and cultivate cocoa parcelles registered in CocoaTrack
- Primary mobile device users (smartphone, Android preferred)
- Mix of experience levels with smartphones (beginner to intermediate)
- Located in areas with variable internet connectivity (field conditions)
- French-speaking (primary language in Cameroon)

**Recrutement:**
- Contact through cooperative managers already using CocoaTrack
- Reach out through local agricultural extension services
- Prioritize planteurs with 2+ parcelles registered in the system
- Offer compensation for 1.5-hour testing session (e.g., 25,000 FCFA or equivalent)

### Contact Approach / Approche de Contact

**Email / SMS Template:**

```
Objet : Invitation à tester l'application CocoaTrack sur votre téléphone

Bonjour [Nom],

Nous améliorons l'application CocoaTrack pour vous permettre de surveiller la santé de vos parcelles de cacao depuis votre téléphone, même sans connexion internet.

Nous recherchons 3-5 planteurs pour tester cette nouvelle fonctionnalité et nous donner leur avis. La session de test durera environ 1h30 et sera rémunérée.

Seriez-vous disponible pour participer ? Nous pouvons organiser la session dans votre village ou à la coopérative.

Cordialement,
[Votre nom]
```

---

## 3. Test Environment / Environnement de Test

**Platform**: CocoaTrack Staging Environment  
**URL**: https://staging.cocoatrack.cm (or equivalent)  
**Test Devices**: 
- Participant's own smartphone (preferred, to test real-world conditions)
- Backup test devices: Android smartphones (320px-768px screen width)
**Test Account**: Planteur role with access to 2-3 test parcelles  
**Network Conditions**:
- Online testing: Standard mobile data (3G/4G)
- Offline testing: Airplane mode or WiFi disabled

**Test Data Requirements:**
- 3-5 test parcelles with various health statuses:
  - Parcelle with "Excellent" health status (NDVI 0.75)
  - Parcelle with "Good" health status (NDVI 0.65)
  - Parcelle with "Fair" health status (NDVI 0.55)
  - Parcelle with "Poor" health status (NDVI 0.40)
  - Parcelle with "Critical" health status (NDVI 0.20)
- Recent NDVI data (< 30 days old) for all test parcelles
- Cached data pre-loaded for offline testing scenarios
- Temporal data (12 months) for at least 2 parcelles

**Required Setup:**
- Pre-cache test parcelle data before offline testing scenarios
- Ensure health status badges are visible on parcelle list and detail views
- Verify mobile layout renders correctly on test devices

---

## 4. Test Scenarios / Scénarios de Test

### Scenario 1: View Parcelle Health Status on Mobile
### Scénario 1 : Consulter le Statut de Santé de la Parcelle sur Mobile

**Objective / Objectif**: Verify that planteurs can easily view and understand health status indicators on their mobile devices.

**Requirements Tested**: 6.1, 6.2, 6.4, 6.5, 6.6, 18.1, 18.5, 18.6

**Prerequisites / Prérequis**:
- Logged in as planteur on mobile device
- At least 3 parcelles with different health statuses visible

**Test Steps / Étapes de Test**:

1. **Open parcelle list on mobile**
   - Open CocoaTrack on smartphone
   - Navigate to "Mes Parcelles" (My Parcelles) page
   - **Expected**: 
     - Page loads correctly on mobile screen (320px-768px)
     - Each parcelle shows a color-coded health status badge
     - Badges are large enough to read without zooming
     - Colors are clearly distinguishable (green, yellow, orange, red)

2. **Identify health status at a glance**
   - Look at the parcelle list without tapping anything
   - **Expected**:
     - Health status labels are visible: Excellent / Bon / Moyen / Mauvais / Critique
     - Color coding matches: dark green (Excellent), green (Bon), yellow (Moyen), orange (Mauvais), red (Critique)
     - Critical parcelles are visually prominent

3. **View health status details**
   - Tap on a parcelle with "Mauvais" (Poor) status
   - **Expected**:
     - Detail page loads correctly on mobile
     - Health status badge is displayed prominently
     - A simple recommendation is shown (e.g., "Envisagez l'irrigation" / "Consider irrigation")
     - Trend indicator shows if health is improving, stable, or declining

4. **View health trend over 3 months**
   - On the parcelle detail page, find the health trend section
   - **Expected**:
     - Trend is displayed as "En amélioration" / "Stable" / "En déclin"
     - Trend is easy to understand without technical knowledge

5. **Check health status on map popup**
   - Navigate to the map view
   - Tap on a parcelle polygon
   - **Expected**:
     - Popup appears with health status badge
     - Popup is readable on mobile screen
     - Touch target is large enough to tap accurately

**Success Criteria / Critères de Réussite**:
- ✅ Health status is visible and understandable without explanation
- ✅ Color coding is intuitive and distinguishable
- ✅ Recommendations are simple and actionable
- ✅ All elements are readable on mobile without zooming

**Feedback Questions / Questions de Retour**:
1. Est-ce que vous comprenez facilement le statut de santé de votre parcelle ?
2. Les couleurs sont-elles claires et faciles à distinguer ?
3. Les recommandations sont-elles utiles et compréhensibles ?
4. Y a-t-il des informations manquantes que vous aimeriez voir ?

---

### Scenario 2: View Satellite Imagery on Mobile
### Scénario 2 : Visualiser l'Imagerie Satellitaire sur Mobile

**Objective / Objectif**: Verify that satellite imagery overlays display correctly and are usable on mobile devices.

**Requirements Tested**: 18.1, 18.2, 18.3, 18.4, 18.6

**Prerequisites / Prérequis**:
- Logged in as planteur on mobile device
- Internet connection available (3G/4G)
- At least 1 parcelle with satellite imagery available

**Test Steps / Étapes de Test**:

1. **Load satellite imagery on mobile**
   - Navigate to a parcelle detail page
   - Enable satellite imagery overlay
   - **Expected**:
     - Imagery loads within acceptable time on mobile connection
     - Critical data (health status, alerts) loads before full imagery
     - Image quality is appropriate for mobile screen (not blurry, not excessively large)
     - Data transfer is optimized (max 2MB per parcelle)

2. **Interact with map using touch gestures**
   - Pinch to zoom in on the parcelle
   - Pan across the map by dragging
   - **Expected**:
     - Pinch-to-zoom works smoothly
     - Pan gesture works without accidental taps
     - Map responds to touch without lag

3. **Use temporal slider on mobile**
   - Find the temporal slider on the parcelle detail page
   - Swipe left/right to change the date
   - **Expected**:
     - Slider is touch-enabled and responds to swipe gestures
     - Date changes when swiping
     - Imagery updates to match selected date
     - Slider is large enough to interact with on mobile

4. **View NDVI overlay on mobile**
   - Enable NDVI color overlay on the map
   - **Expected**:
     - NDVI colors are visible on mobile screen
     - Color legend is readable
     - Overlay does not obscure important map features

5. **Test on narrow screen (320px)**
   - If testing on a narrow device, verify layout
   - **Expected**:
     - No horizontal scrolling required
     - All controls are accessible
     - Text is not cut off

**Success Criteria / Critères de Réussite**:
- ✅ Satellite imagery loads and displays correctly on mobile
- ✅ Touch gestures (pinch-to-zoom, pan, swipe) work correctly
- ✅ Temporal slider is usable with touch
- ✅ Layout adapts to mobile screen width (320px-768px)

**Feedback Questions / Questions de Retour**:
1. L'imagerie satellitaire se charge-t-elle rapidement sur votre téléphone ?
2. Les gestes tactiles (zoom, défilement) fonctionnent-ils bien ?
3. L'interface est-elle facile à utiliser sur votre téléphone ?
4. Y a-t-il des éléments trop petits ou difficiles à toucher ?

---

### Scenario 3: Use Offline Mode in the Field
### Scénario 3 : Utiliser le Mode Hors Ligne sur le Terrain

**Objective / Objectif**: Verify that planteurs can access satellite data and health status when there is no internet connectivity.

**Requirements Tested**: 7.1, 7.2, 7.3, 7.5, 7.6, 7.7

**Prerequisites / Prérequis**:
- Logged in as planteur on mobile device
- Previously viewed parcelles (data should be cached)
- Internet connection will be disabled during this scenario

**Test Steps / Étapes de Test**:

1. **Pre-cache data while online**
   - While connected to internet, view 3-5 parcelles
   - View satellite imagery and health status for each
   - **Expected**: Data is cached automatically in the background

2. **Disable internet connection**
   - Turn on airplane mode or disable WiFi/mobile data
   - **Expected**: Device has no internet connectivity

3. **Access parcelle list offline**
   - Navigate to "Mes Parcelles" page
   - **Expected**:
     - Parcelle list loads from cache
     - A "Données en cache" (Cached data) indicator is visible
     - Health status badges are still displayed
     - Cache date is shown (e.g., "Mis à jour il y a 2 jours")

4. **View parcelle details offline**
   - Tap on a previously viewed parcelle
   - **Expected**:
     - Parcelle detail page loads from cache
     - Satellite imagery is displayed (from cache)
     - NDVI statistics are displayed
     - Health status is displayed
     - "Données en cache" indicator is visible with cache date

5. **Verify cached data indicator**
   - Look for the cached data indicator
   - **Expected**:
     - Indicator is clearly visible (not hidden)
     - Shows the date when data was last updated
     - Indicator is understandable without technical knowledge

6. **Test staleness warning (if applicable)**
   - If cached data is older than 30 days, check for warning
   - **Expected**:
     - Warning message is displayed: "Données anciennes - Mettez à jour dès que possible"
     - Warning is clear but not alarming

7. **Re-enable internet and refresh**
   - Turn off airplane mode / re-enable internet
   - Tap "Actualiser" (Refresh) button
   - **Expected**:
     - Data refreshes from server
     - "Données en cache" indicator disappears or updates
     - Latest health status is displayed

**Success Criteria / Critères de Réussite**:
- ✅ Parcelle list and details load correctly offline
- ✅ Cached data indicator is clearly visible
- ✅ Health status and NDVI data are available offline
- ✅ Data refreshes correctly when connectivity is restored

**Feedback Questions / Questions de Retour**:
1. Pouvez-vous accéder aux informations de votre parcelle sans connexion internet ?
2. L'indicateur "données en cache" est-il clair et compréhensible ?
3. Savez-vous quand les données ont été mises à jour pour la dernière fois ?
4. Le mode hors ligne est-il utile pour votre travail sur le terrain ?

---

### Scenario 4: Understand Health Status Recommendations
### Scénario 4 : Comprendre les Recommandations de Statut de Santé

**Objective / Objectif**: Verify that planteurs can understand and act on health status recommendations without technical knowledge.

**Requirements Tested**: 6.1, 6.2, 6.3, 6.5, 6.6

**Prerequisites / Prérequis**:
- Logged in as planteur on mobile device
- At least 1 parcelle with "Poor" or "Critical" health status

**Test Steps / Étapes de Test**:

1. **Find a parcelle with poor health**
   - Look at the parcelle list
   - Identify a parcelle with orange (Mauvais) or red (Critique) badge
   - **Expected**: Poor/Critical parcelles are easy to spot

2. **Read the health recommendation**
   - Tap on the parcelle with poor health
   - Find the recommendation section
   - **Expected**:
     - Recommendation is in simple French (no technical jargon)
     - Recommendation is actionable (e.g., "Envisagez l'irrigation", "Consultez un agronome")
     - Recommendation matches the health status level

3. **Understand the health status explanation**
   - Look for a tooltip or explanation of what the health status means
   - **Expected**:
     - Brief explanation is available (e.g., "Votre parcelle a besoin d'attention")
     - Explanation avoids NDVI technical terms
     - Explanation is in French

4. **Check if notification was received (if applicable)**
   - If health status changed recently, check for notification
   - **Expected**:
     - Notification was received (in-app or email)
     - Notification includes parcelle name and new health status
     - Notification includes a link to the parcelle detail page

**Success Criteria / Critères de Réussite**:
- ✅ Health status is understandable without technical knowledge
- ✅ Recommendations are simple and actionable
- ✅ Planteur knows what action to take based on health status

**Feedback Questions / Questions de Retour**:
1. Comprenez-vous ce que signifie le statut de santé de votre parcelle ?
2. Les recommandations sont-elles claires et utiles ?
3. Savez-vous quoi faire quand votre parcelle est en mauvaise santé ?
4. Avez-vous reçu des notifications quand le statut a changé ?

---

## 5. General Usability Testing / Test d'Utilisabilité Général

### Navigation and Workflow / Navigation et Flux de Travail

**Test Steps**:
1. Ask participant to navigate to their parcelles without guidance
2. Ask participant to find the health status of their worst-performing parcelle
3. Ask participant to check if their parcelle data is available offline

**Feedback Questions**:
1. L'application est-elle facile à utiliser sur votre téléphone ?
2. Pouvez-vous trouver les informations dont vous avez besoin rapidement ?
3. Y a-t-il des fonctionnalités que vous ne comprenez pas ?

### Performance on Mobile / Performance sur Mobile

**Test Steps**:
1. Note loading times for:
   - Parcelle list page (first load)
   - Parcelle detail page with satellite imagery
   - Map view with NDVI overlay
   - Offline data access

**Feedback Questions**:
1. L'application se charge-t-elle rapidement sur votre téléphone ?
2. Y a-t-il des moments où l'application est lente ou bloquée ?

### Language and Comprehension / Langue et Compréhension

**Test Steps**:
1. Ask participant to read health status labels aloud
2. Ask participant to explain what each status means in their own words
3. Check if any French terms are unclear or unfamiliar

**Feedback Questions**:
1. Tous les textes sont-ils en français et compréhensibles ?
2. Y a-t-il des mots ou termes que vous ne comprenez pas ?

---

## 6. Data Collection / Collecte de Données

### During Testing / Pendant le Test

**Observer Notes**:
- Record time to complete each scenario
- Note any confusion, hesitation, or errors
- Note any elements that are too small to tap on mobile
- Record any positive reactions or moments of understanding
- Note any language comprehension issues

**Think-Aloud Protocol**:
- Ask participants to verbalize their thoughts while testing
- Record quotes and observations in French

### After Testing / Après le Test

**Feedback Form**:
- Participants complete structured feedback form (see separate template)
- 10-15 minutes to complete (keep it short for planteurs)
- Facilitator reads questions aloud if needed

**Debrief Interview**:
- 10-minute discussion in French
- Ask open-ended questions about overall experience
- Gather suggestions for improvements

---

## 7. Success Metrics / Métriques de Réussite

### Quantitative Metrics / Métriques Quantitatives

- **Task Completion Rate**: % of scenarios completed successfully
  - Target: ≥85% (lower than other user groups due to varying tech literacy)
- **Time on Task**: Average time to complete each scenario
  - Scenario 1: <3 minutes
  - Scenario 2: <5 minutes
  - Scenario 3: <5 minutes
  - Scenario 4: <3 minutes
- **Error Rate**: Number of errors or failed attempts
  - Target: <3 errors per participant
- **User Satisfaction**: Average rating across all features
  - Target: ≥3.5/5.0 (adjusted for user group)

### Qualitative Metrics / Métriques Qualitatives

- Ability to understand health status without explanation
- Confidence in using the app in the field
- Usefulness of offline mode for field work
- Clarity of French language and terminology
- Overall trust in the satellite data

---

## 8. Risk Mitigation / Atténuation des Risques

### Potential Issues / Problèmes Potentiels

1. **Low Tech Literacy**:
   - Mitigation: Use simple language in test instructions
   - Have facilitator demonstrate first if needed
   - Allow more time per scenario

2. **Device Compatibility**:
   - Mitigation: Test on participant's own device when possible
   - Bring backup Android devices
   - Test on multiple screen sizes (320px, 375px, 414px, 768px)

3. **Network Conditions**:
   - Mitigation: Test offline scenarios in controlled environment
   - Pre-cache data before offline testing
   - Have mobile hotspot available as backup

4. **Language Barrier**:
   - Mitigation: All test materials in French
   - Facilitator must be fluent in French (and local dialect if needed)
   - Avoid technical terms in instructions

5. **Participant Availability**:
   - Mitigation: Recruit 5-6 participants, expect 3-5 to attend
   - Offer flexible scheduling (morning or evening)
   - Consider testing at cooperative meeting

---

## 9. Post-UAT Actions / Actions Post-UAT

### Immediate Actions / Actions Immédiates

1. **Compile Feedback**:
   - Aggregate all feedback forms
   - Compile observer notes
   - Create summary document

2. **Prioritize Issues**:
   - Focus on mobile usability issues (P0/P1)
   - Identify language/comprehension issues
   - Note offline mode failures

3. **Create Tickets**:
   - Create bug tickets for mobile layout issues
   - Create enhancement tickets for usability improvements

### Follow-Up / Suivi

1. **Share Results**:
   - Share UAT summary with development team
   - Share with cooperative managers for context

2. **Plan Fixes**:
   - Prioritize mobile responsiveness fixes
   - Improve French language clarity
   - Enhance offline mode reliability

3. **Thank Participants**:
   - Send thank-you message (SMS or via cooperative manager)
   - Provide compensation
   - Inform them when improvements are deployed

---

## 10. Appendix: Test Data Requirements / Annexe : Exigences de Données de Test

### Required Test Parcelles / Parcelles de Test Requises

1. **Parcelle A - Excellent Health**:
   - Mean NDVI: 0.75
   - Health Status: Excellent
   - Trend: Stable
   - Cache: Pre-loaded

2. **Parcelle B - Good Health**:
   - Mean NDVI: 0.65
   - Health Status: Good (Bon)
   - Trend: Improving
   - Cache: Pre-loaded

3. **Parcelle C - Fair Health**:
   - Mean NDVI: 0.55
   - Health Status: Fair (Moyen)
   - Trend: Declining
   - Cache: Pre-loaded

4. **Parcelle D - Poor Health**:
   - Mean NDVI: 0.40
   - Health Status: Poor (Mauvais)
   - Trend: Declining
   - Recommendation: "Envisagez l'irrigation et consultez un agronome"
   - Cache: Pre-loaded

5. **Parcelle E - Critical Health**:
   - Mean NDVI: 0.20
   - Health Status: Critical (Critique)
   - Trend: Declining
   - Recommendation: "Intervention urgente requise - Contactez votre agronome"
   - Cache: Pre-loaded

### Mobile Device Test Matrix / Matrice de Test des Appareils Mobiles

| Device Type | Screen Width | OS | Priority |
|-------------|-------------|-----|----------|
| Small Android | 320px | Android 9+ | High |
| Standard Android | 375px | Android 10+ | High |
| Large Android | 414px | Android 11+ | Medium |
| Tablet | 768px | Android 9+ | Low |
| iPhone SE | 375px | iOS 13+ | Medium |

### Offline Cache Pre-Loading Checklist / Liste de Vérification du Pré-Chargement du Cache

Before offline testing scenarios, verify:
- [ ] All 5 test parcelles have been viewed while online
- [ ] Satellite imagery is cached for each parcelle
- [ ] NDVI statistics are cached for each parcelle
- [ ] Health status data is cached for each parcelle
- [ ] Temporal data (12 months) is cached for at least 2 parcelles
- [ ] Cache date is recent (< 24 hours before testing)

---

**Document Prepared By**: CocoaTrack Development Team  
**Review Date**: May 2026  
**Approval**: [Pending]
