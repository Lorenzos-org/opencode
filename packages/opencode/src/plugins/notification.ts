export const NotificationPlugin = ({ project, client, $, directory, worktree }) => {
  return {
    event: async ({ event }) => {
      if (event.type === 'session.idle') {
      if (process.platform === 'darwin') {
        await $`osascript -e 'display notification "Session completed!" with title "opencode"'`
      } else {
        console.log('Notifications are only supported on macOS.')
      }
      }
    }
  }
}
