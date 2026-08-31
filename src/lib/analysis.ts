import { z } from 'zod'
import type { ChatCompletion } from './ai'

/** One recognised food on the plate. Macros are optional — models omit them. */
const foodItemSchema = z.object({
  name: z.string().min(1).max(120),
  quantity: z.number().nonnegative().nullable().default(null),
  unit: z.string().max(32).nullable().default(null),
  calories: z.number().int().min(0).max(10_000),
  protein_g: z.number().min(0).max(2_000).nullable().default(null),
  carbs_g: z.number().min(0).max(2_000).nullable().default(null),
  fat_g: z.number().min(0).max(2_000).nullable().default(null),
  confidence: z.number().min(0).max(1).nullable().default(null),
})

export const analysisSchema = z.object({
  items: z.array(foodItemSchema).min(1).max(20),
})

export type FoodItem = z.infer<typeof foodItemSchema>
export type Analysis = z.infer<typeof analysisSchema>

/** Structured output, not a tool call: json_schema is enforced, a tool is only suggested. */
export const ANALYZE_RESPONSE_FORMAT = {
  type: 'json_schema' as const,
  json_schema: {
    name: 'log_foods',
    schema: {
      type: 'object' as const,
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Short food name, e.g. "Grilled chicken breast"' },
              quantity: { type: 'number', description: 'Portion amount, null if not estimable' },
              unit: { type: 'string', description: 'g, ml, cup, piece, slice, bowl' },
              calories: { type: 'integer', description: 'kcal for the portion shown' },
              protein_g: { type: 'number' },
              carbs_g: { type: 'number' },
              fat_g: { type: 'number' },
              confidence: { type: 'number', description: '0 to 1, how sure you are of this item' },
            },
            required: ['name', 'calories'],
          },
        },
      },
      required: ['items'],
    },
  },
}

export const MAX_NOTE_LENGTH = 200

/** The note is quoted as the user's description, never merged into the instruction. */
export function analyzePrompt(note?: string | null): string {
  const hint = note?.trim().slice(0, MAX_NOTE_LENGTH)
  if (!hint) return ANALYZE_PROMPT

  return [
    ANALYZE_PROMPT,
    `The person who took the photo describes it as: "${hint}"`,
    'Treat that as a hint for identifying items you cannot recognise on sight.',
    'Still estimate portions from the photo, not from the description.',
  ].join(' ')
}

export const ANALYZE_PROMPT = [
  'Identify every distinct food and drink in this photo and estimate its nutrition.',
  'Estimate the portion actually visible, not a standard serving.',
  'List components separately when they are separable — a burger and its fries are two items.',
  'If the photo contains no food at all, return an empty items array.',
  'Reply with JSON only.',
].join(' ')

/** Scans for the outermost braces, since models wrap the JSON in a fence unasked. */
export function extractAnalysis(completion: ChatCompletion): unknown {
  const text = completion.choices?.[0]?.message?.content
  if (typeof text !== 'string') throw new Error('model returned no content')

  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) throw new Error('model returned no parsable output')
  return JSON.parse(text.slice(start, end + 1))
}
