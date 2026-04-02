import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { resumesApi } from "@/lib/api/resumes"
import { toast } from "sonner"
import type { ResumeItem } from "@/types"

export function useResumes() {
  return useQuery<ResumeItem[]>({
    queryKey: ["resumes"],
    queryFn: async () => {
      const data = await resumesApi.list()
      return (data?.resumes ?? []) as ResumeItem[]
    },
  })
}

export function useResume(id: string) {
  return useQuery({
    queryKey: ["resume", id],
    queryFn: () => resumesApi.get(id),
    enabled: !!id,
  })
}

export function useCreateResume() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; content?: Record<string, unknown> }) =>
      resumesApi.create(data),
    onSuccess: () => {
      toast.success("Resume created")
      queryClient.invalidateQueries({ queryKey: ["resumes"] })
    },
    onError: (err: Error) => toast.error(err.message || "Failed to create"),
  })
}

export function useUpdateResume() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: Record<string, unknown>
    }) => resumesApi.update(id, data),
    onSuccess: (_, { id }) => {
      toast.success("Resume saved")
      queryClient.invalidateQueries({ queryKey: ["resumes"] })
      queryClient.invalidateQueries({ queryKey: ["resume", id] })
    },
    onError: (err: Error) => toast.error(err.message || "Failed to save"),
  })
}

export function useDeleteResume() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => resumesApi.remove(id),
    onSuccess: () => {
      toast.success("Resume deleted")
      queryClient.invalidateQueries({ queryKey: ["resumes"] })
    },
    onError: (err: Error) => toast.error(err.message || "Failed to delete"),
  })
}

export function useResumeVersions(resumeId: string) {
  return useQuery({
    queryKey: ["resume-versions", resumeId],
    queryFn: () => resumesApi.listVersions(resumeId),
    enabled: !!resumeId,
  })
}
