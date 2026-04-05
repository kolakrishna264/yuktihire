const API_BASE = process.env.NEXT_PUBLIC_API_URL
  || (typeof window !== "undefined" && window.location.hostname !== "localhost"
    ? "https://api.yuktihire.com/api/v1"
    : "http://localhost:8000/api/v1")

async function getAuthToken(): Promise<string | null> {
  try {
    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  } catch {
    return null
  }
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = await getAuthToken()

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  })

  if (!res.ok) {
    let message = `API error: ${res.status}`
    let errorType = "error"
    let detail: any = null
    try {
      const body = await res.json()
      detail = body?.detail
      if (typeof detail === "object") {
        message = detail?.message || message
        errorType = detail?.type || (detail?.upgradeRequired ? "plan_limit" : "error")
      } else {
        message = detail || body?.message || message
      }
    } catch {}

    const err = new Error(message) as any
    err.status = res.status
    err.errorType = errorType  // "throttle" | "plan_limit" | "error"
    err.detail = detail
    throw err
  }

  // 204 No Content
  if (res.status === 204) return null

  return res.json()
}

/**
 * Download a file from the API with authentication.
 * Fetches as blob and triggers browser download.
 */
export async function apiDownload(path: string, filename: string) {
  const token = await getAuthToken()

  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })

  if (!res.ok) {
    let message = `Download failed: ${res.status}`
    try {
      const body = await res.json()
      message = body?.detail?.message || body?.detail || message
    } catch {}
    throw new Error(message)
  }

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
