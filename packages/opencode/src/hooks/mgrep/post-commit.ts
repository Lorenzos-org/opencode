import { SyncManager } from "../../lib/mgrep/sync-helpers"
import { Log } from "../../util/log"
import { execSync } from "child_process"
import * as path from "path"

const log = Log.create({ service: "mgrep-post-commit-hook" })

/**
 * Git post-commit hook for mgrep
 * Automatically syncs committed files to mgrep index
 */
export async function postCommitHook(): Promise<void> {
  try {
    log.info("Running mgrep post-commit hook")

    // Get the list of files changed in the last commit
    const changedFiles = getChangedFiles()

    if (changedFiles.length === 0) {
      log.info("No files changed in commit, skipping mgrep sync")
      return
    }

    log.info("Syncing changed files to mgrep", { fileCount: changedFiles.length })

    // Get the git root directory
    const gitRoot = getGitRoot()

    // Perform sync on changed files
    const result = await SyncManager.performFullSync(gitRoot, {
      showProgress: false,
      fileFilter: (fileInfo) => {
        const relativePath = path.relative(gitRoot, fileInfo.path)
        return changedFiles.includes(relativePath)
      },
    })

    if (result.syncResult) {
      log.info("mgrep sync completed", {
        uploaded: result.syncResult.uploadedFiles.length,
        failed: result.syncResult.failedFiles.length,
      })
    } else {
      log.info("No files needed syncing")
    }
  } catch (error) {
    log.error("mgrep post-commit hook failed", { error })
    // Don't fail the commit, just log the error
  }
}

/**
 * Get files changed in the last commit
 */
function getChangedFiles(): string[] {
  try {
    const output = execSync("git diff-tree --no-commit-id --name-only -r HEAD", {
      encoding: "utf8",
    })
    return output.trim().split("\n").filter(Boolean)
  } catch (error) {
    log.error("Failed to get changed files", { error })
    return []
  }
}

/**
 * Get the git root directory
 */
function getGitRoot(): string {
  try {
    const output = execSync("git rev-parse --show-toplevel", {
      encoding: "utf8",
    })
    return output.trim()
  } catch (error) {
    log.error("Failed to get git root", { error })
    return process.cwd()
  }
}

// Run the hook
postCommitHook()
