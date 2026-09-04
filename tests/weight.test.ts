import { describe, test, expect } from 'vitest'
import { trailingAverage, weightProgress } from '@/lib/weight'

describe('trailingAverage', () => {
  test('is defined from the first point, not after a full window', () => {
    // Arrange / Act
    const out = trailingAverage([80, 82], 7)

    // Assert: no leading gap, so a two-day-old account still gets a line.
    expect(out).toEqual([80, 81])
  })

  test('averages only the trailing window once it is full', () => {
    const out = trailingAverage([1, 2, 3, 4, 5], 3)
    expect(out).toEqual([1, 1.5, 2, 3, 4])
  })

  test('smooths a single-day water spike instead of tracking it', () => {
    // Arrange: a 4 kg one-day jump, the shape a heavy meal or salt actually makes.
    const raw = [80, 80, 80, 84, 80, 80, 80]

    // Act
    const smoothed = trailingAverage(raw, 7)

    // Assert: the raw series jumps 4 kg; the trend must move a fraction of that.
    const rawJump = raw[3] - raw[2]
    const trendJump = smoothed[3] - smoothed[2]
    expect(rawJump).toBe(4)
    expect(trendJump).toBeCloseTo(1)
    expect(trendJump).toBeLessThan(rawJump / 2)

    // And by the end of the window the spike has almost washed out.
    expect(smoothed[6]).toBeCloseTo(80.57, 1)
  })

  test('an empty series produces an empty series', () => {
    expect(trailingAverage([], 7)).toEqual([])
  })
})

describe('weightProgress', () => {
  test('reports progress when losing toward a lower target', () => {
    const p = weightProgress(90, 85, 80)
    expect(p).toEqual({ changed: -5, remaining: -5, pct: 50 })
  })

  test('treats gaining toward a higher target identically', () => {
    const p = weightProgress(60, 65, 70)
    expect(p).toEqual({ changed: 5, remaining: 5, pct: 50 })
  })

  test('floors at zero when moving away from the target', () => {
    const p = weightProgress(90, 93, 80)
    expect(p.pct).toBe(0)
    expect(p.changed).toBe(3)
  })

  test('caps at 100 once the target is passed', () => {
    expect(weightProgress(90, 75, 80).pct).toBe(100)
  })

  test('reports change but no percentage when no target is set', () => {
    expect(weightProgress(90, 88, null)).toEqual({ changed: -2, remaining: null, pct: null })
  })

  test('does not divide by zero when the target equals the starting weight', () => {
    expect(weightProgress(80, 80, 80)).toEqual({ changed: 0, remaining: 0, pct: 100 })
  })
})
