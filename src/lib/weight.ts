import { supabaseServer } from './supabase-server'

export type WeightPoint = { local_date: string; weight_kg: number }

/**
 * Trailing average over the last `window` readings, defined from the very first
 * point so a new account still gets a line. Daily weight is mostly water, so the
 * raw series is noise with a signal in it -- the average is the signal.
 */
export function trailingAverage(values: number[], window = 7): number[] {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1)
    return slice.reduce((a, b) => a + b, 0) / slice.length
  })
}

export type WeightProgress = {
  /** Signed change since the first reading. Negative means weight lost. */
  changed: number
  /** Signed distance still to go. Null when no target is set. */
  remaining: number | null
  /** 0-100 toward the target, or null without one. Never negative. */
  pct: number | null
}

/**
 * Progress from the first recorded weight toward the target. Direction-agnostic:
 * gaining toward a higher target reads the same as losing toward a lower one.
 * Moving the wrong way floors at zero rather than going negative.
 */
export function weightProgress(
  first: number,
  latest: number,
  target: number | null,
): WeightProgress {
  const changed = latest - first
  if (target === null) return { changed, remaining: null, pct: null }

  const total = target - first
  const remaining = target - latest
  // Already at the target when set: nothing to travel, so it is done.
  if (total === 0) return { changed, remaining, pct: 100 }

  const pct = Math.round(Math.max(0, Math.min(100, (changed / total) * 100)))
  return { changed, remaining, pct }
}

/** Readings in a date window, oldest first, so a chart can walk them left to right. */
export async function loadWeights(from: string, to: string): Promise<WeightPoint[]> {
  const supabase = await supabaseServer()
  const { data } = await supabase
    .from('weights')
    .select('local_date, weight_kg')
    .gte('local_date', from)
    .lte('local_date', to)
    .order('local_date', { ascending: true })

  // numeric comes back as a string from PostgREST; the chart needs numbers.
  return (data ?? []).map((r) => ({
    local_date: r.local_date as string,
    weight_kg: Number(r.weight_kg),
  }))
}
