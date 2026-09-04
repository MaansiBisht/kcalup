/**
 * Builds the accuracy fixture set from Nutrition5k.
 *
 *   node scripts/fetch-fixtures.mjs [count]
 *
 * Nutrition5k is ~5,000 real cafeteria plates whose calories were measured by
 * weighing every ingredient, not estimated by a person. That is the only reason
 * this benchmark means anything: the labels are facts, not guesses.
 *
 * Google Research, CC BY 4.0 — https://github.com/google-research-datasets/Nutrition5k
 *
 * Images are cached outside git. The manifest is committed, so the exact set is
 * reproducible from the dish ids without redistributing 40 photographs.
 */
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

const BASE = 'https://storage.googleapis.com/nutrition5k_dataset/nutrition5k_dataset'
const FIXTURES = join(import.meta.dirname, '..', 'tests', 'fixtures')
const IMAGES = join(FIXTURES, 'images')
const WANTED = Number(process.argv[2] ?? 40)

// A plate a person would actually photograph: a composed meal, not a lone
// condiment and not a catering tray. Keeps the benchmark about the app's job.
const MIN_KCAL = 150
const MAX_KCAL = 900
const MIN_MASS_G = 100
const MIN_INGREDIENTS = 2
const MAX_INGREDIENTS = 8

async function metadata(cafe) {
  const res = await fetch(`${BASE}/metadata/dish_metadata_cafe${cafe}.csv`)
  if (!res.ok) throw new Error(`cafe${cafe} metadata: HTTP ${res.status}`)
  return res.text()
}

/** Rows are variable length: 7 dish fields then 7 fields per ingredient. */
function parseDishes(csv) {
  const dishes = []
  for (const line of csv.split('\n')) {
    const f = line.split(',')
    if (f.length < 7 || !f[0].startsWith('dish_')) continue

    const [id, kcal, mass, fat, carb, protein] = f
    const ingredients = []
    for (let i = 6; i + 1 < f.length; i += 7) {
      if (f[i]?.startsWith('ingr_')) ingredients.push(f[i + 1]?.trim())
    }
    dishes.push({
      id,
      kcal: Number(kcal),
      mass: Number(mass),
      fat: Number(fat),
      carb: Number(carb),
      protein: Number(protein),
      ingredients: ingredients.filter(Boolean),
    })
  }
  return dishes
}

const usable = (d) =>
  Number.isFinite(d.kcal) &&
  d.kcal >= MIN_KCAL &&
  d.kcal <= MAX_KCAL &&
  d.mass >= MIN_MASS_G &&
  d.ingredients.length >= MIN_INGREDIENTS &&
  d.ingredients.length <= MAX_INGREDIENTS

const csvs = await Promise.all([metadata(1), metadata(2)])
const all = csvs.flatMap(parseDishes).filter(usable)

// Sorted by calories then sampled at an even stride, so the set spans the whole
// range rather than clustering wherever the dataset happens to be dense. Fully
// deterministic: the same command always produces the same fixtures.
all.sort((a, b) => a.kcal - b.kcal || a.id.localeCompare(b.id))

/** Not every dish has overhead imagery, so ask before choosing. HEAD is cheap. */
async function hasImage(id) {
  const res = await fetch(`${BASE}/imagery/realsense_overhead/${id}/rgb.png`, { method: 'HEAD' })
  return res.ok
}

// Over-sample the calorie-sorted list, discard the dishes with no photo, then
// take an even stride through what is left. Sampling after the availability
// check is what keeps the final set spread across the range instead of
// bunching wherever the imagery happens to be complete.
const poolSize = Math.min(all.length, WANTED * 3)
const poolStride = all.length / poolSize
const pool = Array.from({ length: poolSize }, (_, i) => all[Math.floor(i * poolStride)])

process.stdout.write(`checking imagery for ${pool.length} candidates\n`)
const flags = await Promise.all(pool.map((d) => hasImage(d.id)))
const available = pool.filter((_, i) => flags[i])
if (available.length < WANTED) {
  console.warn(`only ${available.length} candidates have imagery; taking all of them`)
}

const take = Math.min(WANTED, available.length)
const stride = available.length / take
const chosen = Array.from({ length: take }, (_, i) => available[Math.floor(i * stride)])

mkdirSync(IMAGES, { recursive: true })
const cases = []

for (const dish of chosen) {
  const file = `${dish.id}.jpg`
  const path = join(IMAGES, file)

  if (!existsSync(path)) {
    const res = await fetch(`${BASE}/imagery/realsense_overhead/${dish.id}/rgb.png`)
    if (!res.ok) {
      console.warn(`skip ${dish.id}: image HTTP ${res.status}`)
      continue
    }
    const png = join(IMAGES, `${dish.id}.png`)
    writeFileSync(png, Buffer.from(await res.arrayBuffer()))

    // Re-encoded to match what the app actually uploads: JPEG at quality 82,
    // long edge capped at 1280. The model should see production artefacts, not
    // a pristine PNG the phone would never send.
    execFileSync('magick', [png, '-resize', '1280x1280>', '-quality', '82', path])
    rmSync(png)
  }

  cases.push({
    image: `images/${file}`,
    kcal: Math.round(dish.kcal),
    grams: Math.round(dish.mass),
    expect: dish.ingredients.slice(0, 2),
    dish_id: dish.id,
  })
  process.stdout.write(`\r${cases.length}/${take} plates`)
}

writeFileSync(
  join(FIXTURES, 'cases.json'),
  JSON.stringify(
    {
      source: 'Nutrition5k (Google Research), CC BY 4.0',
      url: 'https://github.com/google-research-datasets/Nutrition5k',
      note: 'Calories are measured by weighing every ingredient, not estimated. Images are cached by scripts/fetch-fixtures.mjs and are not committed.',
      cases,
    },
    null,
    2,
  ) + '\n',
)
console.log(`\n${cases.length} cases written, ${all.length} dishes matched the filter`)
