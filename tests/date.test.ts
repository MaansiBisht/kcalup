import { describe, test, expect } from 'vitest'
import {
  localDate,
  shiftDate,
  formatDayLabel,
  formatFullDate,
  formatTime,
  greeting,
  hourIn,
  isValidTimezone,
  resolveTimezone,
  supportedTimezones,
} from '@/lib/date'

describe('localDate', () => {
  test('11:45 PM IST stays on the same local day even though UTC has not rolled', () => {
    // 2026-08-30 23:45 IST == 2026-08-30 18:15 UTC
    const at = new Date('2026-08-30T18:15:00Z')
    expect(localDate('Asia/Kolkata', at)).toBe('2026-08-30')
  })

  test('00:30 IST is already the next local day while UTC is still on the previous one', () => {
    // 2026-08-31 00:30 IST == 2026-08-30 19:00 UTC
    const at = new Date('2026-08-30T19:00:00Z')
    expect(localDate('Asia/Kolkata', at)).toBe('2026-08-31')
    expect(localDate('UTC', at)).toBe('2026-08-30')
  })

  test('negative offset: 8 PM in New York is still the same day, UTC is already tomorrow', () => {
    const at = new Date('2026-08-31T00:30:00Z') // 20:30 EDT on Aug 30
    expect(localDate('America/New_York', at)).toBe('2026-08-30')
    expect(localDate('UTC', at)).toBe('2026-08-31')
  })

  test('survives a DST spring-forward boundary', () => {
    // US DST begins 2026-03-08. 03:30 EDT that morning is 07:30 UTC.
    const at = new Date('2026-03-08T07:30:00Z')
    expect(localDate('America/New_York', at)).toBe('2026-03-08')
  })

  test('half-hour and 45-minute offsets', () => {
    const at = new Date('2026-08-30T18:30:00Z')
    expect(localDate('Asia/Kathmandu', at)).toBe('2026-08-31') // UTC+5:45
    expect(localDate('Australia/Adelaide', at)).toBe('2026-08-31') // UTC+9:30
  })
})

describe('shiftDate', () => {
  test('crosses month and year boundaries', () => {
    expect(shiftDate('2026-08-31', 1)).toBe('2026-09-01')
    expect(shiftDate('2026-01-01', -1)).toBe('2025-12-31')
  })
  test('handles a leap day', () => {
    expect(shiftDate('2028-02-28', 1)).toBe('2028-02-29')
  })
  test('does not drift across a DST boundary', () => {
    expect(shiftDate('2026-03-07', 1)).toBe('2026-03-08')
    expect(shiftDate('2026-11-01', 1)).toBe('2026-11-02')
  })
})

describe('formatDayLabel', () => {
  test('names today and yesterday, spells out anything older', () => {
    expect(formatDayLabel('2026-08-31', '2026-08-31')).toBe('Today')
    expect(formatDayLabel('2026-08-30', '2026-08-31')).toBe('Yesterday')
    expect(formatDayLabel('2026-08-25', '2026-08-31')).toContain('Aug 25')
  })
})

describe('greeting / hourIn', () => {
  test('midnight reads as hour 0, not 24', () => {
    const at = new Date('2026-08-30T18:30:00Z') // 00:00 IST
    expect(hourIn('Asia/Kolkata', at)).toBe(0)
    expect(greeting('Asia/Kolkata', at)).toBe('Good morning')
  })
  test('afternoon and evening', () => {
    expect(greeting('UTC', new Date('2026-08-30T14:00:00Z'))).toBe('Good afternoon')
    expect(greeting('UTC', new Date('2026-08-30T20:00:00Z'))).toBe('Good evening')
  })
  test('the reported bug: 13:26 IST must greet afternoon, not the UTC morning', () => {
    const at = new Date('2026-09-25T07:56:00Z') // 13:26 IST, 07:56 UTC
    expect(greeting('Asia/Kolkata', at)).toBe('Good afternoon')
    expect(greeting('UTC', at)).toBe('Good morning')
  })
  test('IST boundaries: 11:59 still morning, 17:00 already evening', () => {
    expect(greeting('Asia/Kolkata', new Date('2026-09-25T06:29:00Z'))).toBe('Good morning')
    expect(greeting('Asia/Kolkata', new Date('2026-09-25T11:30:00Z'))).toBe('Good evening')
  })
})

describe('formatTime', () => {
  const iso = '2026-09-25T07:56:00Z' // 13:26 IST, 03:56 EDT
  test('renders the instant in the given timezone', () => {
    expect(formatTime(iso, 'Asia/Kolkata')).toBe('1:26 PM')
    expect(formatTime(iso, 'UTC')).toBe('7:56 AM')
    expect(formatTime(iso, 'America/New_York')).toBe('3:56 AM')
  })
  test('accepts a Date too', () => {
    expect(formatTime(new Date(iso), 'Asia/Kolkata')).toBe('1:26 PM')
  })
})

describe('resolveTimezone / isValidTimezone', () => {
  test('valid zones pass through', () => {
    expect(resolveTimezone('Asia/Kolkata')).toBe('Asia/Kolkata')
    expect(isValidTimezone('Asia/Kolkata')).toBe(true)
  })
  test('anything else falls back to UTC', () => {
    for (const bad of ['Not/AZone', '', null, undefined]) {
      expect(resolveTimezone(bad)).toBe('UTC')
      expect(isValidTimezone(bad)).toBe(false)
    }
  })
})

describe('supportedTimezones', () => {
  test('lists real zones and always includes UTC', () => {
    // ICU canonicalises aliases — Asia/Kolkata may appear as Asia/Calcutta.
    expect(supportedTimezones()).toContain('America/New_York')
    expect(supportedTimezones()).toContain('UTC')
  })
})

test('formatFullDate always spells the day out, even for today', () => {
  expect(formatFullDate('2026-08-31')).toBe('Monday, Aug 31')
})
