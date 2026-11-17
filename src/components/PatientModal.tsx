import React, { useState } from 'react';
import { X } from 'lucide-react';
import { MotilityStatus, PatientRecord } from '../types/clinical';

interface PatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (patient: PatientRecord) => void;
}

export const PatientModal: React.FC<PatientModalProps> = ({ isOpen, onClose, onSave }) => {
  const [fullName, setFullName] = useState('');
  const [caseNumber, setCaseNumber] = useState(
    `ИБ-2026-${Math.floor(4200 + Math.random() * 700)}`
  );
  const [age, setAge] = useState('52');
  const [sex, setSex] = useState<'М' | 'Ж'>('М');
  const [bmi, setBmi] = useState('25.4');
  const [ward, setWard] = useState('ОРИТ №1');
  const [bed, setBed] = useState('Койка 1');
  const [diagnosis, setDiagnosis] = useState('');
  const [initialRate, setInitialRate] = useState('6.5');
  const [atlantaClass, setAtlantaClass] = useState<'MAP' | 'MSAP' | 'SAP' | 'N/A'>('N/A');
  const [agi, setAgi] = useState<0 | 1 | 2 | 3 | 4>(1);
  const [apacheII, setApacheII] = useState('');
  const [ranson, setRanson] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !diagnosis.trim()) return;

    const rateNum = Math.max(0.5, Number(initialRate) || 6.0);
    let status: MotilityStatus = 'normal';
    if (rateNum < 2.5) status = 'paresis';
    else if (rateNum < 6) status = 'hypo';
    else if (rateNum > 19) status = 'hyper';

    const now = new Date();
    const telemetry = Array.from({ length: 6 }, (_, i) => {
      const t = new Date(now.getTime() - (5 - i) * 3600 * 1000);
      const r = Number(Math.max(0.8, rateNum + Math.sin(i * 1.1) * 0.7).toFixed(1));
      return {
        timestamp: t.toISOString(),
        occurrenceRate: r,
        dominantFrequency: Math.round(310 + r * 8),
        duration: Number((0.45 + r * 0.03).toFixed(2)),
        amplitude: Number((-30 + r * 0.85).toFixed(1)),
        interInterval: Number(Math.max(2.5, 55 / r).toFixed(1)),
        signalQuality: 94,
      };
    });

    const newPatient: PatientRecord = {
      id: `pat-${Date.now()}`,
      caseNumber: caseNumber.trim() || `ИБ-${Date.now()}`,
      fullName: fullName.trim(),
      age: Math.max(18, Math.min(110, Number(age) || 50)),
      sex,
      bmi: Number(bmi) || 24.5,
      ward: ward.trim() || 'Стационар',
      bed: bed.trim() || 'Койка 1',
      diagnosis: diagnosis.trim(),
      admissionDate: now.toISOString(),
      monitoringStart: telemetry[0].timestamp,
      status,
      scores: {
        atlantaClass,
        agi,
        apacheII: apacheII ? Number(apacheII) : undefined,
        ranson: ranson ? Number(ranson) : undefined,
      },
      signalSummary: {
        validHours: 5.8,
        totalHours: 6.0,
        bowelSoundsPct: 21.5,
        silencePct: 61.5,
        respirationPct: 7.4,
        frictionNoisePct: 4.2,
        speechCoughPct: 2.1,
        unusablePct: 3.3,
        sensorLocation: 'Правая подвздошная область (RLQ)',
        samplingRateHz: 4000,
      },
      telemetry,
      diary: [
        {
          id: `d-${Date.now()}`,
          timestamp: now.toISOString(),
          author: 'Дежурный врач',
          entryType: 'auscultation',
          auscultationRate: rateNum,
          motilityAssessment: status,
          painVas: 3,
          distension: 'none',
          flatus: true,
          stool: 'none',
          nauseaVomiting: false,
          nutritionType: 'fasting',
          nutritionVolumeMlHr: 0,
          interventions: [],
          notes: 'Первичная установка контактного акустического датчика и старт мониторинга перистальтики.',
        },
      ],
    };

    onSave(newPatient);
    setFullName('');
    setDiagnosis('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 no-print"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-patient-title"
    >
      <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 id="new-patient-title" className="font-display text-lg font-semibold text-slate-900">
            Регистрация нового пациента
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Закрыть окно"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                ФИО пациента *
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Иванов Сергей Петрович"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-cyan-700 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                № истории болезни
              </label>
              <input
                type="text"
                value={caseNumber}
                onChange={(e) => setCaseNumber(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-cyan-700 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Возраст</label>
              <input
                type="number"
                min={18}
                max={110}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-cyan-700 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Пол</label>
              <select
                value={sex}
                onChange={(e) => setSex(e.target.value as 'М' | 'Ж')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-cyan-700 focus:outline-none"
              >
                <option value="М">Мужской</option>
                <option value="Ж">Женский</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">ИМТ (кг/м²)</label>
              <input
                type="number"
                step="0.1"
                value={bmi}
                onChange={(e) => setBmi(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-cyan-700 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Баз. шумы (соб/мин)
              </label>
              <input
                type="number"
                step="0.5"
                min={0}
                max={40}
                value={initialRate}
                onChange={(e) => setInitialRate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-cyan-700 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Отделение</label>
              <input
                type="text"
                value={ward}
                onChange={(e) => setWard(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-cyan-700 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Палата / койка</label>
              <input
                type="text"
                value={bed}
                onChange={(e) => setBed(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-cyan-700 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Основной клинический диагноз *
            </label>
            <input
              type="text"
              required
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              placeholder="Острый панкреатит / Послеоперационный период..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-cyan-700 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Атланта 2012</label>
              <select
                value={atlantaClass}
                onChange={(e) =>
                  setAtlantaClass(e.target.value as 'MAP' | 'MSAP' | 'SAP' | 'N/A')
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-cyan-700 focus:outline-none"
              >
                <option value="N/A">Не применимо</option>
                <option value="MAP">MAP (лёгкий)</option>
                <option value="MSAP">MSAP (средний)</option>
                <option value="SAP">SAP (тяжёлый)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Шкала AGI</label>
              <select
                value={agi}
                onChange={(e) => setAgi(Number(e.target.value) as 0 | 1 | 2 | 3 | 4)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-cyan-700 focus:outline-none"
              >
                <option value={0}>AGI 0</option>
                <option value={1}>AGI I</option>
                <option value={2}>AGI II</option>
                <option value={3}>AGI III</option>
                <option value={4}>AGI IV</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">APACHE II</label>
              <input
                type="number"
                min={0}
                max={71}
                value={apacheII}
                onChange={(e) => setApacheII(e.target.value)}
                placeholder="—"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-cyan-700 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Ranson</label>
              <input
                type="number"
                min={0}
                max={11}
                value={ranson}
                onChange={(e) => setRanson(e.target.value)}
                placeholder="—"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-cyan-700 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-800"
            >
              Создать карту
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
