import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { discoverApi } from "@/lib/api/discover"
import type { DiscoverResponse, JobSourceInfo } from "@/types"

interface DiscoverParams {
  q?: string
  workType?: string
  location?: string
  experienceLevel?: string
  industry?: string
  salaryMin?: number
  source?: string
  sort?: string
  page?: number
  perPage?: number
}

export function useDiscover(params?: DiscoverParams) {
  return useQuery<DiscoverResponse>({
    queryKey: ["discover", params],
    queryFn: async () => {
      const data = await discoverApi.search({
        q: params?.q,
        work_type: params?.workType,
        location: params?.location,
        experience_level: params?.experienceLevel,
        industry: params?.industry,
        salary_min: params?.salaryMin,
        source: params?.source,
        sort: params?.sort || "newest",
        page: params?.page || 1,
        per_page: params?.perPage || 20,
      })
      return data as DiscoverResponse
    },
    staleTime: 3 * 60 * 1000,
  })
}

export function useDiscoverJob(id: string) {
  return useQuery({
    queryKey: ["discover-job", id],
    queryFn: () => discoverApi.getJob(id),
    enabled: !!id,
  })
}

export function useJobSources() {
  return useQuery<JobSourceInfo[]>({
    queryKey: ["job-sources"],
    queryFn: () => discoverApi.getSources(),
    staleTime: 10 * 60 * 1000,
  })
}

export function useRefreshSources() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => discoverApi.refreshSources(),
    onSuccess: () => {
      // Invalidate discover data after a delay (sources take time to sync)
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["discover"] })
        queryClient.invalidateQueries({ queryKey: ["job-sources"] })
      }, 5000)
    },
  })
}
