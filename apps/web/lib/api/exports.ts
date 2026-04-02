export const exportsApi = {
  async list() { return [] },
  async create(data?: any) { return { success: true, ...(data ?? {}) } },
}
