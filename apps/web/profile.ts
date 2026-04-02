import { api } from "./client"
import type { Profile, WorkExperience, Education, Skill } from "@/types"

export const profileApi = {
  getMe: () => api.get<Profile>("/profiles/me"),

  updateMe: (data: Partial<Profile>) => api.patch<Profile>("/profiles/me", data),

  importFromFile: async (file: File) => {
    const form = new FormData()
    form.append("file", file)
    return api.postForm<{ parsed: Partial<Profile>; confidence: number }>("/profiles/me/import", form)
  },

  addExperience: (data: Omit<WorkExperience, "id">) =>
    api.post<{ id: string }>("/profiles/me/experiences", data),

  updateExperience: (id: string, data: Partial<WorkExperience>) =>
    api.patch<{ id: string }>(`/profiles/me/experiences/${id}`, data),

  deleteExperience: (id: string) =>
    api.delete(`/profiles/me/experiences/${id}`),

  addEducation: (data: Omit<Education, "id">) =>
    api.post<{ id: string }>("/profiles/me/educations", data),

  deleteEducation: (id: string) =>
    api.delete(`/profiles/me/educations/${id}`),

  addSkill: (data: Omit<Skill, "id">) =>
    api.post<{ id: string }>("/profiles/me/skills", data),

  deleteSkill: (id: string) =>
    api.delete(`/profiles/me/skills/${id}`),
}
