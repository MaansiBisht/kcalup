/** Shared plumbing for the two evaluation harnesses. Not used by the app. */

/**
 * Runs with a fixed number in flight. Sequential is too slow over 40 plates and
 * unbounded trips the provider's rate limit, which would fail a run for a quota
 * problem rather than an accuracy one.
 */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await fn(items[i])
      }
    }),
  )
  return out
}

export type FailureReason = 'schema' | 'throttled' | 'error'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Retries the provider only for the statuses that mean "busy". A model must not
 * lose a comparison, or fail a build, because we were impatient -- but a 400 or
 * a 404 is a real answer and returns immediately.
 */
export async function withRetry<T>(
  attempt: () => Promise<T>,
  { attempts = 5, capMs = 60_000 } = {},
): Promise<{ value: T } | { failed: FailureReason }> {
  for (let n = 1; n <= attempts; n++) {
    try {
      return { value: await attempt() }
    } catch (error) {
      const status = (error as { status?: number })?.status
      const throttled = status === 429 || status === 503
      // An undefined status is a network wobble, worth one more go.
      if (!(throttled || status === undefined) || n === attempts) {
        return { failed: throttled ? 'throttled' : 'error' }
      }
      await sleep(Math.min(capMs, 3 ** n * 1000))
    }
  }
  return { failed: 'throttled' }
}
