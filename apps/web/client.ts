// ResumeAI — typed API client for FastAPI backend

const API_URL = process.env.NEXT_PUBLIC_API_URL
  || (typeof window !== "undefined" && window.location.hostname !== "localhost"
    ? "https://api.yuktihire.com/api/v1"
    : "http://localhost:8000/api/v1")

class ApiError extends Error {
  status: number
  upgradeRequired: boolean

  constructor(message: string, status: number, upgradeRequired = false) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.upgradeRequired = upgradeRequired
  }
}

async function getAuthToken(): Promise<string | null> {
  if (typeof window === "undefined") return null
  try {
    const { createClient } = await import("@/lib/supabase/client")
    const supabase = createClient()
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  } catch {
    return null
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  authenticated = true
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  }

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json"
  }

  if (authenticated) {
    const token = await getAuthToken()
    if (token) headers["Authorization"] = `Bearer ${token}`
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  })

  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    let upgradeRequired = false
    try {
      const body = await res.json()
      if (typeof body.detail === "string") {
        detail = body.detail
      } else if (body.detail?.message) {
        detail = body.detail.message
        upgradeRequired = body.detail.upgradeRequired ?? false
      }
    } catch {}
    throw new ApiError(detail, res.status, upgradeRequired)
  }

  // Handle empty responses (204)
  if (res.status === 204) return {} as T

  return res.json()
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "POST", body: data ? JSON.stringify(data) : undefined }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "PATCH", body: data ? JSON.stringify(data) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  postForm: <T>(path: string, formData: FormData) =>
    request<T>(path, { method: "POST", body: formData }),
}

export { ApiError }
