import { cmd } from "../../cli/cmd/cmd"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import * as prompts from "@clack/prompts"
import { UI } from "../../cli/ui"

export const MgrepMcpCommand = cmd({
  command: "mcp",
  builder: (yargs) => yargs.command(McpStartCommand).demandCommand(),
  async handler() {},
})

export const McpStartCommand = cmd({
  command: "start",
  describe: "start mgrep MCP server",
  async handler() {
    UI.empty()
    prompts.intro("Start mgrep MCP server")

    const port = await prompts.text({
      message: "Enter port for MCP server",
      placeholder: "3000",
      defaultValue: "3000",
      validate: (x) => {
        const port = parseInt(x)
        if (isNaN(port) || port < 1024 || port > 65535) {
          return "Port must be between 1024 and 65535"
        }
        return undefined
      },
    })
    if (prompts.isCancel(port)) throw new UI.CancelledError()

    const spinner = prompts.spinner()
    spinner.start("Starting MCP server...")

    try {
      // Start mgrep MCP server
      const proc = Bun.spawn(["mgrep", "mcp", "--port", port], {
        stdout: "pipe",
        stderr: "pipe",
      })

      const exitCode = await proc.exited
      if (exitCode !== 0) {
        const errorOutput = await new Response(proc.stderr).text()
        spinner.stop("Failed to start MCP server", 1)
        prompts.log.error(`mgrep MCP failed: ${errorOutput}`)
        return
      }

      spinner.stop("MCP server started")
      prompts.log.info(`MCP server running on port ${port}`)
      prompts.log.info("Connect to: http://localhost:" + port)
      prompts.outro("Press Ctrl+C to stop")
    } catch (error: any) {
      spinner.stop("Failed to start MCP server", 1)
      prompts.log.error(`Error: ${error.message}`)
    }
  },
})
