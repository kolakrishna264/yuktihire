import { useQuery } from "@tanstack/react-query"
import { jobBoardApi } from "@/lib/api/jobBoard"
import type { JobBoardItem } from "@/types"

interface JobBoardParams {
  search?: string
  workType?: string
  limit?: number
}

export function useJobBoard(params?: JobBoardParams) {
  return useQuery<{ jobs: JobBoardItem[]; total: number }>({
    queryKey: ["job-board", params?.search, params?.workType, params?.limit],
    queryFn: async () => {
      const data = await jobBoardApi.list({
        search: params?.search || undefined,
        work_type: params?.workType || undefined,
        limit: params?.limit,
      })
      return {
        jobs: data?.jobs ?? [],
        total: data?.total ?? 0,
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  })
}
