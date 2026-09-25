import { describe, test, expect } from 'vitest'
import { mealTypeFromHour, sumItems, goalProgress, scaleFoodItem } from '@/lib/nutrition'

describe('mealTypeFromHour', () => {
  test('maps the day onto four meal slots', () => {
    expect(mealTypeFromHour(7)).toBe('breakfast')
    expect(mealTypeFromHour(13)).toBe('lunch')
    expect(mealTypeFromHour(19)).toBe('dinner')
    expect(mealTypeFromHour(23)).toBe('snack')
  })
  test('boundaries land on the later meal', () => {
    expect(mealTypeFromHour(11)).toBe('lunch')
    expect(mealTypeFromHour(16)).toBe('dinner')
    expect(mealTypeFromHour(0)).toBe('breakfast')
  })
})

describe('scaleFoodItem', () => {
  const item = {
    name: 'Greek yogurt',
    quantity: 1.5,
    unit: 'cup',
    calories: 101,
    protein_g: 12.3,
    carbs_g: 9.9,
    fat_g: 3.5,
    confidence: 0.88,
  }

  test('scales quantity, calories, and macros together while preserving metadata', () => {
    expect(scaleFoodItem(item, 0.5)).toEqual({
      ...item,
      quantity: 0.8,
      calories: 51,
      protein_g: 6.2,
      carbs_g: 5,
      fat_g: 1.8,
    })
  })

  test('rounds calories to an integer and decimal fields to one decimal', () => {
    expect(scaleFoodItem(item, 1.25)).toMatchObject({
      quantity: 1.9,
      calories: 126,
      protein_g: 15.4,
      carbs_g: 12.4,
      fat_g: 4.4,
    })
  })

  test('preserves null quantity and macros', () => {
    const withNulls = { ...item, quantity: null, protein_g: null, carbs_g: null, fat_g: null }
    expect(scaleFoodItem(withNulls, 2)).toMatchObject({
      quantity: null,
      protein_g: null,
      carbs_g: null,
      fat_g: null,
    })
  })

  test.each([0, -1, Number.NaN])('returns the same item for invalid factor %s', (factor) => {
    expect(scaleFoodItem(item, factor)).toBe(item)
  })
})

describe('sumItems', () => {
  test('adds calories and macros, treating null macros as zero', () => {
    expect(sumItems([
      { calories: 100, protein_g: 10, carbs_g: 5, fat_g: 2 },
      { calories: 50, protein_g: null, carbs_g: null, fat_g: null },
    ])).toEqual({ calories: 150, protein_g: 10, carbs_g: 5, fat_g: 2 })
  })
  test('an empty meal totals zero', () => {
    expect(sumItems([])).toEqual({ calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 })
  })
})

describe('goalProgress', () => {
  test('reports percentage and what is left', () => {
    expect(goalProgress(1240, 2000)).toEqual({ pct: 62, barPct: 62, remaining: 760, over: false })
  })
  test('caps the bar at 100 but keeps the true overage in remaining', () => {
    const p = goalProgress(2500, 2000)
    expect(p).toMatchObject({ pct: 125, barPct: 100, remaining: -500, over: true })
  })
  test('does not divide by zero on a missing goal', () => {
    expect(Number.isFinite(goalProgress(500, 0).pct)).toBe(true)
  })
})
