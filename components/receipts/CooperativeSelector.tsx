'use client';

import { useState, useEffect } from 'react';
import { Building2, Loader2, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Cooperative {
  id: string;
  name: string;
  code: string;
}

export interface CooperativeSelectorProps {
  onSelect: (cooperativeId: string) => void;
  onCancel: () => void;
}

export function CooperativeSelector({ onSelect, onCancel }: CooperativeSelectorProps) {
  const [cooperatives, setCooperatives] = useState<Cooperative[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCooperatives() {
      try {
        const supabase = createClient();
        const { data, error: fetchError } = await supabase
          .from('cooperatives')
          .select('id, name, code')
          .order('name') as { data: Array<{ id: string; name: string; code: string }> | null; error: any };

        if (fetchError) throw fetchError;

        setCooperatives(data ?? []);
        
        // Auto-select if only one cooperative
        if (data && data.length === 1) {
          setSelectedId(data[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur lors du chargement des coopératives');
      } finally {
        setIsLoading(false);
      }
    }

    loadCooperatives();
  }, []);

  const handleContinue = () => {
    if (selectedId) {
      onSelect(selectedId);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-sm text-gray-600">Chargement des coopératives...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <AlertCircle className="w-12 h-12 text-red-500" />
        <p className="text-sm text-red-700">{error}</p>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Fermer
        </button>
      </div>
    );
  }

  if (cooperatives.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Building2 className="w-12 h-12 text-gray-400" />
        <p className="text-sm text-gray-600">Aucune coopérative disponible</p>
        <p className="text-xs text-gray-500">Contactez un administrateur pour créer une coopérative</p>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Fermer
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-2">
          Sélectionnez une coopérative
        </h3>
        <p className="text-sm text-gray-600">
          Choisissez la coopérative pour laquelle vous importez ce reçu de collecte.
        </p>
      </div>

      <div className="space-y-2">
        {/* Option: Aucune coopérative */}
        <label
          className={[
            'flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors',
            selectedId === 'none'
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50',
          ].join(' ')}
        >
          <input
            type="radio"
            name="cooperative"
            value="none"
            checked={selectedId === 'none'}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-4 h-4 text-blue-600 focus:ring-blue-500"
          />
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">Aucune coopérative</p>
            <p className="text-xs text-gray-500">Reçu non associé à une coopérative</p>
          </div>
          <Building2 className="w-5 h-5 text-gray-400" />
        </label>

        {/* Cooperatives list */}
        {cooperatives.map((coop) => (
          <label
            key={coop.id}
            className={[
              'flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors',
              selectedId === coop.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50',
            ].join(' ')}
          >
            <input
              type="radio"
              name="cooperative"
              value={coop.id}
              checked={selectedId === coop.id}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-4 h-4 text-blue-600 focus:ring-blue-500"
            />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">{coop.name}</p>
              <p className="text-xs text-gray-500">Code: {coop.code}</p>
            </div>
            <Building2 className="w-5 h-5 text-gray-400" />
          </label>
        ))}
      </div>

      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={handleContinue}
          disabled={!selectedId}
          className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Continuer
        </button>
      </div>
    </div>
  );
}
