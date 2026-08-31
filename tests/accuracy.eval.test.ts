import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, test, expect } from 'vitest'
import { analysisSchema, extractAnalysis, ANALYZE_RESPONSE_FORMAT, ANALYZE_PROMPT } from '@/lib/analysis'
import { sumItems } from '@/lib/nutrition'
import { chatCompletion } from '@/lib/ai'

// Costs money and needs photos, so it only runs when you ask for it:
//   AI_API_KEY=... npm run eval
const FIXTURES = join(import.meta.dirname, 'fixtures')
const CASES: { image: string; kcal: number; expect?: string[] }[] = JSON.parse(
  readFileSync(join(FIXTURES, 'cases.json'), 'utf8'),
)
const LIVE = Boolean(process.env.AI_API_KEY) && CASES.every((c) => existsSync(join(FIXTURES, c.image)))

// Grading thresholds. Move them down as the prompt improves; never up to make a run pass.
const MAX_MEDIAN_ERROR_PCT = 25
const MAX_WORST_ERROR_PCT = 60

const median = (ns: number[]) => [...ns].sort((a, b) => a - b)[Math.floor(ns.length / 2)]

describe.skipIf(!LIVE)('calorie accuracy', () => {
  test(
    'estimates stay within tolerance of the labelled totals',
    { timeout: 120_000 },
    async () => {
      const rows = []

      for (const c of CASES) {
        const mediaType = c.image.endsWith('.png') ? 'image/png' : 'image/jpeg'
        const data = readFileSync(join(FIXTURES, c.image)).toString('base64')

        const response = await chatCompletion({
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
        })

        const parsed = analysisSchema.safeParse(extractAnalysis(response))
        // A schema failure is an accuracy failure: the user sees nothing either way.
        expect(parsed.success, `${c.image} failed validation`).toBe(true)
        if (!parsed.success) continue

        const got = sumItems(parsed.data.items).calories
        const names = parsed.data.items.map((i) => i.name.toLowerCase()).join(' ')
        const missed = (c.expect ?? []).filter((want) => !names.includes(want.toLowerCase()))

        rows.push({
          image: c.image,
          expected: c.kcal,
          got,
          errorPct: Math.round((Math.abs(got - c.kcal) / c.kcal) * 100),
          missed: missed.join(',') || '-',
        })
      }

      console.table(rows)
      const errors = rows.map((r) => r.errorPct)
      expect(median(errors)).toBeLessThanOrEqual(MAX_MEDIAN_ERROR_PCT)
      expect(Math.max(...errors)).toBeLessThanOrEqual(MAX_WORST_ERROR_PCT)
    },
  )
})
