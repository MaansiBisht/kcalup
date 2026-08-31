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

/**
 * Structured output, not a tool call. The model is not choosing to invoke
 * anything — we always want the same shaped answer — and json_schema is enforced
 * where a function definition is only suggested. Gemini honoured the nested item
 * schema every time through response_format and inconsistently through tools.
 *
 * No minItems: a photo with no food has to be able to come back empty rather than
 * be forced to invent a row. Zod rejects the empty list and the route turns that
 * into "No food found in that photo."
 */
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

export const ANALYZE_PROMPT = [
  'Identify every distinct food and drink in this photo and estimate its nutrition.',
  'Estimate the portion actually visible, not a standard serving.',
  'List components separately when they are separable — a burger and its fries are two items.',
  'If the photo contains no food at all, return an empty items array.',
  'Reply with JSON only.',
].join(' ')

/**
 * The response is the JSON. Scanning for the outermost braces rather than parsing
 * the whole string handles the models that wrap it in a ```json fence anyway.
 */
export function extractAnalysis(completion: ChatCompletion): unknown {
  const text = completion.choices?.[0]?.message?.content
  if (typeof text !== 'string') throw new Error('model returned no content')

  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) throw new Error('model returned no parsable output')
  return JSON.parse(text.slice(start, end + 1))
}
