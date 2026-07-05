// CocoaTrack V2 - Receipt Components
// Export all receipt-related components

export { PlanteurAutocomplete } from './PlanteurAutocomplete';
export type { PlanteurAutocompleteProps, PlanteurOption } from './PlanteurAutocomplete';

export { ChefPlanteurAutocomplete } from './ChefPlanteurAutocomplete';
export type { ChefPlanteurAutocompleteProps, ChefPlanteurOption } from './ChefPlanteurAutocomplete';
export { ReceiptInvoiceStatusBadge } from './ReceiptInvoiceStatusBadge';
export { ReceiptWorkflowPipeline } from './ReceiptWorkflowPipeline';

export { PdfViewer } from './PdfViewer';

export { ExtractionMethodSelector } from './ExtractionMethodSelector';
export type { ExtractionMethod, ExtractionMethodSelectorProps } from './ExtractionMethodSelector';

export { ProductLinesTable } from './ProductLinesTable';
export type { ProductLine } from '@/types/receipts';

export { PdfUploader } from './PdfUploader';
export type { PdfUploaderProps, UploadCompleteResult } from './PdfUploader';

export { ReceiptImportWizard } from './ReceiptImportWizard';
export type { ReceiptImportWizardProps } from './ReceiptImportWizard';

export { ReceiptImportButton } from './ReceiptImportButton';
export type { ReceiptImportButtonProps } from './ReceiptImportButton';

export { DuplicateWarningModal } from './DuplicateWarningModal';
export type { DuplicateReceipt } from './DuplicateWarningModal';
