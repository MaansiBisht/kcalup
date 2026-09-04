import { trailingAverage, weightProgress, type WeightPoint } from '@/lib/weight'
import { formatFullDate } from '@/lib/date'

/* Geometry. A fixed viewBox scaled to the container; strokes are pinned to real
   pixels with non-scaling-stroke so a 2px line stays 2px at any width. */
const W = 320
const H = 148
const PAD = { top: 14, right: 46, bottom: 20, left: 34 }
const PLOT = {
  x0: PAD.left,
  x1: W - PAD.right,
  y0: PAD.top,
  y1: H - PAD.bottom,
}

/** Marks carry the series colour; text never does. Mirrors the CSS tokens. */
const MOSS = '#3d6b4a'
const HAIRLINE = '#e9e6dd'
const MUTED = '#8b8b80'
const PAPER = '#ffffff'

const kg = (n: number) => `${n.toFixed(1)} kg`

/** "15 Aug" — short enough for an 8px axis label. */
const shortDay = (isoDate: string) => {
  const [yr, mo, dy] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(yr, mo - 1, dy)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

export function WeightTrend({
  points,
  target,
}: {
  points: WeightPoint[]
  target: number | null
}) {
  if (points.length === 0) {
    return (
      <p className="rounded-tile border border-dashed border-hairline px-4 py-8 text-center text-sm text-muted">
        No weigh-ins yet. Record one above and the trend starts here.
      </p>
    )
  }

  const raw = points.map((p) => p.weight_kg)
  const trend = trailingAverage(raw)
  const latest = raw[raw.length - 1]
  const progress = weightProgress(raw[0], latest, target)

  // Domain covers the readings, the trend and the target, then breathes a little.
  const candidates = [...raw, ...trend, ...(target !== null ? [target] : [])]
  const lo = Math.min(...candidates)
  const hi = Math.max(...candidates)
  // Snapped to whole kilos, with an even span, so all three ticks are exact
  // integers. Rounding only the label would print "86" beside a line at 85.55.
  const pad = Math.max(0.5, (hi - lo) * 0.15)
  const min = Math.floor(lo - pad)
  const rawMax = Math.ceil(hi + pad)
  const max = (rawMax - min) % 2 === 0 ? rawMax : rawMax + 1

  const x = (i: number) =>
    points.length === 1 ? (PLOT.x0 + PLOT.x1) / 2 : PLOT.x0 + (i / (points.length - 1)) * (PLOT.x1 - PLOT.x0)
  const y = (v: number) => PLOT.y1 - ((v - min) / (max - min)) * (PLOT.y1 - PLOT.y0)

  const line = trend.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')

  // Three clean ticks. They carry every value that is not directly labelled.
  const ticks = [max, (max + min) / 2, min]
  const endX = x(trend.length - 1)
  const endY = y(trend[trend.length - 1])

  return (
    <figure className="m-0 space-y-3">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full"
        role="img"
        aria-label={`Weight trend over ${points.length} weigh-ins, latest ${kg(latest)}${
          target !== null ? `, target ${kg(target)}` : ''
        }`}
      >
        {/* Gridlines: hairline, solid, recessive. Never dashed. */}
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PLOT.x0}
              x2={PLOT.x1}
              y1={y(t)}
              y2={y(t)}
              stroke={HAIRLINE}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            <text x={PLOT.x0 - 6} y={y(t) + 3} textAnchor="end" fontSize={8} fill={MUTED}>
              {t.toFixed(0)}
            </text>
          </g>
        ))}

        {/* Target: a reference line, not a series. Dashed and labelled so it can
            never be mistaken for data, which is also what separates it from the
            trend without leaning on colour alone. */}
        {target !== null && target > min && target < max && (
          <g>
            <line
              x1={PLOT.x0}
              x2={PLOT.x1}
              y1={y(target)}
              y2={y(target)}
              stroke={MUTED}
              strokeWidth={1}
              strokeDasharray="4 3"
              vectorEffect="non-scaling-stroke"
            />
            <text x={PLOT.x0 + 3} y={y(target) - 4} fontSize={8} fill={MUTED}>
              target {target.toFixed(0)}
            </text>
          </g>
        )}

        {/* No area fill: weight has no meaningful zero, so shading down to the
            axis floor would encode an arbitrary height as if it were magnitude. */}
        <path
          d={line}
          fill="none"
          stroke={MOSS}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* Every reading gets a native tooltip -- the hover layer with no JS. */}
        {points.map((p, i) => (
          <circle key={p.local_date} cx={x(i)} cy={y(p.weight_kg)} r={5} fill="transparent">
            <title>{`${formatFullDate(p.local_date)}: ${kg(p.weight_kg)}`}</title>
          </circle>
        ))}

        {/* Only the ends of the span are labelled; the tooltip carries the rest. */}
        {points.length > 1 && (
          <>
            <text x={PLOT.x0} y={H - 6} fontSize={8} fill={MUTED}>
              {shortDay(points[0].local_date)}
            </text>
            <text x={PLOT.x1} y={H - 6} textAnchor="end" fontSize={8} fill={MUTED}>
              {shortDay(points[points.length - 1].local_date)}
            </text>
          </>
        )}

        {/* End marker: 8px across, ringed in the surface colour so it stays
            legible where it sits on the line. Labelled, because it is the value
            the reader came for. */}
        <circle cx={endX} cy={endY} r={4} fill={MOSS} stroke={PAPER} strokeWidth={2} />
        <text x={endX + 8} y={endY + 3} fontSize={9} fontWeight={600} fill="#14150f">
          {latest.toFixed(1)}
        </text>
      </svg>

      <figcaption className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
        <span>
          {/* Only claim smoothing once there is something to smooth. */}
          {points.length} weigh-in{points.length === 1 ? '' : 's'}
          {points.length >= 3 ? ', trend smoothed over 7 days' : ''}
        </span>
        <span>
          {progress.changed === 0
            ? 'No change since your first'
            : `${progress.changed > 0 ? '+' : ''}${progress.changed.toFixed(1)} kg since your first`}
        </span>
      </figcaption>

      {target !== null && progress.pct !== null && (
        <div className="rounded-tile bg-cream px-3.5 py-3">
          <p className="flex items-baseline justify-between text-xs">
            <span className="font-medium text-ink">Progress to {kg(target)}</span>
            <span className="font-semibold text-ink tabular-nums">{progress.pct}%</span>
          </p>
          <span className="mt-2 block h-1 w-full overflow-hidden rounded-full bg-hairline">
            <span className="block h-full rounded-full bg-moss" style={{ width: `${progress.pct}%` }} />
          </span>
          <p className="mt-2 text-[0.6875rem] text-muted tabular-nums">
            {Math.abs(progress.remaining ?? 0) < 0.05
              ? 'You are there.'
              : `${Math.abs(progress.remaining ?? 0).toFixed(1)} kg to go`}
          </p>
        </div>
      )}
    </figure>
  )
}
