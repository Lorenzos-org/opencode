export const NotificationPlugin = ({ project, client, $, directory, worktree }) => {
  return {
    event: async ({ event }) => {
      if (event.type === 'session.idle') {
        await $`osascript -e 'display notification "Session completed!" with title "opencode"'`
      }
    }
  }
}
