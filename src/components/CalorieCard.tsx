import { goalProgress } from '@/lib/nutrition'

export function CalorieCard({
  consumed,
  goal,
  label = "Today's calories",
}: {
  consumed: number
  goal: number
  label?: string
}) {
  const { pct, barPct, remaining, over } = goalProgress(consumed, goal)

  return (
    <section
      aria-label={label}
      className="relative overflow-hidden rounded-card bg-forest px-6 py-6 text-white"
    >
      {/* Depth, not decoration: an off-canvas ring keeps the card from reading as a flat swatch. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-14 size-48 rounded-full border-[18px] border-white/[0.07]"
      />

      <p className="text-[0.6875rem] font-semibold tracking-[0.14em] text-white/60 uppercase">
        {label}
      </p>

      <p className="mt-2.5 flex items-baseline gap-2">
        <span className="text-[2.75rem] leading-none font-bold tracking-tight tabular-nums">
          {consumed.toLocaleString()}
        </span>
        <span className="text-sm font-medium text-white/55">
          / {goal.toLocaleString()} kcal
        </span>
      </p>

      <div
        className="mt-5 h-2 overflow-hidden rounded-full bg-white/15"
        role="progressbar"
        aria-valuenow={barPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${pct}% of daily goal`}
      >
        <div
          className="h-full rounded-full bg-white transition-[width] duration-500 ease-out"
          style={{ width: `${barPct}%` }}
        />
      </div>

      <p className="mt-3 flex justify-between text-xs font-medium text-white/70">
        <span className="tabular-nums">{pct}% of goal</span>
        {/* Over goal is neutral information, not an alarm. */}
        <span className="tabular-nums">
          {over ? `${Math.abs(remaining).toLocaleString()} over` : `${remaining.toLocaleString()} left`}
        </span>
      </p>
    </section>
  )
}
