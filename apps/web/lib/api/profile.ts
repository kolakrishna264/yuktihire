import { apiFetch } from "./client"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"

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

export const profileApi = {
  async getMe() {
    return apiFetch("/profiles/me")
  },

  async importResume(file: File) {
    const token = await getAuthToken()
    const formData = new FormData()
    formData.append("file", file)
    const res = await fetch(`${API_BASE}/profiles/me/import`, {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    })
    if (!res.ok) {
      let message = `API error: ${res.status}`
      try {
        const body = await res.json()
        message = body?.detail || body?.message || message
      } catch {
        // ignore
      }
      throw new Error(message)
    }
    if (res.status === 204) return null
    return res.json()
  },

  async update(data: Record<string, unknown>) {
    return apiFetch("/profiles/me", {
      method: "PATCH",
      body: JSON.stringify(data),
    })
  },

  async addExperience(data: Record<string, unknown>) {
    return apiFetch("/profiles/me/experiences", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  async updateExperience(id: string, data: Record<string, unknown>) {
    return apiFetch(`/profiles/me/experiences/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    })
  },

  async deleteExperience(id: string) {
    return apiFetch(`/profiles/me/experiences/${id}`, { method: "DELETE" })
  },

  async addEducation(data: Record<string, unknown>) {
    return apiFetch("/profiles/me/educations", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  async deleteEducation(id: string) {
    return apiFetch(`/profiles/me/educations/${id}`, { method: "DELETE" })
  },

  async addSkill(data: Record<string, unknown>) {
    return apiFetch("/profiles/me/skills", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  async deleteSkill(id: string) {
    return apiFetch(`/profiles/me/skills/${id}`, { method: "DELETE" })
  },
}
