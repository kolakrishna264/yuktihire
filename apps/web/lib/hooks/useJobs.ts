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

export function useCreateJob() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      title: string
      company: string
      status?: ApplicationStatus
      url?: string
      notes?: string
    }) => jobsApi.create(data),
    onSuccess: () => {
      toast.success("Job added")
      queryClient.invalidateQueries({ queryKey: ["jobs"] })
    },
    onError: (err: Error) => toast.error(err.message || "Failed to add job"),
  })
}

export function useUpdateJob() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: Partial<JobApplication>
    }) => jobsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] })
    },
    onError: (err: Error) => toast.error(err.message || "Failed to update"),
  })
}

export function useDeleteJob() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => jobsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] })
    },
    onError: (err: Error) => toast.error(err.message || "Failed to delete"),
  })
}
