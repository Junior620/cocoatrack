/**
 * Human-readable NDVI / EVI / NDMI interpretation for cocoa temporal charts.
 */

import {
  detectEVIEarlyAlert,
  calculateNdviEviGap,
  interpretNdviEviGap,
  type EVIAlert,
} from './evi-alerts';
import { detectNDMIEarlyAlert, type NDMIAlert } from './ndmi-alerts';
import {
  combineVegetationAlerts,
  type CombinedVegetationAlert,
} from './combined-alerts';
import { getCocoaSeasonContext } from './seasonality';

export type CurveVerdict =
  | 'healthy'
  | 'watch'
  | 'stress'
  | 'recovering'
  | 'incomplete';

export interface CurveInterpretation {
  verdict: CurveVerdict;
  title: string;
  summary: string;
  bullets: string[];
  howToRead: string[];
  recommendation: string;
  /** Short actionable steps for field agents */
  agentActions: string[];
  eviAlert: EVIAlert;
  ndmiAlert: NDMIAlert;
  combinedAlert: CombinedVegetationAlert;
  gap: number | null;
  gapLabel: string;
  gapHint: string;
}

function ndviLabel(v: number): string {
  if (v >= 0.65) return 'excellent';
  if (v >= 0.55) return 'bon';
  if (v >= 0.45) return 'moyen';
  if (v >= 0.30) return 'faible';
  return 'critique';
}

/**
 * Build a plain-language analysis from the timeline series.
 */
export function interpretNdviEviCurves(
  points: Array<{
    date: Date | string;
    ndvi: number;
    evi?: number | null;
    ndmi?: number | null;
  }>
): CurveInterpretation {
  const valid = points.filter((p) => !isNaN(p.ndvi));
  const withEvi = valid.filter(
    (p) => p.evi != null && !isNaN(Number(p.evi))
  );
  const withNdmi = valid.filter(
    (p) => p.ndmi != null && !isNaN(Number(p.ndmi))
  );

  const howToRead = [
    'Courbe verte (NDVI) = verdure globale. C’est la base du badge santé.',
    'Courbe bleue pointillée (EVI) = signal plus sensible sous canopée dense (cacao ombragé).',
    'Courbe ambre (NDMI) = humidité foliaire (SWIR). Baisse avant le NDVI = stress hydrique.',
    'EVI souvent sous le NDVI : normal. Un écart large (> 0,15) = canopée dense / NDVI saturé.',
    'Signal d’alerte fort : EVI ou NDMI qui baisse alors que le NDVI reste plat.',
    'Double signal EVI+NDMI = priorité visite haute (canopée et hydrique).',
    `Saison cacao (réf. aujourd’hui) : ${getCocoaSeasonContext().labelFr} — ${getCocoaSeasonContext().hintFr}`,
    'Trous dans la courbe = mois sans image (nuages), pas une chute de végétation.',
    'Badge qualité image : bonne (<80 % nuages), acceptable (secours 80–95 %), dégradée (≥95 %).',
  ];

  const emptyNdmi = detectNDMIEarlyAlert([]);
  const emptyCombined = combineVegetationAlerts(
    detectEVIEarlyAlert([]),
    emptyNdmi
  );

  if (valid.length === 0) {
    return {
      verdict: 'incomplete',
      title: 'Pas assez de données',
      summary: 'Aucune mesure NDVI exploitable sur la période.',
      bullets: [],
      howToRead,
      recommendation: 'Lancez Historique GEE pour charger des images Sentinel-2.',
      agentActions: [
        'Lancer Historique GEE (12 mois) sur la parcelle',
        'Vérifier que la géométrie de la parcelle est correcte',
      ],
      eviAlert: detectEVIEarlyAlert([]),
      ndmiAlert: emptyNdmi,
      combinedAlert: emptyCombined,
      gap: null,
      gapLabel: 'Écart indisponible',
      gapHint: 'Complétez l’EVI pour interpréter la canopée.',
    };
  }

  const avgNdvi =
    valid.reduce((s, p) => s + p.ndvi, 0) / valid.length;
  const first = valid[0];
  const last = valid[valid.length - 1];
  const ndviDelta = last.ndvi - first.ndvi;

  const avgEvi =
    withEvi.length > 0
      ? withEvi.reduce((s, p) => s + Number(p.evi), 0) / withEvi.length
      : null;
  const eviDelta =
    withEvi.length >= 2
      ? Number(withEvi[withEvi.length - 1].evi) - Number(withEvi[0].evi)
      : null;

  const avgNdmi =
    withNdmi.length > 0
      ? withNdmi.reduce((s, p) => s + Number(p.ndmi), 0) / withNdmi.length
      : null;
  const ndmiDelta =
    withNdmi.length >= 2
      ? Number(withNdmi[withNdmi.length - 1].ndmi) -
        Number(withNdmi[0].ndmi)
      : null;

  const latestEvi =
    withEvi.length > 0 ? Number(withEvi[withEvi.length - 1].evi) : null;
  const gap = calculateNdviEviGap(last.ndvi, latestEvi);
  const gapInfo = interpretNdviEviGap(gap);
  const gapLabel = gapInfo.labelFr;

  const eviAlert = detectEVIEarlyAlert(
    valid.map((p) => ({
      date: p.date,
      ndvi: p.ndvi,
      evi: p.evi ?? null,
    }))
  );
  const ndmiAlert = detectNDMIEarlyAlert(
    valid.map((p) => ({
      date: p.date,
      ndvi: p.ndvi,
      ndmi: p.ndmi ?? null,
    }))
  );
  const combinedAlert = combineVegetationAlerts(eviAlert, ndmiAlert);

  const bullets: string[] = [
    `NDVI moyen ${avgNdvi.toFixed(3)} → niveau ${ndviLabel(avgNdvi)} pour le cacao.`,
    `NDVI sur la période : ${ndviDelta >= 0 ? '+' : ''}${ndviDelta.toFixed(3)} (${
      ndviDelta > 0.05 ? 'en hausse' : ndviDelta < -0.05 ? 'en baisse' : 'stable'
    }).`,
  ];

  if (avgEvi != null) {
    bullets.push(
      `EVI moyen ${avgEvi.toFixed(3)}${
        eviDelta != null
          ? ` · tendance ${eviDelta >= 0 ? '+' : ''}${eviDelta.toFixed(3)}`
          : ''
      }.`
    );
  } else {
    bullets.push(
      'EVI absent sur cette période — complétez via Historique GEE pour le signal précoce.'
    );
  }

  if (avgNdmi != null) {
    bullets.push(
      `NDMI moyen ${avgNdmi.toFixed(3)}${
        ndmiDelta != null
          ? ` · tendance ${ndmiDelta >= 0 ? '+' : ''}${ndmiDelta.toFixed(3)}`
          : ''
      } (humidité foliaire).`
    );
  } else {
    bullets.push(
      'NDMI absent — relancez Historique GEE pour le signal hydrique (SWIR).'
    );
  }

  if (gap != null) {
    bullets.push(`Écart NDVI − EVI = ${gap.toFixed(3)} → ${gapLabel}. ${gapInfo.hintFr}`);
  }

  if (eviAlert.level !== 'none') {
    bullets.push(eviAlert.messageFr);
  }
  if (ndmiAlert.level !== 'none') {
    bullets.push(ndmiAlert.messageFr);
  }
  if (combinedAlert.code === 'canopy_and_hydric') {
    bullets.push(combinedAlert.messageFr);
  }

  let verdict: CurveVerdict = 'healthy';
  let title = 'Situation globalement saine';
  let summary =
    'Les courbes indiquent un couvert végétal cohérent avec une plantation de cacao en bon état.';
  let recommendation =
    'Continuer le suivi mensuel. Pas d’action urgente liée aux indices satellitaires.';
  let agentActions = [
    'Maintenir le suivi mensuel satellite',
    'Noter toute anomalie terrain (sécheresse, maladie, ombrage)',
  ];

  const hydricAlert = ndmiAlert.level === 'alert' || ndmiAlert.level === 'watch';
  const canopyAlert = eviAlert.level === 'alert' || eviAlert.level === 'watch';
  const dualAlert = combinedAlert.code === 'canopy_and_hydric';

  if (withEvi.length === 0 && withNdmi.length === 0) {
    verdict = 'incomplete';
    title = 'Analyse partielle (NDVI seul)';
    summary =
      'Le NDVI donne l’état général, mais sans EVI/NDMI on voit moins bien le stress canopée et hydrique.';
    recommendation =
      'Complétez EVI et NDMI (Historique GEE) pour une lecture cacao plus fiable.';
    agentActions = [
      'Lancer Historique GEE / Compléter les indices',
      'Revenir vérifier les courbes après calcul',
    ];
  } else if (
    dualAlert ||
    eviAlert.level === 'alert' ||
    ndmiAlert.level === 'alert' ||
    avgNdvi < 0.3
  ) {
    verdict = 'stress';
    title = dualAlert
      ? 'Double alerte canopée + hydrique'
      : 'Stress probable — à vérifier au champ';
    summary = dualAlert
      ? combinedAlert.messageFr
      : ndmiAlert.level === 'alert'
        ? 'Le NDMI signale un stress hydrique précoce que le NDVI peut masquer.'
        : eviAlert.level === 'alert'
          ? 'L’EVI signale un stress précoce que le NDVI peut masquer sous canopée dense.'
          : 'Le NDVI est bas : couvert faible ou stress marqué.';
    recommendation =
      'Vérifier hydrique, ombrage, sanitaire et nutrition. Comparer avec les parcelles voisines.';
    agentActions = [
      dualAlert
        ? 'Visite terrain prioritaire sous 7 jours (canopée + hydrique)'
        : 'Visite terrain sous 7 jours',
      ...(hydricAlert
        ? ['Contrôler irrigation / disponibilité en eau', 'Observer flétrissement foliaire']
        : ['Contrôler stress hydrique et ombrage']),
      'Inspecter maladies / ravageurs / carences',
      'Comparer avec 1–2 parcelles voisines',
    ];
  } else if (
    canopyAlert ||
    hydricAlert ||
    (eviDelta != null && eviDelta < -0.04) ||
    (ndmiDelta != null && ndmiDelta < -0.04) ||
    avgNdvi < 0.45
  ) {
    verdict = 'watch';
    title = 'À surveiller';
    summary =
      hydricAlert
        ? 'Le NDMI invite à la prudence côté humidité, même si le NDVI reste acceptable.'
        : 'Les indices restent acceptables, mais la dynamique (surtout EVI/NDMI) invite à la prudence.';
    recommendation =
      'Renforcer le suivi le mois prochain. Anticiper irrigation / entretien si la baisse se confirme.';
    agentActions = [
      'Planifier un passage observation le mois prochain',
      ...(hydricAlert
        ? ['Anticiper irrigation si la baisse NDMI se confirme']
        : ['Anticiper irrigation / entretien si la baisse EVI se confirme']),
      'Surveiller l’écart NDVI−EVI (saturation)',
    ];
  } else if (
    ndviDelta > 0.05 ||
    (eviDelta != null && eviDelta > 0.04) ||
    (ndmiDelta != null && ndmiDelta > 0.04)
  ) {
    verdict = 'recovering';
    title = 'Dynamique positive';
    summary =
      'Les courbes remontent : reprise de verdure, humidité ou amélioration des conditions.';
    recommendation =
      'Maintenir les pratiques actuelles et confirmer sur 1–2 cycles d’images.';
    agentActions = [
      'Maintenir les pratiques actuelles',
      'Confirmer la reprise sur 1–2 prochaines images',
    ];
  }

  return {
    verdict,
    title,
    summary,
    bullets,
    howToRead,
    recommendation,
    agentActions,
    eviAlert,
    ndmiAlert,
    combinedAlert,
    gap,
    gapLabel,
    gapHint: gapInfo.hintFr,
  };
}

export function verdictTone(verdict: CurveVerdict): string {
  switch (verdict) {
    case 'healthy':
      return 'border-emerald-200 bg-emerald-50 text-emerald-950';
    case 'recovering':
      return 'border-lime-200 bg-lime-50 text-lime-950';
    case 'watch':
      return 'border-amber-200 bg-amber-50 text-amber-950';
    case 'stress':
      return 'border-orange-300 bg-orange-50 text-orange-950';
    case 'incomplete':
    default:
      return 'border-slate-200 bg-slate-50 text-slate-900';
  }
}
