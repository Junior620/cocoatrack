'use client';

import { useEffect, useState } from 'react';
import { useFactoryProductTypes, useFactoryProductionLines } from '@/lib/hooks/useFactory';
import {
  FACTORY_DEPARTMENT_LABELS,
  MVP_FACTORY_DEPARTMENTS,
  type FactoryDepartment,
} from '@/types/usinage';

interface StaffRow {
  id: string;
  full_name: string;
  email: string;
  role: string;
  factory_department: FactoryDepartment | null;
  can_solo_validate_lot: boolean;
}

interface GapItem {
  cdc: string;
  existing: string;
  status: string;
  notes?: string;
}

interface RoadmapItem {
  id: string;
  title: string;
  rationale: string;
}

export default function FactorySettingsPage() {
  const { data: types } = useFactoryProductTypes();
  const { data: lines } = useFactoryProductionLines();
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [gaps, setGaps] = useState<GapItem[]>([]);
  const [roadmap, setRoadmap] = useState<RoadmapItem[]>([]);
  const [gradeRule, setGradeRule] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadOrg = async () => {
    const [s, g, r, gr] = await Promise.all([
      fetch('/api/factory/organization?view=staff').then((x) => x.json()),
      fetch('/api/factory/organization?view=gap').then((x) => x.json()),
      fetch('/api/factory/organization?view=roadmap').then((x) => x.json()),
      fetch('/api/factory/organization?view=grade_rules').then((x) => x.json()),
    ]);
    if (s.error) setError(s.error);
    setStaff(s.data ?? []);
    setGaps(g.gaps ?? []);
    setRoadmap(r.roadmap ?? []);
    setGradeRule(gr.rule ?? null);
  };

  useEffect(() => {
    loadOrg();
  }, []);

  const updateStaff = async (profileId: string, patch: Partial<StaffRow>) => {
    const res = await fetch('/api/factory/organization', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile_id: profileId,
        factory_department: patch.factory_department,
        can_solo_validate_lot: patch.can_solo_validate_lot,
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error);
      return;
    }
    await loadOrg();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#5C4033]">Paramètres usine</h1>
      <p className="text-sm text-gray-500">
        Référentiels · départements MVP · règles grade · roadmap Phase D
      </p>

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <section className="rounded-xl border border-[#d4c4b0] bg-white p-4">
        <h2 className="mb-3 font-semibold">Départements MVP & séparation des devoirs</h2>
        <p className="mb-3 text-xs text-gray-500">
          Départements : {MVP_FACTORY_DEPARTMENTS.map((d) => FACTORY_DEPARTMENT_LABELS[d]).join(', ')}.
          Sans droit « solo », un même agent ne peut pas enchaîner réception + QC + validation.
        </p>
        <ul className="space-y-2 text-sm">
          {staff.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-2 border-b border-gray-100 py-2">
              <span className="min-w-[160px] font-medium">{s.full_name}</span>
              <span className="text-gray-500">{s.role}</span>
              <select
                className="rounded border px-2 py-1"
                value={s.factory_department ?? ''}
                onChange={(e) =>
                  updateStaff(s.id, {
                    factory_department: (e.target.value || null) as FactoryDepartment | null,
                    can_solo_validate_lot: s.can_solo_validate_lot,
                  })
                }
              >
                <option value="">— Département —</option>
                {MVP_FACTORY_DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {FACTORY_DEPARTMENT_LABELS[d]}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={!!s.can_solo_validate_lot}
                  onChange={(e) =>
                    updateStaff(s.id, {
                      factory_department: s.factory_department,
                      can_solo_validate_lot: e.target.checked,
                    })
                  }
                />
                Solo validate
              </label>
            </li>
          ))}
          {staff.length === 0 && <li className="text-gray-500">Aucun personnel rattaché au site</li>}
        </ul>
      </section>

      <section className="rounded-xl border border-[#d4c4b0] bg-white p-4">
        <h2 className="mb-3 font-semibold">Règles grade ONCC actives</h2>
        {gradeRule ? (
          <dl className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
            <div>
              <dt className="text-gray-500">Nom</dt>
              <dd>{String(gradeRule.name)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Humidité max</dt>
              <dd>{String(gradeRule.moisture_target_max)} %</dd>
            </div>
            <div>
              <dt className="text-gray-500">Moisissure max</dt>
              <dd>{String(gradeRule.mold_max_pct)} %</dd>
            </div>
            <div>
              <dt className="text-gray-500">Tolérance bilan</dt>
              <dd>{String(gradeRule.mass_balance_tolerance_pct)} %</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-gray-500">Aucune règle (sera créée au premier QC)</p>
        )}
      </section>

      <section className="rounded-xl border border-[#d4c4b0] bg-white p-4">
        <h2 className="mb-3 font-semibold">Types de produits</h2>
        <ul className="space-y-1 text-sm">
          {(
            (types as Array<{
              name: string;
              category: string;
              is_raw_material: boolean;
              is_finished_product: boolean;
            }>) ?? []
          ).map((t, i) => (
            <li key={i} className="flex justify-between border-b border-gray-100 py-1">
              <span>{t.name}</span>
              <span className="text-gray-500">
                {t.is_raw_material ? 'Matière première' : t.is_finished_product ? 'Produit fini' : t.category}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-[#d4c4b0] bg-white p-4">
        <h2 className="mb-3 font-semibold">Lignes de production</h2>
        <ul className="space-y-1 text-sm">
          {(
            (lines as Array<{ name: string; capacity_kg_per_day: number | null; status: string }>) ?? []
          ).map((l, i) => (
            <li key={i} className="flex justify-between border-b border-gray-100 py-1">
              <span>{l.name}</span>
              <span className="text-gray-500">{l.capacity_kg_per_day ? `${l.capacity_kg_per_day} kg/j` : '-'}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-[#d4c4b0] bg-white p-4">
        <h2 className="mb-3 font-semibold">Gap list /factory vs CDC</h2>
        <ul className="space-y-1 text-sm">
          {gaps.map((g) => (
            <li key={g.cdc} className="flex justify-between gap-2 border-b border-gray-50 py-1">
              <span>
                <strong>{g.cdc}</strong> — {g.existing}
                {g.notes ? <span className="text-gray-500"> · {g.notes}</span> : null}
              </span>
              <span className="shrink-0 text-xs uppercase text-[#8B6914]">{g.status}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-dashed border-[#d4c4b0] bg-[#faf6f1] p-4">
        <h2 className="mb-3 font-semibold">Phase D — hors MVP</h2>
        <ul className="space-y-2 text-sm">
          {roadmap.map((item) => (
            <li key={item.id}>
              <strong>{item.title}</strong>
              <p className="text-gray-600">{item.rationale}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
