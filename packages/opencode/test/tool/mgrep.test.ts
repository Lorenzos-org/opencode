import { describe, expect, test, beforeAll, afterAll } from "bun:test"
import path from "path"
import { MgrepTool } from "../../src/tool/mgrep"
import { Instance } from "../../src/project/instance"

const ctx = {
  sessionID: "test",
  messageID: "",
  toolCallID: "",
  agent: "build",
  abort: AbortSignal.any([]),
  metadata: () => {},
}

const mgrep = await MgrepTool.init()
const projectRoot = path.join(__dirname, "../..")

describe("tool.mgrep", () => {
  test("basic semantic search", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const result = await mgrep.execute(
          {
            q: "test function",
            m: 5,
            a: false,
          },
          ctx,
        )
        expect(result.title).toBe("test function")
        expect(result.metadata).toBeDefined()
        expect(result.output).toBeDefined()
      },
    })
  })

  test("search with AI answer generation", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const result = await mgrep.execute(
          {
            q: "how to run tests",
            m: 3,
            a: true,
          },
          ctx,
        )
        expect(result.title).toBe("how to run tests")
        expect(result.metadata).toBeDefined()
        expect(result.output).toBeDefined()
      },
    })
  })

  test("search in specific path", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const testPath = path.join(projectRoot, "test")
        const result = await mgrep.execute(
          {
            q: "test files",
            m: 3,
            a: false,
            path: testPath,
          },
          ctx,
        )
        expect(result.title).toBe("test files")
        expect(result.metadata).toBeDefined()
        expect(result.output).toBeDefined()
      },
    })
  })

  test("handles empty query error", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        await expect(
          mgrep.execute(
            {
              q: "",
              m: 5,
              a: false,
            },
            ctx,
          ),
        ).rejects.toThrow("query is required")
      },
    })
  })

  test("handles no results gracefully", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const result = await mgrep.execute(
          {
            q: "nonexistent_search_term_xyz123",
            m: 5,
            a: false,
          },
          ctx,
        )
        expect(result.title).toBe("nonexistent_search_term_xyz123")
        expect(result.metadata.matches).toBe(0)
        expect(result.output).toBe("No results found")
      },
    })
  })

  test("respects result limit parameter", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const result = await mgrep.execute(
          {
            q: "function",
            m: 2,
            a: false,
          },
          ctx,
        )
        expect(result.title).toBe("function")
        expect(result.metadata).toBeDefined()
        expect(result.output).toBeDefined()
      },
    })
  })
})
