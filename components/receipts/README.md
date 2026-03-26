# Receipt Components

This directory contains components for the receipt import feature.

## Components

### PlanteurAutocomplete

Autocomplete component for selecting or creating planteurs in receipt import.

**Features:**
- Search by name with debounced input (300ms)
- Display suggestions list filtered by cooperative
- "Create new planteur" option when no match found
- Keyboard navigation support (Arrow keys, Enter, Escape)
- Loading states and error handling

**Requirements:** 6.1, 6.2, 6.3, 6.4

**Usage:**
```tsx
import { PlanteurAutocomplete } from '@/components/receipts';

<PlanteurAutocomplete
  value={planteurId}
  onChange={(id, planteur) => {
    setPlanteurId(id);
    setSelectedPlanteur(planteur);
  }}
  onCreateNew={(name) => {
    // Handle creating new planteur
    console.log('Create new planteur:', name);
  }}
  cooperativeId={cooperativeId}
  label="Planteur (Vendeur)"
  required
  error={errors.planteur}
/>
```

### ChefPlanteurAutocomplete

Autocomplete component for selecting or creating chef planteurs in receipt import.

**Features:**
- Search by name with debounced input (300ms)
- Display suggestions list filtered by cooperative
- "Create new chef planteur" option when no match found
- Keyboard navigation support (Arrow keys, Enter, Escape)
- Loading states, error and warning handling
- Support for cooperative consistency warnings (Requirement 6.9)

**Requirements:** 6.5, 6.6, 6.7, 6.8

**Usage:**
```tsx
import { ChefPlanteurAutocomplete } from '@/components/receipts';

<ChefPlanteurAutocomplete
  value={chefPlanteurId}
  onChange={(id, chefPlanteur) => {
    setChefPlanteurId(id);
    setSelectedChefPlanteur(chefPlanteur);
    
    // Check cooperative consistency (Requirement 6.9)
    if (selectedPlanteur && chefPlanteur?.cooperative_id !== selectedPlanteur.cooperative_id) {
      setWarning('Le planteur et le collecteur ne sont pas de la même coopérative');
    } else {
      setWarning(null);
    }
  }}
  onCreateNew={(name) => {
    // Handle creating new chef planteur
    console.log('Create new chef planteur:', name);
  }}
  cooperativeId={cooperativeId}
  label="Chef Planteur (Acheteur)"
  required
  error={errors.chefPlanteur}
  warning={cooperativeWarning}
/>
```

## Implementation Notes

### Debouncing
Both components use a 300ms debounce delay for search queries to reduce API calls while typing.

### Cooperative Filtering
When a `cooperativeId` prop is provided, search results are automatically filtered to only show planteurs/chef planteurs from that cooperative.

### Create New Functionality
The "Create new" option appears:
- When no search results are found
- At the bottom of the results list when results exist
- Only if the `onCreateNew` callback is provided

### Keyboard Navigation
- **Arrow Down/Up**: Navigate through options
- **Enter**: Select highlighted option or create new
- **Escape**: Close dropdown
- **Space**: Open dropdown (when closed)

### Accessibility
Both components follow ARIA best practices:
- `role="combobox"` on the trigger button
- `role="listbox"` on the options list
- `role="option"` on each option
- `aria-expanded`, `aria-haspopup`, `aria-selected` attributes
- Keyboard navigation support

## Styling

Components use Tailwind CSS classes and follow the existing design system:
- Primary color for selected/highlighted states
- Gray scale for neutral elements
- Red for errors, Yellow for warnings
- Consistent spacing and border radius
- Smooth transitions and hover effects

## Testing

To test these components:

1. **Search functionality**: Type in the search box and verify debounced API calls
2. **Selection**: Click or use keyboard to select an option
3. **Create new**: Search for non-existent name and click "Create new"
4. **Cooperative filtering**: Provide cooperativeId and verify filtered results
5. **Keyboard navigation**: Use arrow keys, Enter, and Escape
6. **Error states**: Pass error prop and verify display
7. **Warning states** (ChefPlanteur only): Pass warning prop and verify display

### PdfViewer

PDF viewer component for displaying receipt PDFs during the import workflow.

**Features:**
- PDF.js canvas-based rendering for high quality
- Page navigation controls (previous/next)
- Page number display (current / total)
- Zoom controls (50% to 200%)
- Keyboard shortcuts (← → for pages, + / - for zoom)
- Download button
- Loading indicator
- Error handling with fallback download link
- Responsive sizing
- Accessible controls with ARIA labels

**Requirements:** 11.4, 11.5, 15.1, 15.2, 15.3, 15.4, 15.5, 15.6

**Usage:**
```tsx
import { PdfViewer } from '@/components/receipts';

<PdfViewer 
  pdfUrl="https://storage.supabase.co/path/to/receipt.pdf"
  className="h-[600px]"
/>
```

**Props:**
- `pdfUrl` (string, required): URL of the PDF file to display
- `className` (string, optional): Additional CSS classes for the container

**Keyboard Shortcuts:**
- `+` or `=`: Zoom in
- `-` or `_`: Zoom out
- `←` (Left Arrow): Previous page
- `→` (Right Arrow): Next page

**Error Handling:**
If the PDF fails to load, the component displays:
- Error icon and message
- Download button as fallback
- User-friendly error text in French

**Implementation Details:**
- Uses PDF.js (pdfjs-dist) for reliable rendering
- Canvas-based rendering for high quality
- Worker loaded from CDN for performance
- Loading state shows spinner until PDF is loaded
- Toolbar provides intuitive controls
- Responsive design adapts to container size
- Properly cleans up resources on unmount

**Testing:**
1. **Valid PDF**: Provide valid PDF URL and verify rendering
2. **Page navigation**: Click previous/next buttons and verify page changes
3. **Page display**: Verify current page and total pages shown correctly
4. **Zoom controls**: Click zoom in/out buttons and verify scaling
5. **Keyboard shortcuts**: Press arrow keys for pages, +/- for zoom
6. **Download**: Click download button and verify file download
7. **Loading state**: Verify spinner shows while PDF loads
8. **Error state**: Provide invalid URL and verify error display
9. **Responsive**: Resize container and verify PDF adapts
10. **Multi-page**: Test with multi-page PDF
