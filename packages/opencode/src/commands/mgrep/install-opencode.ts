import { cmd } from "../../cli/cmd/cmd"
import * as prompts from "@clack/prompts"
import { UI } from "../../cli/ui"
import { Instance } from "../../project/instance"

export const MgrepInstallOpencodeCommand = cmd({
  command: "install-opencode",
  describe: "integrate mgrep with OpenCode project",
  async handler() {
    UI.empty()
    prompts.intro("Integrate mgrep with OpenCode")

    const projectPath = Instance.directory
    prompts.log.info(`Project directory: ${projectPath}`)

    const spinner = prompts.spinner()
    spinner.start("Installing mgrep integration...")

    try {
      // Install mgrep integration
      const proc = Bun.spawn(["mgrep", "install", "--opencode", projectPath], {
        stdout: "pipe",
        stderr: "pipe",
      })

      const output = await new Response(proc.stdout).text()
      const errorOutput = await new Response(proc.stderr).text()
      const exitCode = await proc.exited

      if (exitCode !== 0) {
        spinner.stop("Installation failed", 1)
        prompts.log.error(`mgrep install failed: ${errorOutput}`)
        return
      }

      spinner.stop("Integration installed successfully")

      const result = output.trim()
      if (result) {
        prompts.log.info("Integration details:")
        console.log(result)
      }

      prompts.log.success("mgrep is now integrated with your OpenCode project")
      prompts.log.info("You can now use mgrep search and watch commands")
      prompts.outro("Done")
    } catch (error: any) {
      spinner.stop("Installation failed", 1)
      prompts.log.error(`Error: ${error.message}`)
    }
  },
})
