import React, { useMemo, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { MotilityStatus, PatientRecord } from '../types/clinical';
import { MOTILITY_STATUS_META } from '../utils/clinicalLabels';

interface SidebarProps {
  patients: PatientRecord[];
  selectedPatientId: string;
  onSelectPatient: (id: string) => void;
  onOpenNewPatient: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

type FilterKey = 'all' | 'normal' | 'low' | 'hyper';

export const Sidebar: React.FC<SidebarProps> = ({
  patients,
  selectedPatientId,
  onSelectPatient,
  onOpenNewPatient,
  isMobileOpen,
  onCloseMobile,
}) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');

  const filteredPatients = useMemo(() => {
    const q = query.trim().toLowerCase();
    return patients.filter((p) => {
      const matchesFilter =
        filter === 'all' ||
        (filter === 'normal' && p.status === 'normal') ||
        (filter === 'low' && (p.status === 'hypo' || p.status === 'paresis')) ||
        (filter === 'hyper' && p.status === 'hyper');

      if (!matchesFilter) return false;
      if (!q) return true;
      return (
        p.fullName.toLowerCase().includes(q) ||
        p.caseNumber.toLowerCase().includes(q) ||
        p.ward.toLowerCase().includes(q) ||
        p.diagnosis.toLowerCase().includes(q)
      );
    });
  }, [patients, query, filter]);

  const getLatestRate = (p: PatientRecord): number => {
    if (p.telemetry.length === 0) return 0;
    return p.telemetry[p.telemetry.length - 1].occurrenceRate;
  };

  const renderStatusText = (status: MotilityStatus) => {
    const meta = MOTILITY_STATUS_META[status];
    return (
      <span className={`text-xs font-medium ${meta.colorClass}`}>
        <span aria-hidden="true" className="mr-1">
          {meta.symbol}
        </span>
        {meta.shortLabel}
      </span>
    );
  };

  const content = (
    <aside className="flex h-full w-72 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
          ЭнтероФон
        </span>
        <button
          type="button"
          onClick={onCloseMobile}
          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 lg:hidden"
          aria-label="Закрыть панель пациентов"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="border-b border-slate-200 p-4 space-y-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск пациента, ИБ, отделения"
            aria-label="Поиск пациента"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-700 focus:bg-white focus:outline-none"
          />
        </div>

        <div
          className="grid grid-cols-4 gap-1 rounded-lg bg-slate-100 p-1"
          role="group"
          aria-label="Фильтр по статусу моторики"
        >
          {(
            [
              { key: 'all', label: 'Все' },
              { key: 'normal', label: 'Норма' },
              { key: 'low', label: 'Сниж.' },
              { key: 'hyper', label: 'Гипер' },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                filter === item.key
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {filteredPatients.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-slate-500">Пациенты не найдены</p>
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setFilter('all');
              }}
              className="mt-2 text-xs font-medium text-cyan-700 hover:underline"
            >
              Сбросить фильтр
            </button>
          </div>
        ) : (
          filteredPatients.map((patient) => {
            const isSelected = patient.id === selectedPatientId;
            const latestRate = getLatestRate(patient);
            return (
              <button
                key={patient.id}
                type="button"
                onClick={() => {
                  onSelectPatient(patient.id);
                  onCloseMobile();
                }}
                className={`w-full text-left px-4 py-3.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-700 ${
                  isSelected ? 'bg-cyan-50/70' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className={`truncate text-sm font-semibold ${
                      isSelected ? 'text-cyan-950' : 'text-slate-900'
                    }`}
                  >
                    {patient.fullName}
                  </span>
                  <span className="font-mono text-xs font-semibold tabular-nums text-slate-900 shrink-0">
                    {latestRate.toFixed(1)}
                  </span>
                </div>

                <div className="mt-1 flex items-center justify-between gap-2 text-xs text-slate-500">
                  <span className="truncate">
                    {patient.ward} · {patient.age} {patient.sex}
                  </span>
                  {renderStatusText(patient.status)}
                </div>

                <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
                  <span className="font-mono tabular-nums">{patient.caseNumber}</span>
                  <span aria-hidden="true">·</span>
                  <span className="truncate">{patient.bed}</span>
                </div>
              </button>
            );
          })
        )}
      </div>

      <div className="border-t border-slate-200 p-4">
        <button
          type="button"
          onClick={onOpenNewPatient}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50 hover:text-slate-950 whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4 text-cyan-700" aria-hidden="true" />
          Добавить пациента
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:block lg:h-screen lg:sticky lg:top-0 no-print">
        {content}
      </div>

      {/* Mobile drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden no-print">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full">{content}</div>
        </div>
      )}
    </>
  );
};
