import {
  AcousticAnalysisResult,
  MotilityStatus,
  SegmentedBowelEvent,
} from '../types/clinical';

export type CalibrationPresetId = 'normal' | 'hypo' | 'hyper' | 'artifacts';

export interface CalibrationPresetMeta {
  id: CalibrationPresetId;
  title: string;
  description: string;
  durationSec: number;
}

export const CALIBRATION_PRESETS: CalibrationPresetMeta[] = [
  {
    id: 'normal',
    title: 'Нормоперистальтика (Калибровка)',
    description: '11–13 событий/мин, доминирующая частота 320–420 Гц, чёткие перистальтические всплески',
    durationSec: 20,
  },
  {
    id: 'hypo',
    title: 'Гипоперистальтика (Острый панкреатит)',
    description: '2–3 события/мин, длинные интервалы тишины (>15 с), сниженная амплитуда',
    durationSec: 20,
  },
  {
    id: 'hyper',
    title: 'Гиперперистальтика (СРК / диарея)',
    description: '22–26 событий/мин, кластерные высокочастотные шумы 450–650 Гц',
    durationSec: 20,
  },
  {
    id: 'artifacts',
    title: 'Шум с артефактами дыхания и трения',
    description: 'Смешанный сигнал с низкочастотным дрейфом (<100 Гц) и короткими импульсами трения',
    durationSec: 20,
  },
];

/**
 * Generates a realistic synthetic bowel-sound PCM Float32Array at 8000 Hz
 * using damped resonant chirps in 180–650 Hz band + background physiological noise.
 */
export function generateSyntheticAudioBuffer(
  preset: CalibrationPresetId,
  sampleRate = 8000,
  durationSec = 20
): { samples: Float32Array; sampleRate: number; durationSec: number } {
  const totalSamples = Math.floor(sampleRate * durationSec);
  const samples = new Float32Array(totalSamples);

  // Subtle pink/brownian physiological background noise
  let lastOut = 0;
  for (let i = 0; i < totalSamples; i++) {
    const white = Math.random() * 2 - 1;
    lastOut = (lastOut + 0.04 * white) / 1.04;
    samples[i] = lastOut * 0.045;
  }

  // Optional low-frequency respiratory baseline (< 80 Hz)
  const respAmp = preset === 'artifacts' ? 0.14 : 0.025;
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    samples[i] += Math.sin(2 * Math.PI * 0.28 * t) * respAmp * (0.4 + 0.6 * Math.sin(2 * Math.PI * 38 * t));
  }

  // Event schedule based on preset
  const eventTimes: Array<{
    start: number;
    dur: number;
    freq: number;
    amp: number;
    isArtifact?: boolean;
  }> = [];

  if (preset === 'normal') {
    const starts = [1.2, 4.8, 7.3, 12.1, 16.4];
    starts.forEach((s, idx) => {
      eventTimes.push({
        start: s,
        dur: 0.45 + (idx % 3) * 0.18,
        freq: 310 + ((idx * 53) % 140),
        amp: 0.28 + (idx % 2) * 0.12,
      });
    });
  } else if (preset === 'hypo') {
    eventTimes.push({ start: 3.5, dur: 0.35, freq: 245, amp: 0.14 });
    eventTimes.push({ start: 15.8, dur: 0.32, freq: 230, amp: 0.12 });
  } else if (preset === 'hyper') {
    const starts = [0.6, 1.9, 3.4, 5.1, 6.8, 8.7, 10.2, 12.5, 14.3, 16.0, 18.1];
    starts.forEach((s, idx) => {
      eventTimes.push({
        start: s,
        dur: 0.55 + (idx % 3) * 0.22,
        freq: 420 + ((idx * 67) % 210),
        amp: 0.36 + (idx % 3) * 0.09,
      });
    });
  } else if (preset === 'artifacts') {
    // Mix valid bowel sounds and sharp high-freq friction bursts
    eventTimes.push({ start: 2.1, dur: 0.52, freq: 340, amp: 0.25 });
    eventTimes.push({ start: 6.4, dur: 0.12, freq: 1450, amp: 0.55, isArtifact: true });
    eventTimes.push({ start: 9.8, dur: 0.62, freq: 365, amp: 0.29 });
    eventTimes.push({ start: 13.7, dur: 0.1, freq: 1620, amp: 0.6, isArtifact: true });
    eventTimes.push({ start: 17.2, dur: 0.48, freq: 330, amp: 0.24 });
  }

  for (const ev of eventTimes) {
    const startIdx = Math.floor(ev.start * sampleRate);
    const len = Math.floor(ev.dur * sampleRate);
    for (let j = 0; j < len && startIdx + j < totalSamples; j++) {
      const u = j / len;
      // Multi-pulse peristaltic envelope
      const env =
        ev.isArtifact
          ? Math.sin(Math.PI * u)
          : Math.sin(Math.PI * u) * (0.65 + 0.35 * Math.sin(Math.PI * 5 * u));
      const t = j / sampleRate;
      const carrier =
        Math.sin(2 * Math.PI * ev.freq * t) * 0.65 +
        Math.sin(2 * Math.PI * (ev.freq * 1.38) * t + 0.7) * 0.35;
      samples[startIdx + j] += carrier * env * ev.amp;
    }
  }

  return { samples, sampleRate, durationSec };
}

/**
 * Simple 2nd-order Butterworth-like bandpass filter (highpass ~100Hz + lowpass ~1000Hz)
 */
function applyBandpassFilter(samples: Float32Array, sampleRate: number): Float32Array {
  const out = new Float32Array(samples.length);
  // High-pass ~100 Hz RC
  const rcHp = 1 / (2 * Math.PI * 100);
  const dt = 1 / sampleRate;
  const alphaHp = rcHp / (rcHp + dt);
  let prevIn = 0;
  let prevHp = 0;

  // Low-pass ~950 Hz RC
  const rcLp = 1 / (2 * Math.PI * 950);
  const alphaLp = dt / (rcLp + dt);
  let prevLp = 0;

  for (let i = 0; i < samples.length; i++) {
    const hp = alphaHp * (prevHp + samples[i] - prevIn);
    prevIn = samples[i];
    prevHp = hp;

    const lp = prevLp + alphaLp * (hp - prevLp);
    prevLp = lp;
    out[i] = lp;
  }
  return out;
}

/**
 * Computes real DFT magnitude spectrum in 50–1200 Hz band for a slice
 */
function computeSpectrumBand(
  slice: Float32Array,
  sampleRate: number,
  numBins = 32,
  maxFreqHz = 1200
): { bins: number[]; dominantFreqHz: number } {
  const n = Math.min(slice.length, 512);
  const bins = new Array<number>(numBins).fill(0);
  let bestFreq = 300;
  let bestMag = -1;

  for (let b = 0; b < numBins; b++) {
    const freq = ((b + 0.5) / numBins) * maxFreqHz;
    if (freq < 60) {
      bins[b] = 0;
      continue;
    }
    const omega = (2 * Math.PI * freq) / sampleRate;
    let re = 0;
    let im = 0;
    for (let i = 0; i < n; i++) {
      // Hann window
      const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
      const s = slice[i] * w;
      re += s * Math.cos(omega * i);
      im -= s * Math.sin(omega * i);
    }
    const mag = Math.sqrt(re * re + im * im) / n;
    bins[b] = mag;
    if (freq >= 120 && freq <= 900 && mag > bestMag) {
      bestMag = mag;
      bestFreq = freq;
    }
  }

  return { bins, dominantFreqHz: Math.round(bestFreq) };
}

/**
 * Full clinical signal processing pipeline:
 * 1) Bandpass filtering (100–950 Hz)
 * 2) Envelope segmentation (40 ms frames)
 * 3) Event extraction & artifact discrimination
 * 4) 5 Bowel Sound parameters + Spectrogram matrix
 */
export function analyzeBowelSoundSamples(
  rawSamples: Float32Array,
  sampleRate: number,
  fileName: string
): AcousticAnalysisResult {
  const durationSec = rawSamples.length / sampleRate;
  const filtered = applyBandpassFilter(rawSamples, sampleRate);

  // Compute frame RMS energy every 40ms
  const frameSize = Math.max(64, Math.floor(sampleRate * 0.04));
  const numFrames = Math.floor(filtered.length / frameSize);
  const rmsFrames = new Float32Array(numFrames);

  for (let f = 0; f < numFrames; f++) {
    let sumSq = 0;
    const offset = f * frameSize;
    for (let j = 0; j < frameSize; j++) {
      const v = filtered[offset + j];
      sumSq += v * v;
    }
    rmsFrames[f] = Math.sqrt(sumSq / frameSize);
  }

  // Robust baseline noise floor (median + 3.2 * MAD-like floor)
  const sortedRms = Array.from(rmsFrames).sort((a, b) => a - b);
  const medianRms = sortedRms[Math.floor(sortedRms.length * 0.5)] || 0.005;
  const p25 = sortedRms[Math.floor(sortedRms.length * 0.25)] || 0.002;
  const threshold = Math.max(0.018, medianRms * 2.6 + (medianRms - p25) * 2.0);

  // Segment contiguous frames above threshold
  const rawSegments: Array<{ startFrame: number; endFrame: number; peakRms: number }> = [];
  let inEvent = false;
  let evStart = 0;
  let evPeak = 0;

  for (let f = 0; f < numFrames; f++) {
    const val = rmsFrames[f];
    if (val >= threshold) {
      if (!inEvent) {
        inEvent = true;
        evStart = f;
        evPeak = val;
      } else if (val > evPeak) {
        evPeak = val;
      }
    } else if (inEvent) {
      // Allow short 80ms gap merge
      const nextVal = f + 1 < numFrames ? rmsFrames[f + 1] : 0;
      if (nextVal >= threshold) {
        continue;
      }
      rawSegments.push({ startFrame: evStart, endFrame: f - 1, peakRms: evPeak });
      inEvent = false;
    }
  }
  if (inEvent) {
    rawSegments.push({ startFrame: evStart, endFrame: numFrames - 1, peakRms: evPeak });
  }

  // Classify segments and extract features
  const detectedEvents: SegmentedBowelEvent[] = [];
  rawSegments.forEach((seg, idx) => {
    const startSec = Number(((seg.startFrame * frameSize) / sampleRate).toFixed(2));
    const endSec = Number((((seg.endFrame + 1) * frameSize) / sampleRate).toFixed(2));
    const dur = Number((endSec - startSec).toFixed(2));
    if (dur < 0.08) return; // ignore micro-clicks

    const startSample = seg.startFrame * frameSize;
    const endSample = Math.min(filtered.length, (seg.endFrame + 1) * frameSize);
    const slice = filtered.subarray(startSample, endSample);
    const { dominantFreqHz } = computeSpectrumBand(slice, sampleRate, 32, 1200);
    const db = Number((20 * Math.log10(Math.max(seg.peakRms, 1e-5))).toFixed(1));

    // Heuristic classification (bowel sound vs friction/respiration)
    let classification: SegmentedBowelEvent['classification'] = 'кишечный шум';
    if (dur < 0.16 && dominantFreqHz > 750) {
      classification = 'артефакт движения';
    } else if (dominantFreqHz < 130 && dur > 1.2) {
      classification = 'дыхание';
    }

    detectedEvents.push({
      id: idx + 1,
      startTimeSec: startSec,
      endTimeSec: endSec,
      durationSec: dur,
      peakAmplitudeDb: db,
      dominantFreqHz,
      classification,
    });
  });

  const validBowelEvents = detectedEvents.filter((e) => e.classification === 'кишечный шум');
  const durationMin = Math.max(durationSec / 60, 0.05);
  const occurrenceRate = Number((validBowelEvents.length / durationMin).toFixed(1));

  const dominantFrequency =
    validBowelEvents.length > 0
      ? Math.round(
          validBowelEvents.reduce((acc, e) => acc + e.dominantFreqHz, 0) / validBowelEvents.length
        )
      : 0;

  const avgDuration =
    validBowelEvents.length > 0
      ? Number(
          (
            validBowelEvents.reduce((acc, e) => acc + e.durationSec, 0) / validBowelEvents.length
          ).toFixed(2)
        )
      : 0;

  const avgAmplitude =
    validBowelEvents.length > 0
      ? Number(
          (
            validBowelEvents.reduce((acc, e) => acc + e.peakAmplitudeDb, 0) /
            validBowelEvents.length
          ).toFixed(1)
        )
      : -55.0;

  let interInterval = durationSec;
  if (validBowelEvents.length > 1) {
    let sumGap = 0;
    for (let i = 1; i < validBowelEvents.length; i++) {
      sumGap += Math.max(0.1, validBowelEvents[i].startTimeSec - validBowelEvents[i - 1].endTimeSec);
    }
    interInterval = Number((sumGap / (validBowelEvents.length - 1)).toFixed(1));
  } else if (validBowelEvents.length === 1) {
    interInterval = Number((durationSec / 2).toFixed(1));
  }

  // Waveform downsampled to 240 points for preview
  const previewCount = 240;
  const waveformPreview: number[] = [];
  const step = Math.max(1, Math.floor(filtered.length / previewCount));
  for (let i = 0; i < previewCount; i++) {
    const start = i * step;
    let peak = 0;
    for (let j = 0; j < step && start + j < filtered.length; j++) {
      const abs = Math.abs(filtered[start + j]);
      if (abs > peak) peak = abs;
    }
    waveformPreview.push(Math.min(1, peak * 1.8));
  }

  // Spectrogram frames (80 time slices x 28 freq bins)
  const specCols = 80;
  const specBins = 28;
  const spectrogramFrames: number[][] = [];
  const colSamples = Math.max(256, Math.floor(filtered.length / specCols));
  let globalMaxSpec = 1e-6;

  const rawSpecCols: number[][] = [];
  for (let c = 0; c < specCols; c++) {
    const s = c * colSamples;
    const slice = filtered.subarray(s, Math.min(filtered.length, s + 512));
    const { bins } = computeSpectrumBand(slice, sampleRate, specBins, 1200);
    for (const v of bins) {
      if (v > globalMaxSpec) globalMaxSpec = v;
    }
    rawSpecCols.push(bins);
  }
  for (const col of rawSpecCols) {
    spectrogramFrames.push(
      col.map((v) => Math.min(1, Math.pow(v / globalMaxSpec, 0.55)))
    );
  }

  const artifactCount = detectedEvents.filter((e) => e.classification !== 'кишечный шум').length;
  const signalQualityPct = Math.max(
    65,
    Math.min(99, Math.round(97 - artifactCount * 4.5))
  );

  let motilityVerdict: MotilityStatus = 'normal';
  if (occurrenceRate < 2.5) motilityVerdict = 'paresis';
  else if (occurrenceRate < 6) motilityVerdict = 'hypo';
  else if (occurrenceRate > 19) motilityVerdict = 'hyper';

  return {
    fileName,
    durationSec: Number(durationSec.toFixed(1)),
    sampleRate,
    parameters: {
      occurrenceRate,
      dominantFrequency,
      duration: avgDuration,
      amplitude: avgAmplitude,
      interInterval: Number(interInterval.toFixed(1)),
    },
    detectedEvents,
    waveformPreview,
    spectrogramFrames,
    maxFreqHz: 1200,
    signalQualityPct,
    motilityVerdict,
  };
}

/**
 * Decodes an uploaded WAV/MP3/OGG File using Web Audio API
 */
export async function decodeAudioFile(
  file: File
): Promise<{ samples: Float32Array; sampleRate: number }> {
  const arrayBuffer = await file.arrayBuffer();
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const channelData = audioBuffer.getChannelData(0);
    // Downsample to max 8000 Hz if very large for fast browser FFT
    if (audioBuffer.sampleRate > 16000) {
      const ratio = Math.floor(audioBuffer.sampleRate / 8000);
      const downsampled = new Float32Array(Math.floor(channelData.length / ratio));
      for (let i = 0; i < downsampled.length; i++) {
        downsampled[i] = channelData[i * ratio];
      }
      return { samples: downsampled, sampleRate: Math.round(audioBuffer.sampleRate / ratio) };
    }
    return { samples: new Float32Array(channelData), sampleRate: audioBuffer.sampleRate };
  } finally {
    await ctx.close();
  }
}

/**
 * Plays back a Float32Array buffer through speakers for physician auscultation review
 */
export function playFloat32Samples(
  samples: Float32Array,
  sampleRate: number,
  onEnded?: () => void
): () => void {
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  const buffer = ctx.createBuffer(1, samples.length, sampleRate);
  buffer.getChannelData(0).set(samples);

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const gain = ctx.createGain();
  gain.gain.value = 1.4;
  source.connect(gain);
  gain.connect(ctx.destination);

  source.onended = () => {
    ctx.close().catch(() => {});
    onEnded?.();
  };
  source.start();

  return () => {
    try {
      source.stop();
    } catch {
      // ignore if already stopped
    }
    ctx.close().catch(() => {});
  };
}
