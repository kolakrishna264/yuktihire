import { useQuery } from "@tanstack/react-query"
import { jobBoardApi } from "@/lib/api/jobBoard"
import type { JobBoardItem } from "@/types"

interface JobBoardParams {
  search?: string
  workType?: string
  sort?: string
  page?: number
  perPage?: number
}

interface JobBoardResponse {
  jobs: JobBoardItem[]
  total: number
  page: number
  perPage: number
  totalPages: number
}

export function useJobBoard(params?: JobBoardParams) {
  return useQuery<JobBoardResponse>({
    queryKey: ["job-board", params?.search, params?.workType, params?.sort, params?.page, params?.perPage],
    queryFn: async () => {
      const data = await jobBoardApi.list({
        search: params?.search || undefined,
        work_type: params?.workType || undefined,
        sort: params?.sort || "newest",
        page: params?.page || 1,
        per_page: params?.perPage || 20,
      })
      return {
        jobs: data?.jobs ?? [],
        total: data?.total ?? 0,
        page: data?.page ?? 1,
        perPage: data?.perPage ?? 20,
        totalPages: data?.totalPages ?? 0,
      }
    },
    staleTime: 5 * 60 * 1000,
  })
}
