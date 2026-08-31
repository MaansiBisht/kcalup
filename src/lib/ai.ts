// The only module that knows who the provider is. OpenAI chat-completions shape.
const BASE_URL = process.env.AI_BASE_URL || 'https://api.commandcode.ai/provider/v1'

export const AI_MODEL = process.env.AI_MODEL || 'minimax/minimax-m3-free'

export type ChatMessage = {
  role: 'user'
  content: ({ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } })[]
}

export type ChatCompletion = {
  choices: {
    message: { content: string | null }
  }[]
}

/** Throws with `status` set, so the route can tell a bad key from a bad photo. */
export async function chatCompletion(body: Record<string, unknown>): Promise<ChatCompletion> {
  // Checked here, not at import, so tests can load this module without a key.
  if (!process.env.AI_API_KEY) {
    throw new Error('Missing required environment variable: AI_API_KEY')
  }

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.AI_API_KEY}`,
    },
    body: JSON.stringify({ model: AI_MODEL, ...body }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw Object.assign(new Error(`AI request failed: ${response.status} ${detail.slice(0, 300)}`), {
      status: response.status,
    })
  }

  return response.json()
}
