'use client';

/**
 * Compact feedback buttons for early-alert calibration.
 */

import { useState } from 'react';
import { Check, X, HelpCircle, Loader2 } from 'lucide-react';

type AlertKind = 'ndmi' | 'evi' | 'combined';
type Verdict = 'true_positive' | 'false_positive' | 'uncertain';

interface AlertFeedbackButtonsProps {
  parcelleId: string;
  alertKind: AlertKind;
  alertLevel: 'watch' | 'alert';
  alertCode?: string;
  context?: Record<string, unknown>;
  className?: string;
}

export function AlertFeedbackButtons({
  parcelleId,
  alertKind,
  alertLevel,
  alertCode,
  context,
  className = '',
}: AlertFeedbackButtonsProps) {
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<Verdict | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (verdict: Verdict) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/satellite/alert-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parcelleId,
          alertKind,
          alertLevel,
          alertCode,
          verdict,
          context,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Échec enregistrement');
      }
      setDone(verdict);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    const label =
      done === 'true_positive'
        ? 'Merci — signal confirmé'
        : done === 'false_positive'
          ? 'Merci — faux positif noté'
          : 'Merci — noté comme incertain';
    return (
      <p className={`mt-2 text-xs font-medium opacity-80 ${className}`}>{label}</p>
    );
  }

  return (
    <div className={`mt-3 ${className}`}>
      <p className="text-[11px] font-medium uppercase tracking-wide opacity-70">
        Calibration terrain
      </p>
      <div className="mt-1.5 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => submit('true_positive')}
          className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-white/80 px-2 py-1 text-xs font-medium text-emerald-900 hover:bg-emerald-50 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          Confirmé
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => submit('false_positive')}
          className="inline-flex items-center gap-1 rounded-md border border-red-300 bg-white/80 px-2 py-1 text-xs font-medium text-red-900 hover:bg-red-50 disabled:opacity-50"
        >
          <X className="h-3 w-3" />
          Faux positif
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => submit('uncertain')}
          className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white/80 px-2 py-1 text-xs font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
        >
          <HelpCircle className="h-3 w-3" />
          Incertain
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}
