import { Log } from "../../util/log"
import * as fs from "fs"
import * as path from "path"
import { execSync } from "child_process"

const log = Log.create({ service: "mgrep-install-hooks" })

/**
 * Install mgrep git hooks
 * Creates git hook files that call the mgrep hook scripts
 */
export async function installHooks(): Promise<void> {
  try {
    log.info("Installing mgrep git hooks")

    // Get git directory
    const gitDir = getGitDir()
    const hooksDir = path.join(gitDir, "hooks")

    // Ensure hooks directory exists
    if (!fs.existsSync(hooksDir)) {
      fs.mkdirSync(hooksDir, { recursive: true })
    }

    // Install each hook
    await installHook(hooksDir, "pre-commit", "pre-commit.ts")
    await installHook(hooksDir, "post-commit", "post-commit.ts")
    await installHook(hooksDir, "post-merge", "post-merge.ts")

    log.info("mgrep git hooks installed successfully")
  } catch (error) {
    log.error("Failed to install mgrep hooks", { error })
    throw error
  }
}

/**
 * Install a specific hook
 */
async function installHook(hooksDir: string, hookName: string, scriptName: string): Promise<void> {
  const hookPath = path.join(hooksDir, hookName)
  const scriptPath = path.resolve(__dirname, scriptName)

  // Check if bun is available
  const bunCommand = getBunCommand()

  // Create the hook script content
  const hookContent = `#!/bin/sh
# mgrep ${hookName} hook
${bunCommand} run "${scriptPath}"
`

  // Write the hook file
  fs.writeFileSync(hookPath, hookContent, { mode: 0o755 })

  log.info(`Installed ${hookName} hook`, { path: hookPath })
}

/**
 * Get the git directory
 */
function getGitDir(): string {
  try {
    const output = execSync("git rev-parse --git-dir", {
      encoding: "utf8",
    })
    return output.trim()
  } catch (error) {
    throw new Error("Not in a git repository")
  }
}

/**
 * Get the bun command to use
 */
function getBunCommand(): string {
  // Try different bun commands
  const candidates = ["bun", "bunx", "npx bun"]

  for (const candidate of candidates) {
    try {
      execSync(`${candidate} --version`, { stdio: "ignore" })
      return candidate
    } catch (error) {
      // Continue to next candidate
    }
  }

  throw new Error("bun is not available. Please install bun to use mgrep hooks.")
}

// Run the installation
installHooks().catch((error) => {
  console.error("Failed to install mgrep hooks:", error)
  process.exit(1)
})
