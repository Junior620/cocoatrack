/**
 * Yield Prediction Examples Page
 * 
 * Page de démonstration visuelle du composant YieldPredictionDisplay
 * Utilisée pour générer les captures d'écran du mémoire académique
 */

'use client';

import { YieldPredictionMockStates } from '@/components/satellite/YieldPredictionMockStates';

export default function YieldPredictionExamplesPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Exemples - Prédiction de Rendement
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Cette page présente différents états du composant YieldPredictionDisplay
            pour les captures d'écran du mémoire académique.
          </p>
        </div>

        {/* Instructions */}
        <div className="mb-8 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h2 className="mb-2 font-semibold text-blue-900">
            📸 Instructions pour les Captures
          </h2>
          <ul className="space-y-1 text-sm text-blue-800">
            <li>• <strong>Figure 3.X.1</strong> : Capturer "État Initial"</li>
            <li>• <strong>Figure 3.X.2</strong> : Capturer "Confiance Élevée (Complet)"</li>
            <li>• <strong>Figure 3.X.4</strong> : Capturer "Comparaison Niveaux" (3 cartes)</li>
            <li>• Utiliser Ctrl+Shift+PrtScn (Linux) ou outil de capture</li>
          </ul>
        </div>

        {/* Examples Grid */}
        <div className="space-y-12">
          
          {/* Section 1: État Initial (pour Figure 3.X.1) */}
          <section>
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-full bg-primary-600 px-3 py-1 text-sm font-bold text-white">
                Figure 3.X.1
              </div>
              <h2 className="text-xl font-bold text-gray-900">
                État Initial - Aucune Prédiction
              </h2>
            </div>
            <p className="mb-4 text-sm text-gray-600">
              Interface avant génération de la prédiction. Montre le bouton "Générer Prévision".
            </p>
            <div className="max-w-2xl">
              <YieldPredictionMockStates state="empty" />
            </div>
          </section>

          {/* Section 2: Prédiction Complète (pour Figure 3.X.2) */}
          <section>
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-full bg-primary-600 px-3 py-1 text-sm font-bold text-white">
                Figure 3.X.2
              </div>
              <h2 className="text-xl font-bold text-gray-900">
                Résultat Prédiction - Confiance Élevée (Complet)
              </h2>
            </div>
            <p className="mb-4 text-sm text-gray-600">
              Prédiction complète avec rendement estimé, badge confiance HIGH, intervalle,
              comparaison coopérative, et détails modèle.
            </p>
            <div className="max-w-2xl">
              <YieldPredictionMockStates state="high" />
            </div>
          </section>

          {/* Section 3: Comparaison Niveaux de Confiance (pour Figure 3.X.4) */}
          <section>
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-full bg-primary-600 px-3 py-1 text-sm font-bold text-white">
                Figure 3.X.4
              </div>
              <h2 className="text-xl font-bold text-gray-900">
                Comparaison Niveaux de Confiance
              </h2>
            </div>
            <p className="mb-4 text-sm text-gray-600">
              Comparaison visuelle des trois niveaux de confiance (HIGH, MEDIUM, LOW) 
              avec badges colorés et intervalles différents.
            </p>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div>
                <div className="mb-2 text-center">
                  <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-800">
                    🟢 Confiance ÉLEVÉE
                  </span>
                </div>
                <YieldPredictionMockStates state="high" />
                <div className="mt-2 rounded-lg bg-green-50 p-3 text-xs text-green-800">
                  <strong>Critères:</strong> ≥6 mois NDVI + historique disponible<br />
                  <strong>Intervalle:</strong> ±10%<br />
                  <strong>Usage:</strong> Planification opérationnelle
                </div>
              </div>
              
              <div>
                <div className="mb-2 text-center">
                  <span className="inline-flex items-center rounded-full bg-yellow-100 px-3 py-1 text-sm font-semibold text-yellow-800">
                    🟡 Confiance MOYENNE
                  </span>
                </div>
                <YieldPredictionMockStates state="medium" />
                <div className="mt-2 rounded-lg bg-yellow-50 p-3 text-xs text-yellow-800">
                  <strong>Critères:</strong> ≥3 mois NDVI OU historique<br />
                  <strong>Intervalle:</strong> ±20%<br />
                  <strong>Usage:</strong> Indicatif, prudence requise
                </div>
              </div>
              
              <div>
                <div className="mb-2 text-center">
                  <span className="inline-flex items-center rounded-full bg-orange-100 px-3 py-1 text-sm font-semibold text-orange-800">
                    🔴 Confiance FAIBLE
                  </span>
                </div>
                <YieldPredictionMockStates state="low" />
                <div className="mt-2 rounded-lg bg-orange-50 p-3 text-xs text-orange-800">
                  <strong>Critères:</strong> &lt;3 mois NDVI + pas d'historique<br />
                  <strong>Intervalle:</strong> ±30%<br />
                  <strong>Usage:</strong> Exploratoire uniquement
                </div>
              </div>
            </div>
          </section>

          {/* Section 4: Comparaison avec Moyenne (Bonus) */}
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                Bonus - Comparaison Coopérative
              </h2>
            </div>
            <p className="mb-4 text-sm text-gray-600">
              Exemples de parcelles au-dessus et en-dessous de la moyenne coopérative (500 kg/ha).
            </p>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div>
                <div className="mb-2 text-center text-sm font-semibold text-green-700">
                  ↑ Au-dessus de la Moyenne (+35%)
                </div>
                <YieldPredictionMockStates state="above-average" />
              </div>
              
              <div>
                <div className="mb-2 text-center text-sm font-semibold text-red-700">
                  ↓ En-dessous de la Moyenne (-10%)
                </div>
                <YieldPredictionMockStates state="below-average" />
              </div>
            </div>
          </section>

          {/* Section 5: Rendement Réel Enregistré (Bonus) */}
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                Bonus - Rendement Réel Enregistré
              </h2>
            </div>
            <p className="mb-4 text-sm text-gray-600">
              Exemple après récolte avec rendement réel enregistré montrant la précision du modèle.
            </p>
            <div className="max-w-2xl">
              <YieldPredictionMockStates state="with-actual" />
            </div>
          </section>

          {/* Section 6: Formulaire Édition (Bonus) */}
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                Bonus - Note sur Formulaire
              </h2>
            </div>
            <p className="mb-4 text-sm text-gray-600">
              Le formulaire de saisie du rendement réel apparaît sur la vraie page parcelle 
              après clic sur le bouton "+ Enregistrer le Rendement Réel". Cette fonctionnalité 
              n'est pas affichée dans les mockups pour simplicité.
            </p>
          </section>

        </div>

        {/* Footer */}
        <div className="mt-12 rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-3 font-semibold text-gray-900">
            📝 Notes pour le Mémoire
          </h3>
          <div className="space-y-2 text-sm text-gray-600">
            <p>
              <strong>Figures essentielles :</strong>
            </p>
            <ul className="ml-6 list-disc space-y-1">
              <li>Figure 3.X.1 : État initial (Section 1)</li>
              <li>Figure 3.X.2 : Résultat complet confiance HIGH (Section 2)</li>
              <li>Figure 3.X.4 : Comparaison 3 niveaux (Section 3)</li>
            </ul>
            <p className="mt-3">
              <strong>Figures bonus (optionnelles) :</strong>
            </p>
            <ul className="ml-6 list-disc space-y-1">
              <li>Comparaison coopérative (Section 4)</li>
              <li>Rendement réel vs prédit (Section 5)</li>
              <li>Formulaire saisie (Section 6)</li>
            </ul>
            <p className="mt-3 text-xs italic">
              Pour Figure 3.X.3 (Graphique NDVI temporel), aller sur une vraie page parcelle 
              avec données NDVI disponibles.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
