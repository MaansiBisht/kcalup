import { describe, test, expect } from 'vitest'
import { mealTypeFromHour, sumItems, goalProgress } from '@/lib/nutrition'

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
