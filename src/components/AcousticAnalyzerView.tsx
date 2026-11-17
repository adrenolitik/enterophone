import React, { useEffect, useRef, useState } from 'react';
import { Mic, Play, Square, Upload, Volume2 } from 'lucide-react';
import {
  AcousticAnalysisResult,
  AcousticParameters,
  PatientRecord,
} from '../types/clinical';
import {
  CALIBRATION_PRESETS,
  CalibrationPresetId,
  analyzeBowelSoundSamples,
  decodeAudioFile,
  generateSyntheticAudioBuffer,
  playFloat32Samples,
} from '../utils/acousticEngine';
import { MOTILITY_STATUS_META } from '../utils/clinicalLabels';

interface AcousticAnalyzerViewProps {
  patient: PatientRecord;
  onApplyToDiary: (params: AcousticParameters) => void;
}

export const AcousticAnalyzerView: React.FC<AcousticAnalyzerViewProps> = ({
  patient,
  onApplyToDiary,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<CalibrationPresetId>('normal');
  const [activeSamples, setActiveSamples] = useState<{
    samples: Float32Array;
    sampleRate: number;
  } | null>(null);
  const [analysis, setAnalysis] = useState<AcousticAnalysisResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSec, setRecordingSec] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const stopPlaybackRef = useRef<(() => void) | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordTimerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const waveformCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const spectrogramCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Initialize with default calibration preset on mount
  useEffect(() => {
    runPreset('normal');
    return () => {
      stopPlaybackRef.current?.();
      if (recordTimerRef.current) window.clearInterval(recordTimerRef.current);
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const runPreset = (presetId: CalibrationPresetId) => {
    stopPlaybackRef.current?.();
    setIsPlaying(false);
    setErrorMsg(null);
    setSelectedPreset(presetId);

    const { samples, sampleRate } = generateSyntheticAudioBuffer(presetId, 8000, 20);
    setActiveSamples({ samples, sampleRate });
    const meta = CALIBRATION_PRESETS.find((p) => p.id === presetId);
    const res = analyzeBowelSoundSamples(
      samples,
      sampleRate,
      meta ? `${meta.title}.wav` : 'preset.wav'
    );
    setAnalysis(res);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    stopPlaybackRef.current?.();
    setIsPlaying(false);
    setErrorMsg(null);
    setIsProcessing(true);

    try {
      const { samples, sampleRate } = await decodeAudioFile(file);
      setActiveSamples({ samples, sampleRate });
      const res = analyzeBowelSoundSamples(samples, sampleRate, file.name);
      setAnalysis(res);
    } catch {
      setErrorMsg(
        'Не удалось декодировать аудиофайл. Используйте формат WAV, MP3 или OGG.'
      );
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleTogglePlayback = () => {
    if (!activeSamples) return;
    if (isPlaying) {
      stopPlaybackRef.current?.();
      setIsPlaying(false);
      return;
    }
    setIsPlaying(true);
    stopPlaybackRef.current = playFloat32Samples(
      activeSamples.samples,
      activeSamples.sampleRate,
      () => setIsPlaying(false)
    );
  };

  const handleStartRecording = async () => {
    setErrorMsg(null);
    stopPlaybackRef.current?.();
    setIsPlaying(false);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMsg('Браузер не поддерживает захват аудио с микрофона.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunks.push(ev.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (recordTimerRef.current) window.clearInterval(recordTimerRef.current);
        setIsRecording(false);
        setIsProcessing(true);
        try {
          const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
          const file = new File([blob], `запись_датчика_${new Date().toISOString().slice(11, 19)}.webm`, {
            type: blob.type,
          });
          const { samples, sampleRate } = await decodeAudioFile(file);
          setActiveSamples({ samples, sampleRate });
          const res = analyzeBowelSoundSamples(samples, sampleRate, file.name);
          setAnalysis(res);
        } catch {
          setErrorMsg('Не удалось обработать записанный сигнал с микрофона.');
        } finally {
          setIsProcessing(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordingSec(0);
      recordTimerRef.current = window.setInterval(() => {
        setRecordingSec((s) => s + 1);
      }, 1000);
    } catch {
      setErrorMsg('Нет доступа к микрофону или контактному аудиоинтерфейсу.');
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  // Render Waveform + Segmented Events on Canvas
  useEffect(() => {
    const canvas = waveformCanvasRef.current;
    if (!canvas || !analysis) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    // Center baseline
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    // Highlight segmented events
    analysis.detectedEvents.forEach((ev) => {
      const x1 = (ev.startTimeSec / Math.max(0.1, analysis.durationSec)) * w;
      const x2 = (ev.endTimeSec / Math.max(0.1, analysis.durationSec)) * w;
      ctx.fillStyle =
        ev.classification === 'кишечный шум'
          ? 'rgba(14, 116, 144, 0.14)'
          : 'rgba(217, 119, 6, 0.16)';
      ctx.fillRect(x1, 0, Math.max(3, x2 - x1), h);
    });

    // Waveform bars
    const preview = analysis.waveformPreview;
    const step = w / Math.max(1, preview.length);
    ctx.fillStyle = '#0e7490';
    preview.forEach((amp, idx) => {
      const barH = Math.max(2, amp * (h * 0.82));
      const x = idx * step;
      ctx.fillRect(x, h / 2 - barH / 2, Math.max(1.5, step - 1), barH);
    });
  }, [analysis]);

  // Render Spectrogram on Canvas
  useEffect(() => {
    const canvas = spectrogramCanvasRef.current;
    if (!canvas || !analysis) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const frames = analysis.spectrogramFrames;
    if (frames.length === 0) return;
    const numBins = frames[0].length;
    const colW = w / frames.length;
    const binH = h / numBins;

    for (let t = 0; t < frames.length; t++) {
      for (let f = 0; f < numBins; f++) {
        const v = frames[t][f]; // 0..1
        // Calibrated scientific Cyan -> Teal -> Amber ramp on dark obsidian canvas
        const r = Math.round(11 + v * 235);
        const g = Math.round(18 + Math.sin(v * Math.PI) * 165 + v * 50);
        const b = Math.round(35 + (1 - Math.abs(v - 0.45) * 1.8) * 180);
        ctx.fillStyle = `rgb(${Math.min(255, r)}, ${Math.min(255, g)}, ${Math.max(
          20,
          Math.min(255, b)
        )})`;
        const y = h - (f + 1) * binH;
        ctx.fillRect(t * colW, y, Math.ceil(colW), Math.ceil(binH));
      }
    }
  }, [analysis]);

  return (
    <div className="space-y-6">
      {/* Control & Source Bar */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900">
              Акустический анализатор фоноэнтерограмм
            </h2>
            <p className="text-xs text-slate-500">
              Полосовая фильтрация (100–950 Гц), сегментация эпизодов, расчёт 5 параметров и БПФ-спектрограмма
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={handleFileUpload}
              className="hidden"
              id="audio-upload-input"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <Upload className="h-3.5 w-3.5 text-cyan-700" aria-hidden="true" />
              Загрузить WAV / аудио
            </button>

            {!isRecording ? (
              <button
                type="button"
                onClick={handleStartRecording}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                <Mic className="h-3.5 w-3.5 text-rose-600" aria-hidden="true" />
                Запись с датчика / микр.
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStopRecording}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-rose-700 whitespace-nowrap shrink-0"
              >
                <Square className="h-3.5 w-3.5" aria-hidden="true" />
                Стоп ({recordingSec} с)
              </button>
            )}

            <button
              type="button"
              onClick={handleTogglePlayback}
              disabled={!activeSamples}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              {isPlaying ? (
                <>
                  <Square className="h-3.5 w-3.5 text-slate-700" aria-hidden="true" />
                  Остановить звук
                </>
              ) : (
                <>
                  <Volume2 className="h-3.5 w-3.5 text-cyan-700" aria-hidden="true" />
                  Прослушать
                </>
              )}
            </button>

            {analysis && (
              <button
                type="button"
                onClick={() => onApplyToDiary(analysis.parameters)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-700 px-4 py-2 text-xs font-medium text-white hover:bg-cyan-800 whitespace-nowrap shrink-0"
              >
                <Play className="h-3.5 w-3.5" aria-hidden="true" />
                Внести в дневник ({patient.fullName.split(' ')[0]})
              </button>
            )}
          </div>
        </div>

        {errorMsg && (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs text-rose-800">
            {errorMsg}
          </div>
        )}

        {/* Calibration Presets Selector */}
        <div className="mt-4 border-t border-slate-100 pt-4">
          <div className="text-xs font-medium text-slate-500 mb-2">
            Калибровочные фоноэнтерограммы (синтезированные эталоны для проверки алгоритма):
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {CALIBRATION_PRESETS.map((preset) => {
              const active = selectedPreset === preset.id && analysis?.fileName.includes(preset.title);
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => runPreset(preset.id)}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    active
                      ? 'border-cyan-700 bg-cyan-50/70'
                      : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
                  }`}
                >
                  <div className="text-xs font-semibold text-slate-900">{preset.title}</div>
                  <div className="mt-1 text-[11px] leading-snug text-slate-500">
                    {preset.description}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {analysis && (
        <>
          {/* Extracted 5 Parameters + Verdict */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-xs text-slate-500">Частота шумов</div>
              <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-slate-900">
                {analysis.parameters.occurrenceRate.toFixed(1)}{' '}
                <span className="text-xs font-normal text-slate-500">соб/мин</span>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-xs text-slate-500">Домин. частота</div>
              <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-slate-900">
                {analysis.parameters.dominantFrequency}{' '}
                <span className="text-xs font-normal text-slate-500">Гц</span>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-xs text-slate-500">Ср. длительность</div>
              <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-slate-900">
                {analysis.parameters.duration.toFixed(2)}{' '}
                <span className="text-xs font-normal text-slate-500">с</span>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-xs text-slate-500">Амплитуда</div>
              <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-slate-900">
                {analysis.parameters.amplitude.toFixed(1)}{' '}
                <span className="text-xs font-normal text-slate-500">дБ</span>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-xs text-slate-500">Межшум. интервал</div>
              <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-slate-900">
                {analysis.parameters.interInterval.toFixed(1)}{' '}
                <span className="text-xs font-normal text-slate-500">с</span>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-xs text-slate-500">Заключение алгоритма</div>
              <div
                className={`mt-1.5 text-sm font-semibold ${
                  MOTILITY_STATUS_META[analysis.motilityVerdict].colorClass
                }`}
              >
                {MOTILITY_STATUS_META[analysis.motilityVerdict].symbol}{' '}
                {MOTILITY_STATUS_META[analysis.motilityVerdict].shortLabel}
              </div>
              <div className="mt-0.5 font-mono text-[11px] tabular-nums text-slate-500">
                Качество: {analysis.signalQualityPct}%
              </div>
            </div>
          </section>

          {/* Waveform & Spectrogram Canvases */}
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-baseline justify-between mb-3">
                <div>
                  <h3 className="font-display text-sm font-semibold text-slate-900">
                    Осциллограмма и сегментация событий
                  </h3>
                  <p className="text-xs text-slate-500">
                    Бирюзовые зоны — кишечные шумы, янтарные — артефакты
                  </p>
                </div>
                <span className="font-mono text-xs tabular-nums text-slate-500">
                  {analysis.durationSec} с · {analysis.sampleRate} Гц
                </span>
              </div>
              <canvas
                ref={waveformCanvasRef}
                width={640}
                height={180}
                className="w-full rounded-lg border border-slate-200 bg-white"
              />
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-baseline justify-between mb-3">
                <div>
                  <h3 className="font-display text-sm font-semibold text-slate-900">
                    Частотно-временная спектрограмма
                  </h3>
                  <p className="text-xs text-slate-500">
                    Полоса анализа 0–{analysis.maxFreqHz} Гц (БПФ, окно Ханна)
                  </p>
                </div>
                <span className="font-mono text-xs tabular-nums text-slate-500">
                  1200 Гц ↑ / 0 Гц ↓
                </span>
              </div>
              <canvas
                ref={spectrogramCanvasRef}
                width={640}
                height={180}
                className="w-full rounded-lg border border-slate-800 bg-slate-950"
              />
            </div>
          </section>

          {/* Segmented Events Table */}
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
              <h3 className="font-display text-sm font-semibold text-slate-900">
                Выделенные акустические события ({analysis.detectedEvents.length})
              </h3>
              <span className="text-xs text-slate-500 truncate max-w-xs">{analysis.fileName}</span>
            </div>

            {analysis.detectedEvents.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-slate-500">
                Эпизодов выше пороговой энергии не обнаружено (выраженная тишина / парез).
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">№</th>
                      <th className="px-4 py-2.5 font-medium">Интервал (с)</th>
                      <th className="px-4 py-2.5 font-medium text-right">Длительность</th>
                      <th className="px-4 py-2.5 font-medium text-right">Пик частоты</th>
                      <th className="px-4 py-2.5 font-medium text-right">Амплитуда</th>
                      <th className="px-4 py-2.5 font-medium">Классификация</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {analysis.detectedEvents.map((ev) => (
                      <tr key={ev.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-2 font-mono tabular-nums text-slate-500">
                          {ev.id}
                        </td>
                        <td className="px-4 py-2 font-mono tabular-nums text-slate-900">
                          {ev.startTimeSec.toFixed(2)} — {ev.endTimeSec.toFixed(2)}
                        </td>
                        <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-900">
                          {ev.durationSec.toFixed(2)} с
                        </td>
                        <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-900">
                          {ev.dominantFreqHz} Гц
                        </td>
                        <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-900">
                          {ev.peakAmplitudeDb.toFixed(1)} дБ
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={`font-medium ${
                              ev.classification === 'кишечный шум'
                                ? 'text-cyan-800'
                                : 'text-amber-700'
                            }`}
                          >
                            {ev.classification}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};
