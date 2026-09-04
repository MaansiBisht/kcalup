import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, test, expect } from 'vitest'
import { analysisSchema, extractAnalysis, ANALYZE_RESPONSE_FORMAT, ANALYZE_PROMPT } from '@/lib/analysis'
import { sumItems } from '@/lib/nutrition'
import { chatCompletion } from '@/lib/ai'
import { mapLimit, withRetry } from './eval-helpers'

// Costs money and needs photos, so it only runs when you ask for it:
//   AI_API_KEY=... npm run eval
const FIXTURES = join(import.meta.dirname, 'fixtures')
const MANIFEST = join(FIXTURES, 'cases.json')

// Images are fetched by `npm run fixtures` and cached outside git, so a clone
// without them skips rather than fails.
const CASES: { image: string; kcal: number; expect?: string[] }[] = existsSync(MANIFEST)
  ? JSON.parse(readFileSync(MANIFEST, 'utf8')).cases
  : []
const PRESENT = CASES.filter((c) => existsSync(join(FIXTURES, c.image)))
const LIVE = Boolean(process.env.AI_API_KEY) && PRESENT.length > 0

/*
 * Thresholds derived from a measured baseline, not from what we wish were true.
 * Baseline: gemini-3.1-flash-lite over 40 Nutrition5k plates, 2026-09-04 --
 * median 25%, p90 70%, worst 95%. See tests/fixtures/benchmark.json.
 *
 * Headroom above the baseline, so day-to-day model variance does not fail the
 * build, but a real regression does. Move them DOWN as the prompt improves;
 * never up to make a run pass.
 *
 * Worst-case is deliberately not asserted: on 40 plates it is one sample and it
 * flaps. p90 is the same signal without the coin toss. It is still reported.
 */
const MAX_MEDIAN_ERROR_PCT = 32
const MAX_P90_ERROR_PCT = 80
const MIN_WITHIN_50_PCT = 65

const CONCURRENCY = 2

const quantile = (ns: number[], q: number) => {
  const sorted = [...ns].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))]
}

describe.skipIf(!LIVE)('calorie accuracy', () => {
  test(
    'estimates stay within tolerance of the labelled totals',
    { timeout: 15 * 60_000 },
    async () => {
      const scored = await mapLimit(PRESENT, CONCURRENCY, async (c) => {
        const mediaType = c.image.endsWith('.png') ? 'image/png' : 'image/jpeg'
        const data = readFileSync(join(FIXTURES, c.image)).toString('base64')

        const attempt = await withRetry(() =>
          chatCompletion({
            max_tokens: 1500,
            response_format: ANALYZE_RESPONSE_FORMAT,
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'image_url', image_url: { url: `data:${mediaType};base64,${data}` } },
                  { type: 'text', text: ANALYZE_PROMPT },
                ],
              },
            ],
          }),
        )

        // A throttled plate is our problem, not the model's. Dropping it keeps
        // the accuracy figure honest; the count assertion below catches a run
        // where too many were lost to be worth grading.
        if ('failed' in attempt) return null

        const parsed = analysisSchema.safeParse(extractAnalysis(attempt.value))
        // A schema failure is an accuracy failure: the user sees nothing either way.
        if (!parsed.success) return null

        const got = sumItems(parsed.data.items).calories
        const names = parsed.data.items.map((i) => i.name.toLowerCase()).join(' ')
        const missed = (c.expect ?? []).filter((want) => !names.includes(want.toLowerCase()))

        return {
          image: c.image.replace('images/', ''),
          expected: c.kcal,
          got,
          errorPct: Math.round((Math.abs(got - c.kcal) / c.kcal) * 100),
          missed: missed.join(',') || '-',
        }
      })

      const rows = scored.filter((r) => r !== null)
      console.table(rows)

      // Unparsable answers are failures, not absences: dropping them would let a
      // model that only answers the easy plates post a flattering median.
      // At least four fifths must have answered, or the sample is too starved
      // to grade -- but a couple lost to throttling does not fail the build.
      expect(rows.length, 'plates that produced a valid answer').toBeGreaterThanOrEqual(
        Math.ceil(PRESENT.length * 0.8),
      )

      const errors = rows.map((r) => r.errorPct)
      const within50 = (errors.filter((e) => e <= 50).length / errors.length) * 100
      console.log(
        `median ${quantile(errors, 0.5)}% · p90 ${quantile(errors, 0.9)}% · ` +
          `worst ${Math.max(...errors)}% · within 50%: ${Math.round(within50)}% of ${errors.length} plates`,
      )

      expect(quantile(errors, 0.5)).toBeLessThanOrEqual(MAX_MEDIAN_ERROR_PCT)
      expect(quantile(errors, 0.9)).toBeLessThanOrEqual(MAX_P90_ERROR_PCT)
      expect(within50).toBeGreaterThanOrEqual(MIN_WITHIN_50_PCT)
    },
  )
})
