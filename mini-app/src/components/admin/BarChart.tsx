interface BarChartProps {
  data: Array<{ label: string; value: number }>;
  height?: number;
  color?: string;
  budgetLine?: number;
  formatValue?: (v: number) => string;
}

export function BarChart({
  data,
  height = 120,
  color = 'var(--hs-accent)',
  budgetLine,
  formatValue,
}: BarChartProps) {
  if (data.length === 0) {
    return (
      <div
        style={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--tg-theme-hint-color, #999)',
          fontSize: 'var(--hs-font-size-small)',
        }}
      >
        No data
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.value), budgetLine ?? 0);
  const safeMax = maxValue > 0 ? maxValue : 1;

  // Layout constants
  const paddingTop = 20;
  const paddingBottom = 18;
  const paddingLeft = 4;
  const paddingRight = 4;
  const barGap = 2;

  const viewBoxWidth = 300;
  const viewBoxHeight = height;

  const chartWidth = viewBoxWidth - paddingLeft - paddingRight;
  const chartHeight = viewBoxHeight - paddingTop - paddingBottom;

  const barWidth = Math.max(
    2,
    (chartWidth - barGap * (data.length - 1)) / data.length,
  );

  // Skip labels if too many data points
  const skipLabels = data.length > 14;

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block' }}
    >
      {/* Max value label */}
      <text
        x={paddingLeft}
        y={paddingTop - 6}
        fontSize="9"
        fill="var(--tg-theme-hint-color, #999)"
      >
        {formatValue ? formatValue(safeMax) : safeMax.toLocaleString()}
      </text>

      {/* Bars */}
      {data.map((d, i) => {
        const barHeight = (d.value / safeMax) * chartHeight;
        const x = paddingLeft + i * (barWidth + barGap);
        const y = paddingTop + chartHeight - barHeight;

        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(barHeight, 0.5)}
              rx={2}
              ry={2}
              fill={color}
              opacity={0.85}
            />
            {/* X-axis label */}
            {(!skipLabels || i % 2 === 0) && (
              <text
                x={x + barWidth / 2}
                y={viewBoxHeight - 2}
                fontSize="7"
                fill="var(--tg-theme-hint-color, #999)"
                textAnchor="middle"
              >
                {d.label}
              </text>
            )}
          </g>
        );
      })}

      {/* Budget line */}
      {budgetLine != null && budgetLine > 0 && (
        <g>
          <line
            x1={paddingLeft}
            y1={paddingTop + chartHeight - (budgetLine / safeMax) * chartHeight}
            x2={viewBoxWidth - paddingRight}
            y2={paddingTop + chartHeight - (budgetLine / safeMax) * chartHeight}
            stroke="var(--tg-theme-destructive-text-color, #e53935)"
            strokeWidth="1"
            strokeDasharray="4 3"
            opacity={0.7}
          />
          <text
            x={viewBoxWidth - paddingRight}
            y={
              paddingTop +
              chartHeight -
              (budgetLine / safeMax) * chartHeight -
              3
            }
            fontSize="7"
            fill="var(--tg-theme-destructive-text-color, #e53935)"
            textAnchor="end"
            opacity={0.8}
          >
            budget
          </text>
        </g>
      )}
    </svg>
  );
}
