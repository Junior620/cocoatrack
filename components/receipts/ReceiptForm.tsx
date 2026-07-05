'use client';

import { useState, useCallback, useRef } from 'react';
import { AlertCircle, AlertTriangle, ExternalLink } from 'lucide-react';
import type { ProductLine } from '@/types/receipts';
import { PlanteurAutocomplete, type PlanteurOption } from './PlanteurAutocomplete';
import { ChefPlanteurAutocomplete, type ChefPlanteurOption } from './ChefPlanteurAutocomplete';
import { ProductLinesTable } from './ProductLinesTable';
import { PdfViewer } from './PdfViewer';
import { DuplicateWarningModal, type DuplicateReceipt } from './DuplicateWarningModal';

/** Reference humidity for net weight recalculation */
const HUMIDITY_REF = 8;

function recalcLine(line: ProductLine): ProductLine {
  if (!line.grossWeight || !line.humidity) return line;
  const netWeight = Math.round((line.grossWeight * (100 - line.humidity)) / (100 - HUMIDITY_REF) * 100) / 100;
  const amount = Math.round(netWeight * line.pricePerKg * 100) / 100;
  return { ...line, netWeight, amount };
}

/**
 * Form data structure for receipt import
 */
export interface ReceiptFormData {
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
  chefPlanteurName: string; // Saisie manuelle si pas trouvé en BD
  professionalCardNumber: string;
  
  // Products (managed by ProductLinesTable)
  productLines: ProductLine[];
  
  // Payment
  paymentMode: 'Espèces' | 'Autres';
  amountPaid: number;
}

/**
 * Props for ReceiptForm component
 */
export interface ReceiptFormProps {
  /** Initial data for pre-filling (from OCR) */
  initialData?: Partial<ReceiptFormData>;
  /** PDF URL for viewer */
  pdfUrl: string;
  /** Cooperative ID for filtering autocompletes */
  cooperativeId: string;
  /** Callback when form is submitted */
  onSubmit: (data: ReceiptFormData) => void | Promise<void>;
  /** Whether the form is submitting */
  isSubmitting?: boolean;
}

/**
 * ReceiptForm Component
 * 
 * Main form component for importing collection receipts.
 * Features:
 * - 5 sections: contract, location, transaction, products, payment
 * - Integrated autocompletes for planteur and chef planteur
 * - Integrated ProductLinesTable for product lines
 * - Integrated PdfViewer for PDF preview
 * - Automatic balance calculation
 * - Real-time validation
 * - Inline error messages
 * 
 * @see Requirements 5.1, 5.2, 5.3, 5.4, 5.10, 5.11, 5.12, 5.17
 */
export function ReceiptForm({
  initialData,
  pdfUrl,
  cooperativeId,
  onSubmit,
  isSubmitting = false,
}: ReceiptFormProps) {
  // Form state
  const [formData, setFormData] = useState<ReceiptFormData>({
    contractNumber: initialData?.contractNumber || '',
    receiptNumber: initialData?.receiptNumber || '',
    campaign: initialData?.campaign || '',
    region: initialData?.region || '',
    department: initialData?.department || '',
    arrondissement: initialData?.arrondissement || '',
    village: initialData?.village || '',
    transactionDate: initialData?.transactionDate || '',
    planteurId: initialData?.planteurId || '',
    chefPlanteurId: initialData?.chefPlanteurId || '',
    chefPlanteurName: initialData?.chefPlanteurName || '',
    professionalCardNumber: initialData?.professionalCardNumber || '',
    productLines: (initialData?.productLines || []).map(recalcLine),
    paymentMode: initialData?.paymentMode || 'Espèces',
    amountPaid: initialData?.amountPaid || 0,
  });

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Selected actors for cooperative validation
  const [selectedPlanteur, setSelectedPlanteur] = useState<PlanteurOption | null>(null);
  const [selectedChefPlanteur, setSelectedChefPlanteur] = useState<ChefPlanteurOption | null>(null);

  // Receipt number uniqueness state (Requirement 17.1, 17.2)
  const [receiptNumberWarning, setReceiptNumberWarning] = useState<{
    exists: boolean;
    collectionReceiptId?: string;
    deliveryIds?: string[];
  } | null>(null);
  const [isValidatingReceiptNumber, setIsValidatingReceiptNumber] = useState(false);

  // Duplicate detection state (Requirement 17.3, 17.4, 17.5, 17.6)
  const [pendingDuplicates, setPendingDuplicates] = useState<DuplicateReceipt[] | null>(null);
  const pendingSubmitData = useRef<ReceiptFormData | null>(null);

  // Calculate total amount from product lines (Requirement 5.9)
  const totalAmount = formData.productLines.reduce((sum, line) => sum + (line.amount || 0), 0);

  // Calculate balance (Requirement 5.11)
  const balance = totalAmount - formData.amountPaid;

  // Validate a single field
  const validateField = useCallback((field: keyof ReceiptFormData, value: any): string | null => {
    switch (field) {
      case 'contractNumber':
        if (!value || value.trim() === '') return 'Ce champ est obligatoire';
        return null;
      
      case 'receiptNumber':
        if (!value || value.trim() === '') return 'Ce champ est obligatoire';
        return null;
      
      case 'campaign':
        if (!value || value.trim() === '') return 'Ce champ est obligatoire';
        return null;
      
      case 'transactionDate':
        if (!value || value.trim() === '') return 'Ce champ est obligatoire';
        // Check if date is in the future (Requirement 5.13)
        const selectedDate = new Date(value);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (selectedDate > today) return 'La date ne peut pas être dans le futur';
        return null;
      
      case 'planteurId':
        if (!value || value.trim() === '') return 'Ce champ est obligatoire';
        return null;
      
      case 'chefPlanteurId':
        // Valid if either an ID is selected OR a name is manually entered
        if (!value || value.trim() === '') {
          // Check chefPlanteurName via formData — handled separately
          return null; // Will be validated in validateForm
        }
        return null;
      
      case 'productLines':
        if (!value || value.length === 0) return 'Veuillez ajouter au moins une ligne de produit';
        return null;
      
      case 'amountPaid':
        if (value < 0) return 'Le montant versé ne peut pas être négatif';
        return null;
      
      default:
        return null;
    }
  }, []);

  // Update form field
  const updateField = useCallback((field: keyof ReceiptFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    
    // Validate the field
    const error = validateField(field, value);
    setErrors((prev) => {
      const newErrors = { ...prev };
      if (error) {
        newErrors[field] = error;
      } else {
        delete newErrors[field];
      }
      return newErrors;
    });
  }, [validateField]);

  // Handle planteur selection
  const handlePlanteurChange = useCallback((planteurId: string | null, planteur: PlanteurOption | null) => {
    setSelectedPlanteur(planteur);
    updateField('planteurId', planteurId || '');
  }, [updateField]);

  // Handle chef planteur selection
  const handleChefPlanteurChange = useCallback((chefPlanteurId: string | null, chefPlanteur: ChefPlanteurOption | null) => {
    setSelectedChefPlanteur(chefPlanteur);
    setFormData((prev) => ({
      ...prev,
      chefPlanteurId: chefPlanteurId || '',
      chefPlanteurName: chefPlanteur?.name || prev.chefPlanteurName,
    }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next.chefPlanteurId;
      return next;
    });
  }, []);

  // Check cooperative consistency (Requirement 5.16)
  const cooperativeWarning = selectedPlanteur && selectedChefPlanteur && 
    selectedPlanteur.cooperative_id !== selectedChefPlanteur.cooperative_id
    ? 'Le planteur et le collecteur ne sont pas de la même coopérative'
    : undefined;

  // Validate receipt number uniqueness on blur (Requirement 17.1, 17.2)
  const handleReceiptNumberBlur = useCallback(async () => {
    const value = formData.receiptNumber.trim();
    if (!value || !cooperativeId) {
      setReceiptNumberWarning(null);
      return;
    }
    setIsValidatingReceiptNumber(true);
    try {
      const params = new URLSearchParams({ receiptNumber: value, cooperativeId });
      const res = await fetch(`/api/receipts/validate-number?${params}`);
      if (res.ok) {
        const data = await res.json();
        setReceiptNumberWarning(data.exists ? data : null);
      }
    } catch {
      // Non-blocking
    } finally {
      setIsValidatingReceiptNumber(false);
    }
  }, [formData.receiptNumber, cooperativeId]);

  // Validate all fields
  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    
    // Validate all required fields
    const requiredFields: (keyof ReceiptFormData)[] = [
      'contractNumber',
      'receiptNumber',
      'campaign',
      'transactionDate',
      'planteurId',
      'productLines',
    ];
    
    requiredFields.forEach((field) => {
      const error = validateField(field, formData[field]);
      if (error) {
        newErrors[field] = error;
      }
    });

    // Fournisseur optionnel — pas de validation obligatoire

    const amountError = validateField('amountPaid', formData.amountPaid);
    if (amountError) {
      newErrors.amountPaid = amountError;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, validateField]);

  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // Duplicate detection before creating (Requirement 17.5)
    const totalWeight = formData.productLines.reduce((sum, l) => sum + (l.netWeight || 0), 0);
    if (formData.planteurId && formData.chefPlanteurId && formData.transactionDate && totalWeight > 0) {
      try {
        const res = await fetch('/api/receipts/detect-duplicates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            planteurId: formData.planteurId,
            chefPlanteurId: formData.chefPlanteurId,
            transactionDate: formData.transactionDate,
            totalWeight,
            cooperativeId,
          }),
        });
        if (res.ok) {
          const body = await res.json();
          if (body.duplicates && body.duplicates.length > 0) {
            pendingSubmitData.current = formData;
            setPendingDuplicates(body.duplicates);
            return;
          }
        }
      } catch {
        // Non-blocking: if detection fails, proceed with submission
      }
    }

    await onSubmit(formData);
  }, [formData, validateForm, onSubmit, cooperativeId]);

  // Called when user confirms despite duplicates (Requirement 17.3, 17.4)
  const handleDuplicateContinue = useCallback(async () => {
    const data = pendingSubmitData.current;
    setPendingDuplicates(null);
    pendingSubmitData.current = null;
    if (data) {
      await onSubmit(data);
    }
  }, [onSubmit]);

  const handleDuplicateCancel = useCallback(() => {
    setPendingDuplicates(null);
    pendingSubmitData.current = null;
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Form Section */}
      <div className="space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Informations du contrat (Requirement 5.2) */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Informations du contrat
            </h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="contractNumber" className="block text-sm font-medium text-gray-700 mb-1">
                  Numéro de contrat <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="contractNumber"
                  value={formData.contractNumber}
                  onChange={(e) => updateField('contractNumber', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6FAF3D] ${
                    errors.contractNumber ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Ex: N°CONT.M041912772280M-CM/DLA/03/2025/00320"
                  disabled={isSubmitting}
                />
                {errors.contractNumber && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
                    <AlertCircle className="h-3 w-3" />
                    {errors.contractNumber}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="receiptNumber" className="block text-sm font-medium text-gray-700 mb-1">
                  Numéro de reçu <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="receiptNumber"
                  value={formData.receiptNumber}
                  onChange={(e) => {
                    updateField('receiptNumber', e.target.value);
                    setReceiptNumberWarning(null);
                  }}
                  onBlur={handleReceiptNumberBlur}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6FAF3D] ${
                    errors.receiptNumber ? 'border-red-500' : receiptNumberWarning?.exists ? 'border-amber-400' : 'border-gray-300'
                  }`}
                  placeholder="Ex: 0000004"
                  disabled={isSubmitting}
                />
                {isValidatingReceiptNumber && (
                  <p className="mt-1 text-xs text-gray-400">Vérification en cours...</p>
                )}
                {errors.receiptNumber && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
                    <AlertCircle className="h-3 w-3" />
                    {errors.receiptNumber}
                  </p>
                )}
                {/* Requirement 10.2, 17.2: warning with link to existing receipt */}
                {!errors.receiptNumber && receiptNumberWarning?.exists && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-amber-600">
                    <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                    Ce numéro de reçu existe déjà.{' '}
                    <a
                      href={`/deliveries?receipt=${receiptNumberWarning.collectionReceiptId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 underline hover:text-amber-700"
                    >
                      Voir les livraisons
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="campaign" className="block text-sm font-medium text-gray-700 mb-1">
                  Campagne <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="campaign"
                  value={formData.campaign}
                  onChange={(e) => updateField('campaign', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6FAF3D] ${
                    errors.campaign ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Ex: cacaoyère 2023/2024"
                  disabled={isSubmitting}
                />
                {errors.campaign && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
                    <AlertCircle className="h-3 w-3" />
                    {errors.campaign}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Informations de localisation (Requirement 5.3) */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Informations de localisation
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="region" className="block text-sm font-medium text-gray-700 mb-1">
                  Région
                </label>
                <input
                  type="text"
                  id="region"
                  value={formData.region}
                  onChange={(e) => updateField('region', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6FAF3D]"
                  placeholder="Ex: Centre"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-1">
                  Département
                </label>
                <input
                  type="text"
                  id="department"
                  value={formData.department}
                  onChange={(e) => updateField('department', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6FAF3D]"
                  placeholder="Ex: Mfoundi"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label htmlFor="arrondissement" className="block text-sm font-medium text-gray-700 mb-1">
                  Arrondissement
                </label>
                <input
                  type="text"
                  id="arrondissement"
                  value={formData.arrondissement}
                  onChange={(e) => updateField('arrondissement', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6FAF3D]"
                  placeholder="Ex: Yaoundé 1"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label htmlFor="village" className="block text-sm font-medium text-gray-700 mb-1">
                  Village
                </label>
                <input
                  type="text"
                  id="village"
                  value={formData.village}
                  onChange={(e) => updateField('village', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6FAF3D]"
                  placeholder="Ex: Nkol-Eton"
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          {/* Section 3: Informations de transaction (Requirement 5.4) */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Informations de transaction
            </h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="transactionDate" className="block text-sm font-medium text-gray-700 mb-1">
                  Date de transaction <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  id="transactionDate"
                  value={formData.transactionDate}
                  onChange={(e) => updateField('transactionDate', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6FAF3D] ${
                    errors.transactionDate ? 'border-red-500' : 'border-gray-300'
                  }`}
                  disabled={isSubmitting}
                />
                {errors.transactionDate && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
                    <AlertCircle className="h-3 w-3" />
                    {errors.transactionDate}
                  </p>
                )}
              </div>

              <PlanteurAutocomplete
                value={formData.planteurId}
                onChange={handlePlanteurChange}
                cooperativeId={cooperativeId}
                required
                label="Nom du vendeur (planteur)"
                placeholder="Rechercher un planteur..."
                error={errors.planteurId}
                disabled={isSubmitting}
              />

              {/* Chef planteur: saisie manuelle OU recherche en BD */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fournisseur <span className="text-gray-400 font-normal">(optionnel)</span>
                </label>
                <input
                  type="text"
                  value={formData.chefPlanteurName || (selectedChefPlanteur?.name ?? '')}
                  onChange={(e) => {
                    const name = e.target.value;
                    setFormData((prev) => ({ ...prev, chefPlanteurName: name, chefPlanteurId: '' }));
                    setSelectedChefPlanteur(null);
                    setErrors((prev) => { const n = { ...prev }; delete n.chefPlanteurId; return n; });
                  }}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6FAF3D] mb-2 ${
                    errors.chefPlanteurId ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Saisir le nom du collecteur..."
                  disabled={isSubmitting}
                />
                <ChefPlanteurAutocomplete
                  value={formData.chefPlanteurId}
                  onChange={handleChefPlanteurChange}
                  cooperativeId={cooperativeId}
                  label=""
                  placeholder="Ou rechercher dans la base..."
                  warning={cooperativeWarning}
                  disabled={isSubmitting}
                />
                {errors.chefPlanteurId && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
                    <AlertCircle className="h-3 w-3" />
                    {errors.chefPlanteurId}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="professionalCardNumber" className="block text-sm font-medium text-gray-700 mb-1">
                  Numéro de carte professionnelle
                </label>
                <input
                  type="text"
                  id="professionalCardNumber"
                  value={formData.professionalCardNumber}
                  onChange={(e) => updateField('professionalCardNumber', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6FAF3D]"
                  placeholder="Ex: CP123456"
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          {/* Section 4: Tableau des produits (Requirement 5.5) */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Tableau des produits
            </h3>
            <ProductLinesTable
              lines={formData.productLines}
              onChange={(lines) => updateField('productLines', lines)}
            />
            {errors.productLines && (
              <p className="mt-2 flex items-center gap-1 text-xs text-red-600">
                <AlertCircle className="h-3 w-3" />
                {errors.productLines}
              </p>
            )}
          </div>

          {/* Section 5: Informations de paiement (Requirement 5.10) */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Informations de paiement
            </h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="paymentMode" className="block text-sm font-medium text-gray-700 mb-1">
                  Mode de paiement
                </label>
                <select
                  id="paymentMode"
                  value={formData.paymentMode}
                  onChange={(e) => updateField('paymentMode', e.target.value as 'Espèces' | 'Autres')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6FAF3D]"
                  disabled={isSubmitting}
                >
                  <option value="Espèces">Espèces</option>
                  <option value="Autres">Autres</option>
                </select>
              </div>

              <div>
                <label htmlFor="amountPaid" className="block text-sm font-medium text-gray-700 mb-1">
                  Montant versé (XAF)
                </label>
                <input
                  type="number"
                  id="amountPaid"
                  value={formData.amountPaid || ''}
                  onChange={(e) => updateField('amountPaid', parseFloat(e.target.value) || 0)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6FAF3D] ${
                    errors.amountPaid ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="0"
                  step="1"
                  min="0"
                  disabled={isSubmitting}
                />
                {errors.amountPaid && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
                    <AlertCircle className="h-3 w-3" />
                    {errors.amountPaid}
                  </p>
                )}
              </div>

              {/* Display calculated values */}
              <div className="pt-4 border-t border-gray-200 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">Total général:</span>
                  <span className="text-lg font-bold text-gray-900">
                    {totalAmount.toLocaleString('fr-FR')} XAF
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">Solde:</span>
                  <span className={`text-lg font-bold ${balance < 0 && formData.productLines.length > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                    {balance.toLocaleString('fr-FR')} XAF
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-[#6FAF3D] text-white rounded-lg font-medium hover:bg-[#5a8f31] focus:outline-none focus:ring-2 focus:ring-[#6FAF3D] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Création en cours...' : 'Créer les livraisons'}
            </button>
          </div>
        </form>
      </div>

      {/* PDF Viewer Section (Requirement 5.17) */}
      <div className="lg:sticky lg:top-6 h-fit">
        <PdfViewer pdfUrl={pdfUrl} className="h-[800px]" />
      </div>

      {/* Duplicate detection warning modal (Requirement 17.3–17.6) */}
      {pendingDuplicates && pendingDuplicates.length > 0 && (
        <DuplicateWarningModal
          duplicates={pendingDuplicates}
          onContinue={handleDuplicateContinue}
          onCancel={handleDuplicateCancel}
        />
      )}
    </div>
  );
}
