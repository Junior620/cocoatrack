'use client';

// CocoaTrack V2 - ShapefileUploader Component
// Drag-and-drop file uploader for parcelle imports
// Supports: .zip (Shapefile), .kml, .kmz, .geojson
// 
// Features:
// - Drag-and-drop zone with visual feedback
// - File type validation
// - File size validation (50MB max)
// - Real upload progress indicator (using XMLHttpRequest)
// - Auto-parse after upload
// - Error/warning display
// - Import mode selection (auto_create, orphan, assign)
// - DBF field selector for auto_create mode
// - Chef planteur selector for auto_create mode
// - Planteur selector for assign mode

import { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, FileUp, AlertCircle, AlertTriangle, CheckCircle, X, FileText, Loader2, Users, UserPlus, FileQuestion, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parcellesImportApi } from '@/lib/api/parcelles-import';
import { planteursApi } from '@/lib/api/planteurs';
import { chefPlanteursApi } from '@/lib/api/chef-planteurs';
import type {
  ParcelImportFile,
  ParsedFeature,
  ParseReport,
  ParcelleApiError,
  ImportMode,
  AutoCreatePreview,
} from '@/types/parcelles';
import { 
  PARCELLE_LIMITS,
  IMPORT_MODE_VALUES,
  IMPORT_MODE_LABELS,
  IMPORT_MODE_DESCRIPTIONS,
} from '@/types/parcelles';

// Accepted file extensions and MIME types
const ACCEPTED_EXTENSIONS = ['.zip', '.kml', '.kmz', '.geojson', '.json'];
const ACCEPTED_MIME_TYPES = [
  'application/zip',
  'application/x-zip-compressed',
  'application/vnd.google-earth.kml+xml',
  'application/vnd.google-earth.kmz',
  'application/geo+json',
  'application/json',
];

// File type labels for display
const FILE_TYPE_LABELS: Record<string, string> = {
  '.zip': 'Shapefile (ZIP)',
  '.kml': 'KML',
  '.kmz': 'KMZ',
  '.geojson': 'GeoJSON',
  '.json': 'GeoJSON',
};

// Planteur type for selector
interface PlanteurOption {
  id: string;
  name: string;
  code: string;
}

// Chef planteur type for selector
interface ChefPlanteurOption {
  id: string;
  name: string;
  code: string;
}

export interface ShapefileUploaderProps {
  /** Optional planteur ID (if importing from planteur form) */
  planteurId?: string;
  /** Callback when upload completes successfully */
  onUploadComplete?: (importFile: ParcelImportFile) => void;
  /** Callback when parse completes successfully */
  onParseComplete?: (features: ParsedFeature[], report: ParseReport, availableFields: string[]) => void;
  /** Callback when import mode changes */
  onModeChange?: (mode: ImportMode) => void;
  /** Callback when planteur name field changes (for auto_create mode) */
  onPlanteurNameFieldChange?: (field: string | undefined) => void;
  /** Callback when chef planteur changes (for auto_create mode) */
  onChefPlanteurChange?: (chefPlanteurId: string | undefined) => void;
  /** Callback when planteur changes (for assign mode) */
  onPlanteurChange?: (planteurId: string | undefined) => void;
  /** Callback when an error occurs */
  onError?: (error: ParcelleApiError | Error) => void;
  /** Accepted file formats (default: all supported) */
  acceptedFormats?: string[];
  /** Additional CSS classes */
  className?: string;
  /** Whether the uploader is disabled */
  disabled?: boolean;
  /** Whether to show mode selector (default: true) */
  showModeSelector?: boolean;
  /** Default import mode */
  defaultMode?: ImportMode;
}

type UploadState = 'idle' | 'dragging' | 'uploading' | 'parsing' | 'success' | 'error';

interface UploadError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * ShapefileUploader - Drag-and-drop file uploader for parcelle imports
 * 
 * Workflow:
 * 1. User drops or selects a file
 * 2. File is validated (type, size)
 * 3. File is uploaded to storage
 * 4. File is automatically parsed
 * 5. Callbacks are triggered with results
 * 
 * Note: cooperative_id is NOT passed from frontend - backend gets it from auth.uid() profile
 */
export function ShapefileUploader({
  planteurId,
  onUploadComplete,
  onParseComplete,
  onModeChange,
  onPlanteurNameFieldChange,
  onChefPlanteurChange,
  onPlanteurChange,
  onError,
  acceptedFormats = ACCEPTED_EXTENSIONS,
  className,
  disabled = false,
  showModeSelector = true,
  defaultMode = 'orphan',
}: ShapefileUploaderProps) {
  const [state, setState] = useState<UploadState>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<UploadError | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importFile, setImportFile] = useState<ParcelImportFile | null>(null);
  const [parseReport, setParseReport] = useState<ParseReport | null>(null);
  const [availableFields, setAvailableFields] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Import mode state
  const [importMode, setImportMode] = useState<ImportMode>(planteurId ? 'assign' : defaultMode);
  
  // For auto_create mode
  const [planteurNameField, setPlanteurNameField] = useState<string | undefined>(undefined);
  const [selectedChefPlanteur, setSelectedChefPlanteur] = useState<string | undefined>(undefined);
  const [chefPlanteurs, setChefPlanteurs] = useState<ChefPlanteurOption[]>([]);
  const [loadingChefPlanteurs, setLoadingChefPlanteurs] = useState(false);
  
  // Auto-create preview state
  const [autoCreatePreview, setAutoCreatePreview] = useState<AutoCreatePreview | null>(null);
  const [loadingAutoCreatePreview, setLoadingAutoCreatePreview] = useState(false);
  const [autoCreatePreviewError, setAutoCreatePreviewError] = useState<string | null>(null);
  
  // For assign mode
  const [selectedPlanteur, setSelectedPlanteur] = useState<string | undefined>(planteurId);
  const [planteurs, setPlanteurs] = useState<PlanteurOption[]>([]);
  const [loadingPlanteurs, setLoadingPlanteurs] = useState(false);
  const [planteurSearch, setPlanteurSearch] = useState('');
  
  // Refs to track if data has been loaded (to avoid re-fetching on empty results)
  const chefPlanteursLoadedRef = useRef(false);
  const planteursLoadedRef = useRef(false);

  // Pre-load chef planteurs on mount (for auto_create mode)
  // This ensures data is ready when user selects the mode, avoiding perceived slowness
  useEffect(() => {
    // Only load if mode selector is shown and we haven't loaded yet
    if (showModeSelector && !planteurId && !chefPlanteursLoadedRef.current) {
      chefPlanteursLoadedRef.current = true; // Mark immediately to prevent double calls
      setLoadingChefPlanteurs(true);
      chefPlanteursApi.list({ pageSize: 100 })
        .then((result) => {
          setChefPlanteurs(result.data.map((cp) => ({
            id: cp.id,
            name: cp.name,
            code: cp.code,
          })));
        })
        .catch((err) => {
          console.error('Failed to load chef planteurs:', err);
        })
        .finally(() => {
          setLoadingChefPlanteurs(false);
        });
    }
  }, [showModeSelector, planteurId]);

  // Pre-load planteurs on mount (for assign mode)
  // This ensures data is ready when user selects the mode, avoiding perceived slowness
  useEffect(() => {
    // Only load if mode selector is shown and we haven't loaded yet
    if (showModeSelector && !planteurId && !planteursLoadedRef.current) {
      planteursLoadedRef.current = true; // Mark immediately to prevent double calls
      setLoadingPlanteurs(true);
      planteursApi.list({ pageSize: 100, is_active: true })
        .then((result) => {
          setPlanteurs(result.data.map((p) => ({
            id: p.id,
            name: p.name,
            code: p.code,
          })));
        })
        .catch((err) => {
          console.error('Failed to load planteurs:', err);
        })
        .finally(() => {
          setLoadingPlanteurs(false);
        });
    }
  }, [showModeSelector, planteurId]);

  // Fetch auto-create preview when mode is auto_create and field is selected
  useEffect(() => {
    // Only fetch if we have an import file, mode is auto_create, and a field is selected
    if (importMode !== 'auto_create' || !planteurNameField || !importFile) {
      setAutoCreatePreview(null);
      setAutoCreatePreviewError(null);
      return;
    }

    // Fetch the preview
    setLoadingAutoCreatePreview(true);
    setAutoCreatePreviewError(null);

    parcellesImportApi.previewAutoCreate(importFile.id, planteurNameField)
      .then((preview) => {
        setAutoCreatePreview(preview);
      })
      .catch((err) => {
        console.error('Failed to fetch auto-create preview:', err);
        const errorMessage = err instanceof Error ? err.message :
          (err && typeof err === 'object' && 'message' in err) ? String(err.message) :
          'Erreur lors de la prévisualisation';
        setAutoCreatePreviewError(errorMessage);
        setAutoCreatePreview(null);
      })
      .finally(() => {
        setLoadingAutoCreatePreview(false);
      });
  }, [importMode, planteurNameField, importFile]);

  // Handle mode change
  const handleModeChange = useCallback((mode: ImportMode) => {
    setImportMode(mode);
    onModeChange?.(mode);
    
    // Reset mode-specific selections
    if (mode !== 'auto_create') {
      setPlanteurNameField(undefined);
      setSelectedChefPlanteur(undefined);
      onPlanteurNameFieldChange?.(undefined);
      onChefPlanteurChange?.(undefined);
    }
    if (mode !== 'assign') {
      setSelectedPlanteur(planteurId);
      onPlanteurChange?.(planteurId);
    }
  }, [onModeChange, onPlanteurNameFieldChange, onChefPlanteurChange, onPlanteurChange, planteurId]);

  // Handle planteur name field change
  const handlePlanteurNameFieldChange = useCallback((field: string | undefined) => {
    setPlanteurNameField(field);
    onPlanteurNameFieldChange?.(field);
  }, [onPlanteurNameFieldChange]);

  // Handle chef planteur change
  const handleChefPlanteurChange = useCallback((chefPlanteurId: string | undefined) => {
    setSelectedChefPlanteur(chefPlanteurId);
    onChefPlanteurChange?.(chefPlanteurId);
  }, [onChefPlanteurChange]);

  // Handle planteur change
  const handlePlanteurSelectChange = useCallback((planteurIdValue: string | undefined) => {
    setSelectedPlanteur(planteurIdValue);
    onPlanteurChange?.(planteurIdValue);
  }, [onPlanteurChange]);

  // Helper function to format error details for display
  const formatErrorDetails = (details: Record<string, unknown>): string => {
    const parts: string[] = [];
    if (details.missing && Array.isArray(details.missing)) {
      parts.push(`Fichiers manquants: ${(details.missing as string[]).join(', ')}`);
    }
    if (details.reason) {
      parts.push(`Raison: ${details.reason}`);
    }
    if (details.limit !== undefined && details.actual !== undefined) {
      parts.push(`Limite: ${details.limit}, Actuel: ${details.actual}`);
    }
    if (details.resource) {
      parts.push(`Ressource: ${details.resource}`);
    }
    if (details.type && details.expected) {
      parts.push(`Type trouvé: ${details.type}, Attendu: ${(details.expected as string[]).join(' ou ')}`);
    }
    if (details.existing_import_id) {
      parts.push(`Import existant: ${details.existing_import_id}`);
    }
    return parts.join(' | ');
  };

  // Helper function to format warning details for display
  const formatWarningDetails = (details: Record<string, unknown>): string => {
    const parts: string[] = [];
    if (details.sample_coord && Array.isArray(details.sample_coord)) {
      const coord = details.sample_coord as [number, number];
      parts.push(`Coordonnée exemple: [${coord[0].toFixed(4)}, ${coord[1].toFixed(4)}]`);
    }
    if (details.existing_parcelle_id) {
      parts.push(`Parcelle existante: ${details.existing_parcelle_id}`);
    }
    return parts.join(' | ');
  };

  // Get file extension from filename
  const getFileExtension = (filename: string): string => {
    const ext = filename.toLowerCase().split('.').pop();
    return ext ? `.${ext}` : '';
  };

  // Validate file type
  const isValidFileType = (file: File): boolean => {
    const ext = getFileExtension(file.name);
    return acceptedFormats.includes(ext) || ACCEPTED_MIME_TYPES.includes(file.type);
  };

  // Validate file size
  const isValidFileSize = (file: File): boolean => {
    return file.size <= PARCELLE_LIMITS.MAX_FILE_SIZE_BYTES;
  };

  // Format file size for display
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Handle file selection (from drop or input)
  const handleFile = useCallback(async (file: File) => {
    setSelectedFile(file);
    setError(null);

    // Validate file type
    if (!isValidFileType(file)) {
      const ext = getFileExtension(file.name);
      setError({
        code: 'INVALID_FILE_TYPE',
        message: `Type de fichier non supporté: ${ext || file.type}`,
        details: { accepted: acceptedFormats },
      });
      setState('error');
      return;
    }

    // Validate file size
    if (!isValidFileSize(file)) {
      setError({
        code: 'FILE_TOO_LARGE',
        message: `Le fichier est trop volumineux (${formatFileSize(file.size)}). Maximum: 50 MB`,
        details: {
          limit: PARCELLE_LIMITS.MAX_FILE_SIZE_BYTES,
          actual: file.size,
        },
      });
      setState('error');
      return;
    }

    // Start upload
    setState('uploading');
    setProgress(0);

    try {
      // Upload file with real progress tracking
      console.log('[ShapefileUploader] Starting upload...');
      const uploadedFile = await parcellesImportApi.upload(
        file, 
        planteurId,
        (uploadProgress, phase) => {
          if (phase === 'uploading') {
            setProgress(uploadProgress);
          }
        }
      );
      
      console.log('[ShapefileUploader] Upload complete, file ID:', uploadedFile.id);
      setProgress(100);
      setImportFile(uploadedFile);

      // Notify upload complete
      onUploadComplete?.(uploadedFile);

      // Auto-trigger parse
      setState('parsing');
      setProgress(0);

      // Simulate progress during parsing (actual progress not available)
      const parseProgressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 5, 90));
      }, 300);

      // Add timeout for parsing (60 seconds max)
      console.log('[ShapefileUploader] Starting parse...');
      const parsePromise = parcellesImportApi.parse(uploadedFile.id);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Le parsing a pris trop de temps (timeout 60s). Veuillez réessayer avec un fichier plus petit.')), 60000);
      });

      const parseResult = await Promise.race([parsePromise, timeoutPromise]);
      
      console.log('[ShapefileUploader] Parse complete, features:', parseResult.features.length);
      clearInterval(parseProgressInterval);
      setProgress(100);

      // Store parse report for displaying errors/warnings
      setParseReport(parseResult.report);
      
      // Store available fields for mode-specific selectors
      setAvailableFields(parseResult.available_fields || []);

      // Notify parse complete with available fields
      onParseComplete?.(parseResult.features, parseResult.report, parseResult.available_fields || []);

      setState('success');
    } catch (err: unknown) {
      setState('error');
      
      // Debug: log raw error with all enumerable and non-enumerable properties
      console.error('[ShapefileUploader] Raw error:', err);
      console.error('[ShapefileUploader] Error type:', typeof err);
      console.error('[ShapefileUploader] Error constructor:', err?.constructor?.name);
      if (err && typeof err === 'object') {
        console.error('[ShapefileUploader] Error keys:', Object.keys(err));
        console.error('[ShapefileUploader] Error JSON:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
      }
      
      // Handle API errors - check for error_code property (ParcelleApiError format)
      if (err && typeof err === 'object' && 'error_code' in err) {
        const apiError = err as ParcelleApiError;
        console.error('[ShapefileUploader] API Error detected:', apiError.error_code, apiError.message);
        setError({
          code: apiError.error_code,
          message: apiError.message || 'Erreur API',
          details: apiError.details,
        });
        onError?.(apiError);
      } else if (err instanceof Error) {
        // Standard Error object
        console.error('[ShapefileUploader] Standard Error:', err.message);
        setError({
          code: 'UNKNOWN_ERROR',
          message: err.message || 'Une erreur est survenue',
        });
        onError?.(err);
      } else {
        // Unknown error type
        const errorMessage = typeof err === 'string' ? err : 
          (err && typeof err === 'object' && 'message' in err) ? String((err as { message: unknown }).message) :
          'Une erreur inconnue est survenue';
        console.error('[ShapefileUploader] Unknown error:', errorMessage);
        setError({
          code: 'UNKNOWN_ERROR',
          message: errorMessage,
        });
        onError?.(new Error(errorMessage));
      }
    }
  }, [planteurId, acceptedFormats, onUploadComplete, onParseComplete, onError]);

  // Handle drag events
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setState('dragging');
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only reset if leaving the drop zone entirely
    if (e.currentTarget === e.target) {
      setState('idle');
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    } else {
      setState('idle');
    }
  }, [disabled, handleFile]);

  // Handle file input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  }, [handleFile]);

  // Handle click to open file picker
  const handleClick = useCallback(() => {
    if (!disabled && state !== 'uploading' && state !== 'parsing') {
      fileInputRef.current?.click();
    }
  }, [disabled, state]);

  // Reset the uploader
  const handleReset = useCallback(() => {
    setState('idle');
    setProgress(0);
    setError(null);
    setSelectedFile(null);
    setImportFile(null);
    setParseReport(null);
    setAvailableFields([]);
    // Reset mode-specific selections
    setPlanteurNameField(undefined);
    // Reset auto-create preview
    setAutoCreatePreview(null);
    setAutoCreatePreviewError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Get status icon
  const getStatusIcon = () => {
    switch (state) {
      case 'uploading':
      case 'parsing':
        return <Loader2 className="h-8 w-8 text-primary-600 animate-spin" />;
      case 'success':
        return <CheckCircle className="h-8 w-8 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-8 w-8 text-red-600" />;
      case 'dragging':
        return <FileUp className="h-8 w-8 text-primary-600" />;
      default:
        return <Upload className="h-8 w-8 text-gray-400" />;
    }
  };

  // Get status message
  const getStatusMessage = () => {
    switch (state) {
      case 'uploading':
        return 'Téléchargement en cours...';
      case 'parsing':
        return 'Analyse du fichier...';
      case 'success':
        return 'Fichier importé avec succès';
      case 'error':
        return error?.message || 'Une erreur est survenue';
      case 'dragging':
        return 'Déposez le fichier ici';
      default:
        return 'Glissez-déposez un fichier ou cliquez pour sélectionner';
    }
  };

  // Get accepted formats string for input
  const getAcceptString = () => {
    return acceptedFormats.join(',');
  };

  // Get mode icon
  const getModeIcon = (mode: ImportMode) => {
    switch (mode) {
      case 'auto_create':
        return <UserPlus className="h-5 w-5" />;
      case 'orphan':
        return <FileQuestion className="h-5 w-5" />;
      case 'assign':
        return <Users className="h-5 w-5" />;
    }
  };

  // Filter planteurs by search
  const filteredPlanteurs = planteurSearch
    ? planteurs.filter(
        (p) =>
          p.name.toLowerCase().includes(planteurSearch.toLowerCase()) ||
          p.code.toLowerCase().includes(planteurSearch.toLowerCase())
      )
    : planteurs;

  return (
    <div className={cn('w-full space-y-4', className)}>
      {/* Import Mode Selector */}
      {showModeSelector && !planteurId && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Info className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900">Mode d&apos;import</h3>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            Choisissez comment les parcelles seront assignées aux planteurs
          </p>
          
          {/* Mode Selection Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {IMPORT_MODE_VALUES.map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => handleModeChange(mode)}
                disabled={disabled}
                className={cn(
                  'relative flex flex-col items-start p-4 rounded-lg border-2 transition-all duration-200 text-left',
                  importMode === mode
                    ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-500/20'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50',
                  disabled && 'opacity-50 cursor-not-allowed'
                )}
              >
                <div className={cn(
                  'p-2 rounded-lg mb-2',
                  importMode === mode ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-500'
                )}>
                  {getModeIcon(mode)}
                </div>
                <span className={cn(
                  'text-sm font-medium',
                  importMode === mode ? 'text-primary-900' : 'text-gray-900'
                )}>
                  {IMPORT_MODE_LABELS[mode]}
                </span>
                <span className="text-xs text-gray-500 mt-1">
                  {IMPORT_MODE_DESCRIPTIONS[mode]}
                </span>
                {importMode === mode && (
                  <div className="absolute top-2 right-2">
                    <CheckCircle className="h-5 w-5 text-primary-600" />
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Mode-specific options */}
          {importMode === 'auto_create' && (
            <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
              {/* DBF Field Selector - only shown after parse */}
              {availableFields.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Champ contenant le nom du planteur *
                  </label>
                  <select
                    value={planteurNameField || ''}
                    onChange={(e) => handlePlanteurNameFieldChange(e.target.value || undefined)}
                    disabled={disabled}
                    className="w-full rounded-lg border border-gray-200 py-2 px-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  >
                    <option value="">-- Sélectionner un champ --</option>
                    {availableFields.map((field) => (
                      <option key={field} value={field}>
                        {field}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Les planteurs seront créés automatiquement à partir de ce champ
                  </p>
                </div>
              )}

              {/* Auto-create Preview - shown when field is selected */}
              {planteurNameField && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  {loadingAutoCreatePreview ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Analyse des planteurs...
                    </div>
                  ) : autoCreatePreviewError ? (
                    <div className="flex items-start gap-2 text-sm text-red-600">
                      <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>{autoCreatePreviewError}</span>
                    </div>
                  ) : autoCreatePreview ? (
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                        Prévisualisation
                      </h4>
                      
                      {/* New planteurs to create */}
                      {autoCreatePreview.new_planteurs.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <UserPlus className="h-4 w-4 text-green-600" />
                            <span className="text-xs font-medium text-green-700">
                              {autoCreatePreview.new_planteurs.length} planteur(s) à créer
                            </span>
                          </div>
                          <ul className="ml-6 space-y-1">
                            {autoCreatePreview.new_planteurs.slice(0, 5).map((p, idx) => (
                              <li key={idx} className="text-xs text-gray-600 flex items-center justify-between">
                                <span>{p.name}</span>
                                <span className="text-gray-400">({p.parcelle_count} parcelle{p.parcelle_count > 1 ? 's' : ''})</span>
                              </li>
                            ))}
                            {autoCreatePreview.new_planteurs.length > 5 && (
                              <li className="text-xs text-gray-400 italic">
                                ... et {autoCreatePreview.new_planteurs.length - 5} autre(s)
                              </li>
                            )}
                          </ul>
                        </div>
                      )}

                      {/* Existing planteurs to reuse */}
                      {autoCreatePreview.existing_planteurs.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Users className="h-4 w-4 text-blue-600" />
                            <span className="text-xs font-medium text-blue-700">
                              {autoCreatePreview.existing_planteurs.length} planteur(s) existant(s) à réutiliser
                            </span>
                          </div>
                          <ul className="ml-6 space-y-1">
                            {autoCreatePreview.existing_planteurs.slice(0, 5).map((p) => (
                              <li key={p.id} className="text-xs text-gray-600 flex items-center justify-between">
                                <span>{p.name}</span>
                                <span className="text-gray-400">({p.parcelle_count} parcelle{p.parcelle_count > 1 ? 's' : ''})</span>
                              </li>
                            ))}
                            {autoCreatePreview.existing_planteurs.length > 5 && (
                              <li className="text-xs text-gray-400 italic">
                                ... et {autoCreatePreview.existing_planteurs.length - 5} autre(s)
                              </li>
                            )}
                          </ul>
                        </div>
                      )}

                      {/* Orphan parcelles (empty names) */}
                      {autoCreatePreview.orphan_count > 0 && (
                        <div className="flex items-start gap-2 p-2 bg-amber-50 rounded border border-amber-200">
                          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-xs font-medium text-amber-800">
                              {autoCreatePreview.orphan_count} parcelle(s) sans nom de planteur
                            </p>
                            <p className="text-xs text-amber-700 mt-0.5">
                              Ces parcelles seront importées comme orphelines
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Summary when no planteurs to create or reuse */}
                      {autoCreatePreview.new_planteurs.length === 0 && 
                       autoCreatePreview.existing_planteurs.length === 0 && 
                       autoCreatePreview.orphan_count === 0 && (
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Info className="h-4 w-4" />
                          <span>Aucune parcelle valide à importer</span>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              )}
              
              {/* Chef Planteur Selector (optional) */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Fournisseur par défaut <span className="text-gray-400 font-normal">(optionnel)</span>
                </label>
                {loadingChefPlanteurs ? (
                  <div className="flex items-center gap-2 py-2 text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Chargement des fournisseurs...
                  </div>
                ) : (
                  <select
                    value={selectedChefPlanteur || ''}
                    onChange={(e) => handleChefPlanteurChange(e.target.value || undefined)}
                    disabled={disabled}
                    className="w-full rounded-lg border border-gray-200 py-2 px-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  >
                    <option value="">-- Aucun fournisseur --</option>
                    {chefPlanteurs.map((cp) => (
                      <option key={cp.id} value={cp.id}>
                        {cp.name} ({cp.code})
                      </option>
                    ))}
                  </select>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  Si sélectionné, les nouveaux planteurs seront rattachés à ce fournisseur
                </p>
              </div>
            </div>
          )}

          {importMode === 'assign' && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Planteur destinataire *
              </label>
              {loadingPlanteurs ? (
                <div className="flex items-center gap-2 py-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Chargement des planteurs...
                </div>
              ) : (
                <>
                  {/* Search input */}
                  <input
                    type="text"
                    placeholder="Rechercher un planteur..."
                    value={planteurSearch}
                    onChange={(e) => setPlanteurSearch(e.target.value)}
                    disabled={disabled}
                    className="w-full rounded-lg border border-gray-200 py-2 px-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 mb-2"
                  />
                  <select
                    value={selectedPlanteur || ''}
                    onChange={(e) => handlePlanteurSelectChange(e.target.value || undefined)}
                    disabled={disabled}
                    className="w-full rounded-lg border border-gray-200 py-2 px-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    size={Math.min(filteredPlanteurs.length + 1, 6)}
                  >
                    <option value="">-- Sélectionner un planteur --</option>
                    {filteredPlanteurs.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code})
                      </option>
                    ))}
                  </select>
                </>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Toutes les parcelles seront assignées à ce planteur
              </p>
            </div>
          )}

          {importMode === 'orphan' && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-amber-800">
                    Les parcelles seront importées sans planteur
                  </p>
                  <p className="text-xs text-amber-700 mt-1">
                    Vous pourrez les assigner ultérieurement depuis la vue &quot;Parcelles par planteur&quot;
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Drop zone */}
      <div
        className={cn(
          'relative border-2 border-dashed rounded-lg p-8 transition-all duration-200 cursor-pointer',
          'flex flex-col items-center justify-center min-h-[200px]',
          state === 'idle' && 'border-gray-300 bg-gray-50 hover:border-primary-400 hover:bg-primary-50',
          state === 'dragging' && 'border-primary-500 bg-primary-50 scale-[1.02]',
          state === 'uploading' && 'border-primary-400 bg-primary-50 cursor-wait',
          state === 'parsing' && 'border-primary-400 bg-primary-50 cursor-wait',
          state === 'success' && 'border-green-400 bg-green-50',
          state === 'error' && 'border-red-400 bg-red-50',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleClick}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Zone de dépôt de fichier"
        aria-disabled={disabled}
      >
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept={getAcceptString()}
          onChange={handleInputChange}
          className="hidden"
          disabled={disabled}
          aria-hidden="true"
        />

        {/* Status icon */}
        <div className="mb-4">
          {getStatusIcon()}
        </div>

        {/* Status message */}
        <p className={cn(
          'text-sm font-medium text-center',
          state === 'error' ? 'text-red-700' : 
          state === 'success' ? 'text-green-700' : 
          'text-gray-600'
        )}>
          {getStatusMessage()}
        </p>

        {/* File info */}
        {selectedFile && state !== 'idle' && (
          <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
            <FileText className="h-4 w-4" />
            <span>{selectedFile.name}</span>
            <span className="text-gray-400">({formatFileSize(selectedFile.size)})</span>
          </div>
        )}

        {/* Progress bar */}
        {(state === 'uploading' || state === 'parsing') && (
          <div className="mt-4 w-full max-w-xs">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-600 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-gray-500 text-center">
              {progress}%
            </p>
          </div>
        )}

        {/* Accepted formats hint */}
        {state === 'idle' && (
          <p className="mt-4 text-xs text-gray-400">
            Formats acceptés: {acceptedFormats.map(ext => FILE_TYPE_LABELS[ext] || ext).join(', ')}
          </p>
        )}

        {/* Error details */}
        {state === 'error' && error?.details && (
          <div className="mt-3 text-xs text-red-600">
            {error.code === 'INVALID_FILE_TYPE' && (
              <p>Formats acceptés: {(error.details.accepted as string[])?.join(', ')}</p>
            )}
            {error.code === 'FILE_TOO_LARGE' && (
              <p>Taille maximale: 50 MB</p>
            )}
          </div>
        )}

        {/* Reset button for error/success states */}
        {(state === 'error' || state === 'success') && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleReset();
            }}
            className={cn(
              'mt-4 inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md',
              'transition-colors duration-200',
              state === 'error' 
                ? 'text-red-700 bg-red-100 hover:bg-red-200' 
                : 'text-green-700 bg-green-100 hover:bg-green-200'
            )}
          >
            <X className="h-4 w-4" />
            {state === 'error' ? 'Réessayer' : 'Nouveau fichier'}
          </button>
        )}
      </div>

      {/* Import file info (after successful upload) */}
      {importFile && state === 'success' && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-800">
                Import créé avec succès
              </p>
              <p className="mt-1 text-xs text-green-600">
                ID: {importFile.id}
              </p>
              {importFile.nb_features > 0 && (
                <p className="mt-1 text-xs text-green-600">
                  {importFile.nb_features} parcelle(s) détectée(s)
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Parse Report Errors Display */}
      {parseReport && parseReport.errors.length > 0 && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">
                {parseReport.errors.length} erreur(s) détectée(s)
              </p>
              <ul className="mt-2 space-y-1">
                {parseReport.errors.map((err, index) => (
                  <li key={index} className="text-xs text-red-700">
                    <span className="font-medium">{err.code}</span>
                    {err.feature_index !== undefined && (
                      <span className="text-red-500"> (Feature {err.feature_index})</span>
                    )}
                    : {err.message}
                    {err.details && Object.keys(err.details).length > 0 && (
                      <span className="text-red-500 block ml-4">
                        {formatErrorDetails(err.details)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Parse Report Warnings Display */}
      {parseReport && parseReport.warnings.length > 0 && (
        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800">
                {parseReport.warnings.length} avertissement(s)
              </p>
              <ul className="mt-2 space-y-1">
                {parseReport.warnings.map((warn, index) => (
                  <li key={index} className="text-xs text-amber-700">
                    <span className="font-medium">{warn.code}</span>
                    {warn.feature_index !== undefined && (
                      <span className="text-amber-500"> (Feature {warn.feature_index})</span>
                    )}
                    : {warn.message}
                    {warn.requires_confirmation && (
                      <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-200 text-amber-800">
                        Confirmation requise
                      </span>
                    )}
                    {warn.details && Object.keys(warn.details).length > 0 && (
                      <span className="text-amber-500 block ml-4">
                        {formatWarningDetails(warn.details)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ShapefileUploader;
