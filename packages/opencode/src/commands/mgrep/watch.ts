import { cmd } from "../../cli/cmd/cmd"
import * as prompts from "@clack/prompts"
import { UI } from "../../cli/ui"
import { Instance } from "../../project/instance"

export const MgrepWatchCommand = cmd({
  command: "watch [path]",
  describe: "watch files and sync with mgrep index",
  builder: (yargs) =>
    yargs.positional("path", {
      describe: "directory to watch",
      type: "string",
      default: ".",
    }),
  async handler(args) {
    UI.empty()
    prompts.intro("Watch files for mgrep")

    const watchPath = args.path || Instance.directory
    prompts.log.info(`Watching directory: ${watchPath}`)

    const spinner = prompts.spinner()
    spinner.start("Starting file watcher...")

    try {
      // Start mgrep watch process
      const proc = Bun.spawn(["mgrep", "watch", watchPath], {
        stdout: "pipe",
        stderr: "pipe",
      })

      const exitCode = await proc.exited
      if (exitCode !== 0) {
        const errorOutput = await new Response(proc.stderr).text()
        spinner.stop("Failed to start watcher", 1)
        prompts.log.error(`mgrep watch failed: ${errorOutput}`)
        return
      }

      spinner.stop("Watcher started successfully")
      prompts.log.info("Files will be automatically indexed as they change")
      prompts.outro("Press Ctrl+C to stop watching")
    } catch (error: any) {
      spinner.stop("Failed to start watcher", 1)
      prompts.log.error(`Error: ${error.message}`)
    }
  },
})
