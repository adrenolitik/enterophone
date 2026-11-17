import React, { useMemo, useState } from 'react';
import { AcousticPoint, DiaryEntry, PatientRecord } from '../types/clinical';
import {
  DIARY_TYPE_LABELS,
  MOTILITY_STATUS_META,
  formatDateTimeRu,
  formatTimeShort,
} from '../utils/clinicalLabels';

interface MonitoringViewProps {
  patient: PatientRecord;
  onSelectDiaryTab: () => void;
}

type TimeRangeKey = '6h' | '12h' | '24h' | '48h' | 'all';
type MetricKey = 'occurrenceRate' | 'amplitude' | 'dominantFrequency' | 'interInterval';

interface MetricConfig {
  key: MetricKey;
  label: string;
  unit: string;
  decimals: number;
  stroke: string;
  fill: string;
  normMin?: number;
  normMax?: number;
  paresisThreshold?: number;
}

const METRIC_CONFIGS: Record<MetricKey, MetricConfig> = {
  occurrenceRate: {
    key: 'occurrenceRate',
    label: 'Частота шумов',
    unit: 'соб/мин',
    decimals: 1,
    stroke: '#0e7490',
    fill: 'rgba(14, 116, 144, 0.10)',
    normMin: 6,
    normMax: 18,
    paresisThreshold: 3,
  },
  amplitude: {
    key: 'amplitude',
    label: 'Амплитуда сигнала',
    unit: 'дБ',
    decimals: 1,
    stroke: '#1d4ed8',
    fill: 'rgba(29, 78, 216, 0.08)',
  },
  dominantFrequency: {
    key: 'dominantFrequency',
    label: 'Доминирующая частота',
    unit: 'Гц',
    decimals: 0,
    stroke: '#0f766e',
    fill: 'rgba(15, 118, 110, 0.08)',
  },
  interInterval: {
    key: 'interInterval',
    label: 'Межшумовой интервал',
    unit: 'с',
    decimals: 1,
    stroke: '#b45309',
    fill: 'rgba(180, 83, 9, 0.08)',
  },
};

export const MonitoringView: React.FC<MonitoringViewProps> = ({
  patient,
  onSelectDiaryTab,
}) => {
  const [timeRange, setTimeRange] = useState<TimeRangeKey>('all');
  const [activeMetric, setActiveMetric] = useState<MetricKey>('occurrenceRate');
  const [showDiaryPins, setShowDiaryPins] = useState(true);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const visibleTelemetry = useMemo(() => {
    const data = patient.telemetry;
    if (timeRange === 'all') return data;
    const countMap: Record<Exclude<TimeRangeKey, 'all'>, number> = {
      '6h': 6,
      '12h': 12,
      '24h': 24,
      '48h': 48,
    };
    const n = countMap[timeRange];
    return data.slice(Math.max(0, data.length - n));
  }, [patient.telemetry, timeRange]);

  const latestPoint: AcousticPoint | undefined =
    patient.telemetry[patient.telemetry.length - 1];
  const prevWindowPoint: AcousticPoint | undefined =
    patient.telemetry[Math.max(0, patient.telemetry.length - 7)];

  const getDelta = (key: keyof AcousticPoint): string => {
    if (!latestPoint || !prevWindowPoint) return '—';
    const diff = Number(latestPoint[key]) - Number(prevWindowPoint[key]);
    const sign = diff > 0 ? '+' : '';
    const dec = key === 'dominantFrequency' ? 0 : key === 'duration' ? 2 : 1;
    return `${sign}${diff.toFixed(dec)}`;
  };

  // Match diary entries onto visible telemetry indices
  const mappedDiaryMarkers = useMemo(() => {
    if (!showDiaryPins || visibleTelemetry.length === 0) return [];
    const startMs = new Date(visibleTelemetry[0].timestamp).getTime() - 3600 * 1000;
    const endMs =
      new Date(visibleTelemetry[visibleTelemetry.length - 1].timestamp).getTime() + 3600 * 1000;

    return patient.diary
      .filter((d) => {
        const ms = new Date(d.timestamp).getTime();
        return ms >= startMs && ms <= endMs;
      })
      .map((entry) => {
        const ms = new Date(entry.timestamp).getTime();
        let nearestIdx = 0;
        let minDiff = Infinity;
        visibleTelemetry.forEach((pt, idx) => {
          const diff = Math.abs(new Date(pt.timestamp).getTime() - ms);
          if (diff < minDiff) {
            minDiff = diff;
            nearestIdx = idx;
          }
        });
        return { entry, index: nearestIdx };
      });
  }, [patient.diary, visibleTelemetry, showDiaryPins]);

  // Circadian 24-hour aggregation
  const circadianProfile = useMemo(() => {
    const buckets: { sum: number; count: number }[] = Array.from({ length: 24 }, () => ({
      sum: 0,
      count: 0,
    }));
    patient.telemetry.forEach((pt) => {
      const h = new Date(pt.timestamp).getHours();
      buckets[h].sum += pt.occurrenceRate;
      buckets[h].count += 1;
    });
    return buckets.map((b, hour) => ({
      hour,
      avgRate: b.count > 0 ? Number((b.sum / b.count).toFixed(1)) : null,
    }));
  }, [patient.telemetry]);

  const cfg = METRIC_CONFIGS[activeMetric];
  const chartW = 920;
  const chartH = 290;
  const padL = 52;
  const padR = 20;
  const padT = 22;
  const padB = 34;
  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;

  const { yMin, yMax, pathD, areaD, pointsCoords } = useMemo(() => {
    if (visibleTelemetry.length === 0) {
      return {
        yMin: 0,
        yMax: 20,
        pathD: '',
        areaD: '',
        pointsCoords: [] as Array<{ x: number; y: number; pt: AcousticPoint }>,
      };
    }

    const values = visibleTelemetry.map((p) => Number(p[activeMetric]));
    let rawMin = Math.min(...values);
    let rawMax = Math.max(...values);

    if (activeMetric === 'occurrenceRate') {
      rawMin = Math.min(0, rawMin);
      rawMax = Math.max(22, rawMax + 2);
    } else {
      const span = Math.max(1, rawMax - rawMin);
      rawMin = rawMin - span * 0.15;
      rawMax = rawMax + span * 0.15;
    }

    const toX = (i: number) =>
      visibleTelemetry.length === 1
        ? padL + innerW / 2
        : padL + (i / (visibleTelemetry.length - 1)) * innerW;

    const toY = (v: number) =>
      padT + innerH - ((v - rawMin) / Math.max(1e-6, rawMax - rawMin)) * innerH;

    const coords = visibleTelemetry.map((pt, i) => ({
      x: toX(i),
      y: toY(Number(pt[activeMetric])),
      pt,
    }));

    const line = coords
      .map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
      .join(' ');

    const area =
      coords.length > 0
        ? `${line} L ${coords[coords.length - 1].x.toFixed(1)} ${(padT + innerH).toFixed(
            1
          )} L ${coords[0].x.toFixed(1)} ${(padT + innerH).toFixed(1)} Z`
        : '';

    return { yMin: rawMin, yMax: rawMax, pathD: line, areaD: area, pointsCoords: coords };
  }, [visibleTelemetry, activeMetric, innerH, innerW]);

  const toYVal = (v: number) =>
    padT + innerH - ((v - yMin) / Math.max(1e-6, yMax - yMin)) * innerH;

  const activePointIdx =
    hoveredIdx !== null && hoveredIdx < pointsCoords.length
      ? hoveredIdx
      : pointsCoords.length - 1;
  const activeCoord = pointsCoords[activePointIdx];

  const matchingDiaryAtHovered: DiaryEntry[] = useMemo(() => {
    if (!activeCoord) return [];
    return mappedDiaryMarkers
      .filter((m) => m.index === activePointIdx)
      .map((m) => m.entry);
  }, [mappedDiaryMarkers, activePointIdx, activeCoord]);

  const statusMeta = MOTILITY_STATUS_META[patient.status];

  const kpiCards = [
    {
      label: 'Частота шумов',
      value: latestPoint ? latestPoint.occurrenceRate.toFixed(1) : '—',
      unit: 'соб/мин',
      delta: getDelta('occurrenceRate'),
      ref: 'Норма: 6–18',
    },
    {
      label: 'Домин. частота',
      value: latestPoint ? latestPoint.dominantFrequency.toString() : '—',
      unit: 'Гц',
      delta: getDelta('dominantFrequency'),
      ref: 'Спектр: 200–600',
    },
    {
      label: 'Длительность события',
      value: latestPoint ? latestPoint.duration.toFixed(2) : '—',
      unit: 'с',
      delta: getDelta('duration'),
      ref: 'Ср. цикл: 0.4–1.1',
    },
    {
      label: 'Амплитуда сигнала',
      value: latestPoint ? latestPoint.amplitude.toFixed(1) : '—',
      unit: 'дБ',
      delta: getDelta('amplitude'),
      ref: 'Порог: >-40 дБ',
    },
    {
      label: 'Межшумовой интервал',
      value: latestPoint ? latestPoint.interInterval.toFixed(1) : '—',
      unit: 'с',
      delta: getDelta('interInterval'),
      ref: 'Парез: >20 с',
    },
  ];

  const signalBreakdownRows = [
    {
      label: 'Кишечные шумы (валидные)',
      pct: patient.signalSummary.bowelSoundsPct,
      color: 'bg-cyan-700',
    },
    {
      label: 'Физиологическая тишина',
      pct: patient.signalSummary.silencePct,
      color: 'bg-slate-300',
    },
    {
      label: 'Дыхательные шумы',
      pct: patient.signalSummary.respirationPct,
      color: 'bg-sky-400',
    },
    {
      label: 'Трение датчика / движение',
      pct: patient.signalSummary.frictionNoisePct,
      color: 'bg-amber-400',
    },
    {
      label: 'Речь / кашель',
      pct: patient.signalSummary.speechCoughPct,
      color: 'bg-indigo-400',
    },
    {
      label: 'Исключённые сегменты (помехи)',
      pct: patient.signalSummary.unusablePct,
      color: 'bg-rose-400',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Patient clinical context strip (Zero-pill unboxed metadata) */}
      <section className="rounded-xl border border-slate-200 bg-white px-6 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <h1 className="font-display text-xl font-bold text-slate-900">
                {patient.fullName}
              </h1>
              <span className={`text-sm font-semibold ${statusMeta.colorClass}`}>
                <span aria-hidden="true" className="mr-1">
                  {statusMeta.symbol}
                </span>
                {statusMeta.label}
              </span>
            </div>
            <p className="text-sm text-slate-600">{patient.diagnosis}</p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
              <span className="font-mono tabular-nums">{patient.caseNumber}</span>
              <span aria-hidden="true">·</span>
              <span>
                {patient.age} лет, {patient.sex}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">ИМТ {patient.bmi.toFixed(1)}</span>
              <span aria-hidden="true">·</span>
              <span>
                {patient.ward}, {patient.bed}
              </span>
              <span aria-hidden="true">·</span>
              <span>Датчик: {patient.signalSummary.sensorLocation}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 border-t border-slate-100 pt-3 lg:border-t-0 lg:pt-0">
            <div>
              <div className="text-xs text-slate-500">Атланта 2012</div>
              <div className="font-mono text-sm font-semibold tabular-nums text-slate-900">
                {patient.scores.atlantaClass}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Шкала AGI</div>
              <div className="font-mono text-sm font-semibold tabular-nums text-slate-900">
                AGI {patient.scores.agi}
              </div>
            </div>
            {patient.scores.apacheII !== undefined && (
              <div>
                <div className="text-xs text-slate-500">APACHE II</div>
                <div className="font-mono text-sm font-semibold tabular-nums text-slate-900">
                  {patient.scores.apacheII} б.
                </div>
              </div>
            )}
            {patient.scores.ranson !== undefined && (
              <div>
                <div className="text-xs text-slate-500">Ranson</div>
                <div className="font-mono text-sm font-semibold tabular-nums text-slate-900">
                  {patient.scores.ranson} б.
                </div>
              </div>
            )}
            <div>
              <div className="text-xs text-slate-500">Валидный сигнал</div>
              <div className="font-mono text-sm font-semibold tabular-nums text-slate-900">
                {patient.signalSummary.validHours.toFixed(1)} /{' '}
                {patient.signalSummary.totalHours.toFixed(1)} ч
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5 Bowel Sound Acoustic Parameters Grid */}
      <section aria-label="Пять акустических параметров перистальтики">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {kpiCards.map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3.5"
            >
              <div className="text-xs font-medium text-slate-500">{kpi.label}</div>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className="font-mono text-2xl font-semibold tabular-nums text-slate-900">
                  {kpi.value}
                </span>
                <span className="font-mono text-xs text-slate-500">{kpi.unit}</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-xs text-slate-500">
                <span className="font-mono tabular-nums">Δ 6ч: {kpi.delta}</span>
                <span>{kpi.ref}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Main Interactive Bowel Sound Activity Chart */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              График динамики кишечной активности
            </h2>
            <p className="text-xs text-slate-500">
              Почасовой профиль акустических параметров с наложением отметок врачебного дневника
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Metric selector */}
            <div
              className="flex items-center gap-1 rounded-lg bg-slate-100 p-1"
              role="group"
              aria-label="Выбор акустического параметра"
            >
              {(Object.keys(METRIC_CONFIGS) as MetricKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveMetric(key)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    activeMetric === key
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {METRIC_CONFIGS[key].label}
                </button>
              ))}
            </div>

            {/* Timeframe selector */}
            <div
              className="flex items-center gap-1 rounded-lg bg-slate-100 p-1"
              role="group"
              aria-label="Выбор временного диапазона"
            >
              {(
                [
                  { k: '6h', l: '6 ч' },
                  { k: '12h', l: '12 ч' },
                  { k: '24h', l: '24 ч' },
                  { k: '48h', l: '48 ч' },
                  { k: 'all', l: 'Весь период' },
                ] as const
              ).map((tf) => (
                <button
                  key={tf.k}
                  type="button"
                  onClick={() => setTimeRange(tf.k)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    timeRange === tf.k
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tf.l}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowDiaryPins((v) => !v)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                showDiaryPins
                  ? 'border-cyan-700 bg-cyan-50 text-cyan-900'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              События дневника ({mappedDiaryMarkers.length})
            </button>
          </div>
        </div>

        {/* Crosshair telemetry readout strip */}
        {activeCoord && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3.5 py-2 text-xs">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-700">
              <span className="font-mono font-semibold tabular-nums text-slate-900">
                {formatDateTimeRu(activeCoord.pt.timestamp)}
              </span>
              <span className="font-mono tabular-nums">
                Частота: <strong>{activeCoord.pt.occurrenceRate.toFixed(1)}</strong> соб/мин
              </span>
              <span className="font-mono tabular-nums">
                Пик: <strong>{activeCoord.pt.dominantFrequency}</strong> Гц
              </span>
              <span className="font-mono tabular-nums">
                Ампл.: <strong>{activeCoord.pt.amplitude.toFixed(1)}</strong> дБ
              </span>
              <span className="font-mono tabular-nums">
                Длит.: <strong>{activeCoord.pt.duration.toFixed(2)}</strong> с
              </span>
              <span className="font-mono tabular-nums">
                Интервал: <strong>{activeCoord.pt.interInterval.toFixed(1)}</strong> с
              </span>
              <span className="font-mono tabular-nums text-slate-500">
                Качество: {activeCoord.pt.signalQuality}%
              </span>
            </div>

            {matchingDiaryAtHovered.length > 0 && (
              <button
                type="button"
                onClick={onSelectDiaryTab}
                className="text-xs font-medium text-cyan-800 hover:underline whitespace-nowrap shrink-0"
              >
                Запись: {DIARY_TYPE_LABELS[matchingDiaryAtHovered[0].entryType]} →
              </button>
            )}
          </div>
        )}

        {/* SVG Chart */}
        <div className="mt-3 w-full overflow-x-auto">
          {visibleTelemetry.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-slate-500">
              Нет данных мониторинга за выбранный период
            </div>
          ) : (
            <svg
              viewBox={`0 0 ${chartW} ${chartH}`}
              className="w-full min-w-[640px] cursor-crosshair select-none"
              role="img"
              aria-label={`График: ${cfg.label}`}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {/* Normal reference band for Occurrence Rate */}
              {activeMetric === 'occurrenceRate' &&
                cfg.normMin !== undefined &&
                cfg.normMax !== undefined && (
                  <>
                    <rect
                      x={padL}
                      y={toYVal(Math.min(yMax, cfg.normMax))}
                      width={innerW}
                      height={Math.max(
                        0,
                        toYVal(Math.max(yMin, cfg.normMin)) -
                          toYVal(Math.min(yMax, cfg.normMax))
                      )}
                      fill="rgba(22, 163, 74, 0.06)"
                    />
                    <text
                      x={padL + 8}
                      y={toYVal(Math.min(yMax, cfg.normMax)) + 13}
                      className="fill-emerald-700 text-[10px] font-medium"
                    >
                      Норма (6–18 соб/мин)
                    </text>

                    {cfg.paresisThreshold !== undefined && yMin < cfg.paresisThreshold && (
                      <>
                        <rect
                          x={padL}
                          y={toYVal(cfg.paresisThreshold)}
                          width={innerW}
                          height={Math.max(0, padT + innerH - toYVal(cfg.paresisThreshold))}
                          fill="rgba(220, 38, 38, 0.06)"
                        />
                        <line
                          x1={padL}
                          x2={padL + innerW}
                          y1={toYVal(cfg.paresisThreshold)}
                          y2={toYVal(cfg.paresisThreshold)}
                          stroke="#dc2626"
                          strokeDasharray="4 4"
                          strokeWidth={1}
                          opacity={0.6}
                        />
                        <text
                          x={padL + 8}
                          y={toYVal(cfg.paresisThreshold) + 12}
                          className="fill-rose-700 text-[10px] font-medium"
                        >
                          Зона риска пареза (&lt;3 соб/мин)
                        </text>
                      </>
                    )}
                  </>
                )}

              {/* Horizontal grid lines & Y axis labels */}
              {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                const val = yMin + (1 - t) * (yMax - yMin);
                const y = padT + t * innerH;
                return (
                  <g key={t}>
                    <line
                      x1={padL}
                      x2={padL + innerW}
                      y1={y}
                      y2={y}
                      stroke="#e2e8f0"
                      strokeWidth={1}
                    />
                    <text
                      x={padL - 8}
                      y={y + 3.5}
                      textAnchor="end"
                      className="fill-slate-500 font-mono text-[10px] tabular-nums"
                    >
                      {val.toFixed(cfg.decimals)}
                    </text>
                  </g>
                );
              })}

              {/* Area + Line */}
              <path d={areaD} fill={cfg.fill} />
              <path
                d={pathD}
                fill="none"
                stroke={cfg.stroke}
                strokeWidth={2.25}
                strokeLinejoin="round"
                strokeLinecap="round"
              />

              {/* X-axis timestamps (up to 8 ticks) */}
              {pointsCoords.map((c, idx) => {
                const step = Math.max(1, Math.floor(pointsCoords.length / 8));
                if (idx % step !== 0 && idx !== pointsCoords.length - 1) return null;
                return (
                  <text
                    key={c.pt.timestamp}
                    x={c.x}
                    y={chartH - 10}
                    textAnchor="middle"
                    className="fill-slate-500 font-mono text-[10px] tabular-nums"
                  >
                    {formatTimeShort(c.pt.timestamp)}
                  </text>
                );
              })}

              {/* Diary event markers */}
              {showDiaryPins &&
                mappedDiaryMarkers.map(({ entry, index }) => {
                  const coord = pointsCoords[index];
                  if (!coord) return null;
                  return (
                    <g key={entry.id}>
                      <line
                        x1={coord.x}
                        x2={coord.x}
                        y1={padT}
                        y2={padT + innerH}
                        stroke="#0e7490"
                        strokeWidth={1}
                        strokeDasharray="2 2"
                        opacity={0.45}
                      />
                      <polygon
                        points={`${coord.x},${padT + 2} ${coord.x - 5},${padT + 10} ${
                          coord.x + 5
                        },${padT + 10}`}
                        fill="#0f172a"
                      />
                    </g>
                  );
                })}

              {/* Active crosshair */}
              {activeCoord && (
                <g>
                  <line
                    x1={activeCoord.x}
                    x2={activeCoord.x}
                    y1={padT}
                    y2={padT + innerH}
                    stroke="#64748b"
                    strokeWidth={1}
                  />
                  <circle
                    cx={activeCoord.x}
                    cy={activeCoord.y}
                    r={4.5}
                    fill="#ffffff"
                    stroke={cfg.stroke}
                    strokeWidth={2.5}
                  />
                </g>
              )}

              {/* Invisible hover columns for snappy crosshair tracking */}
              {pointsCoords.map((c, idx) => {
                const colW = innerW / Math.max(1, pointsCoords.length);
                return (
                  <rect
                    key={`hit-${idx}`}
                    x={c.x - colW / 2}
                    y={padT}
                    width={Math.max(8, colW)}
                    height={innerH}
                    fill="transparent"
                    onMouseEnter={() => setHoveredIdx(idx)}
                  />
                );
              })}
            </svg>
          )}
        </div>

        {/* Matched diary note preview if hovering near a clinical event */}
        {matchingDiaryAtHovered.length > 0 && (
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/70 px-4 py-2.5 text-xs text-slate-700">
            <span className="font-semibold text-slate-900">
              {DIARY_TYPE_LABELS[matchingDiaryAtHovered[0].entryType]} (
              {formatDateTimeRu(matchingDiaryAtHovered[0].timestamp)}):
            </span>{' '}
            {matchingDiaryAtHovered[0].notes}
          </div>
        )}
      </section>

      {/* Bottom 2-column grid: Circadian 24h Profile + Signal Quality Breakdown */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Circadian Profile */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900">
                Суточный профиль активности
              </h3>
              <p className="text-xs text-slate-500">
                Средняя частота шумов по часам суток (соб/мин)
              </p>
            </div>
            <span className="font-mono text-xs text-slate-500 tabular-nums">00:00 — 23:00</span>
          </div>

          <div className="mt-4">
            <svg
              viewBox="0 0 480 150"
              className="w-full"
              role="img"
              aria-label="Суточный профиль перистальтики"
            >
              {[0, 10, 20].map((v) => {
                const y = 122 - (v / 26) * 105;
                return (
                  <g key={v}>
                    <line x1={28} x2={472} y1={y} y2={y} stroke="#f1f5f9" strokeWidth={1} />
                    <text
                      x={22}
                      y={y + 3}
                      textAnchor="end"
                      className="fill-slate-400 font-mono text-[9px] tabular-nums"
                    >
                      {v}
                    </text>
                  </g>
                );
              })}

              {circadianProfile.map((b) => {
                const barW = 13;
                const x = 34 + b.hour * 18.2;
                const val = b.avgRate ?? 0;
                const h = Math.min(105, (val / 26) * 105);
                const y = 122 - h;
                const fill =
                  b.avgRate === null
                    ? '#e2e8f0'
                    : val < 3
                    ? '#dc2626'
                    : val < 6
                    ? '#d97706'
                    : val > 19
                    ? '#2563eb'
                    : '#0e7490';
                return (
                  <g key={b.hour}>
                    <rect
                      x={x}
                      y={b.avgRate === null ? 118 : y}
                      width={barW}
                      height={b.avgRate === null ? 4 : Math.max(2, h)}
                      rx={2}
                      fill={fill}
                      opacity={b.avgRate === null ? 0.5 : 0.85}
                    >
                      <title>
                        {`${String(b.hour).padStart(2, '0')}:00 — ${
                          b.avgRate !== null ? `${b.avgRate} соб/мин` : 'нет данных'
                        }`}
                      </title>
                    </rect>
                    {b.hour % 3 === 0 && (
                      <text
                        x={x + barW / 2}
                        y={138}
                        textAnchor="middle"
                        className="fill-slate-500 font-mono text-[9px] tabular-nums"
                      >
                        {String(b.hour).padStart(2, '0')}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Signal Quality & Event Segmentation */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900">
                Сегментация и качество сигнала
              </h3>
              <p className="text-xs text-slate-500">
                Классификация аудиосегментов ({patient.signalSummary.samplingRateHz} Гц, 16-бит)
              </p>
            </div>
            <span className="font-mono text-xs font-semibold tabular-nums text-emerald-700">
              Валидно{' '}
              {(
                (patient.signalSummary.validHours /
                  Math.max(0.1, patient.signalSummary.totalHours)) *
                100
              ).toFixed(1)}
              %
            </span>
          </div>

          {/* Stacked proportional bar */}
          <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
            {signalBreakdownRows.map((row) => (
              <div
                key={row.label}
                style={{ width: `${row.pct}%` }}
                className={row.color}
                title={`${row.label}: ${row.pct}%`}
              />
            ))}
          </div>

          <div className="mt-4 divide-y divide-slate-100">
            {signalBreakdownRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between py-2 text-xs">
                <div className="flex items-center gap-2 text-slate-700">
                  <span className={`h-2.5 w-2.5 rounded-xs ${row.color}`} aria-hidden="true" />
                  <span>{row.label}</span>
                </div>
                <span className="font-mono font-medium tabular-nums text-slate-900">
                  {row.pct.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
