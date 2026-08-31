const MACROS = [
  { key: 'protein_g', label: 'Protein' },
  { key: 'carbs_g', label: 'Carbs' },
  { key: 'fat_g', label: 'Fat' },
] as const

export function MacroTiles({
  totals,
  goals,
}: {
  totals: { protein_g: number; carbs_g: number; fat_g: number }
  goals: { protein_goal_g: number | null; carbs_goal_g: number | null; fat_goal_g: number | null }
}) {
  const goalFor = { protein_g: goals.protein_goal_g, carbs_g: goals.carbs_goal_g, fat_g: goals.fat_goal_g }

  return (
    <ul className="grid grid-cols-3 gap-2.5">
      {MACROS.map(({ key, label }) => {
        const value = Math.round(totals[key])
        const goal = goalFor[key]
        const pct = goal ? Math.min(100, Math.round((value / goal) * 100)) : null

        return (
          <li key={key} className="rounded-tile border border-hairline bg-paper px-3.5 py-3">
            <p className="text-lg font-bold tracking-tight text-ink tabular-nums">{value}g</p>
            <p className="mt-0.5 text-xs text-muted">{label}</p>
            {/* A macro with no goal shows consumption only — no empty bar to decode. */}
            {pct !== null && (
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-cream">
                <div className="h-full rounded-full bg-moss" style={{ width: `${pct}%` }} />
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
