import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { jobsApi } from "@/lib/api/jobs"
import { toast } from "sonner"
import type { JobApplication, ApplicationStatus } from "@/types"

export function useAllJobs() {
  return useQuery<JobApplication[]>({
    queryKey: ["jobs"],
    queryFn: async () => {
      const data = await jobsApi.getAll()
      return Array.isArray(data) ? data : []
    },
  })
}

export function useSavedJobUrls() {
  return useQuery({
    queryKey: ["saved-job-urls"],
    queryFn: () => jobsApi.getSavedUrls(),
    staleTime: 30_000, // 30s cache
  })
}

export function useCreateJob() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      title: string
      company: string
      status?: ApplicationStatus
      url?: string
      location?: string
      salary?: string
      notes?: string
      source?: string
      work_type?: string
      experience_level?: string
      industry?: string
      skills?: string[]
      description?: string
      external_job_id?: string
      posted_at?: string
    }) => jobsApi.create(data),
    onSuccess: () => {
      toast.success("Job saved to tracker")
      queryClient.invalidateQueries({ queryKey: ["jobs"] })
      queryClient.invalidateQueries({ queryKey: ["saved-job-urls"] })
    },
    onError: (err: Error) => {
      if (err.message?.includes("409") || err.message?.includes("already")) {
        toast.info("Job already tracked")
      } else {
        toast.error(err.message || "Failed to save job")
      }
    },
  })
}

export function useUpdateJob() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<JobApplication> }) =>
      jobsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] })
    },
    onError: (err: Error) => toast.error(err.message || "Failed to update"),
  })
}

export function useMarkApplied() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => jobsApi.markApplied(id),
    onSuccess: () => {
      toast.success("Marked as applied")
      queryClient.invalidateQueries({ queryKey: ["jobs"] })
      queryClient.invalidateQueries({ queryKey: ["saved-job-urls"] })
    },
    onError: (err: Error) => toast.error(err.message || "Failed to mark as applied"),
  })
}

export function useDeleteJob() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => jobsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] })
      queryClient.invalidateQueries({ queryKey: ["saved-job-urls"] })
    },
    onError: (err: Error) => toast.error(err.message || "Failed to delete"),
  })
}
