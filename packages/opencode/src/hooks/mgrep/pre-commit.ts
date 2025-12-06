import { Log } from "../../util/log"
import { execSync } from "child_process"

const log = Log.create({ service: "mgrep-pre-commit-hook" })

/**
 * Git pre-commit hook for mgrep
 * Performs pre-commit checks related to mgrep
 */
export async function preCommitHook(): Promise<void> {
  try {
    log.info("Running mgrep pre-commit hook")

    // Check if mgrep is installed and configured
    if (!isMgrepAvailable()) {
      log.warn("mgrep is not available, skipping pre-commit checks")
      return
    }

    // Check if mgrep token is configured
    if (!isMgrepAuthenticated()) {
      log.warn("mgrep authentication not configured, skipping pre-commit checks")
      return
    }

    log.info("mgrep pre-commit checks passed")
  } catch (error) {
    log.error("mgrep pre-commit hook failed", { error })
    // For pre-commit, we might want to fail the commit if there are issues
    // But for now, just log and allow the commit to proceed
  }
}

/**
 * Check if mgrep command is available
 */
function isMgrepAvailable(): boolean {
  try {
    execSync("which mgrep", { stdio: "ignore" })
    return true
  } catch (error) {
    return false
  }
}

/**
 * Check if mgrep is authenticated
 */
function isMgrepAuthenticated(): boolean {
  try {
    // Try to run a simple mgrep command that requires authentication
    execSync("mgrep store quota", { stdio: "ignore" })
    return true
  } catch (error) {
    return false
  }
}

// Run the hook
preCommitHook()
