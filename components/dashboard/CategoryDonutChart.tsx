import React, { useState, useCallback, useMemo } from 'react';
import { 
  PieChart, 
  Pie, 
  Sector, 
  ResponsiveContainer, 
  Cell, 
  Tooltip 
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Coins, 
  ShoppingBag, 
  Info, 
  Layers, 
  ArrowUpRight, 
  ArrowDownLeft,
  Percent,
  Receipt,
  FileText
} from 'lucide-react';
import type { CategoryData } from '../../types';
import { formatCurrency } from '../../utils/formatter';

interface CategoryDonutChartProps {
  title: string;
  definition?: string;
  type?: 'revenue' | 'expense';
  data: CategoryData[];
  selectedYear?: number | 'all';
}

const REVENUE_COLORS = [
  '#059669', // Emerald
  '#0284c7', // Sky blue
  '#0d9488', // Teal
  '#d97706', // Amber
  '#7c3aed', // Violet
  '#2563eb', // Blue
  '#db2777', // Pink
  '#65a30d', // Lime
  '#0891b2', // Cyan
  '#9333ea'  // Purple
];

const EXPENSE_COLORS = [
  '#e11d48', // Rose red
  '#ea580c', // Orange
  '#d97706', // Amber
  '#7c3aed', // Purple
  '#0284c7', // Sky blue
  '#059669', // Emerald
  '#4f46e5', // Indigo
  '#db2777', // Pink
  '#0d9488', // Teal
  '#b45309'  // Brown-amber
];

const renderActiveShape = (props: any) => {
  const RADIAN = Math.PI / 180;
  const { 
    cx, 
    cy, 
    midAngle, 
    innerRadius, 
    outerRadius, 
    startAngle, 
    endAngle, 
    fill, 
    payload, 
    percent, 
    value 
  } = props;
  
  const sin = Math.sin(-RADIAN * midAngle);
  const cos = Math.cos(-RADIAN * midAngle);
  const sx = cx + (outerRadius + 6) * cos;
  const sy = cy + (outerRadius + 6) * sin;
  const mx = cx + (outerRadius + 18) * cos;
  const my = cy + (outerRadius + 18) * sin;
  const ex = mx + (cos >= 0 ? 1 : -1) * 12;
  const ey = my;
  const textAnchor = cos >= 0 ? 'start' : 'end';

  return (
    <g className="transition-all duration-300">
      {/* Outer Glow / Outline */}
      <Sector
        cx={cx}
        cy={cy}
        startAngle={startAngle}
        endAngle={endAngle}
        innerRadius={outerRadius + 4}
        outerRadius={outerRadius + 8}
        fill={fill}
        opacity={0.35}
        cornerRadius={4}
      />

      {/* Main Slice */}
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 2}
        outerRadius={outerRadius + 4}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        cornerRadius={6}
      />

      {/* Connector lines and label */}
      <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} strokeWidth={1.5} fill="none" />
      <circle cx={ex} cy={ey} r={3} fill={fill} stroke="#ffffff" strokeWidth={1} />
      
      <text 
        x={ex + (cos >= 0 ? 1 : -1) * 6} 
        y={ey} 
        dy={-4} 
        textAnchor={textAnchor} 
        fill="#0f172a" 
        fontSize={11} 
        fontWeight="800"
      >
        {payload.name}
      </text>
      <text 
        x={ex + (cos >= 0 ? 1 : -1) * 6} 
        y={ey} 
        dy={10} 
        textAnchor={textAnchor} 
        fill={fill} 
        fontSize={10} 
        fontWeight="bold"
        fontFamily="monospace"
      >
        {`${formatCurrency(value)} (${(percent * 100).toFixed(1)}%)`}
      </text>
    </g>
  );
};

const CategoryDonutChart: React.FC<CategoryDonutChartProps> = ({ 
  title, 
  definition, 
  type = 'revenue', 
  data = [], 
  selectedYear 
}) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const colors = type === 'revenue' ? REVENUE_COLORS : EXPENSE_COLORS;

  const totalValue = useMemo(() => {
    return data.reduce((acc, item) => acc + (Number(item.value) || 0), 0);
  }, [data]);

  const onPieEnter = useCallback((_: any, index: number) => {
    setActiveIndex(index);
  }, []);

  const onPieLeave = useCallback(() => {
    setActiveIndex(null);
  }, []);

  const activeItem = useMemo(() => {
    if (activeIndex !== null && data[activeIndex]) {
      return data[activeIndex];
    }
    return null;
  }, [activeIndex, data]);

  const topCategory = useMemo(() => {
    if (!data.length) return null;
    return [...data].sort((a, b) => b.value - a.value)[0];
  }, [data]);

  const isRevenue = type === 'revenue';

  return (
    <div className="bg-white rounded-2xl border border-slate-400 p-6 shadow-xl relative overflow-hidden transition-all text-slate-900">
      {/* Decorative ambient background */}
      <div 
        className={`absolute top-0 right-0 w-80 h-80 rounded-full blur-3xl pointer-events-none no-print ${
          isRevenue ? 'bg-emerald-500/5' : 'bg-rose-500/5'
        }`} 
      />

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-4 border-b-2 border-slate-300">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-xl border shrink-0 ${
            isRevenue 
              ? 'bg-emerald-50 border-emerald-300 text-emerald-700' 
              : 'bg-rose-50 border-rose-300 text-rose-700'
          }`}>
            {isRevenue ? <Coins size={24} /> : <ShoppingBag size={24} />}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-black tracking-wide text-slate-900 uppercase">
                {title}
              </h3>
              <span className={`text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                isRevenue 
                  ? 'bg-emerald-100 text-emerald-900 border-emerald-300' 
                  : 'bg-rose-100 text-rose-900 border-rose-300'
              }`}>
                {data.length} Kategori
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Visualisasi proporsi dan rincian alokasi nominal berdasarkan pos rekening pembukuan
            </p>
          </div>
        </div>

        {/* Quick KPI Badge */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <div className="bg-slate-100 border border-slate-300 px-3 py-1.5 rounded-xl font-mono text-xs text-right">
            <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">
              {isRevenue ? 'Total Pendapatan' : 'Total Realisasi Belanja'}
            </span>
            <span className={`font-black text-sm ${isRevenue ? 'text-emerald-800' : 'text-rose-800'}`}>
              {formatCurrency(totalValue)}
            </span>
          </div>
        </div>
      </div>

      {/* Definisi / Explanation Callout Box */}
      {definition && (
        <div className="mb-5 bg-slate-50 border border-slate-300 rounded-xl p-3.5 flex items-start gap-3">
          <div className="p-1.5 bg-white border border-slate-300 rounded-lg text-slate-700 shrink-0 mt-0.5 shadow-2xs">
            <Info size={16} />
          </div>
          <div className="text-xs leading-relaxed text-slate-700">
            <span className="font-bold text-slate-900 uppercase tracking-wide mr-1">Definisi &amp; Ketentuan:</span>
            {definition}
          </div>
        </div>
      )}

      {/* Main Content Area: Left = Category Grid, Right = Pie Chart */}
      {data.length === 0 || totalValue === 0 ? (
        <div className="p-10 bg-slate-50 border border-slate-300 rounded-xl text-center text-slate-500 text-xs italic">
          Belum ada catatan transaksi {isRevenue ? 'pendapatan' : 'belanja'} untuk periode yang dipilih.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* KOLOM KIRI: GRID KATEGORI PENDAPATAN / BELANJA (Span 7) */}
          <div className="lg:col-span-7 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Layers size={14} className={isRevenue ? 'text-emerald-600' : 'text-rose-600'} />
                Rincian Nominal Pos ({data.length} Kategori)
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                Arahkan kursor untuk menyorot bagan
              </span>
            </div>

            {/* Category Grid Items */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.map((cat, idx) => {
                const color = colors[idx % colors.length];
                const percent = totalValue > 0 ? (cat.value / totalValue) * 100 : 0;
                const isHovered = activeIndex === idx;

                return (
                  <div
                    key={cat.name || idx}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onMouseLeave={() => setActiveIndex(null)}
                    className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                      isHovered
                        ? 'bg-slate-100 border-slate-800 shadow-md ring-2 ring-slate-400 scale-[1.02]'
                        : 'bg-slate-50/80 border-slate-300 hover:border-slate-400 hover:bg-white shadow-2xs'
                    }`}
                  >
                    <div>
                      {/* Top row: Color pill, Code/Name, Percent badge */}
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span 
                            className="w-3 h-3 rounded-full shrink-0 shadow-xs" 
                            style={{ backgroundColor: color }}
                          />
                          <div className="min-w-0 flex-1">
                            <h5 className="text-xs font-black text-slate-900 leading-snug" title={cat.name}>
                              {cat.name}
                            </h5>
                            {cat.code && (
                              <span className="text-[10px] text-slate-500 font-mono block">
                                Akun: {cat.code}
                              </span>
                            )}
                          </div>
                        </div>

                        <span 
                          className="text-[10px] font-mono font-black px-2 py-0.5 rounded-full shrink-0 border"
                          style={{
                            backgroundColor: `${color}15`,
                            color: color,
                            borderColor: `${color}40`
                          }}
                        >
                          {percent.toFixed(1)}%
                        </span>
                      </div>

                      {/* Nominal Display */}
                      <div className="mt-2 flex items-baseline justify-between">
                        <span className="text-[11px] text-slate-600 font-medium">Nominal:</span>
                        <p className="text-sm font-black font-mono text-slate-900 tracking-tight">
                          {formatCurrency(cat.value)}
                        </p>
                      </div>

                      {/* Mini Proportional Progress Bar */}
                      <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2 overflow-hidden border border-slate-300">
                        <div 
                          className="h-full transition-all duration-300"
                          style={{ 
                            width: `${Math.min(100, Math.max(0, percent))}%`,
                            backgroundColor: color 
                          }}
                        />
                      </div>
                    </div>

                    {/* Footer Info if transaction count is available */}
                    {cat.count !== undefined && (
                      <div className="mt-2 pt-1.5 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                        <span>{cat.count} Transaksi</span>
                        <span className="font-semibold" style={{ color }}>{percent.toFixed(0)}% Porsi</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Quick Stat Summary Footer below grid */}
            {topCategory && (
              <div className="mt-4 p-3 bg-slate-100/70 border border-slate-300 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-700">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-900">Kontributor Terbesar:</span>
                  <span className="font-bold underline text-slate-900">{topCategory.name}</span>
                </div>
                <div>
                  <span className="font-black text-slate-900">{formatCurrency(topCategory.value)}</span>
                  <span className="text-slate-500 ml-1">
                    ({((topCategory.value / totalValue) * 100).toFixed(1)}%)
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* KOLOM KANAN: DONUT PIE CHART (Span 5) */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center bg-slate-50/70 p-4 rounded-xl border border-slate-300 relative">
            <div className="w-full flex items-center justify-between mb-1 px-2">
              <span className="text-[11px] font-mono font-bold text-slate-600 uppercase tracking-wider">
                Distribusi Persentase
              </span>
              <span className="text-[10px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-300">
                Interaktif
              </span>
            </div>

            <div className="w-full relative" style={{ height: 290 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  {/* @ts-ignore */}
                  <Pie
                    activeIndex={activeIndex !== null ? activeIndex : undefined}
                    activeShape={renderActiveShape}
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={95}
                    dataKey="value"
                    onMouseEnter={onPieEnter}
                    onMouseLeave={onPieLeave}
                    paddingAngle={3}
                    animationDuration={600}
                    stroke="#ffffff"
                    strokeWidth={2}
                  >
                    {data.map((_, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={colors[index % colors.length]} 
                        className="transition-all duration-200 cursor-pointer"
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>

              {/* Center Donut Label when no slice is hovered */}
              {activeIndex === null && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {isRevenue ? 'Pendapatan' : 'Belanja'}
                  </span>
                  <span className="text-xs font-mono font-black text-slate-900 leading-tight mt-0.5">
                    {formatCurrency(totalValue)}
                  </span>
                  <span className="text-[9px] font-mono text-slate-500 mt-0.5">
                    {data.length} Kategori
                  </span>
                </div>
              )}
            </div>

            {/* Donut Footer Helper */}
            <div className="mt-2 text-center text-[10px] font-mono text-slate-500">
              * Arahkan kursor atau klik potongan bagan untuk melihat nominal spesifik
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoryDonutChart;
