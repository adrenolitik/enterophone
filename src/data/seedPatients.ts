import { AcousticPoint, PatientRecord } from '../types/clinical';

function buildTelemetrySeries(
  startIso: string,
  hours: number,
  generator: (hourIdx: number, hourOfDay: number) => Omit<AcousticPoint, 'timestamp'>
): AcousticPoint[] {
  const startMs = new Date(startIso).getTime();
  const points: AcousticPoint[] = [];
  for (let i = 0; i < hours; i++) {
    const t = new Date(startMs + i * 3600 * 1000);
    const hourOfDay = t.getHours();
    points.push({
      timestamp: t.toISOString(),
      ...generator(i, hourOfDay),
    });
  }
  return points;
}

export const INITIAL_PATIENTS: PatientRecord[] = [
  {
    id: 'pat-001',
    caseNumber: 'ИБ-2026-4108',
    fullName: 'Соколов Алексей Викторович',
    age: 54,
    sex: 'М',
    bmi: 28.4,
    ward: 'ОРИТ №2',
    bed: 'Койка 4',
    diagnosis: 'Острый панкреатит (риск прогрессирования в SAP, <48 ч от дебюта)',
    admissionDate: '2026-11-15T08:30:00',
    monitoringStart: '2026-11-15T09:00:00',
    status: 'hypo',
    scores: {
      atlantaClass: 'MSAP',
      ranson: 3,
      apacheII: 11,
      bisap: 2,
      agi: 2,
      crp: 184,
      amylase: 1420,
    },
    signalSummary: {
      validHours: 43.8,
      totalHours: 48.0,
      bowelSoundsPct: 18.4,
      silencePct: 62.1,
      respirationPct: 8.2,
      frictionNoisePct: 5.1,
      speechCoughPct: 2.8,
      unusablePct: 3.4,
      sensorLocation: 'Правая подвздошная область (RLQ)',
      samplingRateHz: 4000,
    },
    telemetry: buildTelemetrySeries('2026-11-15T09:00:00', 48, (i, hod) => {
      // Simulates initial attenuation in AP followed by gradual stabilization after epidural & infusion
      const circadian = Math.sin(((hod - 8) / 24) * Math.PI * 2) * 0.9;
      let baseRate = 6.8 - i * 0.16;
      if (i >= 24) {
        baseRate = 2.9 + (i - 24) * 0.14;
      }
      const noise = Math.sin(i * 1.7) * 0.6 + Math.cos(i * 0.9) * 0.4;
      const rate = Math.max(1.1, Number((baseRate + circadian * 0.5 + noise).toFixed(1)));
      const freq = Math.round(285 + (rate - 3) * 14 + Math.sin(i * 1.1) * 18);
      const dur = Number((0.42 + rate * 0.035 + Math.cos(i) * 0.04).toFixed(2));
      const amp = Number((-34 + rate * 1.1 + Math.sin(i * 0.8) * 1.8).toFixed(1));
      const interval = Number(Math.min(48, Math.max(3.8, 56 / Math.max(rate, 0.9))).toFixed(1));
      const quality = Math.round(91 + Math.sin(i * 0.7) * 5);
      return {
        occurrenceRate: rate,
        dominantFrequency: freq,
        duration: dur,
        amplitude: amp,
        interInterval: interval,
        signalQuality: Math.min(99, Math.max(78, quality)),
      };
    }),
    diary: [
      {
        id: 'd-101',
        timestamp: '2026-11-15T10:15:00',
        author: 'д-р Крылов М.А.',
        entryType: 'auscultation',
        auscultationRate: 6.5,
        motilityAssessment: 'hypo',
        painVas: 7,
        distension: 'moderate',
        flatus: false,
        stool: 'none',
        nauseaVomiting: true,
        nutritionType: 'fasting',
        nutritionVolumeMlHr: 0,
        interventions: ['Инфузионная терапия', 'Спазмолитики'],
        notes: 'При поступлении перистальтика вялая, единичные шумы в правой подвздошной области. Наложен контактный датчик.',
      },
      {
        id: 'd-102',
        timestamp: '2026-11-16T04:00:00',
        author: 'д-р Крылов М.А.',
        entryType: 'symptom',
        auscultationRate: 2.2,
        motilityAssessment: 'paresis',
        painVas: 6,
        distension: 'severe',
        flatus: false,
        stool: 'none',
        nauseaVomiting: false,
        nutritionType: 'fasting',
        nutritionVolumeMlHr: 0,
        interventions: ['Эпидуральная анальгезия', 'Назогастральная декомпрессия'],
        notes: 'Нарастание вздутия, выраженное затухание кишечных шумов (<3 соб/мин). Установлена длительная эпидуральная анальгезия для купирования пареза.',
      },
      {
        id: 'd-103',
        timestamp: '2026-11-16T15:30:00',
        author: 'д-р Соболева Е.Н.',
        entryType: 'nutrition',
        auscultationRate: 4.8,
        motilityAssessment: 'hypo',
        painVas: 4,
        distension: 'moderate',
        flatus: true,
        stool: 'none',
        nauseaVomiting: false,
        nutritionType: 'enteral_tube',
        nutritionVolumeMlHr: 25,
        interventions: ['Эпидуральная анальгезия', 'Прокинетики'],
        notes: 'Появление первых газов, тренд частоты шумов восходящий. Начато трофическое зондовое питание 25 мл/ч под контролем фоноэнтерографии.',
      },
      {
        id: 'd-104',
        timestamp: '2026-11-17T07:45:00',
        author: 'д-р Крылов М.А.',
        entryType: 'auscultation',
        auscultationRate: 6.1,
        motilityAssessment: 'hypo',
        painVas: 3,
        distension: 'moderate',
        flatus: true,
        stool: 'none',
        nauseaVomiting: false,
        nutritionType: 'enteral_tube',
        nutritionVolumeMlHr: 45,
        interventions: ['Прокинетики', 'Инфузионная терапия'],
        notes: 'Удовлетворительная переносимость энтерального питания, остаточный объём желудка <50 мл. Продолжается мониторинг.',
      },
    ],
  },
  {
    id: 'pat-002',
    caseNumber: 'ИБ-2026-4082',
    fullName: 'Морозова Елена Ивановна',
    age: 67,
    sex: 'Ж',
    bmi: 25.1,
    ward: 'Хирургия №1',
    bed: 'Палата 7, койка 2',
    diagnosis: 'Состояние после лапароскопической резекции сигмовидной кишки (3-и сут)',
    admissionDate: '2026-11-14T11:00:00',
    monitoringStart: '2026-11-15T12:00:00',
    status: 'normal',
    scores: {
      atlantaClass: 'N/A',
      agi: 1,
      crp: 72,
    },
    signalSummary: {
      validHours: 41.2,
      totalHours: 44.0,
      bowelSoundsPct: 24.6,
      silencePct: 56.8,
      respirationPct: 7.5,
      frictionNoisePct: 4.8,
      speechCoughPct: 3.1,
      unusablePct: 3.2,
      sensorLocation: 'Правая подвздошная область (RLQ)',
      samplingRateHz: 4000,
    },
    telemetry: buildTelemetrySeries('2026-11-15T12:00:00', 44, (i, hod) => {
      // Recovery from post-op ileus
      const postMealBoost = hod === 9 || hod === 14 || hod === 19 ? 2.1 : 0;
      const baseRate = Math.min(11.8, 1.8 + i * 0.23);
      const rate = Number((baseRate + postMealBoost + Math.sin(i * 1.3) * 0.7).toFixed(1));
      const freq = Math.round(310 + rate * 9 + Math.cos(i) * 14);
      const dur = Number((0.48 + rate * 0.03).toFixed(2));
      const amp = Number((-31 + rate * 0.95).toFixed(1));
      const interval = Number(Math.max(3.2, 54 / Math.max(rate, 1.2)).toFixed(1));
      return {
        occurrenceRate: rate,
        dominantFrequency: freq,
        duration: dur,
        amplitude: amp,
        interInterval: interval,
        signalQuality: Math.round(93 + Math.sin(i) * 4),
      };
    }),
    diary: [
      {
        id: 'd-201',
        timestamp: '2026-11-15T14:00:00',
        author: 'д-р Орлов С.П.',
        entryType: 'auscultation',
        auscultationRate: 2.0,
        motilityAssessment: 'paresis',
        painVas: 5,
        distension: 'moderate',
        flatus: false,
        stool: 'none',
        nauseaVomiting: false,
        nutritionType: 'fasting',
        nutritionVolumeMlHr: 0,
        interventions: ['Неостигмин по схеме', 'Ранняя активизация'],
        notes: 'Послеоперационный парез кишечника, единичные высокочастотные шумы. Назначена ранняя активизация.',
      },
      {
        id: 'd-202',
        timestamp: '2026-11-16T10:30:00',
        author: 'д-р Орлов С.П.',
        entryType: 'nutrition',
        auscultationRate: 7.4,
        motilityAssessment: 'normal',
        painVas: 3,
        distension: 'none',
        flatus: true,
        stool: 'none',
        nauseaVomiting: false,
        nutritionType: 'sipping',
        nutritionVolumeMlHr: 60,
        interventions: ['Ранняя активизация', 'НПВС'],
        notes: 'Отхождение газов, стабильная перистальтика. Разрешён сипинг, переход на стол №0.',
      },
      {
        id: 'd-203',
        timestamp: '2026-11-17T08:00:00',
        author: 'д-р Орлов С.П.',
        entryType: 'symptom',
        auscultationRate: 10.8,
        motilityAssessment: 'normal',
        painVas: 2,
        distension: 'none',
        flatus: true,
        stool: 'formed',
        nauseaVomiting: false,
        nutritionType: 'oral_diet',
        nutritionVolumeMlHr: 120,
        interventions: [],
        notes: 'Самостоятельный оформленный стул утром. Выраженный постпрандиальный пик на фоноэнтерограмме.',
      },
    ],
  },
  {
    id: 'pat-003',
    caseNumber: 'ИБ-2026-4129',
    fullName: 'Волков Дмитрий Николаевич',
    age: 39,
    sex: 'М',
    bmi: 24.6,
    ward: 'Гастроэнтерология',
    bed: 'Палата 14, койка 1',
    diagnosis: 'Острый отёчный панкреатит лёгкой степени (MAP)',
    admissionDate: '2026-11-16T07:15:00',
    monitoringStart: '2026-11-16T09:00:00',
    status: 'normal',
    scores: {
      atlantaClass: 'MAP',
      ranson: 1,
      apacheII: 4,
      bisap: 0,
      agi: 0,
      crp: 38,
      amylase: 790,
    },
    signalSummary: {
      validHours: 22.9,
      totalHours: 24.0,
      bowelSoundsPct: 29.5,
      silencePct: 54.0,
      respirationPct: 6.4,
      frictionNoisePct: 4.1,
      speechCoughPct: 2.5,
      unusablePct: 3.5,
      sensorLocation: 'Правая подвздошная область (RLQ)',
      samplingRateHz: 4000,
    },
    telemetry: buildTelemetrySeries('2026-11-16T09:00:00', 24, (i, hod) => {
      const circadian = Math.sin(((hod - 9) / 24) * Math.PI * 2) * 1.8;
      const rate = Number((10.9 + circadian + Math.cos(i * 1.4) * 1.2).toFixed(1));
      const freq = Math.round(355 + Math.sin(i * 0.9) * 24);
      const dur = Number((0.74 + Math.sin(i) * 0.08).toFixed(2));
      const amp = Number((-21.5 + Math.cos(i * 0.6) * 2.1).toFixed(1));
      const interval = Number(Math.max(2.9, 55 / rate).toFixed(1));
      return {
        occurrenceRate: rate,
        dominantFrequency: freq,
        duration: dur,
        amplitude: amp,
        interInterval: interval,
        signalQuality: Math.round(95 + Math.sin(i * 1.2) * 3),
      };
    }),
    diary: [
      {
        id: 'd-301',
        timestamp: '2026-11-16T11:00:00',
        author: 'д-р Крылов М.А.',
        entryType: 'auscultation',
        auscultationRate: 11.2,
        motilityAssessment: 'normal',
        painVas: 4,
        distension: 'none',
        flatus: true,
        stool: 'formed',
        nauseaVomiting: false,
        nutritionType: 'oral_diet',
        nutritionVolumeMlHr: 100,
        interventions: ['Инфузионная терапия', 'Спазмолитики'],
        notes: 'Моторика сохранена в полном объёме, низкий риск перехода в тяжёлую форму. Раннее пероральное питание переносит хорошо.',
      },
    ],
  },
  {
    id: 'pat-004',
    caseNumber: 'АМБ-2026-0891',
    fullName: 'Кузнецова Татьяна Петровна',
    age: 45,
    sex: 'Ж',
    bmi: 22.3,
    ward: 'Дневной стационар',
    bed: 'Каб. функц. диагн.',
    diagnosis: 'Синдром раздражённого кишечника с преобладанием диареи (СРК-Д)',
    admissionDate: '2026-11-17T00:00:00',
    monitoringStart: '2026-11-17T00:00:00',
    status: 'hyper',
    scores: {
      atlantaClass: 'N/A',
      agi: 0,
      crp: 4,
    },
    signalSummary: {
      validHours: 9.2,
      totalHours: 10.0,
      bowelSoundsPct: 41.2,
      silencePct: 41.0,
      respirationPct: 5.8,
      frictionNoisePct: 5.2,
      speechCoughPct: 3.3,
      unusablePct: 3.5,
      sensorLocation: 'Правая подвздошная область (RLQ)',
      samplingRateHz: 44100,
    },
    telemetry: buildTelemetrySeries('2026-11-17T00:00:00', 10, (i, hod) => {
      const mealTrigger = hod >= 8 ? 6.5 : 0;
      const rate = Number((17.4 + mealTrigger + Math.sin(i * 1.8) * 2.4).toFixed(1));
      const freq = Math.round(445 + mealTrigger * 8 + Math.cos(i) * 25);
      const dur = Number((0.92 + Math.sin(i * 0.8) * 0.12).toFixed(2));
      const amp = Number((-16.2 + Math.sin(i) * 2.3).toFixed(1));
      const interval = Number(Math.max(1.8, 52 / rate).toFixed(1));
      return {
        occurrenceRate: rate,
        dominantFrequency: freq,
        duration: dur,
        amplitude: amp,
        interInterval: interval,
        signalQuality: 94,
      };
    }),
    diary: [
      {
        id: 'd-401',
        timestamp: '2026-11-17T08:15:00',
        author: 'д-р Соболева Е.Н.',
        entryType: 'nutrition',
        auscultationRate: 24.5,
        motilityAssessment: 'hyper',
        painVas: 5,
        distension: 'moderate',
        flatus: true,
        stool: 'loose',
        nauseaVomiting: false,
        nutritionType: 'oral_diet',
        nutritionVolumeMlHr: 150,
        interventions: ['Спазмолитики'],
        notes: 'Выраженная гипермоторная реакция через 20 минут после тестового завтрака: пик частоты до 25 соб/мин, спастические боли.',
      },
    ],
  },
];
