# ProductLinesTable Component Implementation

## Overview

The `ProductLinesTable` component is a dynamic table for managing product lines in collection receipts. It provides automatic calculations, real-time validation, and an intuitive interface for adding/removing product lines.

## Features

### 1. Dynamic Row Management
- Add new product lines with the "Ajouter une ligne" button
- Remove individual lines with the trash icon
- Minimum 0 lines, no maximum limit

### 2. Automatic Calculations

#### Net Weight Calculation
```typescript
netWeight = grossWeight * (1 - humidity/100)
```
- Automatically recalculates when gross weight or humidity changes
- Displayed in read-only field (gray background)
- Rounded to 2 decimal places

#### Line Amount Calculation
```typescript
amount = netWeight * pricePerKg
```
- Automatically recalculates when net weight or price changes
- Displayed in read-only field (gray background)
- Formatted with thousand separators

#### Total Amount
```typescript
totalAmount = sum of all line amounts
```
- Displayed in table footer
- Updates automatically when any line changes
- Formatted with thousand separators and "XAF" suffix

### 3. Field Validation

#### Commercial Type
- Required field
- Error: "Le type commercial est obligatoire"

#### Gross Weight
- Must be > 0
- Error: "Le poids brut doit être supérieur à zéro"

#### Humidity
- Must be between 0 and 100
- Error: "L'humidité doit être entre 0% et 100%"

#### Price per Kg
- Must be > 0
- Error: "Le prix doit être supérieur à zéro"

### 4. User Experience
- Inline error messages below invalid fields
- Red border on invalid fields
- Green focus ring on valid fields
- Responsive table with horizontal scroll on small screens
- Clear visual distinction between editable and calculated fields

## Usage

### Basic Usage

```tsx
import { ProductLinesTable } from '@/components/receipts';
import type { ProductLine } from '@/types/receipts';

function MyForm() {
  const [productLines, setProductLines] = useState<ProductLine[]>([]);

  return (
    <ProductLinesTable
      lines={productLines}
      onChange={setProductLines}
    />
  );
}
```

### With Initial Data

```tsx
const [productLines, setProductLines] = useState<ProductLine[]>([
  {
    commercialType: 'Tout Venant',
    grossWeight: 500,
    humidity: 8,
    netWeight: 460,
    pricePerKg: 1200,
    amount: 552000,
  },
]);
```

### Accessing Total Amount

```tsx
const totalAmount = productLines.reduce((sum, line) => sum + line.amount, 0);
```

### Form Integration

```tsx
function ReceiptForm() {
  const [productLines, setProductLines] = useState<ProductLine[]>([]);
  const [amountPaid, setAmountPaid] = useState(0);

  const totalAmount = productLines.reduce((sum, line) => sum + line.amount, 0);
  const balance = totalAmount - amountPaid;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (productLines.length === 0) {
      alert('Veuillez ajouter au moins une ligne de produit');
      return;
    }

    // Submit form data
    const formData = {
      productLines,
      totalAmount,
      amountPaid,
      balance,
    };
    
    console.log('Submitting:', formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <ProductLinesTable
        lines={productLines}
        onChange={setProductLines}
      />
      
      <div className="mt-4">
        <label>Montant versé (XAF)</label>
        <input
          type="number"
          value={amountPaid}
          onChange={(e) => setAmountPaid(parseFloat(e.target.value) || 0)}
        />
      </div>
      
      <div className="mt-2">
        <strong>Solde: {balance.toLocaleString('fr-FR')} XAF</strong>
      </div>
      
      <button type="submit">Créer le reçu</button>
    </form>
  );
}
```

## Props

### `lines: ProductLine[]`
Array of product lines to display and edit.

### `onChange: (lines: ProductLine[]) => void`
Callback function called whenever the product lines change (add, remove, or edit).

## ProductLine Type

```typescript
interface ProductLine {
  commercialType: string;    // e.g., "Tout Venant", "G2"
  grossWeight: number;       // kg
  humidity: number;          // percentage (0-100)
  netWeight: number;         // kg (calculated)
  pricePerKg: number;        // XAF
  amount: number;            // XAF (calculated)
}
```

## Validation Rules

| Field | Rule | Error Message |
|-------|------|---------------|
| commercialType | Required, non-empty | "Le type commercial est obligatoire" |
| grossWeight | > 0 | "Le poids brut doit être supérieur à zéro" |
| humidity | 0 ≤ value ≤ 100 | "L'humidité doit être entre 0% et 100%" |
| pricePerKg | > 0 | "Le prix doit être supérieur à zéro" |

## Calculation Formulas

### Net Weight
```
netWeight = grossWeight × (1 - humidity/100)
```

Example:
- Gross weight: 500 kg
- Humidity: 8%
- Net weight: 500 × (1 - 8/100) = 500 × 0.92 = 460 kg

### Line Amount
```
amount = netWeight × pricePerKg
```

Example:
- Net weight: 460 kg
- Price per kg: 1200 XAF
- Amount: 460 × 1200 = 552,000 XAF

### Total Amount
```
totalAmount = Σ(amount for each line)
```

Example:
- Line 1: 552,000 XAF
- Line 2: 418,500 XAF
- Total: 970,500 XAF

## Styling

The component uses Tailwind CSS with CocoaTrack brand colors:
- Primary color: `#6FAF3D` (green)
- Error color: `#ef4444` (red)
- Gray shades for backgrounds and borders

### Customization

To customize colors, modify the className strings:
- Focus ring: `focus:ring-[#6FAF3D]` → `focus:ring-[#YOUR_COLOR]`
- Error border: `border-red-500` → `border-[#YOUR_COLOR]`

## Accessibility

- All inputs have proper labels (table headers)
- Error messages are associated with their inputs
- Keyboard navigation supported
- Focus indicators visible
- Color contrast meets WCAG AA standards

## Performance

- Efficient re-renders using React state
- Calculations performed only when relevant fields change
- No unnecessary re-calculations on unrelated field updates

## Testing

### Unit Tests
See `ProductLinesTable.test.tsx` for:
- Add/remove row functionality
- Net weight calculation
- Amount calculation
- Total calculation
- Field validation
- Error display

### Property Tests
See `product-lines.property.test.ts` for:
- Property 2: Net Weight Calculation
- Property 3: Line Amount Calculation
- Property 4: Total Amount Calculation

## Requirements Mapping

| Requirement | Implementation |
|-------------|----------------|
| 5.5 | Dynamic table with add/remove rows |
| 5.6 | Add and remove product lines |
| 5.7 | Automatic net weight calculation |
| 5.8 | Automatic amount calculation |
| 5.9 | Display total amount |

## Related Components

- `ReceiptForm`: Parent form component that uses ProductLinesTable
- `PlanteurAutocomplete`: For selecting planteur
- `ChefPlanteurAutocomplete`: For selecting chef planteur
- `PdfViewer`: For viewing the receipt PDF alongside the form

## Example

See `ProductLinesTableExample.tsx` for a complete working example with:
- Initial data
- State management
- Total calculation
- Debug output

## Troubleshooting

### Calculations not updating
- Ensure you're passing the `onChange` callback
- Check that parent component is updating state correctly

### Validation errors not showing
- Errors are stored in internal component state
- Check browser console for any React errors

### Styling issues
- Ensure Tailwind CSS is properly configured
- Check that all required Tailwind classes are included in your build

## Future Enhancements

Potential improvements for future versions:
- Bulk import from CSV
- Preset commercial types dropdown
- Duplicate line detection
- Undo/redo functionality
- Drag-and-drop row reordering
- Export to Excel
