import { describe, test, expect } from 'vitest'
import { safeNext } from '@/app/auth/callback/route'

describe('safeNext', () => {
  test('keeps a relative path', () => {
    expect(safeNext('/account')).toBe('/account')
  })

  test('falls back to onboarding when absent', () => {
    expect(safeNext(null)).toBe('/onboarding')
    expect(safeNext('')).toBe('/onboarding')
  })

  test('rejects a protocol-relative host, which is the open-redirect trick', () => {
    expect(safeNext('//evil.com')).toBe('/onboarding')
  })

  test('rejects an absolute URL', () => {
    expect(safeNext('https://evil.com')).toBe('/onboarding')
    expect(safeNext('javascript:alert(1)')).toBe('/onboarding')
  })
})
