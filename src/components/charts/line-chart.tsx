"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { formatRupiah, formatRupiahCompact } from "@/lib/format/currency";

export interface ChartSeries {
  key: string;
  label: string;
  /** A CSS color, normally a `var(--color-series-n)` token. */
  color: string;
  values: number[];
}

interface LineChartProps {
  /** Accessible summary of what the chart shows. */
  description: string;
  /** X positions, e.g. ages. Every series has one value per entry. */
  x: number[];
  series: ChartSeries[];
  /**
   * Label for each x value in tooltips and the table, e.g. "Age 40". Plain
   * strings (not a formatter) so server components can pass them.
   */
  xLabels?: string[];
  xAxisLabel?: string;
  /** Light area wash under a single series. */
  area?: boolean;
  height?: number;
}

const MARGIN = { top: 20, bottom: 36, left: 76 };

/** Rounds up to 1, 2, 2.5 or 5 × 10^n so axis ticks are clean numbers. */
function niceStep(rough: number): number {
  if (rough <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(rough));
  const unit = rough / power;
  const nice = unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 2.5 ? 2.5 : unit <= 5 ? 5 : 10;
  return nice * power;
}

function pickXTicks(count: number, maxTicks: number): number[] {
  if (count <= maxTicks) return Array.from({ length: count }, (_, i) => i);
  const step = Math.ceil((count - 1) / (maxTicks - 1));
  const ticks: number[] = [];
  for (let i = 0; i < count - 1; i += step) ticks.push(i);
  // Always label the final point; drop a tick that would crowd it.
  if (count - 1 - ticks[ticks.length - 1] < step / 2) ticks.pop();
  ticks.push(count - 1);
  return ticks;
}

/**
 * Accessible SVG line chart: one y-axis, hairline grid, 2px lines, end
 * markers with a surface ring, a legend for 2+ series, a crosshair
 * tooltip (pointer or arrow keys) and a data-table fallback.
 */
export function LineChart({
  description,
  x,
  series,
  xLabels,
  xAxisLabel,
  area = false,
  height = 260,
}: LineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState<number | null>(null);
  const tableId = useId();

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const count = x.length;
  const showEndLabels = width >= 520;
  const right = showEndLabels ? 96 : 16;
  const plotWidth = width - MARGIN.left - right;
  const plotHeight = height - MARGIN.top - MARGIN.bottom;

  const maxValue = Math.max(0, ...series.flatMap((s) => s.values));
  const step = niceStep(maxValue / 4);
  const yMax = Math.max(step, Math.ceil(maxValue / step) * step);
  const yTicks = Array.from({ length: Math.round(yMax / step) + 1 }, (_, i) => i * step);

  const xPos = (i: number) => MARGIN.left + (count <= 1 ? plotWidth / 2 : (i / (count - 1)) * plotWidth);
  const yPos = (v: number) => MARGIN.top + plotHeight - (v / yMax) * plotHeight;
  const xTicks = pickXTicks(count, width < 480 ? 4 : 7);
  const last = count - 1;

  // End labels only when they cannot collide; otherwise legend + tooltip carry values.
  const endYs = series.map((s) => yPos(s.values[last]));
  const labelsFit = showEndLabels && endYs.every((y, i) => endYs.every((o, j) => i === j || Math.abs(y - o) >= 18));

  function indexFromPointer(event: PointerEvent<SVGRectElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - box.left) / box.width;
    return Math.min(last, Math.max(0, Math.round(ratio * last)));
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const delta = event.key === "ArrowRight" ? 1 : -1;
      setActive((i) => Math.min(last, Math.max(0, (i ?? last) + delta)));
    } else if (event.key === "Home") setActive(0);
    else if (event.key === "End") setActive(last);
    else if (event.key === "Escape") setActive(null);
  }

  const tooltipLeft = active === null ? 0 : Math.min(Math.max(xPos(active), 130), width - 130);

  return (
    <div>
      {series.length > 1 ? (
        <ul className="mb-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted" aria-label="Legend">
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-2">
              <span aria-hidden="true" className="h-0.5 w-4 rounded-full" style={{ background: s.color }} />
              {s.label}
            </li>
          ))}
        </ul>
      ) : null}

      <div
        ref={containerRef}
        className="relative rounded-lg outline-offset-4"
        tabIndex={0}
        role="group"
        aria-label={`${description} Use the left and right arrow keys to read values.`}
        aria-describedby={tableId}
        onKeyDown={onKeyDown}
        onFocus={() => setActive((i) => i ?? last)}
        onBlur={() => setActive(null)}
      >
        {/* viewBox scales the first render until the real width is measured. */}
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={description}
          className="block h-auto w-full overflow-visible"
        >
          {yTicks.map((tick) => (
            <g key={tick}>
              <line
                x1={MARGIN.left}
                x2={MARGIN.left + plotWidth}
                y1={yPos(tick)}
                y2={yPos(tick)}
                className="stroke-line"
                strokeWidth={1}
              />
              <text
                x={MARGIN.left - 8}
                y={yPos(tick)}
                dy="0.32em"
                textAnchor="end"
                className="fill-muted text-[11px] tabular-nums"
              >
                {tick === 0 ? "Rp 0" : formatRupiahCompact(tick)}
              </text>
            </g>
          ))}

          {xTicks.map((i) => (
            <text
              key={i}
              x={xPos(i)}
              y={MARGIN.top + plotHeight + 18}
              textAnchor="middle"
              className="fill-muted text-[11px] tabular-nums"
            >
              {x[i]}
            </text>
          ))}
          {xAxisLabel ? (
            <text
              x={MARGIN.left + plotWidth}
              y={height - 2}
              textAnchor="end"
              className="fill-muted text-[11px]"
            >
              {xAxisLabel}
            </text>
          ) : null}

          {series.map((s) => {
            const points = s.values.map((v, i) => `${xPos(i)},${yPos(v)}`);
            return (
              <g key={s.key}>
                {area && series.length === 1 ? (
                  <path
                    d={`M${xPos(0)},${yPos(0)} L${points.join(" L")} L${xPos(last)},${yPos(0)} Z`}
                    fill={s.color}
                    fillOpacity={0.1}
                  />
                ) : null}
                <path
                  d={`M${points.join(" L")}`}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                <circle cx={xPos(last)} cy={yPos(s.values[last])} r={4} fill={s.color} stroke="white" strokeWidth={2} />
                {labelsFit ? (
                  <text
                    x={xPos(last) + 10}
                    y={yPos(s.values[last])}
                    dy="0.32em"
                    className="fill-ink text-[11px] font-semibold tabular-nums"
                  >
                    {formatRupiahCompact(s.values[last])}
                  </text>
                ) : null}
              </g>
            );
          })}

          {active !== null ? (
            <g aria-hidden="true">
              <line
                x1={xPos(active)}
                x2={xPos(active)}
                y1={MARGIN.top}
                y2={MARGIN.top + plotHeight}
                className="stroke-muted"
                strokeWidth={1}
              />
              {series.map((s) => (
                <circle
                  key={s.key}
                  cx={xPos(active)}
                  cy={yPos(s.values[active])}
                  r={4.5}
                  fill={s.color}
                  stroke="white"
                  strokeWidth={2}
                />
              ))}
            </g>
          ) : null}

          {/* Hit area covers the whole plot so the reader aims at an x, not a 2px line. */}
          <rect
            x={MARGIN.left}
            y={MARGIN.top}
            width={Math.max(plotWidth, 1)}
            height={plotHeight}
            fill="transparent"
            onPointerMove={(event) => setActive(indexFromPointer(event))}
            onPointerDown={(event) => setActive(indexFromPointer(event))}
            onPointerLeave={() => setActive(null)}
          />
        </svg>

        {active !== null ? (
          <div
            role="presentation"
            className="pointer-events-none absolute top-0 z-10 w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-lg border border-line bg-surface px-3 py-2 text-xs whitespace-nowrap shadow-lg"
            style={{ left: tooltipLeft }}
          >
            <p className="font-medium text-muted">{xLabels?.[active] ?? x[active]}</p>
            <ul className="mt-1.5 space-y-1">
              {series.map((s) => (
                <li key={s.key} className="flex items-center gap-2">
                  <span aria-hidden="true" className="h-0.5 w-3 rounded-full" style={{ background: s.color }} />
                  <span className="font-semibold text-ink tabular-nums">{formatRupiah(s.values[active])}</span>
                  <span className="text-muted">{s.label}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-xs font-medium text-brand-700 hover:underline">
          Show data table
        </summary>
        <div className="mt-2 max-h-72 overflow-auto rounded-lg border border-line">
          <table id={tableId} className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-canvas">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  {xAxisLabel ?? "Point"}
                </th>
                {series.map((s) => (
                  <th key={s.key} scope="col" className="px-3 py-2 text-right font-medium">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {x.map((value, i) => (
                <tr key={value}>
                  <th scope="row" className="px-3 py-1.5 font-normal text-muted">
                    {xLabels?.[i] ?? value}
                  </th>
                  {series.map((s) => (
                    <td key={s.key} className="px-3 py-1.5 text-right tabular-nums">
                      {formatRupiah(s.values[i])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
