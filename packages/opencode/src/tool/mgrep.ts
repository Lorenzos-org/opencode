import z from "zod"
import { Tool } from "./tool"
import DESCRIPTION from "./mgrep.txt"
import { Instance } from "../project/instance"

export const MgrepTool = Tool.define("mgrep", {
  description: DESCRIPTION,
  parameters: z.object({
    q: z.string().describe("The semantic search query."),
    m: z.number().default(10).describe("The number of chunks to return."),
    a: z
      .boolean()
      .default(false)
      .describe("If an answer should be generated based of the chunks. Useful for questions."),
    path: z.string().optional().describe("The directory to search in. Defaults to current working directory."),
  }),
  async execute(params) {
    if (!params.q) {
      throw new Error("query is required")
    }

    const searchPath = params.path || Instance.directory

    const args = ["search", "-m", params.m.toString()]
    if (params.a) {
      args.push("-a")
    }
    args.push(params.q)
    if (searchPath !== Instance.directory) {
      args.push(searchPath)
    }

    try {
      const proc = Bun.spawn(["mgrep", ...args], {
        stdout: "pipe",
        stderr: "pipe",
      })

      const output = await new Response(proc.stdout).text()
      const errorOutput = await new Response(proc.stderr).text()
      const exitCode = await proc.exited

      if (exitCode !== 0) {
        throw new Error(`mgrep failed: ${errorOutput}`)
      }

      const result = output.trim()

      if (!result || result.includes("No results found")) {
        return {
          title: params.q,
          metadata: { matches: 0, truncated: false },
          output: "No results found",
        }
      }

      return {
        title: params.q,
        metadata: {
          matches: 1,
          truncated: false,
        },
        output: result,
      }
    } catch (error: any) {
      throw new Error(`mgrep failed: ${error.message || error}`)
    }
  },
})
