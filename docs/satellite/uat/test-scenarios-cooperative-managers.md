# Test Scenarios: Satellite Imagery Analysis — Cooperative Managers
# Scénarios de Test : Analyse d'Imagerie Satellitaire — Gestionnaires de Coopératives

**Document Version / Version du document**: 1.0  
**Feature / Fonctionnalité**: Satellite Imagery Analysis Integration  
**Platform / Plateforme**: CocoaTrack  
**Target Users / Utilisateurs cibles**: Cooperative Managers / Gestionnaires de Coopératives  

---

## Instructions for Facilitators / Instructions pour les facilitateurs

Read each scenario title and preconditions to the participant. Then read the task instructions aloud (in French for Cameroonian participants). Observe without guiding. Record pass/fail and any observations in the results template.

*Lisez le titre et les préconditions de chaque scénario au participant. Lisez ensuite les instructions de la tâche à voix haute (en français pour les participants camerounais). Observez sans guider. Enregistrez réussite/échec et toute observation dans le modèle de résultats.*

---

## Scenario 1: View Satellite Imagery Overlay on a Parcelle Map

**Scenario ID**: UAT-CM-001  
**Category**: Satellite Imagery Display  
**Priority**: Critical  
**Estimated Duration**: 8 minutes  

### Preconditions / Préconditions

- Participant is logged in as a Cooperative Manager
- At least 15 parcelles are visible in the parcelle list
- Satellite imagery data is available for at least 10 parcelles

### Task Instructions / Instructions de tâche

*Read to participant / Lire au participant :*

> **FR**: « Imaginez que vous souhaitez voir l'état actuel de vos parcelles depuis l'espace. Trouvez une de vos parcelles sur la carte et affichez l'image satellitaire par-dessus la carte. »
>
> **EN**: "Imagine you want to see the current state of your parcelles from space. Find one of your parcelles on the map and display the satellite image on top of the map."

### Steps / Étapes

1. Navigate to the parcelle list or map view.
2. Select a parcelle that has satellite imagery available.
3. Locate and activate the satellite imagery overlay.
4. Confirm that the satellite image is visible on the map.
5. Adjust the opacity of the satellite overlay.
6. Toggle the satellite overlay off, then back on.

### Expected Results / Résultats attendus

- [ ] Participant can navigate to a parcelle map view without assistance.
- [ ] Satellite imagery overlay is visible on the map within 3 seconds of activation.
- [ ] Opacity slider is discoverable and functional (0%–100% range).
- [ ] Toggling the overlay off removes the satellite image; toggling on restores it.
- [ ] No error messages appear during normal operation.

### Observations / Observations

_Space for note-taker to record participant behavior, quotes, and issues._

```
Time started: ________
Time completed: ________
Pass / Fail: ________
Issues observed: 
```

---

## Scenario 2: Understand What the Satellite Image Shows

**Scenario ID**: UAT-CM-002  
**Category**: Satellite Imagery Display — Comprehension  
**Priority**: High  
**Estimated Duration**: 5 minutes  

### Preconditions / Préconditions

- Satellite imagery overlay is active (from Scenario 1 or fresh start)
- At least one parcelle with visible vegetation is displayed

### Task Instructions / Instructions de tâche

> **FR**: « Regardez l'image satellitaire affichée sur la carte. Pouvez-vous me dire ce que vous voyez ? Qu'est-ce que les différentes couleurs ou zones vous indiquent sur vos parcelles ? »
>
> **EN**: "Look at the satellite image displayed on the map. Can you tell me what you see? What do the different colors or areas tell you about your parcelles?"

### Steps / Étapes

1. Observe the satellite imagery overlay on the map.
2. Describe what is visible (vegetation, bare soil, water, etc.).
3. Attempt to identify the parcelle boundaries within the imagery.
4. Note any information displayed alongside the imagery (date, cloud cover, etc.).

### Expected Results / Résultats attendus

- [ ] Participant can identify vegetation areas in the imagery.
- [ ] Parcelle boundaries are visible and distinguishable from the imagery.
- [ ] Imagery acquisition date is displayed and readable.
- [ ] Cloud cover percentage (if any) is visible and understandable.
- [ ] Participant does not express significant confusion about what the image represents.

### Observations / Observations

```
Time started: ________
Time completed: ________
Pass / Fail: ________
Issues observed: 
```

---

## Scenario 3: Handle Unavailable Satellite Imagery

**Scenario ID**: UAT-CM-003  
**Category**: Satellite Imagery Display — Error State  
**Priority**: High  
**Estimated Duration**: 5 minutes  

### Preconditions / Préconditions

- At least one parcelle in the test account has NO satellite imagery available
- This parcelle is identifiable in the list (facilitator knows which one)

### Task Instructions / Instructions de tâche

> **FR**: « Essayez d'afficher l'image satellitaire pour la parcelle nommée [NOM DE LA PARCELLE TEST]. Dites-moi ce qui se passe. »
>
> **EN**: "Try to display the satellite image for the parcelle named [TEST PARCELLE NAME]. Tell me what happens."

### Steps / Étapes

1. Navigate to the specified parcelle (no satellite data available).
2. Attempt to activate the satellite imagery overlay.
3. Read and interpret any message displayed.
4. Identify what action options are available.

### Expected Results / Résultats attendus

- [ ] A clear, user-friendly message is displayed (not a technical error code).
- [ ] The message explains WHY imagery is unavailable (e.g., "No recent imagery available for this parcelle").
- [ ] The last available imagery date is shown (if applicable).
- [ ] A retry option or alternative action is offered.
- [ ] Participant understands the message without explanation from the facilitator.

### Observations / Observations

```
Time started: ________
Time completed: ________
Pass / Fail: ________
Issues observed: 
```

---

## Scenario 4: View and Understand Health Status Badges

**Scenario ID**: UAT-CM-004  
**Category**: Health Status Indicators  
**Priority**: Critical  
**Estimated Duration**: 8 minutes  

### Preconditions / Préconditions

- Participant is on the parcelle list view
- Parcelles with various health statuses are visible (Excellent, Good, Fair, Poor, Critical)

### Task Instructions / Instructions de tâche

> **FR**: « Regardez la liste de vos parcelles. Vous devriez voir des indicateurs colorés à côté de chaque parcelle. Pouvez-vous m'expliquer ce que ces indicateurs signifient ? Quelle parcelle nécessite le plus d'attention selon vous ? »
>
> **EN**: "Look at your parcelle list. You should see colored indicators next to each parcelle. Can you explain to me what these indicators mean? Which parcelle needs the most attention in your opinion?"

### Steps / Étapes

1. Navigate to the parcelle list view.
2. Identify the health status badges/indicators.
3. Describe what each color means (without prompting).
4. Identify the parcelle(s) in the worst health condition.
5. Click on a parcelle with "Critical" status to view details.

### Expected Results / Résultats attendus

- [ ] Health status badges are visible in the parcelle list without scrolling.
- [ ] Participant correctly identifies that red/critical = worst condition.
- [ ] Participant correctly identifies that green/excellent = best condition.
- [ ] Participant can identify the parcelle requiring most attention.
- [ ] Clicking on a parcelle opens the detail view with health status information.
- [ ] Participant does not require explanation of the color coding.

### Observations / Observations

```
Time started: ________
Time completed: ________
Pass / Fail: ________
Issues observed: 
```

---

## Scenario 5: Filter Parcelles by Health Status

**Scenario ID**: UAT-CM-005  
**Category**: Health Status Indicators — Filtering  
**Priority**: High  
**Estimated Duration**: 6 minutes  

### Preconditions / Préconditions

- Participant is on the parcelle list view
- Parcelles with multiple health statuses are present
- Health status filter is available in the UI

### Task Instructions / Instructions de tâche

> **FR**: « Vous avez beaucoup de parcelles. Vous voulez voir uniquement celles qui sont en mauvais état — celles qui ont le statut "Critique" ou "Mauvais". Comment feriez-vous cela ? »
>
> **EN**: "You have many parcelles. You want to see only the ones in poor condition — those with 'Critical' or 'Poor' status. How would you do that?"

### Steps / Étapes

1. Locate the filter controls on the parcelle list.
2. Apply a filter for "Critical" health status.
3. Verify that only Critical parcelles are shown.
4. Add "Poor" to the filter (multi-select if available).
5. Clear the filter to return to the full list.

### Expected Results / Résultats attendus

- [ ] Filter control is discoverable without assistance.
- [ ] Filtering by "Critical" shows only parcelles with Critical status.
- [ ] Filtering by multiple statuses works correctly.
- [ ] Clearing the filter restores the full parcelle list.
- [ ] Filter state is visually indicated (user knows a filter is active).

### Observations / Observations

```
Time started: ________
Time completed: ________
Pass / Fail: ________
Issues observed: 
```

---

## Scenario 6: Switch Between Map Providers with Satellite Overlay

**Scenario ID**: UAT-CM-006  
**Category**: Map Interactions  
**Priority**: Medium  
**Estimated Duration**: 6 minutes  

### Preconditions / Préconditions

- Participant is on a parcelle map view
- Both Leaflet (OpenStreetMap) and Google Maps options are available
- Satellite overlay is active

### Task Instructions / Instructions de tâche

> **FR**: « Vous utilisez actuellement un type de carte. Essayez de passer à un autre type de carte tout en gardant l'image satellitaire visible. Dites-moi ce que vous observez. »
>
> **EN**: "You are currently using one type of map. Try switching to a different map type while keeping the satellite image visible. Tell me what you observe."

### Steps / Étapes

1. Note the current map provider (Leaflet or Google Maps).
2. Activate the satellite imagery overlay (if not already active).
3. Switch to the other map provider using the map switcher control.
4. Verify that the satellite overlay is still visible after switching.
5. Adjust the opacity to confirm the overlay is functional on the new map.

### Expected Results / Résultats attendus

- [ ] Map switcher control is discoverable.
- [ ] Switching map providers does not remove the satellite overlay.
- [ ] Satellite imagery is correctly positioned on both map providers.
- [ ] Parcelle boundaries remain visible after switching.
- [ ] No error messages appear during the switch.

### Observations / Observations

```
Time started: ________
Time completed: ________
Pass / Fail: ________
Issues observed: 
```

---

## Scenario 7: Use the Temporal Slider to View Historical Imagery

**Scenario ID**: UAT-CM-007  
**Category**: Temporal Slider  
**Priority**: High  
**Estimated Duration**: 10 minutes  

### Preconditions / Préconditions

- Participant is on a parcelle detail page or map view with temporal data available
- Temporal slider is visible with at least 6 months of data
- Significant NDVI changes are present in the timeline (highlighted dates)

### Task Instructions / Instructions de tâche

> **FR**: « Vous voulez voir comment cette parcelle a évolué au cours des derniers mois. Utilisez le curseur de temps pour regarder les images de différentes périodes. Trouvez le moment où la végétation a le plus changé. »
>
> **EN**: "You want to see how this parcelle has changed over the past few months. Use the time slider to look at images from different periods. Find the moment when the vegetation changed the most."

### Steps / Étapes

1. Locate the temporal slider on the parcelle view.
2. Move the slider to a date 6 months ago.
3. Observe the satellite imagery update for that date.
4. Move the slider forward month by month.
5. Identify a date marked as having a significant change.
6. Compare the imagery at that date with the current date.

### Expected Results / Résultats attendus

- [ ] Temporal slider is discoverable and its purpose is understood.
- [ ] Moving the slider updates the displayed imagery within 2 seconds.
- [ ] Dates with significant changes are visually highlighted on the slider.
- [ ] Participant can identify a period of significant vegetation change.
- [ ] NDVI value updates as the slider moves.
- [ ] Cloud cover percentage is visible for each date (if applicable).

### Observations / Observations

```
Time started: ________
Time completed: ________
Pass / Fail: ________
Issues observed: 
```

---

## Scenario 8: Understand Health Status Trend and Recommendation

**Scenario ID**: UAT-CM-008  
**Category**: Health Status Indicators — Detail View  
**Priority**: High  
**Estimated Duration**: 6 minutes  

### Preconditions / Préconditions

- Participant is on a parcelle detail page
- The parcelle has a health status trend (improving, stable, or declining)
- A recommendation is displayed based on the health status

### Task Instructions / Instructions de tâche

> **FR**: « Regardez les informations de santé de cette parcelle. Que vous dit le système sur l'état de la parcelle ? Est-ce que la situation s'améliore ou se dégrade ? Que vous recommande le système de faire ? »
>
> **EN**: "Look at the health information for this parcelle. What does the system tell you about the parcelle's condition? Is the situation improving or getting worse? What does the system recommend you do?"

### Steps / Étapes

1. Navigate to a parcelle detail page.
2. Locate the health status section.
3. Read and interpret the health status badge and trend indicator.
4. Read and interpret the recommendation text.
5. Describe in their own words what action they would take based on this information.

### Expected Results / Résultats attendus

- [ ] Participant correctly identifies the current health status level.
- [ ] Trend indicator (improving/stable/declining) is understood correctly.
- [ ] Recommendation text is clear and actionable.
- [ ] Participant can describe a concrete action they would take.
- [ ] NDVI value and last calculation date are visible.

### Observations / Observations

```
Time started: ________
Time completed: ________
Pass / Fail: ________
Issues observed: 
```

---

## Scenario 9: View Multiple Parcelles Health Status on Map

**Scenario ID**: UAT-CM-009  
**Category**: Map Interactions — Multi-Parcelle  
**Priority**: Medium  
**Estimated Duration**: 6 minutes  

### Preconditions / Préconditions

- Participant is on the map view showing multiple parcelles
- Parcelles are color-coded by health status on the map
- At least 5 parcelles are visible simultaneously

### Task Instructions / Instructions de tâche

> **FR**: « Regardez la carte avec toutes vos parcelles. Les couleurs des parcelles indiquent leur état de santé. Sans cliquer sur chaque parcelle individuellement, pouvez-vous identifier rapidement quelles zones de votre coopérative ont des problèmes ? »
>
> **EN**: "Look at the map with all your parcelles. The colors of the parcelles indicate their health status. Without clicking on each parcelle individually, can you quickly identify which areas of your cooperative have problems?"

### Steps / Étapes

1. Navigate to the map view showing all parcelles.
2. Observe the color-coded parcelle boundaries.
3. Identify the geographic area(s) with the most problematic parcelles.
4. Click on a parcelle popup to verify the health status shown matches the color.
5. Describe the overall health picture of the cooperative.

### Expected Results / Résultats attendus

- [ ] Color-coded parcelle boundaries are visible on the map.
- [ ] Participant can identify problem areas without clicking each parcelle.
- [ ] Map popup shows health status badge consistent with boundary color.
- [ ] Participant can describe the overall cooperative health at a glance.
- [ ] Legend or color key is available and understandable.

### Observations / Observations

```
Time started: ________
Time completed: ________
Pass / Fail: ________
Issues observed: 
```

---

## Scenario 10: Experience Offline / Cached Data Behavior

**Scenario ID**: UAT-CM-010  
**Category**: Error States and Offline Behavior  
**Priority**: Medium  
**Estimated Duration**: 5 minutes  

### Preconditions / Préconditions

- Facilitator has previously loaded satellite data for the test parcelles (to populate cache)
- Facilitator simulates offline mode by disabling network in browser DevTools OR by using a pre-configured offline test page

### Task Instructions / Instructions de tâche

> **FR**: « Imaginez que vous êtes dans une zone avec une mauvaise connexion internet. Essayez d'accéder aux données satellitaires de vos parcelles. Que se passe-t-il ? Pouvez-vous quand même voir des informations utiles ? »
>
> **EN**: "Imagine you are in an area with poor internet connectivity. Try to access the satellite data for your parcelles. What happens? Can you still see useful information?"

### Steps / Étapes

1. Facilitator enables offline simulation.
2. Participant attempts to view satellite imagery for a previously loaded parcelle.
3. Participant reads and interprets any offline/cached data indicator.
4. Participant attempts to view a parcelle that was NOT previously loaded.
5. Facilitator restores connectivity.

### Expected Results / Résultats attendus

- [ ] Previously loaded parcelles show cached imagery with a "cached data" indicator.
- [ ] Cache date is displayed so participant knows how old the data is.
- [ ] Parcelles not previously loaded show a clear "no data available offline" message.
- [ ] Participant understands the difference between cached and live data.
- [ ] No application crash or unhandled error occurs in offline mode.

### Observations / Observations

```
Time started: ________
Time completed: ________
Pass / Fail: ________
Issues observed: 
```

---

## Scenario 11: Mobile Device Usability (Optional — if participant uses mobile)

**Scenario ID**: UAT-CM-011  
**Category**: Mobile Responsiveness  
**Priority**: Medium  
**Estimated Duration**: 8 minutes  

### Preconditions / Préconditions

- Participant has a smartphone (iOS or Android)
- CocoaTrack staging environment is accessible on mobile browser
- Participant is logged in on their mobile device

### Task Instructions / Instructions de tâche

> **FR**: « Utilisez votre téléphone pour accéder à CocoaTrack. Essayez de voir l'image satellitaire d'une de vos parcelles et de vérifier son état de santé. »
>
> **EN**: "Use your phone to access CocoaTrack. Try to view the satellite image of one of your parcelles and check its health status."

### Steps / Étapes

1. Open CocoaTrack in the mobile browser.
2. Navigate to the parcelle list.
3. Select a parcelle and view its satellite imagery.
4. Use pinch-to-zoom on the map.
5. Use the temporal slider with swipe gestures.
6. View the health status badge on mobile.

### Expected Results / Résultats attendus

- [ ] Satellite imagery overlay is visible on mobile screen.
- [ ] Pinch-to-zoom works correctly on the map.
- [ ] Temporal slider responds to swipe gestures.
- [ ] Health status badges are readable on small screens.
- [ ] No horizontal scrolling required for main content.
- [ ] Buttons and controls are large enough to tap accurately.

### Observations / Observations

```
Time started: ________
Time completed: ________
Pass / Fail: ________
Issues observed: 
```

---

## Scenario 12: Free Exploration

**Scenario ID**: UAT-CM-012  
**Category**: General Usability  
**Priority**: Low  
**Estimated Duration**: 10 minutes  

### Preconditions / Préconditions

- All previous scenarios completed
- Participant has 10 minutes of free exploration time

### Task Instructions / Instructions de tâche

> **FR**: « Vous avez maintenant 10 minutes pour explorer librement la fonctionnalité d'imagerie satellitaire. Explorez ce qui vous intéresse le plus. Pensez à voix haute et dites-nous ce que vous trouvez utile, ce qui vous surprend, ou ce qui vous manque. »
>
> **EN**: "You now have 10 minutes to freely explore the satellite imagery feature. Explore what interests you most. Think out loud and tell us what you find useful, what surprises you, or what you feel is missing."

### Steps / Étapes

1. Participant explores the feature freely.
2. Facilitator observes and takes notes on areas of interest and confusion.
3. Facilitator may ask follow-up questions: "What are you trying to do here?" or "What did you expect to happen?"

### Expected Results / Résultats attendus

- [ ] Participant engages with the feature without prompting.
- [ ] Participant discovers at least one feature not covered in previous scenarios.
- [ ] Participant provides spontaneous feedback (positive or negative).

### Observations / Observations

```
Time started: ________
Time completed: ________
Notable discoveries or comments: 
```

---

## Scenario Summary Table / Tableau récapitulatif des scénarios

| ID | Title | Category | Priority | Duration |
|----|-------|----------|----------|----------|
| UAT-CM-001 | View Satellite Imagery Overlay | Imagery Display | Critical | 8 min |
| UAT-CM-002 | Understand What the Image Shows | Imagery Display | High | 5 min |
| UAT-CM-003 | Handle Unavailable Imagery | Error State | High | 5 min |
| UAT-CM-004 | View and Understand Health Status Badges | Health Status | Critical | 8 min |
| UAT-CM-005 | Filter Parcelles by Health Status | Health Status | High | 6 min |
| UAT-CM-006 | Switch Map Providers with Overlay | Map Interactions | Medium | 6 min |
| UAT-CM-007 | Use Temporal Slider | Temporal Slider | High | 10 min |
| UAT-CM-008 | Understand Health Trend and Recommendation | Health Status | High | 6 min |
| UAT-CM-009 | View Multi-Parcelle Health on Map | Map Interactions | Medium | 6 min |
| UAT-CM-010 | Offline / Cached Data Behavior | Error States | Medium | 5 min |
| UAT-CM-011 | Mobile Device Usability (Optional) | Mobile | Medium | 8 min |
| UAT-CM-012 | Free Exploration | General | Low | 10 min |

**Total estimated time (without optional)**: ~75 minutes  
**Total estimated time (with optional)**: ~83 minutes  
