import { describe, test, expect } from 'vitest'
import { streaksFrom, nudgeFor } from '@/lib/streak'

const TODAY = '2026-09-04'

describe('streaksFrom', () => {
  test('an account with nothing logged has no streak', () => {
    expect(streaksFrom([], TODAY)).toEqual({ current: 0, longest: 0, loggedToday: false })
  })

  test('logging today alone is a streak of one', () => {
    expect(streaksFrom([TODAY], TODAY)).toMatchObject({ current: 1, loggedToday: true })
  })

  test('counts back through consecutive days', () => {
    const days = ['2026-09-02', '2026-09-03', TODAY]
    expect(streaksFrom(days, TODAY)).toMatchObject({ current: 3, longest: 3 })
  })

  test('an unfinished today does not break a run ending yesterday', () => {
    // Arrange: logged through yesterday, nothing yet today.
    const days = ['2026-09-01', '2026-09-02', '2026-09-03']

    // Act
    const s = streaksFrom(days, TODAY)

    // Assert: the streak still stands — today has not been missed, only not finished.
    expect(s).toMatchObject({ current: 3, loggedToday: false })
  })

  test('breaks once a whole day has passed unlogged', () => {
    // Nothing today and nothing yesterday: the run really is over.
    const days = ['2026-08-30', '2026-08-31', '2026-09-01']
    expect(streaksFrom(days, TODAY)).toMatchObject({ current: 0, longest: 3 })
  })

  test('a gap splits the run and longest keeps the best stretch', () => {
    const days = ['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-05', TODAY]
    expect(streaksFrom(days, TODAY)).toMatchObject({ current: 1, longest: 3 })
  })

  test('duplicate dates from several meals in a day count once', () => {
    const days = [TODAY, TODAY, TODAY, '2026-09-03', '2026-09-03']
    expect(streaksFrom(days, TODAY)).toMatchObject({ current: 2, longest: 2 })
  })

  test('crosses a month boundary', () => {
    const days = ['2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03', TODAY]
    expect(streaksFrom(days, TODAY)).toMatchObject({ current: 5, longest: 5 })
  })

  test('unsorted input is handled', () => {
    const days = [TODAY, '2026-09-02', '2026-09-03']
    expect(streaksFrom(days, TODAY)).toMatchObject({ current: 3, longest: 3 })
  })
})

describe('nudgeFor', () => {
  test('only the evening line warns that the streak is at risk', () => {
    expect(nudgeFor(9, true).body).not.toMatch(/streak/)
    expect(nudgeFor(14, true).body).not.toMatch(/streak/)
    expect(nudgeFor(21, true).body).toMatch(/streak/)
  })

  test('never threatens a streak that has already been lost', () => {
    // Arrange / Act: evening, but there is no run left to break.
    const body = nudgeFor(21, false).body

    // Assert: it invites a restart instead of warning about a loss that happened.
    expect(body).not.toMatch(/streak ends/)
    expect(body).toMatch(/new run/)
  })

  test('every hour of the day produces a nudge, with or without a streak', () => {
    for (let h = 0; h < 24; h++) {
      for (const hasStreak of [true, false]) {
        expect(nudgeFor(h, hasStreak).title.length).toBeGreaterThan(0)
        expect(nudgeFor(h, hasStreak).body.length).toBeGreaterThan(0)
      }
    }
  })
})
