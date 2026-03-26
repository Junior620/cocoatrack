# ReceiptForm Component Implementation

## Overview
Created the main ReceiptForm component for importing collection receipts from PDF files.

## Component Location
`v2/components/receipts/ReceiptForm.tsx`

## Features Implemented

### 1. Form Sections (Requirement 5.1)
- ✅ Informations du contrat (contract number, receipt number, campaign)
- ✅ Informations de localisation (region, department, arrondissement, village)
- ✅ Informations de transaction (date, seller/planteur, buyer/chef planteur, professional card)
- ✅ Tableau des produits (using ProductLinesTable component)
- ✅ Informations de paiement (payment mode, amount paid, balance)

### 2. Component Integration
- ✅ PlanteurAutocomplete for seller selection (Requirement 5.4)
- ✅ ChefPlanteurAutocomplete for buyer selection (Requirement 5.4)
- ✅ ProductLinesTable for product lines management (Requirement 5.5)
- ✅ PdfViewer for PDF preview alongside the form (Requirement 5.17)

### 3. Automatic Calculations
- ✅ Balance = Total Amount - Amount Paid (Requirement 5.11)
- ✅ Total amount from ProductLinesTable (Requirement 5.9)
- ✅ Real-time calculation updates

### 4. Validation (Requirements 5.12-5.16)
- ✅ All required fields validation
- ✅ Date cannot be in the future (Requirement 5.13)
- ✅ At least one product line required
- ✅ Cooperative consistency check between planteur and chef planteur (Requirement 5.16)
- ✅ Amount paid cannot be negative

### 5. User Experience
- ✅ Inline error messages under each field
- ✅ Real-time validation as user types
- ✅ Warning message for cooperative mismatch
- ✅ Disabled state during submission
- ✅ Clear visual hierarchy with sections
- ✅ Responsive layout with PDF viewer on the side

### 6. Form Data Structure
```typescript
interface ReceiptFormData {
  // Contract info
  contractNumber: string;
  receiptNumber: string;
  campaign: string;
  
  // Location
  region: string;
  department: string;
  arrondissement: string;
  village: string;
  
  // Transaction
  transactionDate: string;
  planteurId: string;
  chefPlanteurId: string;
  professionalCardNumber: string;
  
  // Products
  productLines: ProductLine[];
  
  // Payment
  paymentMode: 'Espèces' | 'Autres';
  amountPaid: number;
}
```

## Props Interface
```typescript
interface ReceiptFormProps {
  initialData?: Partial<ReceiptFormData>;  // For OCR pre-fill
  pdfUrl: string;                          // For PDF viewer
  cooperativeId: string;                   // For filtering autocompletes
  onSubmit: (data: ReceiptFormData) => void | Promise<void>;
  isSubmitting?: boolean;
}
```

## Validation Rules Implemented

### Required Fields
- Contract number
- Receipt number
- Campaign
- Transaction date
- Planteur (seller)
- Chef planteur (buyer)
- At least one product line

### Field-Specific Validation
- **Transaction Date**: Cannot be in the future
- **Amount Paid**: Cannot be negative
- **Cooperative Consistency**: Warning if planteur and chef planteur are from different cooperatives

## Layout
- Two-column grid layout (form on left, PDF viewer on right)
- Responsive: stacks on mobile, side-by-side on desktop
- PDF viewer is sticky on desktop for easy reference while filling form
- Each section is visually separated with cards

## Styling
- Uses Tailwind CSS classes
- Primary color: #6FAF3D (CocoaTrack green)
- Error states: red borders and text
- Warning states: yellow text with icon
- Consistent spacing and typography

## Integration Points
- Integrates with existing PlanteurAutocomplete component
- Integrates with existing ChefPlanteurAutocomplete component
- Integrates with existing ProductLinesTable component
- Integrates with existing PdfViewer component
- Uses ProductLine type from @/types/receipts

## Next Steps
This component is ready to be integrated into the ReceiptImportWizard as the form step.

## Requirements Validated
- ✅ Requirement 5.1: Display 5 sections
- ✅ Requirement 5.2: Contract information section
- ✅ Requirement 5.3: Location information section
- ✅ Requirement 5.4: Transaction information section
- ✅ Requirement 5.10: Payment information section
- ✅ Requirement 5.11: Automatic balance calculation
- ✅ Requirement 5.12: Required fields validation
- ✅ Requirement 5.13: Date validation (not in future)
- ✅ Requirement 5.16: Cooperative consistency validation
- ✅ Requirement 5.17: PDF viewer alongside form
