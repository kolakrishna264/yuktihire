export function scoreColor(score: number): string {
  if (score >= 85) return "text-emerald-600 dark:text-emerald-400"
  if (score >= 70) return "text-amber-600 dark:text-amber-400"
  return "text-red-500 dark:text-red-400"
}

export function scoreBg(score: number): string {
  if (score >= 85) return "bg-emerald-500"
  if (score >= 70) return "bg-amber-500"
  return "bg-red-500"
}

export function formatDate(iso: string): string {
  if (!iso) return ""
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  })
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
