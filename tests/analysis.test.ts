import { describe, test, expect } from 'vitest'
import { analysisSchema, extractAnalysis } from '@/lib/analysis'

const ok = { items: [{ name: 'Toast', calories: 120 }] }

describe('analysisSchema', () => {
  test('accepts a minimal item and defaults the optional macros to null', () => {
    const parsed = analysisSchema.parse(ok)
    expect(parsed.items[0]).toMatchObject({ name: 'Toast', calories: 120, protein_g: null, unit: null })
  })

  test('rejects an empty items array — a meal with no food is not a meal', () => {
    expect(analysisSchema.safeParse({ items: [] }).success).toBe(false)
  })

  test('rejects negative calories', () => {
    expect(analysisSchema.safeParse({ items: [{ name: 'X', calories: -5 }] }).success).toBe(false)
  })

  test('rejects non-integer calories and absurd values', () => {
    expect(analysisSchema.safeParse({ items: [{ name: 'X', calories: 12.5 }] }).success).toBe(false)
    expect(analysisSchema.safeParse({ items: [{ name: 'X', calories: 99_999 }] }).success).toBe(false)
  })

  test('rejects a missing name and a missing items key', () => {
    expect(analysisSchema.safeParse({ items: [{ calories: 100 }] }).success).toBe(false)
    expect(analysisSchema.safeParse({}).success).toBe(false)
  })

  test('rejects a confidence outside 0..1', () => {
    expect(analysisSchema.safeParse({ items: [{ name: 'X', calories: 10, confidence: 1.5 }] }).success).toBe(false)
  })
})

const completion = (content: string | null) => ({ choices: [{ message: { content } }] }) as never

describe('extractAnalysis', () => {
  test('parses the structured JSON response', () => {
    expect(extractAnalysis(completion(JSON.stringify(ok)))).toEqual(ok)
  })

  test('digs the object out of a ```json fence, which models add unasked', () => {
    expect(extractAnalysis(completion('Sure! ```json\n' + JSON.stringify(ok) + '\n``` hope that helps'))).toEqual(ok)
  })

  test('throws when there is nothing parsable, so the route can retry rather than guess', () => {
    expect(() => extractAnalysis(completion('I cannot see any food.'))).toThrow()
  })

  test('throws when the model returned no content at all', () => {
    expect(() => extractAnalysis(completion(null))).toThrow()
  })

  test('throws when the provider returns no choices at all', () => {
    expect(() => extractAnalysis({ choices: [] } as never)).toThrow()
  })
})
