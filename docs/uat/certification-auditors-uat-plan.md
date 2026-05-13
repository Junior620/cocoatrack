# UAT Plan: Certification Auditors - Satellite Imagery Analysis
# Plan de Tests d'Acceptation Utilisateur : Auditeurs de Certification

**Feature**: Satellite Imagery Analysis Integration  
**Target Users**: Certification Auditors (Auditeurs de Certification)  
**Date**: May 2026  
**Version**: 1.0  
**Status**: Ready for Execution

---

## 1. Objectives / Objectifs

### English
The purpose of this UAT is to validate that the satellite imagery analysis features meet the needs of certification auditors for EUDR (EU Deforestation Regulation) compliance verification. Specifically, we will test:

1. **Deforestation Detection**: Ability to detect and review vegetation loss events
2. **Certification Report Generation**: Automated PDF reports for compliance documentation
3. **EUDR Compliance Features**: Baseline comparison, compliance status, and audit trail

### Français
L'objectif de ce test d'acceptation est de valider que les fonctionnalités d'analyse d'imagerie satellitaire répondent aux besoins des auditeurs de certification pour la vérification de la conformité RDUE (Règlement de l'UE sur la Déforestation). Nous testerons spécifiquement :

1. **Détection de la Déforestation**: Capacité à détecter et examiner les événements de perte de végétation
2. **Génération de Rapports de Certification**: Rapports PDF automatisés pour la documentation de conformité
3. **Fonctionnalités de Conformité RDUE**: Comparaison de référence, statut de conformité et piste d'audit

---

## 2. Participant Recruitment / Recrutement des Participants

### Target Profile / Profil Cible

**Ideal Participants / Participants Idéaux:**
- 1-2 certification auditors with experience in cocoa traceability
- Familiarity with EUDR requirements (December 31, 2020 baseline)
- Experience with satellite imagery or GIS tools (preferred but not required)
- French-speaking (primary) or English-speaking

**Recrutement:**
- Contact certification bodies operating in Cameroon (Rainforest Alliance, Fairtrade, UTZ)
- Reach out through cooperative networks
- Offer compensation for 2-hour testing session (e.g., 50,000 FCFA or equivalent)

### Contact Approach / Approche de Contact

**Email Template:**

```
Objet : Invitation à tester une nouvelle fonctionnalité de traçabilité du cacao

Bonjour [Nom],

Nous développons une nouvelle fonctionnalité d'analyse d'imagerie satellitaire pour CocoaTrack, notre plateforme de traçabilité du cacao au Cameroun. Cette fonctionnalité aide à vérifier la conformité RDUE en détectant la déforestation sur les parcelles de cacao.

Nous recherchons 1-2 auditeurs de certification pour tester cette fonctionnalité et nous fournir des retours. La session de test durera environ 2 heures et sera rémunérée.

Seriez-vous intéressé(e) à participer ? Nous pouvons organiser la session à votre convenance.

Cordialement,
[Votre nom]
```

---

## 3. Test Environment / Environnement de Test

**Platform**: CocoaTrack Staging Environment  
**URL**: https://staging.cocoatrack.cm (or equivalent)  
**Test Account**: Auditor role with access to test parcelles  
**Test Data**: 
- 5-10 test parcelles with various scenarios:
  - Parcelle with no deforestation (compliant)
  - Parcelle with minor vegetation loss (compliant)
  - Parcelle with significant deforestation (non-compliant)
  - Parcelle with disputed alert
  - Parcelle with acknowledged alert

**Required Setup:**
- Test parcelles with historical NDVI data (Dec 2020 - present)
- Sample deforestation alerts in various statuses
- Baseline imagery from December 2020

---

## 4. Test Scenarios / Scénarios de Test

### Scenario 1: View and Review Deforestation Alerts
### Scénario 1 : Consulter et Examiner les Alertes de Déforestation

**Objective / Objectif**: Verify that auditors can view, understand, and review deforestation alerts.

**Prerequisites / Prérequis**:
- Logged in as auditor
- At least 3 parcelles with deforestation alerts (pending, acknowledged, disputed)

**Test Steps / Étapes de Test**:

1. **Navigate to parcelle list**
   - Go to Parcelles page
   - Look for parcelles with deforestation alert indicators (red icon/border)
   - **Expected**: Parcelles with alerts are visually distinct

2. **View alert details**
   - Click on a parcelle with a pending alert
   - Scroll to deforestation alerts section
   - **Expected**: Alert displays:
     - Detection date
     - Baseline date (Dec 31, 2020)
     - Baseline NDVI value
     - Current NDVI value
     - NDVI change (negative value)
     - Affected area in hectares
     - Affected area as percentage
     - Status (pending/acknowledged/disputed)

3. **View before/after comparison**
   - Click "View Comparison" or similar button
   - **Expected**: Side-by-side imagery showing:
     - Baseline imagery (Dec 2020)
     - Current imagery
     - NDVI visualization for both periods
     - Clear visual difference in vegetation

4. **Review alert history**
   - View all alerts for the parcelle
   - Filter by status (pending, acknowledged, disputed)
   - **Expected**: Can see all historical alerts with timestamps

**Success Criteria / Critères de Réussite**:
- ✅ Alerts are easy to find and understand
- ✅ All required information is displayed clearly
- ✅ Before/after comparison is visually clear
- ✅ Alert history is accessible

**Feedback Questions / Questions de Retour**:
1. Est-ce que les informations d'alerte sont suffisantes pour votre audit ?
2. Y a-t-il des informations manquantes que vous aimeriez voir ?
3. La comparaison avant/après est-elle claire et convaincante ?

---

### Scenario 2: Generate Certification Report (Single Parcelle)
### Scénario 2 : Générer un Rapport de Certification (Parcelle Unique)

**Objective / Objectif**: Verify that auditors can generate comprehensive EUDR compliance reports.

**Prerequisites / Prérequis**:
- Logged in as auditor
- Parcelle with complete data (NDVI history, deforestation status)

**Test Steps / Étapes de Test**:

1. **Access report generation**
   - Navigate to parcelle detail page
   - Find "Generate Certification Report" button
   - Click the button
   - **Expected**: Report options modal appears

2. **Configure report options**
   - Select language (French/English)
   - Select sections to include:
     - ☑ Parcelle details
     - ☑ EUDR baseline comparison
     - ☑ NDVI trend analysis
     - ☑ Deforestation alerts
     - ☑ Before/after imagery
   - Click "Generate Report"
   - **Expected**: Progress indicator shows report generation

3. **Download and review report**
   - Wait for report generation (should be <30 seconds)
   - Download PDF report
   - Open and review report contents
   - **Expected**: Report includes:
     - Cover page with parcelle name and date
     - Parcelle details (location, surface area, owner)
     - EUDR baseline section:
       - Baseline date (Dec 31, 2020)
       - Baseline NDVI value
       - Current NDVI value
       - Comparison analysis
     - NDVI trend chart (12 months)
     - Deforestation alerts section (if any)
     - Before/after satellite imagery
     - Compliance status indicator (Compliant/Non-Compliant/Requires Review)
     - Declaration statement
     - Digital signature with timestamp
     - Auditor information

4. **Verify report accuracy**
   - Cross-check report data with UI data
   - Verify imagery matches displayed imagery
   - Verify NDVI values are correct
   - **Expected**: All data matches UI display

**Success Criteria / Critères de Réussite**:
- ✅ Report generates within 30 seconds
- ✅ Report is professionally formatted
- ✅ All required sections are present
- ✅ Data accuracy is 100%
- ✅ Report is suitable for official documentation

**Feedback Questions / Questions de Retour**:
1. Le rapport contient-il toutes les informations nécessaires pour la certification RDUE ?
2. Le format et la présentation sont-ils professionnels ?
3. Y a-t-il des sections supplémentaires que vous aimeriez voir ?
4. Le rapport est-il acceptable pour la soumission aux autorités de l'UE ?

---

### Scenario 3: Batch Report Generation
### Scénario 3 : Génération de Rapports en Lot

**Objective / Objectif**: Verify that auditors can efficiently generate reports for multiple parcelles.

**Prerequisites / Prérequis**:
- Logged in as auditor
- Access to 5+ parcelles in a cooperative

**Test Steps / Étapes de Test**:

1. **Select multiple parcelles**
   - Go to Parcelles list page
   - Filter by cooperative (if needed)
   - Select 5 parcelles using checkboxes
   - **Expected**: Selection count displayed

2. **Initiate batch report generation**
   - Click "Generate Reports" button (batch action)
   - Configure report options (same for all)
   - Click "Generate Batch Reports"
   - **Expected**: Progress indicator shows X/5 reports generated

3. **Download batch reports**
   - Wait for all reports to generate
   - Download ZIP archive containing all reports
   - Extract and review reports
   - **Expected**: 
     - ZIP file contains 5 PDF reports
     - Each report is named clearly (e.g., "Parcelle_[Name]_Certification_Report.pdf")
     - All reports are complete and accurate

**Success Criteria / Critères de Réussite**:
- ✅ Batch generation completes within 5 minutes for 5 parcelles
- ✅ All reports are included in ZIP
- ✅ File naming is clear and consistent
- ✅ No errors during generation

**Feedback Questions / Questions de Retour**:
1. Le processus de génération en lot est-il efficace ?
2. Le temps de génération est-il acceptable ?
3. L'organisation des fichiers est-elle claire ?

---

### Scenario 4: EUDR Compliance Verification
### Scénario 4 : Vérification de la Conformité RDUE

**Objective / Objectif**: Verify that auditors can assess EUDR compliance status.

**Prerequisites / Prérequis**:
- Logged in as auditor
- Access to parcelles with various compliance statuses

**Test Steps / Étapes de Test**:

1. **View compliance dashboard**
   - Navigate to cooperative overview or compliance dashboard
   - **Expected**: See summary of compliance status:
     - Total parcelles
     - Compliant parcelles (count and %)
     - Non-compliant parcelles (count and %)
     - Parcelles requiring review (count and %)

2. **Filter by compliance status**
   - Filter parcelle list by "Non-Compliant"
   - **Expected**: Only parcelles with NDVI decrease > 0.3 from baseline shown

3. **Review baseline comparison**
   - Select a non-compliant parcelle
   - View EUDR baseline section
   - **Expected**: Clear display of:
     - Baseline date: December 31, 2020
     - Baseline NDVI: [value]
     - Current NDVI: [value]
     - Change: [negative value] (e.g., -0.35)
     - Interpretation: "Significant vegetation loss detected"

4. **Verify baseline date handling**
   - Check if baseline imagery is from exactly Dec 31, 2020
   - If not available, check if closest date within 60 days is used
   - **Expected**: System uses appropriate baseline with clear documentation

5. **Export compliance data**
   - Export parcelle list with compliance status
   - **Expected**: CSV includes compliance status column

**Success Criteria / Critères de Réussite**:
- ✅ Compliance status is clearly indicated
- ✅ Baseline date (Dec 31, 2020) is consistently used
- ✅ NDVI threshold (0.3) is correctly applied
- ✅ Compliance data can be exported

**Feedback Questions / Questions de Retour**:
1. Le statut de conformité est-il clair et facile à comprendre ?
2. La date de référence RDUE (31 décembre 2020) est-elle correctement appliquée ?
3. Les critères de conformité sont-ils appropriés ?

---

### Scenario 5: Alert Acknowledgment and Dispute
### Scénario 5 : Reconnaissance et Contestation d'Alerte

**Objective / Objectif**: Verify that auditors can acknowledge or dispute deforestation alerts.

**Prerequisites / Prérequis**:
- Logged in as auditor (or cooperative manager with appropriate permissions)
- Parcelle with pending deforestation alert

**Test Steps / Étapes de Test**:

1. **Acknowledge an alert**
   - Navigate to parcelle with pending alert
   - Click "Acknowledge Alert" button
   - Enter acknowledgment notes (e.g., "Verified deforestation. Farmer notified.")
   - Submit acknowledgment
   - **Expected**:
     - Alert status changes to "Acknowledged"
     - Acknowledgment notes are saved
     - Auditor name and timestamp are recorded
     - Action is logged in audit trail

2. **Dispute an alert**
   - Navigate to different parcelle with pending alert
   - Click "Dispute Alert" button
   - Enter dispute reason (e.g., "False positive. Cloud shadow misidentified as deforestation.")
   - Submit dispute
   - **Expected**:
     - Alert status changes to "Disputed"
     - Dispute reason is saved
     - Auditor name and timestamp are recorded
     - Action is logged in audit trail

3. **View audit trail**
   - View alert history
   - **Expected**: See complete audit trail:
     - Alert created: [date, system]
     - Alert acknowledged: [date, auditor name, notes]
     - Alert disputed: [date, auditor name, reason]

**Success Criteria / Critères de Réussite**:
- ✅ Acknowledgment and dispute workflows are clear
- ✅ All actions are properly logged
- ✅ Audit trail is complete and tamper-proof

**Feedback Questions / Questions de Retour**:
1. Le processus de reconnaissance/contestation est-il clair ?
2. Y a-t-il suffisamment d'espace pour documenter vos décisions ?
3. La piste d'audit est-elle suffisante pour vos besoins de certification ?

---

## 5. General Usability Testing / Test d'Utilisabilité Général

### Navigation and Workflow / Navigation et Flux de Travail

**Test Steps**:
1. Navigate through the satellite imagery features without guidance
2. Try to complete a typical audit workflow:
   - Review all parcelles in a cooperative
   - Identify non-compliant parcelles
   - Generate reports for non-compliant parcelles
   - Document findings

**Feedback Questions**:
1. La navigation est-elle intuitive ?
2. Pouvez-vous accomplir vos tâches d'audit efficacement ?
3. Y a-t-il des fonctionnalités manquantes ?

### Performance / Performance

**Test Steps**:
1. Note loading times for:
   - Parcelle list page
   - Parcelle detail page with satellite data
   - Report generation
   - Before/after imagery comparison

**Feedback Questions**:
1. Les temps de chargement sont-ils acceptables ?
2. Y a-t-il des ralentissements notables ?

### Mobile Experience / Expérience Mobile (Optional)

**Test Steps**:
1. Access the platform on a mobile device or tablet
2. Try to view alerts and generate reports

**Feedback Questions**:
1. L'interface mobile est-elle utilisable ?
2. Préférez-vous utiliser un ordinateur de bureau pour ces tâches ?

---

## 6. Data Collection / Collecte de Données

### During Testing / Pendant le Test

**Observer Notes**:
- Record time to complete each scenario
- Note any confusion or hesitation
- Record any errors or bugs encountered
- Note any positive reactions or "aha" moments

**Think-Aloud Protocol**:
- Ask participants to verbalize their thoughts while testing
- Record quotes and observations

### After Testing / Après le Test

**Feedback Form**:
- Participants complete structured feedback form (see separate template)
- 15-20 minutes to complete

**Debrief Interview**:
- 10-15 minute discussion
- Ask open-ended questions about overall experience
- Gather suggestions for improvements

---

## 7. Success Metrics / Métriques de Réussite

### Quantitative Metrics / Métriques Quantitatives

- **Task Completion Rate**: % of scenarios completed successfully
  - Target: ≥90%
- **Time on Task**: Average time to complete each scenario
  - Scenario 1: <5 minutes
  - Scenario 2: <3 minutes (including report generation)
  - Scenario 3: <10 minutes for 5 parcelles
  - Scenario 4: <5 minutes
  - Scenario 5: <3 minutes per action
- **Error Rate**: Number of errors or failed attempts
  - Target: <2 errors per participant
- **User Satisfaction**: Average rating across all features
  - Target: ≥4.0/5.0

### Qualitative Metrics / Métriques Qualitatives

- Clarity of information presentation
- Appropriateness for EUDR compliance verification
- Professional quality of reports
- Completeness of audit trail
- Overall confidence in using the system for certification

---

## 8. Risk Mitigation / Atténuation des Risques

### Potential Issues / Problèmes Potentiels

1. **Technical Issues**:
   - Mitigation: Test environment thoroughly before UAT
   - Have backup test accounts ready
   - Record session for later review if system fails

2. **Participant No-Show**:
   - Mitigation: Recruit 3-4 participants, expect 1-2 to attend
   - Send reminder 24 hours before session

3. **Language Barrier**:
   - Mitigation: Ensure test facilitator is fluent in French
   - Provide materials in French

4. **Insufficient Test Data**:
   - Mitigation: Prepare comprehensive test dataset in advance
   - Include edge cases and various scenarios

---

## 9. Post-UAT Actions / Actions Post-UAT

### Immediate Actions / Actions Immédiates

1. **Compile Feedback**:
   - Aggregate all feedback forms
   - Compile observer notes
   - Create summary document

2. **Prioritize Issues**:
   - Categorize issues by severity (P0, P1, P2, P3)
   - Identify quick wins vs. major changes

3. **Create Tickets**:
   - Create bug tickets for all issues found
   - Create enhancement tickets for feature requests

### Follow-Up / Suivi

1. **Share Results**:
   - Share UAT summary with development team
   - Share with product stakeholders

2. **Plan Fixes**:
   - Schedule bug fixes before production deployment
   - Plan enhancements for future iterations

3. **Thank Participants**:
   - Send thank-you email
   - Provide compensation
   - Offer to share final product when launched

---

## 10. Appendix: Test Data Requirements / Annexe : Exigences de Données de Test

### Required Test Parcelles / Parcelles de Test Requises

1. **Parcelle A - Compliant**:
   - Baseline NDVI (Dec 2020): 0.75
   - Current NDVI: 0.72
   - Change: -0.03 (within acceptable range)
   - Status: Compliant

2. **Parcelle B - Non-Compliant (Significant Deforestation)**:
   - Baseline NDVI (Dec 2020): 0.78
   - Current NDVI: 0.42
   - Change: -0.36 (exceeds 0.3 threshold)
   - Affected area: 1.2 hectares
   - Status: Non-Compliant
   - Alert: Pending

3. **Parcelle C - Non-Compliant (Acknowledged)**:
   - Baseline NDVI (Dec 2020): 0.80
   - Current NDVI: 0.45
   - Change: -0.35
   - Affected area: 0.8 hectares
   - Status: Non-Compliant
   - Alert: Acknowledged by manager on [date]

4. **Parcelle D - Disputed Alert**:
   - Baseline NDVI (Dec 2020): 0.72
   - Current NDVI: 0.40
   - Change: -0.32
   - Affected area: 0.6 hectares
   - Status: Requires Review
   - Alert: Disputed by manager (reason: "Cloud shadow, not deforestation")

5. **Parcelle E - Borderline Case**:
   - Baseline NDVI (Dec 2020): 0.70
   - Current NDVI: 0.41
   - Change: -0.29 (just below 0.3 threshold)
   - Status: Compliant (but close to threshold)

### Required Imagery / Imagerie Requise

- Baseline imagery for all parcelles (Dec 2020 or closest available)
- Current imagery for all parcelles (recent, <30 days old)
- NDVI visualizations for both periods
- Clear visual difference for non-compliant parcelles

---

**Document Prepared By**: CocoaTrack Development Team  
**Review Date**: May 2026  
**Approval**: [Pending]
