import { listAllTasks } from '../../utils/clients'

export default defineEventHandler(async () => {
  const groups = await listAllTasks()
  return {
    groups,
    totalCount: groups.reduce((sum, g) => sum + g.tasks.length, 0),
    onlineCount: groups.filter((g) => g.online).length
  }
})
