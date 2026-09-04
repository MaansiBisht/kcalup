import { describe, test, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'

/**
 * The one test that proves the security model. Everything else in this suite is
 * pure logic; this needs a real database, because RLS is enforced by Postgres
 * and cannot be unit tested.
 *
 * Create two throwaway accounts in a non-production project, then:
 *   RLS_TEST_URL=... RLS_TEST_ANON_KEY=... \
 *   RLS_TEST_USER_A_EMAIL=... RLS_TEST_USER_A_PASSWORD=... \
 *   RLS_TEST_USER_B_EMAIL=... RLS_TEST_USER_B_PASSWORD=... npm test
 */
const env = {
  url: process.env.RLS_TEST_URL,
  anonKey: process.env.RLS_TEST_ANON_KEY,
  aEmail: process.env.RLS_TEST_USER_A_EMAIL,
  aPassword: process.env.RLS_TEST_USER_A_PASSWORD,
  bEmail: process.env.RLS_TEST_USER_B_EMAIL,
  bPassword: process.env.RLS_TEST_USER_B_PASSWORD,
}

const configured = Object.values(env).every(Boolean)

async function signIn(email: string, password: string) {
  const client = createClient(env.url!, env.anonKey!)
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`Could not sign in ${email}: ${error.message}`)
  return client
}

describe.skipIf(!configured)('row level security', () => {
  test("user B cannot read or delete user A's meal", async () => {
    const userA = await signIn(env.aEmail!, env.aPassword!)
    const userB = await signIn(env.bEmail!, env.bPassword!)

    // Arrange: A logs a meal.
    const { data: mealId, error: rpcError } = await userA.rpc('log_meal', {
      p_meal_type: 'snack',
      p_image_key: null,
      p_items: [{ name: 'RLS probe', calories: 1 }],
    })
    expect(rpcError).toBeNull()
    expect(mealId).toBeTruthy()

    // Act + assert: B asks for it by id and gets nothing — not an error, nothing.
    // RLS filters rather than rejects, so the row simply does not exist for B.
    const { data: seenByB } = await userB.from('meals').select('id').eq('id', mealId).maybeSingle()
    expect(seenByB).toBeNull()

    // B cannot delete it either.
    await userB.from('meals').delete().eq('id', mealId)
    const { data: stillThere } = await userA
      .from('meals')
      .select('id')
      .eq('id', mealId)
      .maybeSingle()
    expect(stillThere).toMatchObject({ id: mealId })

    // B cannot reach the child rows through the meal id either.
    const { data: itemsSeenByB } = await userB.from('food_items').select('id').eq('meal_id', mealId)
    expect(itemsSeenByB).toEqual([])

    // Cleanup: A removes their own meal, which cascades to food_items.
    const { error: cleanupError } = await userA.from('meals').delete().eq('id', mealId)
    expect(cleanupError).toBeNull()
  })

  test('repeat_meal copies your own meal and refuses someone else\'s', async () => {
    const userA = await signIn(env.aEmail!, env.aPassword!)
    const userB = await signIn(env.bEmail!, env.bPassword!)

    // Arrange: A logs a two-item meal.
    const { data: originalId } = await userA.rpc('log_meal', {
      p_meal_type: 'lunch',
      p_image_key: null,
      p_items: [
        { name: 'Repeat probe rice', calories: 200, protein_g: 4 },
        { name: 'Repeat probe dal', calories: 150, protein_g: 9 },
      ],
    })
    expect(originalId).toBeTruthy()

    // Act: B cannot repeat it. RLS hides the source row, so the function raises.
    const { error: bError } = await userB.rpc('repeat_meal', {
      p_meal_id: originalId,
      p_meal_type: 'lunch',
    })
    expect(bError).not.toBeNull()

    // Act: A repeats their own, and gets a distinct meal with the same items.
    const { data: copyId, error: aError } = await userA.rpc('repeat_meal', {
      p_meal_id: originalId,
      p_meal_type: 'dinner',
    })
    expect(aError).toBeNull()
    expect(copyId).not.toEqual(originalId)

    const { data: copy } = await userA
      .from('meals')
      .select('calories, meal_type, food_items(name, calories)')
      .eq('id', copyId)
      .single()

    expect(copy).toMatchObject({ calories: 350, meal_type: 'dinner' })
    expect(copy!.food_items).toHaveLength(2)

    // And the picker now shows one suggestion for the pair, counted twice.
    const { data: suggestions } = await userA.rpc('meal_suggestions', { p_limit: 12 })
    const row = (suggestions as { meal_id: string; times_logged: number }[]).find(
      (r) => r.meal_id === copyId,
    )
    expect(row?.times_logged).toBe(2)

    await userA.from('meals').delete().in('id', [originalId, copyId])
  })

  test('a client cannot forge a user_id on insert', async () => {
    const userA = await signIn(env.aEmail!, env.aPassword!)
    const userB = await signIn(env.bEmail!, env.bPassword!)

    const { data: bUser } = await userB.auth.getUser()

    // A tries to write a meal that belongs to B. The WITH CHECK policy refuses.
    const { error } = await userA.from('meals').insert({
      user_id: bUser.user!.id,
      local_date: '2026-01-01',
      meal_type: 'snack',
      calories: 1,
    })

    expect(error).not.toBeNull()
  })
})
