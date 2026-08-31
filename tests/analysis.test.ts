import { describe, test, expect } from 'vitest'
import {
  analysisSchema,
  extractAnalysis,
  analyzePrompt,
  ANALYZE_PROMPT,
  MAX_NOTE_LENGTH,
} from '@/lib/analysis'

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

describe('analyzePrompt', () => {
  test('returns the bare instruction when there is no note', () => {
    expect(analyzePrompt()).toBe(ANALYZE_PROMPT)
    expect(analyzePrompt('')).toBe(ANALYZE_PROMPT)
    expect(analyzePrompt('   ')).toBe(ANALYZE_PROMPT)
    expect(analyzePrompt(null)).toBe(ANALYZE_PROMPT)
  })

  test("quotes the note as the user's description rather than as an instruction", () => {
    const prompt = analyzePrompt('protein shake with oat milk')
    expect(prompt).toContain('"protein shake with oat milk"')
    expect(prompt).toContain('Still estimate portions from the photo')
  })

  test('truncates an overlong note instead of sending it whole', () => {
    const prompt = analyzePrompt('x'.repeat(500))
    expect(prompt).toContain('x'.repeat(MAX_NOTE_LENGTH))
    expect(prompt).not.toContain('x'.repeat(MAX_NOTE_LENGTH + 1))
  })
})
