export type MotilityStatus = 'normal' | 'hypo' | 'paresis' | 'hyper';

export type DiaryEntryType =
  | 'auscultation'
  | 'nutrition'
  | 'therapy'
  | 'symptom'
  | 'acoustic_capture';

export type DistensionLevel = 'none' | 'moderate' | 'severe';
export type StoolStatus = 'none' | 'formed' | 'loose' | 'bloody';
export type NutritionType = 'fasting' | 'enteral_tube' | 'sipping' | 'oral_diet';

export interface AcousticParameters {
  occurrenceRate: number; // событий/мин
  dominantFrequency: number; // Гц
  duration: number; // с
  amplitude: number; // дБ
  interInterval: number; // с
}

export interface AcousticPoint extends AcousticParameters {
  timestamp: string; // ISO
  signalQuality: number; // % валидного сигнала
}

export interface DiaryEntry {
  id: string;
  timestamp: string;
  author: string;
  entryType: DiaryEntryType;
  auscultationRate: number | null;
  motilityAssessment: MotilityStatus;
  painVas: number; // 0-10
  distension: DistensionLevel;
  flatus: boolean;
  stool: StoolStatus;
  nauseaVomiting: boolean;
  nutritionType: NutritionType;
  nutritionVolumeMlHr: number;
  interventions: string[];
  notes: string;
  attachedAcousticParams?: AcousticParameters;
}

export interface ClinicalScores {
  atlantaClass: 'MAP' | 'MSAP' | 'SAP' | 'N/A';
  ranson?: number;
  apacheII?: number;
  bisap?: number;
  agi: 0 | 1 | 2 | 3 | 4;
  crp?: number;
  amylase?: number;
}

export interface SignalQualitySummary {
  validHours: number;
  totalHours: number;
  bowelSoundsPct: number;
  silencePct: number;
  respirationPct: number;
  frictionNoisePct: number;
  speechCoughPct: number;
  unusablePct: number;
  sensorLocation: string;
  samplingRateHz: number;
}

export interface PatientRecord {
  id: string;
  caseNumber: string;
  fullName: string;
  age: number;
  sex: 'М' | 'Ж';
  bmi: number;
  ward: string;
  bed: string;
  diagnosis: string;
  admissionDate: string;
  monitoringStart: string;
  status: MotilityStatus;
  scores: ClinicalScores;
  signalSummary: SignalQualitySummary;
  telemetry: AcousticPoint[];
  diary: DiaryEntry[];
}

export interface SegmentedBowelEvent {
  id: number;
  startTimeSec: number;
  endTimeSec: number;
  durationSec: number;
  peakAmplitudeDb: number;
  dominantFreqHz: number;
  classification: 'кишечный шум' | 'артефакт движения' | 'дыхание';
}

export interface AcousticAnalysisResult {
  fileName: string;
  durationSec: number;
  sampleRate: number;
  parameters: AcousticParameters;
  detectedEvents: SegmentedBowelEvent[];
  waveformPreview: number[];
  spectrogramFrames: number[][]; // time x freq bins (0..1 normalized)
  maxFreqHz: number;
  signalQualityPct: number;
  motilityVerdict: MotilityStatus;
}
