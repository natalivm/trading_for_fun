export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export async function fetchJson(path) {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(body.error || body.hint || `API error ${res.status}`)
  }
  return res.json()
}
