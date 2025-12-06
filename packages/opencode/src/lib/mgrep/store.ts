import { Log } from "../../util/log"
import { getJWTToken } from "./auth"
import { Utils } from "./utils"
import fs from "fs/promises"

const log = Log.create({ service: "mgrep-store" })

export const STORE_API_URL = Utils.isDevelopment() ? "http://localhost:3001" : "https://www.platform.mixedbread.com"

export interface StoreFile {
  id: string
  name: string
  size: number
  contentType: string
  createdAt: string
  updatedAt: string
  url?: string
  metadata?: Record<string, any>
}

export interface StoreUploadResponse {
  id: string
  name: string
  size: number
  contentType: string
  createdAt: string
  url: string
  metadata?: Record<string, any>
}

export interface StoreListResponse {
  files: StoreFile[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

export interface StoreQuota {
  used: number
  limit: number
  remaining: number
  resetAt: string
}

export interface StoreErrorData {
  code: string
  message: string
  details?: any
}

/**
 * Store client for Mixedbread platform file management
 */
export namespace StoreClient {
  /**
   * Uploads a file to the store
   */
  export async function uploadFile(
    filePath: string,
    options?: {
      name?: string
      contentType?: string
      metadata?: Record<string, any>
    },
  ): Promise<StoreUploadResponse> {
    log.info("Starting file upload", { filePath, options })

    try {
      const token = await getJWTToken()
      const file = Bun.file(filePath)

      if (!(await file.exists())) {
        throw new StoreError("FILE_NOT_FOUND", `File not found: ${filePath}`)
      }

      const fileName = options?.name || filePath.split("/").pop() || "unknown"
      const contentType = options?.contentType || "application/octet-stream"
      const fileSize = await file.size()

      // Create multipart form data
      const formData = new FormData()
      formData.append("file", file)
      formData.append("name", fileName)
      formData.append("content_type", contentType)

      if (options?.metadata) {
        formData.append("metadata", JSON.stringify(options.metadata))
      }

      const response = await fetch(`${STORE_API_URL}/api/store/files`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      if (!response.ok) {
        await handleStoreError(response)
      }

      const data = await response.json()
      log.info("File uploaded successfully", { fileId: data.id, fileName, size: fileSize })

      return {
        id: data.id,
        name: data.name,
        size: data.size,
        contentType: data.content_type,
        createdAt: data.created_at,
        url: data.url,
        metadata: data.metadata,
      }
    } catch (error) {
      if (error instanceof StoreError) {
        throw error
      }
      log.error("File upload failed", { error: error instanceof Error ? error.message : error })
      throw new StoreError("UPLOAD_FAILED", `Failed to upload file: ${error instanceof Error ? error.message : error}`)
    }
  }

  /**
   * Lists files in the store
   */
  export async function listFiles(options?: {
    limit?: number
    offset?: number
    sortBy?: "name" | "created_at" | "updated_at" | "size"
    sortOrder?: "asc" | "desc"
  }): Promise<StoreListResponse> {
    log.info("Listing files", { options })

    try {
      const token = await getJWTToken()

      const params = new URLSearchParams()
      if (options?.limit) params.append("limit", options.limit.toString())
      if (options?.offset) params.append("offset", options.offset.toString())
      if (options?.sortBy) params.append("sort_by", options.sortBy)
      if (options?.sortOrder) params.append("sort_order", options.sortOrder)

      const response = await fetch(`${STORE_API_URL}/api/store/files?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        await handleStoreError(response)
      }

      const data = await response.json()
      log.info("Files listed successfully", { count: data.files.length, total: data.total })

      return {
        files: data.files.map((file: any) => ({
          id: file.id,
          name: file.name,
          size: file.size,
          contentType: file.content_type,
          createdAt: file.created_at,
          updatedAt: file.updated_at,
          url: file.url,
          metadata: file.metadata,
        })),
        total: data.total,
        limit: data.limit,
        offset: data.offset,
        hasMore: data.has_more,
      }
    } catch (error) {
      if (error instanceof StoreError) {
        throw error
      }
      log.error("Failed to list files", { error: error instanceof Error ? error.message : error })
      throw new StoreError("LIST_FAILED", `Failed to list files: ${error instanceof Error ? error.message : error}`)
    }
  }

  /**
   * Gets a specific file by ID
   */
  export async function getFile(fileId: string): Promise<StoreFile> {
    log.info("Getting file", { fileId })

    try {
      const token = await getJWTToken()

      const response = await fetch(`${STORE_API_URL}/api/store/files/${fileId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        await handleStoreError(response)
      }

      const data = await response.json()
      log.info("File retrieved successfully", { fileId, fileName: data.name })

      return {
        id: data.id,
        name: data.name,
        size: data.size,
        contentType: data.content_type,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        url: data.url,
        metadata: data.metadata,
      }
    } catch (error) {
      if (error instanceof StoreError) {
        throw error
      }
      log.error("Failed to get file", { error: error instanceof Error ? error.message : error })
      throw new StoreError("GET_FAILED", `Failed to get file: ${error instanceof Error ? error.message : error}`)
    }
  }

  /**
   * Deletes a file from the store
   */
  export async function deleteFile(fileId: string): Promise<void> {
    log.info("Deleting file", { fileId })

    try {
      const token = await getJWTToken()

      const response = await fetch(`${STORE_API_URL}/api/store/files/${fileId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        await handleStoreError(response)
      }

      log.info("File deleted successfully", { fileId })
    } catch (error) {
      if (error instanceof StoreError) {
        throw error
      }
      log.error("Failed to delete file", { error: error instanceof Error ? error.message : error })
      throw new StoreError("DELETE_FAILED", `Failed to delete file: ${error instanceof Error ? error.message : error}`)
    }
  }

  /**
   * Gets store quota information
   */
  export async function getQuota(): Promise<StoreQuota> {
    log.info("Getting store quota")

    try {
      const token = await getJWTToken()

      const response = await fetch(`${STORE_API_URL}/api/store/quota`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        await handleStoreError(response)
      }

      const data = await response.json()
      log.info("Store quota retrieved", { used: data.used, limit: data.limit, remaining: data.remaining })

      return {
        used: data.used,
        limit: data.limit,
        remaining: data.remaining,
        resetAt: data.reset_at,
      }
    } catch (error) {
      if (error instanceof StoreError) {
        throw error
      }
      log.error("Failed to get store quota", { error: error instanceof Error ? error.message : error })
      throw new StoreError(
        "QUOTA_FAILED",
        `Failed to get store quota: ${error instanceof Error ? error.message : error}`,
      )
    }
  }

  /**
   * Downloads a file from the store
   */
  export async function downloadFile(fileId: string, destinationPath?: string): Promise<ArrayBuffer | string> {
    log.info("Downloading file", { fileId, destinationPath })

    try {
      const token = await getJWTToken()

      const response = await fetch(`${STORE_API_URL}/api/store/files/${fileId}/download`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        await handleStoreError(response)
      }

      const data = await response.arrayBuffer()

      if (destinationPath) {
        // Ensure directory exists
        const dir = destinationPath.split("/").slice(0, -1).join("/")
        await fs.mkdir(dir, { recursive: true })

        // Write file to destination
        await Bun.write(destinationPath, data)
        log.info("File downloaded successfully", { fileId, destinationPath })
        return destinationPath
      }

      log.info("File downloaded successfully", { fileId })
      return data
    } catch (error) {
      if (error instanceof StoreError) {
        throw error
      }
      log.error("Failed to download file", { error: error instanceof Error ? error.message : error })
      throw new StoreError(
        "DOWNLOAD_FAILED",
        `Failed to download file: ${error instanceof Error ? error.message : error}`,
      )
    }
  }
}

/**
 * Handles store API errors with proper error codes and messages
 */
async function handleStoreError(response: Response): Promise<never> {
  let errorData: any = {}

  try {
    errorData = await response.json()
  } catch {
    // If response is not JSON, use status text
  }

  const statusCode = response.status
  let errorCode = "UNKNOWN_ERROR"
  let errorMessage = errorData.message || response.statusText

  // Map HTTP status codes to store error codes
  switch (statusCode) {
    case 400:
      errorCode = "BAD_REQUEST"
      break
    case 401:
      errorCode = "UNAUTHORIZED"
      errorMessage = "Authentication required. Please run 'mgrep login' to authenticate."
      break
    case 403:
      errorCode = "FORBIDDEN"
      errorMessage = "Access denied. You don't have permission to perform this action."
      break
    case 404:
      errorCode = "NOT_FOUND"
      break
    case 413:
      errorCode = "FILE_TOO_LARGE"
      errorMessage = "File size exceeds the maximum allowed limit."
      break
    case 429:
      errorCode = "RATE_LIMIT_EXCEEDED"
      errorMessage = "Rate limit exceeded. Please try again later."
      break
    case 507:
      errorCode = "QUOTA_EXCEEDED"
      errorMessage = "Storage quota exceeded. Please delete some files or upgrade your plan."
      break
    default:
      if (statusCode >= 500) {
        errorCode = "SERVER_ERROR"
        errorMessage = "Server error. Please try again later."
      }
  }

  // Use specific error code from API if provided
  if (errorData.code) {
    errorCode = errorData.code
  }

  log.error("Store API error", { statusCode, errorCode, errorMessage, details: errorData })
  throw new StoreError(errorCode, errorMessage, errorData.details)
}

/**
 * Error class for store operations
 */
export class StoreError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any,
  ) {
    super(message)
    this.name = "StoreError"
  }
}

/**
 * Handles store errors with proper logging and user-friendly messages
 */
export function handleStoreOperationError(error: unknown): never {
  if (error instanceof StoreError) {
    // Provide user-friendly messages for common errors
    switch (error.code) {
      case "UNAUTHORIZED":
        console.error("Authentication required. Please run 'mgrep login' to authenticate.")
        break
      case "QUOTA_EXCEEDED":
        console.error("Storage quota exceeded. Use 'mgrep store quota' to check your usage.")
        break
      case "RATE_LIMIT_EXCEEDED":
        console.error("Rate limit exceeded. Please wait before trying again.")
        break
      case "FILE_TOO_LARGE":
        console.error("File is too large. Please compress it or use a smaller file.")
        break
      default:
        console.error(`Store error (${error.code}): ${error.message}`)
    }
    throw error
  }

  if (error instanceof Error) {
    log.error("Store operation error", { message: error.message, stack: error.stack })
    throw new StoreError("OPERATION_FAILED", error.message)
  }

  log.error("Unknown store error", { error })
  throw new StoreError("UNKNOWN_ERROR", "An unknown store error occurred")
}

/**
 * Upload utility with retry logic for large files
 */
export async function uploadFileWithRetry(
  filePath: string,
  options?: {
    name?: string
    contentType?: string
    metadata?: Record<string, any>
    maxRetries?: number
  },
): Promise<StoreUploadResponse> {
  const maxRetries = options?.maxRetries || 3

  return Utils.retry(
    async () => {
      return StoreClient.uploadFile(filePath, options)
    },
    maxRetries,
    2000,
  ) // 2 second base delay
}

/**
 * Batch upload multiple files
 */
export async function uploadMultipleFiles(
  filePaths: string[],
  options?: {
    metadata?: Record<string, any>
    maxConcurrency?: number
  },
): Promise<StoreUploadResponse[]> {
  const maxConcurrency = options?.maxConcurrency || 3
  const results: StoreUploadResponse[] = []

  // Process files in batches to avoid overwhelming the API
  for (let i = 0; i < filePaths.length; i += maxConcurrency) {
    const batch = filePaths.slice(i, i + maxConcurrency)
    const batchPromises = batch.map(async (filePath) => {
      try {
        return await uploadFileWithRetry(filePath, {
          metadata: options?.metadata,
        })
      } catch (error) {
        log.error("Failed to upload file in batch", { filePath, error })
        throw error
      }
    })

    const batchResults = await Promise.all(batchPromises)
    results.push(...batchResults)
  }

  log.info("Batch upload completed", { totalFiles: filePaths.length, successful: results.length })
  return results
}
