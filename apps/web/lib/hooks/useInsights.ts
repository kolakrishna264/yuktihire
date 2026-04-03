import { useQuery } from "@tanstack/react-query"
import { insightsApi } from "@/lib/api/insights"
import type { InsightsOverview, PipelineCount, ActivityWeek, SkillCount, IndustryCount, LocationData } from "@/types"

export function useInsightsOverview() {
  return useQuery<InsightsOverview>({ queryKey: ["insights-overview"], queryFn: () => insightsApi.overview() })
}

export function useInsightsPipeline() {
  return useQuery<PipelineCount[]>({ queryKey: ["insights-pipeline"], queryFn: async () => { const d = await insightsApi.pipeline(); return Array.isArray(d) ? d : [] } })
}

export function useInsightsActivity() {
  return useQuery<ActivityWeek[]>({ queryKey: ["insights-activity"], queryFn: async () => { const d = await insightsApi.activity(); return Array.isArray(d) ? d : [] } })
}

export function useInsightsSkills() {
  return useQuery<SkillCount[]>({ queryKey: ["insights-skills"], queryFn: async () => { const d = await insightsApi.skills(); return Array.isArray(d) ? d : [] } })
}

export function useInsightsIndustries() {
  return useQuery<IndustryCount[]>({ queryKey: ["insights-industries"], queryFn: async () => { const d = await insightsApi.industries(); return Array.isArray(d) ? d : [] } })
}

export function useInsightsLocations() {
  return useQuery<LocationData>({ queryKey: ["insights-locations"], queryFn: () => insightsApi.locations() })
}
