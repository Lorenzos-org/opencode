import { describe, it, expect, beforeEach, mock } from 'bun:test'
import { NotificationPlugin } from '../src/plugins/notification'

describe('NotificationPlugin', () => {
  let plugin
  let mockContext
  let mockExec

  beforeEach(() => {
    mockExec = mock(() => Promise.resolve())

    mockContext = {
      project: {},
      client: {},
      $: mockExec,
      directory: '/test',
      worktree: '/test'
    }
    plugin = NotificationPlugin(mockContext)
  })

  it('should send notification on session idle event', async () => {
    const event = { type: 'session.idle' }

    await plugin.event({ event })

    expect(mockExec).toHaveBeenCalledWith(
      'osascript -e \'display notification "Session completed!" with title "opencode"\''
    )
  })

  it('should not send notification on other events', async () => {
    const event = { type: 'session.start' }

    await plugin.event({ event })

    expect(mockExec).not.toHaveBeenCalled()
  })

  it('should handle notification errors gracefully', async () => {
    mockExec.mockRejectedValue(new Error('Notification failed'))
    const event = { type: 'session.idle' }

    await expect(plugin.event({ event })).resolves.not.toThrow()
  })
})
