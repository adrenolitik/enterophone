import React from 'react';
import { Download, Printer } from 'lucide-react';
import { PatientRecord } from '../types/clinical';
import {
  DIARY_TYPE_LABELS,
  MOTILITY_STATUS_META,
  NUTRITION_LABELS,
  STOOL_LABELS,
  formatDateShort,
  formatDateTimeRu,
} from '../utils/clinicalLabels';
import {
  exportPatientDiaryCsv,
  exportPatientJson,
  exportPatientTelemetryCsv,
} from '../utils/exportUtils';

interface ReportViewProps {
  patient: PatientRecord;
}

export const ReportView: React.FC<ReportViewProps> = ({ patient }) => {
  const firstPt = patient.telemetry[0];
  const lastPt = patient.telemetry[patient.telemetry.length - 1];
  const statusMeta = MOTILITY_STATUS_META[patient.status];

  const avgRate =
    patient.telemetry.length > 0
      ? patient.telemetry.reduce((acc, p) => acc + p.occurrenceRate, 0) /
        patient.telemetry.length
      : 0;

  const minRate =
    patient.telemetry.length > 0
      ? Math.min(...patient.telemetry.map((p) => p.occurrenceRate))
      : 0;

  const maxRate =
    patient.telemetry.length > 0
      ? Math.max(...patient.telemetry.map((p) => p.occurrenceRate))
      : 0;

  const pctChange = (startVal?: number, endVal?: number): string => {
    if (startVal === undefined || endVal === undefined || startVal === 0) return '—';
    const delta = ((endVal - startVal) / Math.abs(startVal)) * 100;
    return `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`;
  };

  return (
    <div className="space-y-6">
      {/* Export Actions Bar (hidden when printing) */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between no-print">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900">
            Клиническое заключение и экспорт данных
          </h2>
          <p className="text-xs text-slate-500">
            Сводный отчёт фоноэнтерографии и врачебного дневника для истории болезни
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => exportPatientTelemetryCsv(patient)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Телеметрия CSV
          </button>
          <button
            type="button"
            onClick={() => exportPatientDiaryCsv(patient)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Дневник CSV
          </button>
          <button
            type="button"
            onClick={() => exportPatientJson(patient)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Карта JSON
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-700 px-4 py-2 text-xs font-medium text-white hover:bg-cyan-800 whitespace-nowrap shrink-0"
          >
            <Printer className="h-3.5 w-3.5" aria-hidden="true" />
            Печать / PDF
          </button>
        </div>
      </div>

      {/* Printable Clinical Report Sheet */}
      <article className="rounded-xl border border-slate-200 bg-white p-8 space-y-8">
        <header className="border-b border-slate-200 pb-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
            <div>
              <div className="text-xs font-medium text-slate-500">
                ПРОТОКОЛ МОНИТОРИНГА ПЕРИСТАЛЬТИКИ ЖКТ
              </div>
              <h1 className="mt-1 font-display text-2xl font-bold text-slate-900">
                {patient.fullName}
              </h1>
            </div>
            <div className="font-mono text-sm font-semibold tabular-nums text-slate-700">
              {patient.caseNumber}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <span className="text-slate-400 block">Возраст / Пол / ИМТ</span>
              <span className="font-medium text-slate-900">
                {patient.age} лет, {patient.sex} · ИМТ {patient.bmi.toFixed(1)}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">Отделение / койка</span>
              <span className="font-medium text-slate-900">
                {patient.ward}, {patient.bed}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">Начало мониторинга</span>
              <span className="font-mono font-medium tabular-nums text-slate-900">
                {formatDateTimeRu(patient.monitoringStart)}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">Текущий статус моторики</span>
              <span className={`font-semibold ${statusMeta.colorClass}`}>
                {statusMeta.symbol} {statusMeta.label}
              </span>
            </div>
          </div>

          <div className="mt-3 text-xs">
            <span className="text-slate-400">Клинический диагноз: </span>
            <span className="font-medium text-slate-900">{patient.diagnosis}</span>
          </div>
        </header>

        {/* Section 1: Acoustic Parameter Comparison Table */}
        <section className="print-break-inside-avoid">
          <h3 className="font-display text-sm font-semibold text-slate-900 mb-3">
            1. Динамика 5 акустических параметров кишечных шумов
          </h3>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Параметр</th>
                  <th className="px-4 py-2.5 font-medium text-right">Начало наблюдения</th>
                  <th className="px-4 py-2.5 font-medium text-right">Текущее значение</th>
                  <th className="px-4 py-2.5 font-medium text-right">Изменение</th>
                  <th className="px-4 py-2.5 font-medium text-right">Ориентир нормы</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="px-4 py-2.5 font-medium text-slate-800">
                    Частота возникновения шумов
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                    {firstPt ? `${firstPt.occurrenceRate.toFixed(1)} соб/мин` : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums">
                    {lastPt ? `${lastPt.occurrenceRate.toFixed(1)} соб/мин` : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-600">
                    {pctChange(firstPt?.occurrenceRate, lastPt?.occurrenceRate)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-500">
                    6.0–18.0 соб/мин
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-medium text-slate-800">Доминирующая частота</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                    {firstPt ? `${firstPt.dominantFrequency} Гц` : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums">
                    {lastPt ? `${lastPt.dominantFrequency} Гц` : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-600">
                    {pctChange(firstPt?.dominantFrequency, lastPt?.dominantFrequency)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-500">
                    200–600 Гц
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-medium text-slate-800">
                    Длительность события
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                    {firstPt ? `${firstPt.duration.toFixed(2)} с` : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums">
                    {lastPt ? `${lastPt.duration.toFixed(2)} с` : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-600">
                    {pctChange(firstPt?.duration, lastPt?.duration)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-500">
                    0.40–1.10 с
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-medium text-slate-800">Амплитуда сигнала</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                    {firstPt ? `${firstPt.amplitude.toFixed(1)} дБ` : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums">
                    {lastPt ? `${lastPt.amplitude.toFixed(1)} дБ` : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-600">
                    {firstPt && lastPt
                      ? `${(lastPt.amplitude - firstPt.amplitude).toFixed(1)} дБ`
                      : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-500">
                    &gt; -40.0 дБ
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-medium text-slate-800">
                    Межшумовой интервал
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                    {firstPt ? `${firstPt.interInterval.toFixed(1)} с` : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums">
                    {lastPt ? `${lastPt.interInterval.toFixed(1)} с` : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-600">
                    {pctChange(firstPt?.interInterval, lastPt?.interInterval)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-500">
                    3.0–12.0 с
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap gap-6 text-xs text-slate-600">
            <span className="font-mono tabular-nums">
              Средняя частота за период: <strong>{avgRate.toFixed(1)} соб/мин</strong>
            </span>
            <span className="font-mono tabular-nums">
              Мин / Макс: <strong>{minRate.toFixed(1)}</strong> /{' '}
              <strong>{maxRate.toFixed(1)} соб/мин</strong>
            </span>
            <span className="font-mono tabular-nums">
              Валидный объём записи:{' '}
              <strong>
                {patient.signalSummary.validHours.toFixed(1)} ч из{' '}
                {patient.signalSummary.totalHours.toFixed(1)} ч
              </strong>
            </span>
          </div>
        </section>

        {/* Section 2: Severity & Laboratory Scores */}
        <section className="print-break-inside-avoid">
          <h3 className="font-display text-sm font-semibold text-slate-900 mb-3">
            2. Клинические шкалы тяжести и лабораторные маркеры
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-lg border border-slate-200 px-3.5 py-2.5">
              <div className="text-[11px] text-slate-500">Атланта 2012</div>
              <div className="font-mono text-sm font-semibold tabular-nums text-slate-900">
                {patient.scores.atlantaClass}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 px-3.5 py-2.5">
              <div className="text-[11px] text-slate-500">Шкала AGI</div>
              <div className="font-mono text-sm font-semibold tabular-nums text-slate-900">
                AGI {patient.scores.agi}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 px-3.5 py-2.5">
              <div className="text-[11px] text-slate-500">APACHE II</div>
              <div className="font-mono text-sm font-semibold tabular-nums text-slate-900">
                {patient.scores.apacheII !== undefined ? `${patient.scores.apacheII} б.` : '—'}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 px-3.5 py-2.5">
              <div className="text-[11px] text-slate-500">Ranson</div>
              <div className="font-mono text-sm font-semibold tabular-nums text-slate-900">
                {patient.scores.ranson !== undefined ? `${patient.scores.ranson} б.` : '—'}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 px-3.5 py-2.5">
              <div className="text-[11px] text-slate-500">СРБ (CRP)</div>
              <div className="font-mono text-sm font-semibold tabular-nums text-slate-900">
                {patient.scores.crp !== undefined ? `${patient.scores.crp} мг/л` : '—'}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 px-3.5 py-2.5">
              <div className="text-[11px] text-slate-500">Амилаза</div>
              <div className="font-mono text-sm font-semibold tabular-nums text-slate-900">
                {patient.scores.amylase !== undefined ? `${patient.scores.amylase} Ед/л` : '—'}
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Diary Log Summary */}
        <section>
          <h3 className="font-display text-sm font-semibold text-slate-900 mb-3">
            3. Ключевые записи врачебного дневника ({patient.diary.length})
          </h3>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Дата / время</th>
                  <th className="px-3 py-2 font-medium">Тип</th>
                  <th className="px-3 py-2 font-medium">Шумы</th>
                  <th className="px-3 py-2 font-medium">Стул / газы</th>
                  <th className="px-3 py-2 font-medium">Питание</th>
                  <th className="px-3 py-2 font-medium">Комментарий</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...patient.diary]
                  .sort(
                    (a, b) =>
                      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                  )
                  .map((d) => (
                    <tr key={d.id}>
                      <td className="px-3 py-2 font-mono tabular-nums whitespace-nowrap">
                        {formatDateTimeRu(d.timestamp)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {DIARY_TYPE_LABELS[d.entryType]}
                      </td>
                      <td className="px-3 py-2 font-mono tabular-nums whitespace-nowrap">
                        {d.auscultationRate !== null
                          ? `${d.auscultationRate.toFixed(1)} соб/мин`
                          : '—'}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {STOOL_LABELS[d.stool]} · газы: {d.flatus ? 'да' : 'нет'}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {NUTRITION_LABELS[d.nutritionType]}
                        {d.nutritionVolumeMlHr > 0 ? ` (${d.nutritionVolumeMlHr} мл/ч)` : ''}
                      </td>
                      <td className="px-3 py-2 text-slate-700">{d.notes}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="border-t border-slate-200 pt-4 flex items-center justify-between text-xs text-slate-500">
          <span>Сформировано в системе «ЭнтероФон»</span>
          <span className="font-mono tabular-nums">
            Дата отчёта: {formatDateShort(new Date().toISOString())}
          </span>
        </footer>
      </article>
    </div>
  );
};
