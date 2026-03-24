"use client";

import type { FC } from "react";

interface TrendPoint {
  date: string;
  score: number;
}

interface ArchTrendChartProps {
  points: TrendPoint[];
  windowLabel: string;
}

export const ArchTrendChart: FC<ArchTrendChartProps> = ({
  points,
  windowLabel,
}) => {
  if (points.length === 0) {
    return (
      <section className="bg-obsidian rounded-lg border border-steel-gray p-6">
        <h2 className="text-xl font-bold text-white mb-2">Trend</h2>
        <p className="text-sm text-cool-ash">
          Once daily snapshots exist, Arch will plot 7/30/90 day trends here.
        </p>
      </section>
    );
  }

  const width = 600;
  const height = 200;
  const paddingX = 24;
  const paddingY = 16;

  const xs = points.map((_, idx) => idx);
  const ys = points.map((p) => p.score);

  const minX = 0;
  const maxX = xs.length > 1 ? xs.length - 1 : 1;
  const minY = 0;
  const maxY = 100;

  const scaleX = (x: number) =>
    paddingX +
    ((x - minX) / (maxX - minX || 1)) * (width - paddingX * 2);
  const scaleY = (y: number) =>
    height - paddingY - ((y - minY) / (maxY - minY || 1)) * (height - paddingY * 2);

  const pathD = points
    .map((p, idx) => {
      const x = scaleX(idx);
      const y = scaleY(p.score);
      return `${idx === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  return (
    <section className="bg-obsidian rounded-lg border border-steel-gray p-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-bold text-white">Trend</h2>
        <span className="text-xs text-gray-400">{windowLabel}</span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-48 mt-2 text-emerald-400"
      >
        <defs>
          <linearGradient id="archTrendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4ade80" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g>
          <line
            x1={paddingX}
            y1={scaleY(80)}
            x2={width - paddingX}
            y2={scaleY(80)}
            stroke="#22c55e"
            strokeDasharray="4 4"
            strokeWidth={0.5}
          />
          <line
            x1={paddingX}
            y1={scaleY(60)}
            x2={width - paddingX}
            y2={scaleY(60)}
            stroke="#eab308"
            strokeDasharray="4 4"
            strokeWidth={0.5}
          />
          <line
            x1={paddingX}
            y1={scaleY(40)}
            x2={width - paddingX}
            y2={scaleY(40)}
            stroke="#fb923c"
            strokeDasharray="4 4"
            strokeWidth={0.5}
          />
        </g>

        <path
          d={pathD}
          fill="none"
          stroke="#4ade80"
          strokeWidth={2}
          strokeLinecap="round"
        />

        <path
          d={`${pathD} L ${scaleX(maxX)} ${scaleY(0)} L ${scaleX(0)} ${scaleY(0)} Z`}
          fill="url(#archTrendFill)"
        />

        {points.map((p, idx) => (
          <g key={p.date}>
            <circle
              cx={scaleX(idx)}
              cy={scaleY(p.score)}
              r={3}
              className="fill-emerald-400"
            />
          </g>
        ))}
      </svg>
    </section>
  );
};

