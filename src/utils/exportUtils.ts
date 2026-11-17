import { PatientRecord } from '../types/clinical';
import {
  DIARY_TYPE_LABELS,
  DISTENSION_LABELS,
  MOTILITY_STATUS_META,
  NUTRITION_LABELS,
  STOOL_LABELS,
  formatDateTimeRu,
} from './clinicalLabels';

function downloadBlob(content: string, fileName: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportPatientTelemetryCsv(patient: PatientRecord) {
  const headers = [
    'Время',
    'Частота_шумов_соб_мин',
    'Доминирующая_частота_Гц',
    'Длительность_с',
    'Амплитуда_дБ',
    'Межшумовой_интервал_с',
    'Качество_сигнала_проц',
  ];

  const rows = patient.telemetry.map((pt) => [
    formatDateTimeRu(pt.timestamp),
    pt.occurrenceRate.toFixed(1),
    pt.dominantFrequency.toString(),
    pt.duration.toFixed(2),
    pt.amplitude.toFixed(1),
    pt.interInterval.toFixed(1),
    pt.signalQuality.toString(),
  ]);

  const csvContent =
    '\uFEFF' +
    [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');

  downloadBlob(
    csvContent,
    `telemetry_${patient.caseNumber}_${new Date().toISOString().slice(0, 10)}.csv`,
    'text/csv;charset=utf-8;'
  );
}

export function exportPatientDiaryCsv(patient: PatientRecord) {
  const headers = [
    'Дата_и_время',
    'Врач',
    'Тип_записи',
    'Оценка_перистальтики',
    'Аускультация_соб_мин',
    'Боль_ВАШ',
    'Вздутие',
    'Газы',
    'Стул',
    'Питание',
    'Скорость_ЭП_мл_ч',
    'Интервенции',
    'Примечание',
  ];

  const rows = patient.diary.map((d) => [
    formatDateTimeRu(d.timestamp),
    `"${d.author}"`,
    DIARY_TYPE_LABELS[d.entryType],
    MOTILITY_STATUS_META[d.motilityAssessment].label,
    d.auscultationRate !== null ? d.auscultationRate.toFixed(1) : '',
    d.painVas.toString(),
    DISTENSION_LABELS[d.distension],
    d.flatus ? 'Да' : 'Нет',
    STOOL_LABELS[d.stool],
    NUTRITION_LABELS[d.nutritionType],
    d.nutritionVolumeMlHr.toString(),
    `"${d.interventions.join(', ')}"`,
    `"${d.notes.replace(/"/g, '""')}"`,
  ]);

  const csvContent =
    '\uFEFF' +
    [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');

  downloadBlob(
    csvContent,
    `diary_${patient.caseNumber}_${new Date().toISOString().slice(0, 10)}.csv`,
    'text/csv;charset=utf-8;'
  );
}

export function exportPatientJson(patient: PatientRecord) {
  downloadBlob(
    JSON.stringify(patient, null, 2),
    `case_${patient.caseNumber}.json`,
    'application/json;charset=utf-8;'
  );
}
