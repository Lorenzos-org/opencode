import { cmd } from "../../cli/cmd/cmd"
import * as prompts from "@clack/prompts"
import { UI } from "../../cli/ui"
import { Instance } from "../../project/instance"

export const MgrepSearchCommand = cmd({
  command: "search <query>",
  describe: "search files using mgrep semantic search",
  builder: (yargs) =>
    yargs
      .positional("query", {
        describe: "search query",
        type: "string",
        demandOption: true,
      })
      .option("path", {
        alias: "p",
        describe: "directory to search in",
        type: "string",
      })
      .option("limit", {
        alias: "m",
        describe: "maximum number of results",
        type: "number",
        default: 10,
      })
      .option("answer", {
        alias: "a",
        describe: "generate AI answer based on results",
        type: "boolean",
        default: false,
      }),
  async handler(args) {
    UI.empty()
    prompts.intro("Search with mgrep")

    const searchPath = args.path || Instance.directory
    const spinner = prompts.spinner()
    spinner.start("Searching...")

    try {
      const mgrepArgs = ["search", "-m", args.limit.toString()]
      if (args.answer) {
        mgrepArgs.push("-a")
      }
      mgrepArgs.push(args.query)
      if (searchPath !== Instance.directory) {
        mgrepArgs.push(searchPath)
      }

      const proc = Bun.spawn(["mgrep", ...mgrepArgs], {
        stdout: "pipe",
        stderr: "pipe",
      })

      const output = await new Response(proc.stdout).text()
      const errorOutput = await new Response(proc.stderr).text()
      const exitCode = await proc.exited

      if (exitCode !== 0) {
        spinner.stop("Search failed", 1)
        prompts.log.error(`mgrep search failed: ${errorOutput}`)
        return
      }

      spinner.stop("Search completed")

      const result = output.trim()
      if (!result || result.includes("No results found")) {
        prompts.log.warn("No results found")
      } else {
        prompts.log.info("Results:")
        console.log(result)
      }

      prompts.outro("Done")
    } catch (error: any) {
      spinner.stop("Search failed", 1)
      prompts.log.error(`Error: ${error.message}`)
    }
  },
})
