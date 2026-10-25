import React, { useState, useId, useMemo } from 'react';
import { TrendingUp, TrendingDown, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';

export interface DqiMonthlyPoint {
  monthKey: string;      // e.g. "2026-04"
  shortMonth: string;    // e.g. "Apr"
  fullMonth: string;     // e.g. "April 2026"
  year: number;
  score: number;         // 0 - 100
  txCount: number;
  balancedCount: number;
  statusText: string;
}

interface DqiSparklineChartProps {
  data: DqiMonthlyPoint[];
  currentScore?: number;
  className?: string;
  width?: number;
  height?: number;
  showLabels?: boolean;
  showTrendBadge?: boolean;
  onClickDetails?: () => void;
}

export const DqiSparklineChart: React.FC<DqiSparklineChartProps> = ({
  data,
  currentScore,
  className = '',
  width = 176,
  height = 42,
  showLabels = true,
  showTrendBadge = true,
  onClickDetails,
}) => {
  const gradientId = useId();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Compute trend (last month vs 6 months ago, or previous month)
  const trendInfo = useMemo(() => {
    if (!data || data.length < 2) {
      return { diff: 0, isUp: false, isDown: false, isStable: true, label: 'Stabil' };
    }
    const firstScore = data[0].score;
    const lastScore = data[data.length - 1].score;
    const diff = Math.round((lastScore - firstScore) * 10) / 10;

    if (diff > 0.05) {
      return { diff, isUp: true, isDown: false, isStable: false, label: `+${diff.toFixed(1)}%` };
    } else if (diff < -0.05) {
      return { diff, isUp: false, isDown: true, isStable: false, label: `${diff.toFixed(1)}%` };
    } else {
      return { diff: 0, isUp: false, isDown: false, isStable: true, label: 'Konsisten' };
    }
  }, [data]);

  // Coordinates calculation
  const paddingX = 8;
  const paddingTop = 6;
  const paddingBottom = 6;
  const innerWidth = width - paddingX * 2;
  const innerHeight = height - paddingTop - paddingBottom;

  const points = useMemo(() => {
    if (!data || data.length === 0) return [];

    const scores = data.map(d => d.score);
    const minVal = Math.min(...scores);
    const maxVal = Math.max(...scores, 100);

    // Dynamic range so fluctuations are perceptible while staying bounded
    const rangeMin = Math.max(0, Math.min(85, minVal - 5));
    const rangeMax = Math.max(100, maxVal);
    const range = rangeMax - rangeMin || 1;

    const count = data.length;
    const stepX = count > 1 ? innerWidth / (count - 1) : 0;

    return data.map((item, idx) => {
      const x = paddingX + idx * stepX;
      // Higher score = smaller y (closer to top)
      const normalizedScore = (item.score - rangeMin) / range;
      const y = paddingTop + innerHeight * (1 - normalizedScore);
      return { x, y, item, idx };
    });
  }, [data, width, height, innerWidth, innerHeight, paddingX, paddingTop]);

  // Generate smooth cubic bezier SVG path
  const { linePath, areaPath } = useMemo(() => {
    if (points.length === 0) return { linePath: '', areaPath: '' };
    if (points.length === 1) {
      const p = points[0];
      return {
        linePath: `M ${p.x} ${p.y}`,
        areaPath: `M ${p.x} ${p.y} L ${p.x} ${height} Z`
      };
    }

    let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const midX = ((p0.x + p1.x) / 2).toFixed(1);
      d += ` C ${midX} ${p0.y.toFixed(1)}, ${midX} ${p1.y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
    }

    const last = points[points.length - 1];
    const first = points[0];
    const area = `${d} L ${last.x.toFixed(1)} ${height} L ${first.x.toFixed(1)} ${height} Z`;

    return { linePath: d, areaPath: area };
  }, [points, height]);

  const activePoint = hoveredIndex !== null && points[hoveredIndex] ? points[hoveredIndex] : null;

  return (
    <div className={`relative flex flex-col items-end select-none ${className}`}>
      {/* Sparkline Header & Mini Trend Indicator */}
      {showTrendBadge && (
        <div className="flex items-center justify-between w-full gap-2 mb-1">
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Tren DQI 6 Bln
            </span>
            <span className="text-[10px] font-mono font-bold text-slate-800">
              ({data[0]?.shortMonth} - {data[data.length - 1]?.shortMonth})
            </span>
          </div>

          <div className="flex items-center gap-1">
            <span
              className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-mono font-black border ${
                trendInfo.isUp
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : trendInfo.isDown
                  ? 'bg-rose-50 text-rose-700 border-rose-300'
                  : 'bg-teal-50 text-teal-800 border-teal-300'
              }`}
              title="Perubahan tren Data Quality Index dalam 6 bulan terakhir"
            >
              {trendInfo.isUp && <TrendingUp size={11} className="text-emerald-600" />}
              {trendInfo.isDown && <TrendingDown size={11} className="text-rose-600" />}
              {trendInfo.isStable && <CheckCircle2 size={11} className="text-teal-600" />}
              <span>{trendInfo.label}</span>
            </span>
          </div>
        </div>
      )}

      {/* SVG Sparkline Container with Smooth Hover Effects */}
      <div 
        className="relative bg-slate-900/[0.03] hover:bg-slate-900/[0.05] p-1 rounded-lg border border-slate-300/80 transition-colors cursor-pointer group"
        onClick={onClickDetails}
        title="Klik untuk membuka analisis lengkap Data Quality Index (DQI)"
      >
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="overflow-visible block"
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <defs>
            <linearGradient id={`grad-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#059669" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#059669" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Baseline reference grid */}
          <line
            x1={paddingX}
            y1={height - paddingBottom}
            x2={width - paddingX}
            y2={height - paddingBottom}
            stroke="#cbd5e1"
            strokeDasharray="2 2"
            strokeWidth="0.8"
          />

          {/* Area fill under curve */}
          {areaPath && (
            <path
              d={areaPath}
              fill={`url(#grad-${gradientId})`}
              className="transition-all duration-300 pointer-events-none"
            />
          )}

          {/* Main sparkline curve */}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke="#059669"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="drop-shadow-xs transition-all duration-300"
            />
          )}

          {/* Data Points (Circles) */}
          {points.map((p, idx) => {
            const isHovered = hoveredIndex === idx;
            const isLast = idx === points.length - 1;
            return (
              <g key={p.item.monthKey}>
                {/* Invisible larger hover hit target */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="10"
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredIndex(idx)}
                />
                {/* Visual circle dot */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isHovered ? 4.5 : isLast ? 3.5 : 2.5}
                  fill={isHovered ? '#047857' : isLast ? '#059669' : '#10b981'}
                  stroke="#ffffff"
                  strokeWidth={isHovered ? 2 : 1.5}
                  className="transition-all duration-150 pointer-events-none"
                />
              </g>
            );
          })}
        </svg>

        {/* Floating Tooltip upon Hover */}
        {activePoint && (
          <div
            className="absolute z-30 bottom-full mb-1.5 px-2 py-1 bg-slate-900/95 text-white text-[10px] rounded-md shadow-lg pointer-events-none whitespace-nowrap transform -translate-x-1/2 transition-all font-sans"
            style={{
              left: `${activePoint.x + 4}px`,
            }}
          >
            <div className="flex items-center gap-1.5 font-bold font-mono">
              <span className="text-emerald-300">{activePoint.item.fullMonth}:</span>
              <span className="text-white">{activePoint.item.score.toFixed(1)}%</span>
            </div>
            <div className="text-[9px] text-slate-300 flex items-center justify-between gap-2 mt-0.5">
              <span>{activePoint.item.statusText}</span>
              <span className="font-mono">({activePoint.item.txCount} trx)</span>
            </div>
          </div>
        )}
      </div>

      {/* Month Labels underneath the Sparkline */}
      {showLabels && points.length > 0 && (
        <div 
          className="flex justify-between items-center text-[9px] font-mono font-semibold text-slate-500 mt-1 px-1"
          style={{ width: `${width}px` }}
        >
          {data.map((item, idx) => (
            <span 
              key={item.monthKey}
              className={`transition-colors ${
                hoveredIndex === idx 
                  ? 'text-emerald-700 font-bold' 
                  : idx === data.length - 1 
                  ? 'text-slate-800 font-bold' 
                  : 'text-slate-500'
              }`}
            >
              {item.shortMonth}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default DqiSparklineChart;
