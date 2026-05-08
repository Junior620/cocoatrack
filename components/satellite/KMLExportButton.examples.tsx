/**
 * KMLExportButton Usage Examples
 * 
 * This file demonstrates various usage patterns for the KMLExportButton component.
 */

import { KMLExportButton } from './KMLExportButton';

/**
 * Example 1: Basic single parcelle export
 * Use case: Export button on parcelle detail page
 */
export function BasicSingleExport() {
  return (
    <KMLExportButton
      parcelleIds="550e8400-e29b-41d4-a716-446655440000"
      parcelleCodes="PAR-001"
    />
  );
}

/**
 * Example 2: Batch export with multiple parcelles
 * Use case: Export button on parcelle list page with selection
 */
export function BatchExport() {
  const selectedParcelles = [
    '550e8400-e29b-41d4-a716-446655440000',
    '550e8400-e29b-41d4-a716-446655440001',
    '550e8400-e29b-41d4-a716-446655440002',
  ];

  const selectedCodes = ['PAR-001', 'PAR-002', 'PAR-003'];

  return (
    <KMLExportButton
      parcelleIds={selectedParcelles}
      parcelleCodes={selectedCodes}
      onComplete={(fileUrl) => {
        console.log('Export completed:', fileUrl);
        // Show success toast, update UI, etc.
      }}
    />
  );
}

/**
 * Example 3: Primary variant button
 * Use case: Main action button
 */
export function PrimaryButton() {
  return (
    <KMLExportButton
      parcelleIds="550e8400-e29b-41d4-a716-446655440000"
      variant="primary"
      size="lg"
    />
  );
}

/**
 * Example 4: Icon-only button
 * Use case: Compact toolbar or action menu
 */
export function IconOnlyButton() {
  return (
    <KMLExportButton
      parcelleIds="550e8400-e29b-41d4-a716-446655440000"
      showText={false}
      size="sm"
      className="rounded-full"
    />
  );
}

/**
 * Example 5: With completion callback
 * Use case: Track analytics or show custom success message
 */
export function WithCallback() {
  const handleExportComplete = (fileUrl: string) => {
    // Track analytics
    console.log('KML export completed:', fileUrl);
    
    // Show custom success message
    alert('Export KML terminé avec succès!');
    
    // Update UI state
    // setExportCount(prev => prev + 1);
  };

  return (
    <KMLExportButton
      parcelleIds="550e8400-e29b-41d4-a716-446655440000"
      onComplete={handleExportComplete}
    />
  );
}

/**
 * Example 6: In a toolbar with other actions
 * Use case: Parcelle detail page action toolbar
 */
export function InToolbar() {
  return (
    <div className="flex items-center gap-2">
      <button className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">
        Modifier
      </button>
      <button className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">
        Supprimer
      </button>
      <KMLExportButton
        parcelleIds="550e8400-e29b-41d4-a716-446655440000"
        variant="outline"
        size="sm"
      />
    </div>
  );
}

/**
 * Example 7: Responsive button (full width on mobile)
 * Use case: Mobile-friendly layout
 */
export function ResponsiveButton() {
  return (
    <KMLExportButton
      parcelleIds="550e8400-e29b-41d4-a716-446655440000"
      className="w-full sm:w-auto"
    />
  );
}

/**
 * Example 8: Disabled state (conditional rendering)
 * Use case: Disable export when no parcelle is selected
 */
export function ConditionalExport({ selectedIds }: { selectedIds: string[] }) {
  if (selectedIds.length === 0) {
    return (
      <button
        disabled
        className="px-4 py-2 text-base rounded-md bg-gray-300 text-gray-500 cursor-not-allowed"
      >
        Sélectionnez des parcelles pour exporter
      </button>
    );
  }

  return (
    <KMLExportButton
      parcelleIds={selectedIds}
      variant="primary"
    />
  );
}

/**
 * Example 9: Integration with parcelle detail page
 * Use case: Complete parcelle detail page integration
 */
export function ParcelleDetailIntegration({ parcelle }: { parcelle: any }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">
          Parcelle {parcelle.code}
        </h2>
        <div className="flex items-center gap-2">
          <button className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">
            Modifier
          </button>
          <KMLExportButton
            parcelleIds={parcelle.id}
            parcelleCodes={parcelle.code}
            variant="outline"
            size="md"
            onComplete={() => {
              console.log(`Exported parcelle ${parcelle.code}`);
            }}
          />
        </div>
      </div>
      
      {/* Rest of parcelle details */}
      <div className="space-y-4">
        <div>
          <span className="text-sm text-gray-500">Surface:</span>
          <span className="ml-2 text-sm font-medium">{parcelle.surface_hectares} ha</span>
        </div>
        {/* More details... */}
      </div>
    </div>
  );
}

/**
 * Example 10: Integration with parcelle list page (batch export)
 * Use case: Complete parcelle list page integration with selection
 */
export function ParcelleListIntegration({ 
  parcelles, 
  selectedIds 
}: { 
  parcelles: any[]; 
  selectedIds: string[] 
}) {
  const selectedCodes = parcelles
    .filter(p => selectedIds.includes(p.id))
    .map(p => p.code);

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Parcelles ({parcelles.length})
          </h2>
          
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">
                {selectedIds.length} sélectionnée(s)
              </span>
              <KMLExportButton
                parcelleIds={selectedIds}
                parcelleCodes={selectedCodes}
                variant="primary"
                size="sm"
                onComplete={() => {
                  console.log(`Exported ${selectedIds.length} parcelles`);
                  // Clear selection after export
                  // setSelectedIds([]);
                }}
              />
            </div>
          )}
        </div>
      </div>
      
      {/* Parcelle list table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          {/* Table content... */}
        </table>
      </div>
    </div>
  );
}
