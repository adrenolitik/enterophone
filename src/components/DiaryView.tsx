import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Play, Plus, RotateCcw, Square, Trash2 } from 'lucide-react';
import {
  AcousticParameters,
  DiaryEntry,
  DiaryEntryType,
  DistensionLevel,
  MotilityStatus,
  NutritionType,
  PatientRecord,
  StoolStatus,
} from '../types/clinical';
import {
  DIARY_TYPE_LABELS,
  DISTENSION_LABELS,
  MOTILITY_STATUS_META,
  NUTRITION_LABELS,
  STOOL_LABELS,
  formatDateTimeRu,
} from '../utils/clinicalLabels';
import { exportPatientDiaryCsv } from '../utils/exportUtils';

interface DiaryViewProps {
  patient: PatientRecord;
  isComposerOpen: boolean;
  onSetComposerOpen: (open: boolean) => void;
  prefilledAcoustic?: AcousticParameters | null;
  onClearPrefilledAcoustic?: () => void;
  onAddEntry: (entry: DiaryEntry) => void;
  onDeleteEntry: (entryId: string) => void;
}

const INTERVENTION_OPTIONS = [
  'Инфузионная терапия',
  'Прокинетики',
  'Эпидуральная анальгезия',
  'Опиоидная анальгезия',
  'НПВС / спазмолитики',
  'Антибиотики',
  'Назогастральная декомпрессия',
  'Ранняя активизация',
];

function toLocalDateTimeInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export const DiaryView: React.FC<DiaryViewProps> = ({
  patient,
  isComposerOpen,
  onSetComposerOpen,
  prefilledAcoustic,
  onClearPrefilledAcoustic,
  onAddEntry,
  onDeleteEntry,
}) => {
  const [filterType, setFilterType] = useState<'all' | DiaryEntryType>('all');
  const [searchText, setSearchText] = useState('');

  // Form states
  const [timestamp, setTimestamp] = useState(() => toLocalDateTimeInput(new Date()));
  const [author, setAuthor] = useState('д-р Крылов М.А.');
  const [entryType, setEntryType] = useState<DiaryEntryType>('auscultation');
  const [auscultationRate, setAuscultationRate] = useState('8.0');
  const [motilityAssessment, setMotilityAssessment] = useState<MotilityStatus>('normal');
  const [painVas, setPainVas] = useState(2);
  const [distension, setDistension] = useState<DistensionLevel>('none');
  const [flatus, setFlatus] = useState(true);
  const [stool, setStool] = useState<StoolStatus>('none');
  const [nauseaVomiting, setNauseaVomiting] = useState(false);
  const [nutritionType, setNutritionType] = useState<NutritionType>('oral_diet');
  const [nutritionVolumeMlHr, setNutritionVolumeMlHr] = useState('60');
  const [interventions, setInterventions] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  // 60-second clinical auscultation counter
  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [tapCount, setTapCount] = useState(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (prefilledAcoustic) {
      onSetComposerOpen(true);
      setEntryType('acoustic_capture');
      setAuscultationRate(prefilledAcoustic.occurrenceRate.toFixed(1));
      if (prefilledAcoustic.occurrenceRate < 2.5) setMotilityAssessment('paresis');
      else if (prefilledAcoustic.occurrenceRate < 6) setMotilityAssessment('hypo');
      else if (prefilledAcoustic.occurrenceRate > 19) setMotilityAssessment('hyper');
      else setMotilityAssessment('normal');
      setNotes(
        `Акустический захват: частота ${prefilledAcoustic.occurrenceRate} соб/мин, домин. частота ${prefilledAcoustic.dominantFrequency} Гц, ср. длительность ${prefilledAcoustic.duration} с, амплитуда ${prefilledAcoustic.amplitude} дБ, интервал ${prefilledAcoustic.interInterval} с.`
      );
    }
  }, [prefilledAcoustic, onSetComposerOpen]);

  useEffect(() => {
    if (!timerRunning) {
      if (timerRef.current) window.clearInterval(timerRef.current);
      return;
    }
    timerRef.current = window.setInterval(() => {
      setElapsedSec((prev) => {
        if (prev + 1 >= 60) {
          setTimerRunning(false);
          return 60;
        }
        return prev + 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [timerRunning]);

  const handleTapSound = () => {
    const nextTaps = tapCount + 1;
    setTapCount(nextTaps);
    const secs = Math.max(elapsedSec, 5);
    const projectedRate = Number(((nextTaps / secs) * 60).toFixed(1));
    setAuscultationRate(projectedRate.toFixed(1));
    if (projectedRate < 2.5) setMotilityAssessment('paresis');
    else if (projectedRate < 6) setMotilityAssessment('hypo');
    else if (projectedRate > 19) setMotilityAssessment('hyper');
    else setMotilityAssessment('normal');
  };

  const resetCounter = () => {
    setTimerRunning(false);
    setElapsedSec(0);
    setTapCount(0);
  };

  const toggleIntervention = (item: string) => {
    setInterventions((prev) =>
      prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rateNum = auscultationRate.trim() === '' ? null : Number(auscultationRate);

    const newEntry: DiaryEntry = {
      id: `d-${Date.now()}`,
      timestamp: new Date(timestamp).toISOString(),
      author: author.trim() || 'Дежурный врач',
      entryType,
      auscultationRate: rateNum !== null && !Number.isNaN(rateNum) ? rateNum : null,
      motilityAssessment,
      painVas,
      distension,
      flatus,
      stool,
      nauseaVomiting,
      nutritionType,
      nutritionVolumeMlHr: Math.max(0, Number(nutritionVolumeMlHr) || 0),
      interventions,
      notes: notes.trim() || 'Осмотр без дополнительных примечаний.',
      attachedAcousticParams: prefilledAcoustic ?? undefined,
    };

    onAddEntry(newEntry);
    onClearPrefilledAcoustic?.();
    setNotes('');
    setInterventions([]);
    resetCounter();
    setTimestamp(toLocalDateTimeInput(new Date()));
    onSetComposerOpen(false);
  };

  const filteredDiary = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return [...patient.diary]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .filter((d) => {
        if (filterType !== 'all' && d.entryType !== filterType) return false;
        if (!q) return true;
        return (
          d.notes.toLowerCase().includes(q) ||
          d.author.toLowerCase().includes(q) ||
          d.interventions.some((iv) => iv.toLowerCase().includes(q))
        );
      });
  }, [patient.diary, filterType, searchText]);

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900">
            Врачебный дневник перистальтики
          </h2>
          <p className="text-xs text-slate-500">
            Хронология аускультации, симптомов ЖКТ, энтерального питания и терапии ({patient.diary.length} записей)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => exportPatientDiaryCsv(patient)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Экспорт CSV
          </button>
          <button
            type="button"
            onClick={() => onSetComposerOpen(!isComposerOpen)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-700 px-4 py-2 text-xs font-medium text-white hover:bg-cyan-800 whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            {isComposerOpen ? 'Скрыть форму' : 'Новая запись'}
          </button>
        </div>
      </div>

      {/* New Diary Entry Composer */}
      {isComposerOpen && (
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900">
                Регистрация клинического наблюдения
              </h3>
              <p className="text-xs text-slate-500">
                Данные синхронизируются с графиком активности кишечника пациента
              </p>
            </div>

            {/* Bedside 60-sec Auscultation Counter */}
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="font-mono text-xs font-semibold tabular-nums text-slate-800">
                {String(elapsedSec).padStart(2, '0')} / 60 с · {tapCount} шумов
              </span>
              {!timerRunning ? (
                <button
                  type="button"
                  onClick={() => {
                    if (elapsedSec >= 60) {
                      setElapsedSec(0);
                      setTapCount(0);
                    }
                    setTimerRunning(true);
                  }}
                  className="inline-flex items-center gap-1 rounded-md bg-white border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-800 hover:bg-slate-100 whitespace-nowrap shrink-0"
                >
                  <Play className="h-3 w-3 text-cyan-700" aria-hidden="true" />
                  Старт 60с
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setTimerRunning(false)}
                  className="inline-flex items-center gap-1 rounded-md bg-white border border-slate-300 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 whitespace-nowrap shrink-0"
                >
                  <Square className="h-3 w-3" aria-hidden="true" />
                  Стоп
                </button>
              )}
              <button
                type="button"
                onClick={handleTapSound}
                className="rounded-md bg-cyan-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-cyan-800 whitespace-nowrap shrink-0"
              >
                +1 Шум
              </button>
              <button
                type="button"
                onClick={resetCounter}
                className="rounded-md p-1 text-slate-500 hover:bg-slate-200"
                title="Сбросить таймер аускультации"
                aria-label="Сбросить таймер"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Дата и время осмотра
                </label>
                <input
                  type="datetime-local"
                  value={timestamp}
                  onChange={(e) => setTimestamp(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs focus:border-cyan-700 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Врач / исследователь
                </label>
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-cyan-700 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Тип записи
                </label>
                <select
                  value={entryType}
                  onChange={(e) => setEntryType(e.target.value as DiaryEntryType)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-cyan-700 focus:outline-none"
                >
                  {(Object.keys(DIARY_TYPE_LABELS) as DiaryEntryType[]).map((k) => (
                    <option key={k} value={k}>
                      {DIARY_TYPE_LABELS[k]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Частота шумов (соб/мин)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  max={60}
                  value={auscultationRate}
                  onChange={(e) => setAuscultationRate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-cyan-700 focus:outline-none"
                />
              </div>
            </div>

            {/* Motility & GI symptoms */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Оценка перистальтики
                </label>
                <select
                  value={motilityAssessment}
                  onChange={(e) => setMotilityAssessment(e.target.value as MotilityStatus)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-cyan-700 focus:outline-none"
                >
                  <option value="normal">Нормоперистальтика</option>
                  <option value="hypo">Гипоперистальтика</option>
                  <option value="paresis">Парез / отсутствует</option>
                  <option value="hyper">Гиперперистальтика</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Боль (ВАШ: {painVas}/10)
                </label>
                <input
                  type="range"
                  min={0}
                  max={10}
                  value={painVas}
                  onChange={(e) => setPainVas(Number(e.target.value))}
                  className="mt-2 w-full accent-cyan-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Вздутие живота
                </label>
                <select
                  value={distension}
                  onChange={(e) => setDistension(e.target.value as DistensionLevel)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-cyan-700 focus:outline-none"
                >
                  <option value="none">Нет</option>
                  <option value="moderate">Умеренное</option>
                  <option value="severe">Выраженное</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Стул</label>
                <select
                  value={stool}
                  onChange={(e) => setStool(e.target.value as StoolStatus)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-cyan-700 focus:outline-none"
                >
                  <option value="none">Не было</option>
                  <option value="formed">Оформленный</option>
                  <option value="loose">Жидкий</option>
                  <option value="bloody">С примесью крови</option>
                </select>
              </div>
              <div className="flex flex-col justify-end gap-2 pb-1">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={flatus}
                    onChange={(e) => setFlatus(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-cyan-700 focus:ring-cyan-700"
                  />
                  Отхождение газов
                </label>
                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={nauseaVomiting}
                    onChange={(e) => setNauseaVomiting(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-cyan-700 focus:ring-cyan-700"
                  />
                  Тошнота / рвота
                </label>
              </div>
            </div>

            {/* Nutrition & Interventions */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Нутритивный статус
                </label>
                <select
                  value={nutritionType}
                  onChange={(e) => setNutritionType(e.target.value as NutritionType)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-cyan-700 focus:outline-none"
                >
                  {(Object.keys(NUTRITION_LABELS) as NutritionType[]).map((k) => (
                    <option key={k} value={k}>
                      {NUTRITION_LABELS[k]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Скорость / объём ЭП (мл/ч)
                </label>
                <input
                  type="number"
                  min={0}
                  max={500}
                  value={nutritionVolumeMlHr}
                  onChange={(e) => setNutritionVolumeMlHr(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-cyan-700 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Примечание врача
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Переносимость питания, динамика вздутия, детали аускультации..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-cyan-700 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <span className="block text-xs font-medium text-slate-700 mb-2">
                Сопутствующие интервенции (влияющие на моторику)
              </span>
              <div className="flex flex-wrap gap-2">
                {INTERVENTION_OPTIONS.map((item) => {
                  const active = interventions.includes(item);
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => toggleIntervention(item)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                        active
                          ? 'border-cyan-700 bg-cyan-50 text-cyan-900'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => {
                  onClearPrefilledAcoustic?.();
                  onSetComposerOpen(false);
                }}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-800"
              >
                Сохранить запись в дневник
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-200/70 p-1"
          role="group"
          aria-label="Фильтр записей дневника"
        >
          {(
            [
              { k: 'all', l: 'Все записи' },
              { k: 'auscultation', l: 'Аускультация' },
              { k: 'nutrition', l: 'Питание / ЭП' },
              { k: 'symptom', l: 'Симптомы' },
              { k: 'acoustic_capture', l: 'Фоноэнтерография' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.k}
              type="button"
              onClick={() => setFilterType(tab.k)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                filterType === tab.k
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.l}
            </button>
          ))}
        </div>

        <input
          type="search"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Поиск по дневнику..."
          aria-label="Поиск по дневнику"
          className="w-full sm:w-64 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-700 focus:outline-none"
        />
      </div>

      {/* Diary Entries Table */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {filteredDiary.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-slate-700">Записи в дневнике отсутствуют</p>
            <p className="mt-1 text-xs text-slate-500">
              Добавьте первое клиническое наблюдение для отслеживания динамики перистальтики.
            </p>
            <button
              type="button"
              onClick={() => onSetComposerOpen(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-cyan-700 px-4 py-2 text-xs font-medium text-white hover:bg-cyan-800"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Добавить первую запись
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredDiary.map((entry) => {
              const statusMeta = MOTILITY_STATUS_META[entry.motilityAssessment];
              return (
                <article key={entry.id} className="p-5 hover:bg-slate-50/60 transition-colors">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-1.5 flex-1">
                      {/* Clean unboxed metadata row */}
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
                        <span className="font-mono font-semibold tabular-nums text-slate-900">
                          {formatDateTimeRu(entry.timestamp)}
                        </span>
                        <span aria-hidden="true" className="text-slate-300">
                          ·
                        </span>
                        <span className="font-medium text-slate-700">
                          {DIARY_TYPE_LABELS[entry.entryType]}
                        </span>
                        <span aria-hidden="true" className="text-slate-300">
                          ·
                        </span>
                        <span className={`font-semibold ${statusMeta.colorClass}`}>
                          <span aria-hidden="true" className="mr-1">
                            {statusMeta.symbol}
                          </span>
                          {statusMeta.label}
                        </span>
                        {entry.auscultationRate !== null && (
                          <>
                            <span aria-hidden="true" className="text-slate-300">
                              ·
                            </span>
                            <span className="font-mono font-semibold tabular-nums text-slate-900">
                              {entry.auscultationRate.toFixed(1)} соб/мин
                            </span>
                          </>
                        )}
                        <span aria-hidden="true" className="text-slate-300">
                          ·
                        </span>
                        <span className="text-slate-500">{entry.author}</span>
                      </div>

                      <p className="text-sm leading-relaxed text-slate-800">{entry.notes}</p>

                      {/* Structured clinical summary line */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs text-slate-600">
                        <span className="font-mono tabular-nums">
                          ВАШ: {entry.painVas}/10
                        </span>
                        <span>Вздутие: {DISTENSION_LABELS[entry.distension]}</span>
                        <span>Газы: {entry.flatus ? 'отходят' : 'нет'}</span>
                        <span>Стул: {STOOL_LABELS[entry.stool]}</span>
                        <span>
                          Питание: {NUTRITION_LABELS[entry.nutritionType]}
                          {entry.nutritionVolumeMlHr > 0
                            ? ` (${entry.nutritionVolumeMlHr} мл/ч)`
                            : ''}
                        </span>
                        {entry.interventions.length > 0 && (
                          <span className="text-slate-700">
                            Терапия: {entry.interventions.join(', ')}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onDeleteEntry(entry.id)}
                      className="self-start rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                      title="Удалить запись"
                      aria-label="Удалить запись дневника"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
