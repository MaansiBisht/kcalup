import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, test } from 'vitest'
import { analysisSchema, extractAnalysis, ANALYZE_RESPONSE_FORMAT, ANALYZE_PROMPT } from '@/lib/analysis'
import { sumItems } from '@/lib/nutrition'
import { chatCompletion } from '@/lib/ai'
import { mapLimit, withRetry, type FailureReason } from './eval-helpers'

/**
 * Model selection, not a regression gate -- that is accuracy.eval.test.ts.
 * This runs every candidate over the whole fixture set and writes the numbers
 * the model choice is defended with:
 *
 *   AI_API_KEY=... npm run eval:models
 *   EVAL_MODELS=a,b npm run eval:models   (override the candidates)
 */
const FIXTURES = join(import.meta.dirname, 'fixtures')
const MANIFEST = join(FIXTURES, 'cases.json')

type Case = { image: string; kcal: number; grams: number; dish_id: string; expect?: string[] }

const manifest = existsSync(MANIFEST)
  ? (JSON.parse(readFileSync(MANIFEST, 'utf8')) as { source: string; url: string; cases: Case[] })
  : { source: '', url: '', cases: [] }

const CASES = manifest.cases.filter((c) => existsSync(join(FIXTURES, c.image)))

const MODELS = (process.env.EVAL_MODELS ?? 'gemini-3.1-flash-lite,gemini-3.5-flash,gemini-3-flash-preview')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean)

const LIVE = Boolean(process.env.AI_API_KEY) && CASES.length > 0

const CONCURRENCY = Number(process.env.EVAL_CONCURRENCY ?? 2)

type Outcome = { kcal: number | null; ms: number; reason?: FailureReason }

async function estimate(model: string, c: Case): Promise<Outcome> {
  const data = readFileSync(join(FIXTURES, c.image)).toString('base64')
  const started = Date.now()

  const attempt = await withRetry(() =>
    chatCompletion({
      model,
      max_tokens: 1500,
      response_format: ANALYZE_RESPONSE_FORMAT,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${data}` } },
            { type: 'text', text: ANALYZE_PROMPT },
          ],
        },
      ],
    }),
  )

  if ('failed' in attempt) return { kcal: null, ms: Date.now() - started, reason: attempt.failed }

  const parsed = analysisSchema.safeParse(extractAnalysis(attempt.value))
  // A schema failure is an accuracy failure: the user sees nothing either way.
  if (!parsed.success) return { kcal: null, ms: Date.now() - started, reason: 'schema' }
  return { kcal: sumItems(parsed.data.items).calories, ms: Date.now() - started }
}

const quantile = (sorted: number[], q: number) =>
  sorted.length === 0 ? NaN : sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))]

describe.skipIf(!LIVE)('model comparison', () => {
  test(
    'measures every candidate over the whole fixture set',
    { timeout: 90 * 60_000 },
    async () => {
      const rows = []

      for (const model of MODELS) {
        const results = await mapLimit(CASES, CONCURRENCY, (c) => estimate(model, c))

        const scored = results
          .map((r, i) => ({ ...r, truth: CASES[i].kcal }))
          .filter((r): r is { kcal: number; ms: number; truth: number } => r.kcal !== null)

        const throttled = results.filter((r) => r.reason === 'throttled').length
        const schemaFailed = results.filter((r) => r.reason === 'schema').length
        const errored = results.filter((r) => r.reason === 'error').length
        // Signed first: a model that is always low is worse than one that is
        // noisy, because the error compounds in one direction every day.
        const signed = scored.map((r) => ((r.kcal - r.truth) / r.truth) * 100).sort((a, b) => a - b)
        const abs = signed.map(Math.abs).sort((a, b) => a - b)
        const within = (pct: number) => (abs.filter((e) => e <= pct).length / abs.length) * 100

        rows.push({
          model,
          n: scored.length,
          // Schema failures count against the model: the user sees nothing
          // either way. Throttling counts against us and invalidates the row.
          'schema fail': schemaFailed,
          throttled,
          errored,
          'median err %': Math.round(quantile(abs, 0.5)),
          'p90 err %': Math.round(quantile(abs, 0.9)),
          'worst err %': Math.round(abs[abs.length - 1] ?? NaN),
          'bias %': Math.round(quantile(signed, 0.5)),
          'within 25%': Math.round(within(25)),
          'within 50%': Math.round(within(50)),
          'median s': Number((quantile(scored.map((r) => r.ms).sort((a, b) => a - b), 0.5) / 1000).toFixed(1)),
          // A row measured on a starved sample is not comparable to a full one.
          usable: scored.length >= CASES.length * 0.8 ? 'yes' : 'NO — starved',
        })
        console.table(rows)

        writeFileSync(
          join(FIXTURES, 'benchmark.json'),
          JSON.stringify(
            {
              measured: new Date().toISOString().slice(0, 10),
              plates: CASES.length,
              source: manifest.source,
              url: manifest.url,
              concurrency: CONCURRENCY,
              results: rows,
            },
            null,
            2,
          ) + '\n',
        )
      }
    },
  )
})
