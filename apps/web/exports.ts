import { getAuthToken } from "./auth"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"

export const exportsApi = {
  exportPDF: async (resumeId: string, filename?: string): Promise<void> => {
    const token = await getAuthToken()
    const res = await fetch(`${API_URL}/exports`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ resume_id: resumeId, format: "PDF", filename }),
    })
    if (!res.ok) throw new Error("Export failed")
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename || "resume.pdf"
    a.click()
    URL.revokeObjectURL(url)
  },

  exportDOCX: async (resumeId: string, filename?: string): Promise<void> => {
    const token = await getAuthToken()
    const res = await fetch(`${API_URL}/exports`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ resume_id: resumeId, format: "DOCX", filename }),
    })
    if (!res.ok) throw new Error("Export failed")
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename || "resume.docx"
    a.click()
    URL.revokeObjectURL(url)
  },
}

async function getAuthToken(): Promise<string | null> {
  const { createClient } = await import("@/lib/supabase/client")
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}
