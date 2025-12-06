import { SyncManager } from "../../lib/mgrep/sync-helpers"
import { Log } from "../../util/log"
import { execSync } from "child_process"
import * as path from "path"

const log = Log.create({ service: "mgrep-post-merge-hook" })

/**
 * Git post-merge hook for mgrep
 * Automatically syncs merged files to mgrep index
 */
export async function postMergeHook(): Promise<void> {
  try {
    log.info("Running mgrep post-merge hook")

    // Check if this was a merge (not just a checkout)
    if (!isMergeCommit()) {
      log.info("Not a merge commit, skipping mgrep sync")
      return
    }

    // Get the list of files changed in the merge
    const changedFiles = getMergedFiles()

    if (changedFiles.length === 0) {
      log.info("No files changed in merge, skipping mgrep sync")
      return
    }

    log.info("Syncing merged files to mgrep", { fileCount: changedFiles.length })

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
    log.error("mgrep post-merge hook failed", { error })
    // Don't fail the merge, just log the error
  }
}

/**
 * Check if the current HEAD is a merge commit
 */
function isMergeCommit(): boolean {
  try {
    const output = execSync("git rev-list --count --min-parents=2 HEAD", {
      encoding: "utf8",
    })
    return parseInt(output.trim()) > 0
  } catch (error) {
    log.error("Failed to check if merge commit", { error })
    return false
  }
}

/**
 * Get files changed in the merge
 */
function getMergedFiles(): string[] {
  try {
    // Get files that differ between HEAD and the merge base
    const output = execSync("git diff --name-only HEAD~1..HEAD", {
      encoding: "utf8",
    })
    return output.trim().split("\n").filter(Boolean)
  } catch (error) {
    log.error("Failed to get merged files", { error })
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
postMergeHook()
