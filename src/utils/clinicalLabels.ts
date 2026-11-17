import {
  DiaryEntryType,
  DistensionLevel,
  MotilityStatus,
  NutritionType,
  PatientRecord,
  StoolStatus,
} from '../types/clinical';

export const MOTILITY_STATUS_META: Record<
  MotilityStatus,
  { label: string; shortLabel: string; symbol: string; colorClass: string; bgSubtle: string }
> = {
  normal: {
    label: 'Нормоперистальтика',
    shortLabel: 'Норма',
    symbol: '●',
    colorClass: 'text-emerald-700',
    bgSubtle: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  },
  hypo: {
    label: 'Гипоперистальтика',
    shortLabel: 'Гипо',
    symbol: '▲',
    colorClass: 'text-amber-700',
    bgSubtle: 'bg-amber-50 border-amber-200 text-amber-800',
  },
  paresis: {
    label: 'Парез / критическое снижение',
    shortLabel: 'Парез',
    symbol: '✖',
    colorClass: 'text-rose-700',
    bgSubtle: 'bg-rose-50 border-rose-200 text-rose-800',
  },
  hyper: {
    label: 'Гиперперистальтика',
    shortLabel: 'Гипер',
    symbol: '◆',
    colorClass: 'text-blue-700',
    bgSubtle: 'bg-blue-50 border-blue-200 text-blue-800',
  },
};

export const DIARY_TYPE_LABELS: Record<DiaryEntryType, string> = {
  auscultation: 'Аускультация',
  nutrition: 'Питание / ЭП',
  therapy: 'Терапия',
  symptom: 'Симптоматика',
  acoustic_capture: 'Фоноэнтерография',
};

export const DISTENSION_LABELS: Record<DistensionLevel, string> = {
  none: 'Нет',
  moderate: 'Умеренное',
  severe: 'Выраженное',
};

export const STOOL_LABELS: Record<StoolStatus, string> = {
  none: 'Не было',
  formed: 'Оформленный',
  loose: 'Жидкий',
  bloody: 'С примесью крови',
};

export const NUTRITION_LABELS: Record<NutritionType, string> = {
  fasting: 'Голод / парентерально',
  enteral_tube: 'Зондовое ЭП',
  sipping: 'Сипинг',
  oral_diet: 'Пероральная диета',
};

export function formatDateTimeRu(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTimeShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function computePatientStatusFromTelemetry(patient: PatientRecord): MotilityStatus {
  if (patient.telemetry.length === 0) return patient.status;
  const last = patient.telemetry[patient.telemetry.length - 1];
  if (last.occurrenceRate < 2.5) return 'paresis';
  if (last.occurrenceRate < 6.0) return 'hypo';
  if (last.occurrenceRate > 19.0) return 'hyper';
  return 'normal';
}
