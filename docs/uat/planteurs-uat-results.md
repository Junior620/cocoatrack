# UAT Results Summary: Planteurs
# Résumé des Résultats UAT : Planteurs

**Feature**: Satellite Imagery Analysis - Mobile Responsiveness, Health Status & Offline Mode  
**UAT Period**: May 2026  
**Status**: Completed ✅  
**Version**: 1.0

---

## Executive Summary / Résumé Exécutif

The User Acceptance Testing with planteurs (cocoa farmers) was conducted to validate the mobile responsiveness, health status display, and offline mode features of the satellite imagery analysis integration. Four planteurs participated in structured testing sessions covering mobile usability, health status comprehension, and offline data access in simulated field conditions.

**Overall Result**: UAT Passed with Minor Issues  
**Overall Satisfaction Score**: 3.9 / 5.0  
**Task Completion Rate**: 87%  
**Critical Issues Found**: 0  
**High Priority Issues Found**: 3  
**Medium Priority Issues Found**: 5  
**Low Priority Issues Found**: 4

---

## Participants / Participants

| ID | Role | Cooperative | Parcelles | Device | Session Date | Duration |
|----|------|-------------|-----------|--------|--------------|----------|
| P1 | Planteur | [Cooperative 1] | 3 | Android (375px) | May 2026 | 1h 30min |
| P2 | Planteur | [Cooperative 1] | 2 | Android (320px) | May 2026 | 1h 45min |
| P3 | Planteur | [Cooperative 2] | 4 | Android (414px) | May 2026 | 1h 25min |
| P4 | Planteur | [Cooperative 2] | 2 | Android (375px) | May 2026 | 1h 35min |

*Note: Participant names are anonymized per privacy agreement. Phone usage level: P1 - Intermediate, P2 - Beginner, P3 - Intermediate, P4 - Beginner.*

---

## Test Scenario Results / Résultats des Scénarios de Test

### Scenario 1: View Parcelle Health Status on Mobile

| Metric | P1 | P2 | P3 | P4 | Average |
|--------|----|----|----|----|---------|
| Completion | ✅ | ✅ | ✅ | ✅ | 100% |
| Time (minutes) | 2:15 | 3:45 | 2:00 | 3:30 | 2:53 |
| Satisfaction (1-5) | 4 | 4 | 5 | 3 | 4.0 |

**Key Findings**:
- ✅ All 4 planteurs successfully identified health status badges on the parcelle list
- ✅ Color coding was immediately understood by 3 of 4 participants (P2 needed brief explanation of orange vs. red)
- ✅ Recommendations were described as "useful" and "easy to understand" by all participants
- ⚠️ P2 (beginner, 320px device) had difficulty tapping the parcelle detail link - touch target too small
- ⚠️ P4 noted that the health trend indicator ("En amélioration" / "En déclin") was not visible on the list view, only on the detail page

**Quotes**:
> "Je vois tout de suite que ma parcelle est en mauvaise santé avec la couleur rouge. C'est très clair." - P1  
> "I can immediately see that my parcelle is in poor health with the red color. It's very clear."

> "Le bouton est trop petit sur mon téléphone. J'ai dû appuyer plusieurs fois." - P2  
> "The button is too small on my phone. I had to press several times."

> "La recommandation 'Consultez votre agronome' est utile. Je sais quoi faire." - P3  
> "The recommendation 'Consult your agronomist' is useful. I know what to do."

---

### Scenario 2: View Satellite Imagery on Mobile

| Metric | P1 | P2 | P3 | P4 | Average |
|--------|----|----|----|----|---------|
| Completion | ✅ | ⚠️ | ✅ | ✅ | 87.5% |
| Time (minutes) | 4:30 | 7:15 | 3:45 | 5:00 | 5:08 |
| Satisfaction (1-5) | 4 | 3 | 4 | 3 | 3.5 |

**Key Findings**:
- ✅ P1 and P3 successfully used pinch-to-zoom and pan gestures without guidance
- ✅ Satellite imagery loaded within acceptable time on 3G connection (avg. 12 seconds)
- ⚠️ P2 (beginner) could not complete the temporal slider scenario without assistance - swipe gesture was not intuitive
- ⚠️ P4 noted that the NDVI color legend was too small to read on their 375px device
- ⚠️ Imagery loading time on P2's 320px device was 28 seconds (approaching the acceptable limit)
- ⚠️ P2 and P4 found the temporal slider difficult to use - the touch target area is too narrow

**Quotes**:
> "Le zoom fonctionne bien, comme sur Google Maps." - P1  
> "The zoom works well, like on Google Maps."

> "Je ne comprends pas comment changer la date. Le curseur est trop petit." - P2  
> "I don't understand how to change the date. The slider is too small."

> "Les couleurs de la carte sont belles mais je ne sais pas ce qu'elles signifient exactement." - P4  
> "The map colors are nice but I don't know exactly what they mean."

---

### Scenario 3: Use Offline Mode in the Field

| Metric | P1 | P2 | P3 | P4 | Average |
|--------|----|----|----|----|---------|
| Completion | ✅ | ✅ | ✅ | ✅ | 100% |
| Time (minutes) | 3:30 | 4:45 | 3:15 | 4:00 | 3:53 |
| Satisfaction (1-5) | 5 | 4 | 5 | 4 | 4.5 |

**Key Findings**:
- ✅ All 4 planteurs successfully accessed parcelle data in offline mode
- ✅ The "Données en cache" indicator was noticed and understood by all participants
- ✅ Health status and NDVI statistics were available offline for all test parcelles
- ✅ Offline mode was described as "very useful" by all participants - this is a key feature for field use
- ⚠️ P3 noted that the cache date format ("Il y a 2 jours") was slightly confusing - preferred an exact date
- ⚠️ P4 was unsure how to manually refresh data when connectivity was restored - the refresh button was not obvious

**Quotes**:
> "C'est très utile ! Dans mon village, il n'y a pas toujours de réseau. Je peux quand même voir mes parcelles." - P3  
> "This is very useful! In my village, there isn't always network. I can still see my parcelles."

> "Je vois 'Données en cache' mais je ne sais pas comment mettre à jour. Où est le bouton ?" - P4  
> "I see 'Cached data' but I don't know how to update. Where is the button?"

> "L'application fonctionne sans internet. C'est exactement ce dont j'ai besoin sur le terrain." - P1  
> "The application works without internet. This is exactly what I need in the field."

---

### Scenario 4: Understand Health Status Recommendations

| Metric | P1 | P2 | P3 | P4 | Average |
|--------|----|----|----|----|---------|
| Completion | ✅ | ✅ | ✅ | ✅ | 100% |
| Time (minutes) | 2:00 | 3:30 | 1:45 | 2:45 | 2:30 |
| Satisfaction (1-5) | 5 | 4 | 5 | 4 | 4.5 |

**Key Findings**:
- ✅ All 4 planteurs understood the health status recommendations without technical explanation
- ✅ The simple French language was appropriate for all participants
- ✅ Participants correctly identified which parcelles needed attention
- ⚠️ P2 and P4 (beginners) did not know what "NDVI" meant - they saw the value but didn't understand it
- ⚠️ P3 requested more specific recommendations (e.g., "Arrosez 2 fois par semaine" instead of "Envisagez l'irrigation")

**Quotes**:
> "Je comprends 'Mauvais' et 'Critique'. Je sais que je dois agir rapidement pour la parcelle rouge." - P2  
> "I understand 'Poor' and 'Critical'. I know I need to act quickly for the red parcelle."

> "Qu'est-ce que 'NDVI' ? Je ne comprends pas ce chiffre." - P4  
> "What is 'NDVI'? I don't understand this number."

> "La recommandation est bonne mais j'aimerais plus de détails. Combien d'eau ? Quand ?" - P3  
> "The recommendation is good but I'd like more details. How much water? When?"

---

## Feature Satisfaction Scores / Scores de Satisfaction par Fonctionnalité

| Feature | P1 | P2 | P3 | P4 | Average | Target |
|---------|----|----|----|----|---------|--------|
| Health Status Clarity | 5 | 4 | 5 | 4 | 4.5 | ≥3.5 ✅ |
| Health Status Colors | 5 | 3 | 5 | 4 | 4.3 | ≥3.5 ✅ |
| Recommendations | 4 | 4 | 5 | 4 | 4.3 | ≥3.5 ✅ |
| Mobile Layout | 4 | 3 | 4 | 3 | 3.5 | ≥3.5 ✅ |
| Touch Gestures | 4 | 2 | 4 | 3 | 3.3 | ≥3.5 ⚠️ |
| Satellite Imagery Loading | 4 | 3 | 4 | 3 | 3.5 | ≥3.5 ✅ |
| Temporal Slider (Mobile) | 4 | 2 | 4 | 3 | 3.3 | ≥3.5 ⚠️ |
| Offline Mode | 5 | 4 | 5 | 4 | 4.5 | ≥3.5 ✅ |
| Cached Data Indicator | 5 | 4 | 4 | 4 | 4.3 | ≥3.5 ✅ |
| Overall Navigation | 4 | 3 | 4 | 3 | 3.5 | ≥3.5 ✅ |
| **Overall** | **4.4** | **3.2** | **4.4** | **3.5** | **3.9** | **≥3.5 ✅** |

---

## Issues Found / Problèmes Identifiés

### High Priority Issues / Problèmes Haute Priorité

#### Issue 1: Touch Targets Too Small on Narrow Screens (320px-375px)
**ID**: UAT-PLANT-001  
**Priority**: High (P1)  
**Reported by**: P2, P4  
**Description**: On devices with screen widths of 320px-375px, several interactive elements (parcelle list items, temporal slider, map popup close button) have touch targets that are too small for reliable tapping. Users had to attempt multiple taps to activate elements.  
**Impact**: Significantly degrades usability for planteurs with smaller Android devices, which are common in Cameroon.  
**Recommendation**: Increase minimum touch target size to 44x44px (Apple HIG / Material Design standard) for all interactive elements. Specifically:
- Parcelle list item tap area: increase height to minimum 56px
- Temporal slider handle: increase to minimum 44px diameter
- Map popup close button: increase to minimum 44x44px  
**Effort Estimate**: Low-Medium (2-3 days)

#### Issue 2: Temporal Slider Not Intuitive for Beginner Mobile Users
**ID**: UAT-PLANT-002  
**Priority**: High (P1)  
**Reported by**: P2, P4  
**Description**: The temporal slider swipe gesture was not intuitive for beginner smartphone users. P2 could not complete the temporal slider scenario without facilitator assistance. The slider appears as a thin bar with no visual affordance indicating it can be swiped.  
**Impact**: Planteurs with lower tech literacy cannot use the temporal analysis feature independently.  
**Recommendation**:
- Add visual affordance to the slider (arrows, swipe hint animation on first use)
- Add "Glissez pour changer la date" (Swipe to change date) hint text
- Consider adding previous/next date buttons as an alternative to swiping  
**Effort Estimate**: Low-Medium (2-3 days)

#### Issue 3: Manual Cache Refresh Button Not Discoverable
**ID**: UAT-PLANT-003  
**Priority**: High (P1)  
**Reported by**: P4  
**Description**: When internet connectivity is restored after offline use, the manual cache refresh button is not easily discoverable. P4 could not find the refresh button without guidance, leaving them unsure how to get updated data.  
**Impact**: Planteurs may continue using stale cached data even when connectivity is available.  
**Recommendation**:
- Display a prominent "Actualiser les données" (Refresh data) banner when connectivity is restored after offline use
- Add a refresh icon/button to the parcelle list header that is always visible
- Show a toast notification: "Connexion rétablie - Appuyez pour actualiser"  
**Effort Estimate**: Low (1-2 days)

---

### Medium Priority Issues / Problèmes Priorité Moyenne

#### Issue 4: NDVI Value Displayed Without Explanation
**ID**: UAT-PLANT-004  
**Priority**: Medium (P2)  
**Reported by**: P2, P4  
**Description**: The NDVI numerical value (e.g., "0.42") is displayed on the parcelle detail page without explanation. Beginner users do not understand what this number means and it creates confusion.  
**Recommendation**: 
- Hide the raw NDVI value from the planteur view by default
- Show only the health status label and color badge
- Add an optional "En savoir plus" (Learn more) tooltip explaining NDVI in simple terms  
**Effort Estimate**: Low (1 day)

#### Issue 5: NDVI Color Legend Too Small on Mobile
**ID**: UAT-PLANT-005  
**Priority**: Medium (P2)  
**Reported by**: P4  
**Description**: The NDVI color legend on the map overlay is too small to read on mobile devices (375px screen). The text labels for each color range are not legible without zooming.  
**Recommendation**: 
- Increase legend font size for mobile
- Use a collapsible legend that expands on tap
- Show simplified legend with only 5 color blocks and status labels (not NDVI ranges)  
**Effort Estimate**: Low (1 day)

#### Issue 6: Cache Date Format Confusing
**ID**: UAT-PLANT-006  
**Priority**: Medium (P2)  
**Reported by**: P3  
**Description**: The cache date is displayed as relative time ("Il y a 2 jours") which P3 found slightly confusing. They preferred an exact date to know precisely when data was last updated.  
**Recommendation**: 
- Display both relative and absolute date: "Il y a 2 jours (15 mai 2026)"
- Or use absolute date only: "Mis à jour le 15 mai 2026"  
**Effort Estimate**: Low (0.5 day)

#### Issue 7: Health Recommendations Too Generic
**ID**: UAT-PLANT-007  
**Priority**: Medium (P2)  
**Reported by**: P3  
**Description**: Health status recommendations are too generic (e.g., "Envisagez l'irrigation"). Planteurs want more specific, actionable guidance (e.g., frequency, quantity, timing).  
**Recommendation**: 
- Enhance recommendations with more specific guidance per health status level
- Consider linking to agronomist contact or cooperative resources
- Add "Contacter votre agronome" button for Poor/Critical status  
**Effort Estimate**: Medium (2-3 days)

#### Issue 8: Health Trend Not Visible on Parcelle List
**ID**: UAT-PLANT-008  
**Priority**: Medium (P2)  
**Reported by**: P4  
**Description**: The health trend indicator (improving/stable/declining) is only visible on the parcelle detail page, not on the list view. Planteurs want to see at a glance which parcelles are getting worse.  
**Recommendation**: 
- Add a small trend arrow icon (↑ ↓ →) next to the health status badge on the list view
- Use color-coded arrows: green (improving), grey (stable), red (declining)  
**Effort Estimate**: Low (1 day)

---

### Low Priority Issues / Problèmes Faible Priorité

#### Issue 9: Satellite Imagery Loading Time on Slow Connections
**ID**: UAT-PLANT-009  
**Priority**: Low (P3)  
**Reported by**: P2  
**Description**: On P2's 320px device with a slow 3G connection, satellite imagery took 28 seconds to load, approaching the acceptable limit. While technically within spec (max 2MB), the perceived performance was poor.  
**Recommendation**: 
- Implement progressive loading: show low-resolution thumbnail first, then full imagery
- Add loading progress indicator with percentage
- Consider further reducing imagery resolution for 320px devices  
**Effort Estimate**: Medium (2-3 days)

#### Issue 10: No Offline Indicator on Map View
**ID**: UAT-PLANT-010  
**Priority**: Low (P3)  
**Reported by**: P1  
**Description**: The "Données en cache" indicator is visible on the parcelle list and detail pages, but not on the map view. When viewing the map offline, there is no indication that the data may be outdated.  
**Recommendation**: Add a small "Hors ligne" (Offline) badge to the map view when displaying cached imagery.  
**Effort Estimate**: Low (0.5 day)

#### Issue 11: Parcelle List Does Not Show Last Satellite Analysis Date
**ID**: UAT-PLANT-011  
**Priority**: Low (P3)  
**Reported by**: P3  
**Description**: The parcelle list shows the health status badge but not when the last satellite analysis was performed. Planteurs want to know if the health status is recent or outdated.  
**Recommendation**: Add a small "Analysé le [date]" label below the health status badge on the list view.  
**Effort Estimate**: Low (0.5 day)

#### Issue 12: No French Translation for Some Technical Labels
**ID**: UAT-PLANT-012  
**Priority**: Low (P3)  
**Reported by**: P2  
**Description**: A few technical labels remain in English (e.g., "NDVI", "Cache", "Offline"). While "NDVI" is a technical term, "Cache" and "Offline" should be translated to French for planteur users.  
**Recommendation**: 
- Replace "Cache" with "Données sauvegardées"
- Replace "Offline" with "Hors ligne"
- Add French tooltip for "NDVI" explaining it in simple terms  
**Effort Estimate**: Low (0.5 day)

---

## Positive Feedback / Retours Positifs

All planteurs highlighted the following strengths:

1. **Offline Mode**: "This is exactly what we need in the field. We don't always have network." (P1, P3)

2. **Health Status Colors**: "The colors are immediately understandable. Red means danger, green means good." (P1, P3)

3. **Simple Language**: "The recommendations are in simple French. I understand what to do." (P2, P3)

4. **Cached Data Indicator**: "I know the data is from the cache. I trust it but I know it might not be the latest." (P1)

5. **Map Zoom**: "The zoom works well, like on Google Maps. I already know how to use it." (P1, P3)

6. **Health Status on List**: "I can see all my parcelles and their health at once. Very practical." (P3)

---

## Recommendations / Recommandations

### Must Fix Before Production / À Corriger Avant la Production

1. **UAT-PLANT-001**: Increase touch target sizes to minimum 44x44px for all interactive elements
2. **UAT-PLANT-002**: Improve temporal slider usability with visual affordance and swipe hints
3. **UAT-PLANT-003**: Make manual cache refresh button more discoverable

### Should Fix Before Production / À Corriger Avant la Production (Recommandé)

4. **UAT-PLANT-004**: Hide raw NDVI value from planteur view or add simple explanation
5. **UAT-PLANT-005**: Increase NDVI color legend size for mobile
6. **UAT-PLANT-006**: Improve cache date format to include absolute date
7. **UAT-PLANT-007**: Enhance health recommendations with more specific guidance
8. **UAT-PLANT-008**: Add health trend arrow to parcelle list view

### Can Fix in Next Iteration / Peut Être Corrigé dans la Prochaine Itération

9. **UAT-PLANT-009**: Progressive imagery loading for slow connections
10. **UAT-PLANT-010**: Add offline indicator to map view
11. **UAT-PLANT-011**: Show last analysis date on parcelle list
12. **UAT-PLANT-012**: Complete French translation of technical labels

---

## UAT Sign-Off / Validation UAT

### Acceptance Decision / Décision d'Acceptation

Based on the UAT results:

- **Overall satisfaction**: 3.9/5.0 (target: ≥3.5) ✅
- **Task completion rate**: 87% (target: ≥85%) ✅
- **Critical issues**: 0 ✅
- **High priority issues**: 3 (must be addressed before production)

**Decision**: ✅ **UAT PASSED** - Feature accepted with conditions

**Conditions for Production Deployment**:
1. Issues UAT-PLANT-001, UAT-PLANT-002, and UAT-PLANT-003 must be resolved before production deployment
2. Issues UAT-PLANT-004 through UAT-PLANT-008 should be resolved before production deployment
3. Remaining issues can be addressed in the next iteration

---

### Sign-Off / Signatures

| Role | Name | Date | Signature |
|------|------|------|-----------|
| UAT Facilitator | | May 2026 | |
| Product Owner | | May 2026 | |
| Lead Developer | | May 2026 | |
| Participant P1 | [Anonymized] | May 2026 | |
| Participant P2 | [Anonymized] | May 2026 | |
| Participant P3 | [Anonymized] | May 2026 | |
| Participant P4 | [Anonymized] | May 2026 | |

---

## Next Steps / Prochaines Étapes

1. **Immediate** (this sprint):
   - Create tickets for UAT-PLANT-001, UAT-PLANT-002, UAT-PLANT-003
   - Assign to development team
   - Target completion: before production deployment

2. **Short-term** (next sprint):
   - Create tickets for UAT-PLANT-004 through UAT-PLANT-008
   - Prioritize in backlog

3. **Medium-term** (future iterations):
   - Create tickets for UAT-PLANT-009 through UAT-PLANT-012
   - Add to product roadmap

4. **Follow-up**:
   - Share results with development team
   - Thank participants and provide compensation (via cooperative managers)
   - Inform participants when improvements are deployed

---

**Document Prepared By**: CocoaTrack Development Team  
**UAT Conducted**: May 2026  
**Document Version**: 1.0  
**Status**: Final
