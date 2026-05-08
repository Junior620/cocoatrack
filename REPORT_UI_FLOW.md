# Report Generation UI Flow

## Visual Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                  Parcelle Detail Page                        │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Header Section                                       │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────────┐ │  │
│  │  │ Calculate  │  │    KML     │  │ Générer Rapport│ │  │
│  │  │ Elevation  │  │   Export   │  │    [BUTTON]    │ │  │
│  │  └────────────┘  └────────────┘  └────────────────┘ │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  [Map Section]                                               │
│  [Health Status Section]                                     │
│  [Deforestation Alerts Section]                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ User clicks "Générer Rapport"
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Report Options Modal (Overlay)                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Options du Rapport de Certification            [X]   │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │                                                        │  │
│  │  Langue du rapport:                                   │  │
│  │    ○ Français  ○ English                              │  │
│  │                                                        │  │
│  │  Date de référence EUDR:                              │  │
│  │    [2020-12-31] (date picker)                         │  │
│  │                                                        │  │
│  │  Sections à inclure:                                  │  │
│  │    ☑ Imagerie avant/après                             │  │
│  │    ☑ Tendance NDVI                                    │  │
│  │    ☐ Prédiction de rendement                          │  │
│  │                                                        │  │
│  │  ┌─────────────────────────────────────────────────┐ │  │
│  │  │ ℹ️  À propos du rapport                          │ │  │
│  │  │ Le rapport de certification inclut les          │ │  │
│  │  │ informations de la parcelle, l'analyse de       │ │  │
│  │  │ déforestation, et un statut de conformité EUDR. │ │  │
│  │  │ La génération peut prendre jusqu'à 30 secondes. │ │  │
│  │  └─────────────────────────────────────────────────┘ │  │
│  │                                                        │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │                    [Annuler]  [Générer le rapport]    │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ User clicks "Générer le rapport"
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Report Options Modal (Loading)                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Options du Rapport de Certification            [X]   │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │                                                        │  │
│  │  [All options shown but disabled]                     │  │
│  │                                                        │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │         [Annuler]  [⟳ Génération en cours...]         │  │
│  │                    (buttons disabled)                  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Generation completes
                            ▼
                    ┌───────────────┐
                    │   Success?    │
                    └───────┬───────┘
                            │
              ┌─────────────┴─────────────┐
              │                           │
              ▼ YES                       ▼ NO
┌─────────────────────────────┐  ┌─────────────────────────────┐
│    Parcelle Detail Page     │  │    Parcelle Detail Page     │
│                             │  │                             │
│  [Modal closes]             │  │  [Modal stays open]         │
│                             │  │                             │
│  ┌───────────────────────┐ │  │  ┌───────────────────────┐ │
│  │ ✓ Rapport généré      │ │  │  │ ⚠️ Erreur lors de la  │ │
│  │   avec succès         │ │  │  │   génération du       │ │
│  │                       │ │  │  │   rapport             │ │
│  │ Le rapport pour       │ │  │  │                       │ │
│  │ PAR-001 est prêt.     │ │  │  │ [Error message]       │ │
│  │                       │ │  │  │                       │ │
│  │ [Télécharger]         │ │  │  │ [Fermer]              │ │
│  │ [Ouvrir nouvel onglet]│ │  │  └───────────────────────┘ │
│  │ [Fermer]              │ │  │                             │
│  └───────────────────────┘ │  │  User can retry or close    │
└─────────────────────────────┘  └─────────────────────────────┘
              │
              │ User clicks download
              ▼
┌─────────────────────────────────────────────────────────────┐
│                    New Browser Tab                           │
│                                                              │
│  [PDF Report opens for download/viewing]                    │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Rapport de Certification EUDR                        │  │
│  │  Parcelle: PAR-001                                    │  │
│  │  Date: 2026-05-08                                     │  │
│  │                                                        │  │
│  │  [Report content...]                                  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## State Transitions

```
┌──────────────┐
│   Initial    │
│   State      │
└──────┬───────┘
       │
       │ showReportModal = false
       │ generatingReport = false
       │ reportUrl = null
       │ reportError = null
       │
       │ User clicks "Générer Rapport"
       ▼
┌──────────────┐
│ Modal Open   │
│   State      │
└──────┬───────┘
       │
       │ showReportModal = true
       │ generatingReport = false
       │
       │ User clicks "Générer le rapport"
       ▼
┌──────────────┐
│ Generating   │
│   State      │
└──────┬───────┘
       │
       │ showReportModal = true
       │ generatingReport = true
       │
       │ API call completes
       ▼
   ┌───────┐
   │Result?│
   └───┬───┘
       │
   ┌───┴────┐
   │        │
   ▼        ▼
Success   Error
   │        │
   │        │ showReportModal = true
   │        │ generatingReport = false
   │        │ reportError = "message"
   │        │
   │        └──────────┐
   │                   │
   │ showReportModal = false
   │ generatingReport = false
   │ reportUrl = "url"
   │
   ▼
┌──────────────┐
│  Download    │
│   State      │
└──────┬───────┘
       │
       │ reportUrl = "url"
       │
       │ User clicks "Fermer"
       ▼
┌──────────────┐
│   Initial    │
│   State      │
└──────────────┘
```

## Component Hierarchy

```
ParcelleDetailContent
│
├── Header Section
│   ├── Calculate Elevation Button
│   ├── Static Image Button
│   ├── KML Export Button
│   └── Generate Report Button ← NEW
│       └── onClick: setShowReportModal(true)
│
├── [Other sections...]
│
├── ReportOptionsModal ← NEW
│   ├── Props:
│   │   ├── isOpen: showReportModal
│   │   ├── onClose: () => setShowReportModal(false)
│   │   ├── onGenerate: handleGenerateReport
│   │   └── isGenerating: generatingReport
│   │
│   └── Content:
│       ├── Language Radio Buttons
│       ├── Baseline Date Input
│       ├── Section Checkboxes
│       ├── Info Box
│       └── Action Buttons
│
├── ReportDownloadLink ← NEW
│   ├── Conditional: {reportUrl && ...}
│   ├── Props:
│   │   ├── reportUrl: reportUrl
│   │   ├── parcelleCode: parcelle.code
│   │   └── onClose: handleCloseReportDownload
│   │
│   └── Content:
│       ├── Success Message
│       ├── Download Button
│       ├── Open in New Tab Link
│       └── Close Button
│
└── Report Error Display ← NEW
    ├── Conditional: {reportError && ...}
    └── Content:
        ├── Error Icon
        ├── Error Message
        └── Close Button
```

## API Call Flow

```
┌─────────────────┐
│  User clicks    │
│  "Générer le    │
│   rapport"      │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  handleGenerateReport(options)          │
│                                         │
│  1. setGeneratingReport(true)           │
│  2. setReportError(null)                │
│  3. setReportUrl(null)                  │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  POST /api/satellite/reports/           │
│       certification                      │
│                                         │
│  Body: {                                │
│    parcelleId: string,                  │
│    options: {                           │
│      language: 'fr' | 'en',             │
│      includeBeforeAfter: boolean,       │
│      includeNDVITrend: boolean,         │
│      includeYieldPrediction: boolean,   │
│      baselineDate: string               │
│    }                                    │
│  }                                      │
└────────┬────────────────────────────────┘
         │
         ▼
    ┌────────┐
    │Response│
    └────┬───┘
         │
    ┌────┴─────┐
    │          │
    ▼          ▼
  Success    Error
    │          │
    │          ├─ setReportError(message)
    │          └─ setGeneratingReport(false)
    │
    ├─ setReportUrl(url)
    ├─ setShowReportModal(false)
    └─ setGeneratingReport(false)
```

## User Interaction Points

1. **"Générer Rapport" Button**
   - Location: Header section
   - Action: Opens modal
   - Visibility: Active parcelles only

2. **Language Selection**
   - Location: Modal
   - Type: Radio buttons
   - Options: Français, English

3. **Baseline Date**
   - Location: Modal
   - Type: Date input
   - Default: 2020-12-31

4. **Section Checkboxes**
   - Location: Modal
   - Type: Checkboxes
   - Options: 3 sections

5. **"Annuler" Button**
   - Location: Modal footer
   - Action: Closes modal
   - State: Disabled during generation

6. **"Générer le rapport" Button**
   - Location: Modal footer
   - Action: Starts generation
   - State: Disabled during generation

7. **"Télécharger le rapport" Button**
   - Location: Download link section
   - Action: Opens report in new tab
   - Visibility: After successful generation

8. **"Ouvrir dans un nouvel onglet" Link**
   - Location: Download link section
   - Action: Opens report in new tab
   - Visibility: After successful generation

9. **"Fermer" Button (Download)**
   - Location: Download link section
   - Action: Dismisses download link
   - Visibility: After successful generation

10. **"Fermer" Button (Error)**
    - Location: Error message
    - Action: Dismisses error
    - Visibility: After generation error
```

This visual flow diagram shows the complete user journey from clicking the button to downloading the report!
