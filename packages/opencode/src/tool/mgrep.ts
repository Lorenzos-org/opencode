import z from "zod"
import { Tool } from "./tool"
import DESCRIPTION from "./mgrep.txt"
import AUTH_DESCRIPTION from "./mgrep-auth.txt"
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

    // Check if mgrep is authenticated
    await this.checkAuthentication()

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
        // Check for authentication errors
        if (
          errorOutput.includes("not authenticated") ||
          errorOutput.includes("login required") ||
          errorOutput.includes("Please run 'mgrep login'")
        ) {
          throw new Error(
            `mgrep authentication required. Please run 'mgrep login' to authenticate with Mixedbread, or set the MXBAI_API_KEY environment variable.`,
          )
        }
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

  async checkAuthentication() {
    // Check if API key is set
    const apiKey = process.env.MXBAI_API_KEY
    if (apiKey) {
      return // API key authentication is available
    }

    // Try to check if mgrep is already authenticated by running a simple command
    try {
      const proc = Bun.spawn(["mgrep", "--version"], {
        stdout: "pipe",
        stderr: "pipe",
      })

      const errorOutput = await new Response(proc.stderr).text()
      const exitCode = await proc.exited

      // If mgrep is not found, we can't proceed
      if (exitCode !== 0 && errorOutput.includes("command not found")) {
        throw new Error("mgrep is not installed. Please install it with: npm install -g @mixedbread/mgrep")
      }

      // Note: We can't easily check authentication status without making a search request
      // The authentication check will happen during the actual search
    } catch (error: any) {
      if (error.message.includes("command not found")) {
        throw error
      }
      // Other errors might be expected, continue with search attempt
    }
  },
})

export const MgrepAuthTool = Tool.define("mgrep-auth", {
  description: AUTH_DESCRIPTION,
  parameters: z.object({
    action: z.enum(["login", "logout", "status"]).describe("Authentication action to perform"),
  }),
  async execute(params) {
    try {
      switch (params.action) {
        case "login":
          return await this.handleLogin()
        case "logout":
          return await this.handleLogout()
        case "status":
          return await this.checkAuthStatus()
        default:
          throw new Error(`Unknown action: ${params.action}`)
      }
    } catch (error: any) {
      throw new Error(`mgrep auth failed: ${error.message || error}`)
    }
  },

  async handleLogin() {
    try {
      const proc = Bun.spawn(["mgrep", "login"], {
        stdout: "pipe",
        stderr: "pipe",
        stdin: "inherit",
      })

      const output = await new Response(proc.stdout).text()
      const errorOutput = await new Response(proc.stderr).text()
      const exitCode = await proc.exited

      if (exitCode !== 0) {
        throw new Error(`mgrep login failed: ${errorOutput}`)
      }

      return {
        title: "mgrep login",
        metadata: { success: true },
        output: output.trim() || "mgrep login completed successfully. You can now use mgrep search.",
      }
    } catch (error: any) {
      if (error.message.includes("command not found")) {
        throw new Error("mgrep is not installed. Please install it with: npm install -g @mixedbread/mgrep")
      }
      throw error
    }
  },

  async handleLogout() {
    try {
      const proc = Bun.spawn(["mgrep", "logout"], {
        stdout: "pipe",
        stderr: "pipe",
      })

      const output = await new Response(proc.stdout).text()
      const errorOutput = await new Response(proc.stderr).text()
      const exitCode = await proc.exited

      if (exitCode !== 0) {
        throw new Error(`mgrep logout failed: ${errorOutput}`)
      }

      return {
        title: "mgrep logout",
        metadata: { success: true },
        output: output.trim() || "mgrep logout completed successfully.",
      }
    } catch (error: any) {
      if (error.message.includes("command not found")) {
        throw new Error("mgrep is not installed. Please install it with: npm install -g @mixedbread/mgrep")
      }
      throw error
    }
  },

  async checkAuthStatus() {
    const apiKey = process.env.MXBAI_API_KEY

    if (apiKey) {
      return {
        title: "mgrep auth status",
        metadata: {
          authenticated: true,
          method: "api_key",
        },
        output: "✅ Authenticated via MXBAI_API_KEY environment variable",
      }
    }

    try {
      // Try a simple search to check authentication
      const proc = Bun.spawn(["mgrep", "search", "-m", "1", "test"], {
        stdout: "pipe",
        stderr: "pipe",
      })

      const output = await new Response(proc.stdout).text()
      const errorOutput = await new Response(proc.stderr).text()
      const exitCode = await proc.exited

      if (exitCode !== 0) {
        if (
          errorOutput.includes("not authenticated") ||
          errorOutput.includes("login required") ||
          errorOutput.includes("Please run 'mgrep login'")
        ) {
          return {
            title: "mgrep auth status",
            metadata: {
              authenticated: false,
              method: "none",
            },
            output:
              "❌ Not authenticated. Please run 'mgrep login' to authenticate with Mixedbread, or set the MXBAI_API_KEY environment variable.",
          }
        }
        throw new Error(`mgrep status check failed: ${errorOutput}`)
      }

      return {
        title: "mgrep auth status",
        metadata: {
          authenticated: true,
          method: "oauth",
        },
        output: "✅ Authenticated via OAuth. You can use mgrep search.",
      }
    } catch (error: any) {
      if (error.message.includes("command not found")) {
        throw new Error("mgrep is not installed. Please install it with: npm install -g @mixedbread/mgrep")
      }
      throw error
    }
  },
})
