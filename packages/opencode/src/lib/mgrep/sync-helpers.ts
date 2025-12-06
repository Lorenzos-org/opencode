import { Log } from "../../util/log"
import { defaultFileSystem, FileInfo } from "./file"
import { StoreClient, StoreFile } from "./store"
import { Utils } from "./utils"
import { createHash } from "crypto"
import { promises as fs } from "fs"
import * as path from "path"

/**
 * Formats bytes for human readable display
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"

  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

const log = Log.create({ service: "mgrep-sync-helpers" })

/**
 * Initial sync result interface
 */
export interface InitialSyncResult {
  /**
   * Total files found in the directory
   */
  totalFiles: number
  /**
   * Files that need to be uploaded (new or modified)
   */
  filesToUpload: string[]
  /**
   * Files that are already synced (no changes needed)
   */
  syncedFiles: string[]
  /**
   * Files that were ignored during sync
   */
  ignoredFiles: string[]
  /**
   * Total size of files to upload in bytes
   */
  uploadSize: number
  /**
   * Whether the sync was successful
   */
  success: boolean
  /**
   * Error message if sync failed
   */
  error?: string
}

/**
 * File hash information
 */
export interface FileHash {
  /**
   * File path relative to root
   */
  path: string
  /**
   * SHA-256 hash of file content
   */
  hash: string
  /**
   * File size in bytes
   */
  size: number
  /**
   * Last modified timestamp
   */
  modified: number
}

/**
 * Progress tracking interface
 */
export interface SyncProgress {
  /**
   * Current operation being performed
   */
  currentOperation: "scanning" | "hashing" | "uploading" | "completed" | "failed"
  /**
   * Total number of files to process
   */
  totalFiles: number
  /**
   * Number of files processed so far
   */
  processedFiles: number
  /**
   * Number of files uploaded successfully
   */
  uploadedFiles: number
  /**
   * Number of files that failed to upload
   */
  failedFiles: number
  /**
   * Total bytes uploaded so far
   */
  uploadedBytes: number
  /**
   * Total bytes to upload
   */
  totalBytes: number
  /**
   * Current file being processed
   */
  currentFile?: string
  /**
   * Estimated time remaining in seconds
   */
  estimatedTimeRemaining?: number
  /**
   * Start timestamp of the sync operation
   */
  startTime: number
}

/**
 * Sync configuration options
 */
export interface SyncOptions {
  /**
   * Maximum number of concurrent uploads
   */
  maxConcurrency?: number
  /**
   * Whether to skip files that already exist in store
   */
  skipExisting?: boolean
  /**
   * Whether to show progress updates
   */
  showProgress?: boolean
  /**
   * Custom progress callback
   */
  onProgress?: (progress: SyncProgress) => void
  /**
   * Whether to retry failed uploads
   */
  retryFailed?: boolean
  /**
   * Maximum number of retry attempts per file
   */
  maxRetries?: number
  /**
   * Whether to check quota before starting sync
   */
  checkQuota?: boolean
  /**
   * Custom file filter function
   */
  fileFilter?: (fileInfo: FileInfo) => boolean
}

/**
 * Sync result with detailed information
 */
export interface SyncResult {
  /**
   * Whether the sync operation was successful
   */
  success: boolean
  /**
   * Total files processed
   */
  totalFiles: number
  /**
   * Files uploaded successfully
   */
  uploadedFiles: string[]
  /**
   * Files that failed to upload
   */
  failedFiles: Array<{ path: string; error: string }>
  /**
   * Files that were skipped
   */
  skippedFiles: string[]
  /**
   * Total bytes uploaded
   */
  totalBytesUploaded: number
  /**
   * Time taken in milliseconds
   */
  duration: number
  /**
   * Final progress state
   */
  finalProgress: SyncProgress
}

/**
 * Quota exceeded error details
 */
export interface QuotaExceededError {
  /**
   * Current quota usage
   */
  currentUsage: number
  /**
   * Quota limit
   */
  limit: number
  /**
   * Required space for upload
   */
  requiredSpace: number
  /**
   * Available space remaining
   */
  availableSpace: number
}

/**
 * File hash computation utilities
 */
export namespace FileHashUtils {
  /**
   * Computes SHA-256 hash of a file
   */
  export async function computeFileHash(filePath: string): Promise<string> {
    try {
      const buffer = await fs.readFile(filePath)
      const hash = createHash("sha256")
      hash.update(buffer)
      return hash.digest("hex")
    } catch (error) {
      log.error("Failed to compute file hash", { filePath, error })
      throw new Error(`Failed to compute hash for ${filePath}: ${error instanceof Error ? error.message : error}`)
    }
  }

  /**
   * Computes hash for multiple files concurrently
   */
  export async function computeMultipleHashes(filePaths: string[], maxConcurrency: number = 4): Promise<FileHash[]> {
    const results: FileHash[] = []
    const semaphore = new Semaphore(maxConcurrency)

    const processFile = async (filePath: string): Promise<FileHash> => {
      await semaphore.acquire()
      try {
        const stat = await fs.stat(filePath)
        const hash = await computeFileHash(filePath)
        return {
          path: filePath,
          hash,
          size: stat.size,
          modified: stat.mtime.getTime(),
        }
      } finally {
        semaphore.release()
      }
    }

    const promises = filePaths.map(processFile)
    const hashResults = await Promise.allSettled(promises)

    for (const result of hashResults) {
      if (result.status === "fulfilled") {
        results.push(result.value)
      } else {
        log.error("Failed to process file hash", { error: result.reason })
      }
    }

    return results
  }

  /**
   * Creates a hash map from file hashes for quick lookup
   */
  export function createHashMap(hashes: FileHash[]): Map<string, FileHash> {
    const map = new Map<string, FileHash>()
    for (const hash of hashes) {
      map.set(hash.path, hash)
    }
    return map
  }

  /**
   * Compares local and remote file hashes to determine changes
   */
  export function compareHashes(
    localHashes: Map<string, FileHash>,
    remoteHashes: Map<string, FileHash>,
  ): {
    newFiles: string[]
    modifiedFiles: string[]
    unchangedFiles: string[]
  } {
    const newFiles: string[] = []
    const modifiedFiles: string[] = []
    const unchangedFiles: string[] = []

    for (const filePath of Array.from(localHashes.keys())) {
      const localHash = localHashes.get(filePath)!
      const remoteHash = remoteHashes.get(filePath)
      if (!remoteHash) {
        newFiles.push(filePath)
      } else if (remoteHash.hash !== localHash.hash) {
        modifiedFiles.push(filePath)
      } else {
        unchangedFiles.push(filePath)
      }
    }

    return { newFiles, modifiedFiles, unchangedFiles }
  }
}

/**
 * Progress tracking utilities
 */
export namespace ProgressTracker {
  /**
   * Creates initial progress state
   */
  export function createInitial(totalFiles: number, totalBytes: number): SyncProgress {
    return {
      currentOperation: "scanning",
      totalFiles,
      processedFiles: 0,
      uploadedFiles: 0,
      failedFiles: 0,
      uploadedBytes: 0,
      totalBytes,
      startTime: Date.now(),
    }
  }

  /**
   * Updates progress and calculates estimated time remaining
   */
  export function updateProgress(current: SyncProgress, updates: Partial<SyncProgress>): SyncProgress {
    const updated = { ...current, ...updates }

    // Calculate estimated time remaining
    if (updated.processedFiles > 0 && updated.currentOperation !== "completed") {
      const elapsed = Date.now() - updated.startTime
      const avgTimePerFile = elapsed / updated.processedFiles
      const remainingFiles = updated.totalFiles - updated.processedFiles
      updated.estimatedTimeRemaining = Math.max(0, (remainingFiles * avgTimePerFile) / 1000)
    }

    return updated
  }

  /**
   * Formats progress for display
   */
  export function formatProgress(progress: SyncProgress): string {
    const percentage = progress.totalFiles > 0 ? Math.round((progress.processedFiles / progress.totalFiles) * 100) : 0

    const bytesUploaded = formatBytes(progress.uploadedBytes)
    const totalBytes = formatBytes(progress.totalBytes)
    const timeRemaining = progress.estimatedTimeRemaining
      ? `${Math.round(progress.estimatedTimeRemaining)}s`
      : "unknown"

    return `[${percentage}%] ${progress.currentOperation}: ${progress.processedFiles}/${progress.totalFiles} files (${bytesUploaded}/${totalBytes}) - ETA: ${timeRemaining}`
  }
}

/**
 * Semaphore implementation for concurrency control
 */
class Semaphore {
  private permits: number
  private waitQueue: (() => void)[] = []

  constructor(permits: number) {
    this.permits = permits
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--
      return
    }

    return new Promise<void>((resolve) => {
      this.waitQueue.push(resolve)
    })
  }

  release(): void {
    this.permits++
    if (this.waitQueue.length > 0) {
      const resolve = this.waitQueue.shift()!
      this.permits--
      resolve()
    }
  }
}

/**
 * Error handling for quota exceeded scenarios
 */
export namespace QuotaHandler {
  /**
   * Checks if upload would exceed quota
   */
  export async function checkUploadQuota(requiredBytes: number): Promise<void> {
    try {
      const quota = await StoreClient.getQuota()

      if (quota.remaining < requiredBytes) {
        const errorDetails = {
          currentUsage: quota.used,
          limit: quota.limit,
          requiredSpace: requiredBytes,
          availableSpace: quota.remaining,
        }

        log.error("Upload would exceed quota", errorDetails)
        throw new QuotaExceededError(
          `Upload requires ${formatBytes(requiredBytes)} but only ${formatBytes(quota.remaining)} available`,
          errorDetails,
        )
      }
    } catch (error) {
      if (error instanceof QuotaExceededError) {
        throw error
      }
      log.error("Failed to check quota", { error })
      throw new Error(`Failed to check storage quota: ${error instanceof Error ? error.message : error}`)
    }
  }

  /**
   * Gets quota information with user-friendly formatting
   */
  export async function getQuotaInfo(): Promise<{
    used: string
    limit: string
    remaining: string
    percentage: number
    resetAt: string
  }> {
    const quota = await StoreClient.getQuota()
    const percentage = Math.round((quota.used / quota.limit) * 100)

    return {
      used: formatBytes(quota.used),
      limit: formatBytes(quota.limit),
      remaining: formatBytes(quota.remaining),
      percentage,
      resetAt: new Date(quota.resetAt).toLocaleString(),
    }
  }
}

/**
 * Custom error for quota exceeded scenarios
 */
export class QuotaExceededError extends Error {
  constructor(
    message: string,
    public details: {
      currentUsage: number
      limit: number
      requiredSpace: number
      availableSpace: number
    },
  ) {
    super(message)
    this.name = "QuotaExceededError"
  }
}

/**
 * Sync implementation with concurrency control
 */
export namespace SyncManager {
  /**
   * Performs initial sync analysis
   */
  export async function performInitialSync(directory: string, options: SyncOptions = {}): Promise<InitialSyncResult> {
    log.info("Starting initial sync analysis", { directory, options })

    try {
      const fileSystem = defaultFileSystem
      const allFiles: string[] = []
      const ignoredFiles: string[] = []

      // Scan directory for files
      for await (const filePath of fileSystem.getFiles(directory)) {
        const fileInfo = await fileSystem.getFileInfo(filePath, directory)
        if (!fileInfo) continue

        if (fileInfo.ignored) {
          ignoredFiles.push(filePath)
          continue
        }

        if (options.fileFilter && !options.fileFilter(fileInfo)) {
          ignoredFiles.push(filePath)
          continue
        }

        allFiles.push(filePath)
      }

      // Get remote files to compare
      let remoteFiles: StoreFile[] = []
      try {
        const listResponse = await StoreClient.listFiles()
        remoteFiles = listResponse.files
      } catch (error) {
        log.warn("Failed to fetch remote files for comparison", { error })
      }

      // Create remote hash map
      const remoteHashMap = new Map<string, StoreFile>()
      for (const file of remoteFiles) {
        remoteHashMap.set(file.name, file)
      }

      // Determine which files need upload
      const filesToUpload: string[] = []
      const syncedFiles: string[] = []
      let uploadSize = 0

      for (const filePath of allFiles) {
        const relativePath = path.relative(directory, filePath)
        const remoteFile = remoteHashMap.get(relativePath)

        if (!remoteFile) {
          // New file
          filesToUpload.push(filePath)
          const stat = await fs.stat(filePath)
          uploadSize += stat.size
        } else {
          // Compare modification times
          const localStat = await fs.stat(filePath)
          const localModified = localStat.mtime.getTime()
          const remoteModified = new Date(remoteFile.updatedAt).getTime()

          if (localModified > remoteModified) {
            filesToUpload.push(filePath)
            uploadSize += localStat.size
          } else {
            syncedFiles.push(filePath)
          }
        }
      }

      const result: InitialSyncResult = {
        totalFiles: allFiles.length,
        filesToUpload,
        syncedFiles,
        ignoredFiles,
        uploadSize,
        success: true,
      }

      log.info("Initial sync analysis completed", result)
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      log.error("Initial sync analysis failed", { error })

      return {
        totalFiles: 0,
        filesToUpload: [],
        syncedFiles: [],
        ignoredFiles: [],
        uploadSize: 0,
        success: false,
        error: errorMessage,
      }
    }
  }

  /**
   * Executes the sync operation with progress tracking
   */
  export async function executeSync(
    directory: string,
    filesToUpload: string[],
    options: SyncOptions = {},
  ): Promise<SyncResult> {
    const startTime = Date.now()
    const maxConcurrency = options.maxConcurrency || 3
    const maxRetries = options.maxRetries || 3

    log.info("Starting sync execution", { directory, fileCount: filesToUpload.length, maxConcurrency })

    // Calculate total bytes
    let totalBytes = 0
    for (const filePath of filesToUpload) {
      const stat = await fs.stat(filePath)
      totalBytes += stat.size
    }

    let progress = ProgressTracker.createInitial(filesToUpload.length, totalBytes)

    if (options.onProgress) {
      options.onProgress(progress)
    }

    if (options.showProgress) {
      console.log(ProgressTracker.formatProgress(progress))
    }

    // Check quota if requested
    if (options.checkQuota) {
      try {
        await QuotaHandler.checkUploadQuota(totalBytes)
      } catch (error) {
        if (error instanceof QuotaExceededError) {
          return {
            success: false,
            totalFiles: filesToUpload.length,
            uploadedFiles: [],
            failedFiles: filesToUpload.map((path) => ({ path, error: error.message })),
            skippedFiles: [],
            totalBytesUploaded: 0,
            duration: Date.now() - startTime,
            finalProgress: ProgressTracker.updateProgress(progress, {
              currentOperation: "failed",
              processedFiles: filesToUpload.length,
              failedFiles: filesToUpload.length,
            }),
          }
        }
        throw error
      }
    }

    const uploadedFiles: string[] = []
    const failedFiles: Array<{ path: string; error: string }> = []
    const skippedFiles: string[] = []
    let uploadedBytes = 0

    const semaphore = new Semaphore(maxConcurrency)

    const uploadFile = async (filePath: string, retryCount: number = 0): Promise<void> => {
      await semaphore.acquire()

      try {
        progress = ProgressTracker.updateProgress(progress, {
          currentOperation: "uploading",
          currentFile: path.relative(directory, filePath),
        })

        if (options.onProgress) {
          options.onProgress(progress)
        }

        if (options.showProgress) {
          console.log(ProgressTracker.formatProgress(progress))
        }

        const relativePath = path.relative(directory, filePath)

        // Check if file already exists and skip if requested
        if (options.skipExisting) {
          try {
            await StoreClient.getFile(relativePath)
            skippedFiles.push(filePath)
            return
          } catch (error) {
            // File doesn't exist, proceed with upload
          }
        }

        // Upload file
        const uploadResponse = await StoreClient.uploadFile(filePath, {
          name: relativePath,
          metadata: {
            directory,
            relativePath,
            uploadedAt: new Date().toISOString(),
          },
        })

        uploadedFiles.push(filePath)
        uploadedBytes += uploadResponse.size

        log.info("File uploaded successfully", { filePath, fileId: uploadResponse.id })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)

        if (options.retryFailed && retryCount < maxRetries) {
          log.warn("Upload failed, retrying", { filePath, retryCount: retryCount + 1, error: errorMessage })
          await Utils.sleep(1000 * (retryCount + 1)) // Exponential backoff
          return uploadFile(filePath, retryCount + 1)
        }

        failedFiles.push({ path: filePath, error: errorMessage })
        log.error("File upload failed", { filePath, error: errorMessage })
      } finally {
        progress = ProgressTracker.updateProgress(progress, {
          processedFiles: progress.processedFiles + 1,
          uploadedFiles: uploadedFiles.length,
          failedFiles: failedFiles.length,
          uploadedBytes,
        })

        if (options.onProgress) {
          options.onProgress(progress)
        }

        if (options.showProgress) {
          console.log(ProgressTracker.formatProgress(progress))
        }

        semaphore.release()
      }
    }

    // Upload files concurrently
    const uploadPromises = filesToUpload.map((filePath) => uploadFile(filePath))
    await Promise.all(uploadPromises)

    const finalProgress = ProgressTracker.updateProgress(progress, {
      currentOperation: failedFiles.length === 0 ? "completed" : "failed",
      processedFiles: filesToUpload.length,
    })

    const duration = Date.now() - startTime
    const success = failedFiles.length === 0

    log.info("Sync execution completed", {
      success,
      uploadedFiles: uploadedFiles.length,
      failedFiles: failedFiles.length,
      duration,
    })

    return {
      success,
      totalFiles: filesToUpload.length,
      uploadedFiles,
      failedFiles,
      skippedFiles,
      totalBytesUploaded: uploadedBytes,
      duration,
      finalProgress,
    }
  }

  /**
   * Convenience method to perform complete sync (analysis + execution)
   */
  export async function performFullSync(
    directory: string,
    options: SyncOptions = {},
  ): Promise<{ initialResult: InitialSyncResult; syncResult?: SyncResult }> {
    const initialResult = await performInitialSync(directory, options)

    if (!initialResult.success || initialResult.filesToUpload.length === 0) {
      return { initialResult }
    }

    const syncResult = await executeSync(directory, initialResult.filesToUpload, options)
    return { initialResult, syncResult }
  }
}

/**
 * Utility functions for formatting and display
 */
export namespace SyncUtils {
  /**
   * Formats bytes for human readable display
   */
  export function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B"

    const k = 1024
    const sizes = ["B", "KB", "MB", "GB", "TB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
  }

  /**
   * Formats duration for display
   */
  export function formatDuration(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    } else {
      return `${seconds}s`
    }
  }

  /**
   * Generates a summary report for sync results
   */
  export function generateSyncReport(result: SyncResult): string {
    const lines: string[] = []
    lines.push("=== Sync Report ===")
    lines.push(`Status: ${result.success ? "✅ Success" : "❌ Failed"}`)
    lines.push(`Duration: ${formatDuration(result.duration)}`)
    lines.push(`Total Files: ${result.totalFiles}`)
    lines.push(`Uploaded: ${result.uploadedFiles.length}`)
    lines.push(`Failed: ${result.failedFiles.length}`)
    lines.push(`Skipped: ${result.skippedFiles.length}`)
    lines.push(`Total Uploaded: ${formatBytes(result.totalBytesUploaded)}`)

    if (result.failedFiles.length > 0) {
      lines.push("\nFailed Files:")
      for (const failure of result.failedFiles.slice(0, 10)) {
        lines.push(`  ❌ ${failure.path}: ${failure.error}`)
      }
      if (result.failedFiles.length > 10) {
        lines.push(`  ... and ${result.failedFiles.length - 10} more`)
      }
    }

    return lines.join("\n")
  }
}
