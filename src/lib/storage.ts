export const MEAL_IMAGES_BUCKET = 'meal-images'

/**
 * Object key for an upload. Random name, never the original filename — filenames
 * leak device details and collide. The user id prefix is what the analyze route
 * and the storage policy both check ownership against.
 */
export function mealImageKey(userId: string): string {
  return `${userId}/${crypto.randomUUID()}.jpg`
}
