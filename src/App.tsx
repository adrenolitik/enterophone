import React, { useEffect, useMemo, useState } from 'react';
import { Menu, Plus } from 'lucide-react';
import { AcousticAnalyzerView } from './components/AcousticAnalyzerView';
import { DiaryView } from './components/DiaryView';
import { MonitoringView } from './components/MonitoringView';
import { PatientModal } from './components/PatientModal';
import { ReportView } from './components/ReportView';
import { Sidebar } from './components/Sidebar';
import { INITIAL_PATIENTS } from './data/seedPatients';
import {
  AcousticParameters,
  AcousticPoint,
  DiaryEntry,
  PatientRecord,
} from './types/clinical';
import { computePatientStatusFromTelemetry } from './utils/clinicalLabels';

type WorkspaceTab = 'monitoring' | 'diary' | 'analyzer' | 'report';

const STORAGE_KEY = 'enterophon_clinical_patients_v1';

export default function App() {
  const [patients, setPatients] = useState<PatientRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Fallback to initial seed
    }
    return INITIAL_PATIENTS;
  });

  const [selectedPatientId, setSelectedPatientId] = useState<string>(
    () => patients[0]?.id ?? INITIAL_PATIENTS[0].id
  );
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('monitoring');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isNewPatientModalOpen, setIsNewPatientModalOpen] = useState(false);
  const [isDiaryComposerOpen, setIsDiaryComposerOpen] = useState(false);
  const [prefilledAcoustic, setPrefilledAcoustic] = useState<AcousticParameters | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(patients));
    } catch {
      // Ignore storage quota errors
    }
  }, [patients]);

  const activePatient = useMemo(
    () => patients.find((p) => p.id === selectedPatientId) ?? patients[0],
    [patients, selectedPatientId]
  );

  const handleAddPatient = (newPatient: PatientRecord) => {
    setPatients((prev) => [newPatient, ...prev]);
    setSelectedPatientId(newPatient.id);
    setActiveTab('monitoring');
  };

  const handleAddDiaryEntry = (entry: DiaryEntry) => {
    if (!activePatient) return;

    setPatients((prev) =>
      prev.map((p) => {
        if (p.id !== activePatient.id) return p;

        const updatedDiary = [entry, ...p.diary];
        const updatedTelemetry = [...p.telemetry];

        // If acoustic parameters or auscultation rate recorded, append a point to telemetry timeline
        if (entry.attachedAcousticParams || entry.auscultationRate !== null) {
          const lastPoint = updatedTelemetry[updatedTelemetry.length - 1];
          const rate =
            entry.attachedAcousticParams?.occurrenceRate ??
            entry.auscultationRate ??
            lastPoint?.occurrenceRate ??
            8.0;
          const newPoint: AcousticPoint = {
            timestamp: entry.timestamp,
            occurrenceRate: rate,
            dominantFrequency:
              entry.attachedAcousticParams?.dominantFrequency ??
              lastPoint?.dominantFrequency ??
              320,
            duration: entry.attachedAcousticParams?.duration ?? lastPoint?.duration ?? 0.6,
            amplitude:
              entry.attachedAcousticParams?.amplitude ?? lastPoint?.amplitude ?? -24.5,
            interInterval:
              entry.attachedAcousticParams?.interInterval ??
              Number(Math.max(2.0, 55 / Math.max(rate, 0.8)).toFixed(1)),
            signalQuality: 96,
          };

          updatedTelemetry.push(newPoint);
          updatedTelemetry.sort(
            (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
        }

        const updatedPatient: PatientRecord = {
          ...p,
          diary: updatedDiary,
          telemetry: updatedTelemetry,
          status: entry.motilityAssessment,
        };
        updatedPatient.status =
          entry.attachedAcousticParams || entry.auscultationRate !== null
            ? computePatientStatusFromTelemetry(updatedPatient)
            : entry.motilityAssessment;

        return updatedPatient;
      })
    );
  };

  const handleDeleteDiaryEntry = (entryId: string) => {
    if (!activePatient) return;
    setPatients((prev) =>
      prev.map((p) => {
        if (p.id !== activePatient.id) return p;
        return {
          ...p,
          diary: p.diary.filter((d) => d.id !== entryId),
        };
      })
    );
  };

  const handleApplyAcousticToDiary = (params: AcousticParameters) => {
    setPrefilledAcoustic(params);
    setActiveTab('diary');
    setIsDiaryComposerOpen(true);
  };

  const handleOpenQuickDiaryEntry = () => {
    setActiveTab('diary');
    setIsDiaryComposerOpen(true);
  };

  const navItems: Array<{ key: WorkspaceTab; label: string }> = [
    { key: 'monitoring', label: 'Мониторинг и графики' },
    { key: 'diary', label: 'Дневник перистальтики' },
    { key: 'analyzer', label: 'Анализатор сигнала' },
    { key: 'report', label: 'Отчёт врача' },
  ];

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <Sidebar
        patients={patients}
        selectedPatientId={activePatient?.id ?? ''}
        onSelectPatient={(id) => {
          setSelectedPatientId(id);
          setIsDiaryComposerOpen(false);
        }}
        onOpenNewPatient={() => setIsNewPatientModalOpen(true)}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Navigation Bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-6 border-b border-slate-200 bg-white px-4 py-3 sm:px-6 no-print">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 lg:hidden"
              aria-label="Открыть список пациентов"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="min-w-0 truncate text-sm text-slate-500">
              <span className="hidden sm:inline">{activePatient?.ward} / </span>
              <span className="font-semibold text-slate-900">
                {activePatient?.fullName ?? 'Пациент'}
              </span>
            </div>
          </div>

          <nav
            className="hidden md:flex items-center gap-6"
            aria-label="Разделы рабочей станции"
          >
            {navItems.map((item) => {
              const isActive = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveTab(item.key)}
                  className={`border-b-2 py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'border-cyan-700 text-slate-950'
                      : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={handleOpenQuickDiaryEntry}
            className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-700 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-cyan-800 whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Запись в дневник
          </button>
        </header>

        {/* Mobile Tab Switcher (compact, non-sticky so 15% mobile sticky cap is respected) */}
        <div className="flex overflow-x-auto border-b border-slate-200 bg-white px-4 py-2 gap-2 md:hidden no-print">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setActiveTab(item.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 ${
                activeTab === item.key
                  ? 'bg-cyan-50 text-cyan-900'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Main Content Viewport */}
        <main className="mx-auto w-full max-w-[1280px] flex-1 p-4 sm:p-6 lg:p-8">
          {activePatient ? (
            <>
              {activeTab === 'monitoring' && (
                <MonitoringView
                  patient={activePatient}
                  onSelectDiaryTab={() => setActiveTab('diary')}
                />
              )}

              {activeTab === 'diary' && (
                <DiaryView
                  patient={activePatient}
                  isComposerOpen={isDiaryComposerOpen}
                  onSetComposerOpen={setIsDiaryComposerOpen}
                  prefilledAcoustic={prefilledAcoustic}
                  onClearPrefilledAcoustic={() => setPrefilledAcoustic(null)}
                  onAddEntry={handleAddDiaryEntry}
                  onDeleteEntry={handleDeleteDiaryEntry}
                />
              )}

              {activeTab === 'analyzer' && (
                <AcousticAnalyzerView
                  patient={activePatient}
                  onApplyToDiary={handleApplyAcousticToDiary}
                />
              )}

              {activeTab === 'report' && <ReportView patient={activePatient} />}
            </>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
              <p className="text-sm text-slate-600">Выберите пациента или создайте новую карту.</p>
            </div>
          )}
        </main>
      </div>

      <PatientModal
        isOpen={isNewPatientModalOpen}
        onClose={() => setIsNewPatientModalOpen(false)}
        onSave={handleAddPatient}
      />
    </div>
  );
}
