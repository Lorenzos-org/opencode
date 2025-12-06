import { describe, it, expect, beforeEach } from 'bun:test'
import { EnvProtection } from '../src/plugins/env-protection'

describe('EnvProtection Plugin', () => {
  let plugin
  let mockContext

  beforeEach(() => {
    mockContext = {
      project: {},
      client: {},
      $: {},
      directory: '/test',
      worktree: '/test'
    }
    plugin = EnvProtection(mockContext)
  })

  it('should throw error when trying to read .env files', () => {
    const input = { tool: 'read' }
    const output = { args: { filePath: '/test/.env' } }

    expect(() => {
      plugin['tool.execute.before'](input, output)
    }).toThrow('Do not read .env files')
  })

  it('should allow reading non-.env files', () => {
    const input = { tool: 'read' }
    const output = { args: { filePath: '/test/config.ts' } }

    expect(() => {
      plugin['tool.execute.before'](input, output)
    }).not.toThrow()
  })

  it('should allow non-read tools on .env files', () => {
    const input = { tool: 'write' }
    const output = { args: { filePath: '/test/.env' } }

    expect(() => {
      plugin['tool.execute.before'](input, output)
    }).not.toThrow()
  })
})
