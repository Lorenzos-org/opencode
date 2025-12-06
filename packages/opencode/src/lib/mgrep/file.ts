import { Log } from "../../util/log"
import { promises as fs } from "fs"
import * as path from "path"

const log = Log.create({ service: "mgrep-file" })

/**
 * Default glob patterns to ignore during file indexing.
 * These are not recognized as binary and also can't be uploaded to Mixedbread.
 */
export const DEFAULT_IGNORE_PATTERNS: readonly string[] = [
  "*.lock",
  "*.bin",
  "*.ipynb",
  "*.pyc",
  "*.safetensors",
  "*.sqlite",
  "*.pt",
]

/**
 * Configuration options for file system operations
 */
export interface FileSystemOptions {
  /**
   * Additional glob patterns to ignore (in addition to .gitignore and hidden files)
   */
  ignorePatterns: string[]
}

/**
 * File type detection result
 */
export interface FileTypeResult {
  /**
   * Whether the file is text
   */
  isText: boolean
  /**
   * Whether the file is binary
   */
  isBinary: boolean
  /**
   * File MIME type if detected
   */
  mimeType?: string
  /**
   * File encoding if detected
   */
  encoding?: string
}

/**
 * File information
 */
export interface FileInfo {
  /**
   * Absolute file path
   */
  path: string
  /**
   * File name
   */
  name: string
  /**
   * File extension
   */
  extension: string
  /**
   * File size in bytes
   */
  size: number
  /**
   * Last modified timestamp
   */
  modified: number
  /**
   * File type information
   */
  type: FileTypeResult
  /**
   * Whether the file is ignored
   */
  ignored: boolean
}

/**
 * File reading options
 */
export interface FileReadOptions {
  /**
   * Encoding to use for text files
   */
  encoding?: "utf8" | "ascii" | "utf16le" | "ucs2" | "latin1" | "binary" | "base64" | "hex"
  /**
   * Maximum file size to read (bytes)
   */
  maxSize?: number
  /**
   * Whether to stream the file instead of reading all at once
   */
  stream?: boolean
  /**
   * Number of bytes to read from start (for preview)
   */
  preview?: number
}

/**
 * File streaming result
 */
export interface FileStreamResult {
  /**
   * Readable stream
   */
  stream: ReadableStream<Uint8Array>
  /**
   * File size
   */
  size: number
  /**
   * File path
   */
  path: string
}

/**
 * Interface for file system operations
 */
export interface FileSystem {
  /**
   * Gets all files in a directory
   */
  getFiles(dirRoot: string): AsyncGenerator<string>

  /**
   * Checks if a file should be ignored
   */
  isIgnored(filePath: string, root: string): boolean

  /**
   * Loads the mgrepignore file for a directory
   */
  loadMgrepignore(dirRoot: string): void

  /**
   * Gets file information
   */
  getFileInfo(filePath: string, root: string): Promise<FileInfo | null>

  /**
   * Reads file content
   */
  readFile(filePath: string, options?: FileReadOptions): Promise<string | Uint8Array>

  /**
   * Creates a file stream
   */
  createFileStream(filePath: string): Promise<FileStreamResult | null>

  /**
   * Detects file type
   */
  detectFileType(filePath: string): Promise<FileTypeResult>
}

/**
 * Node.js implementation of FileSystem with gitignore support
 */
export class NodeFileSystem implements FileSystem {
  private ignoreCache = new Map<string, IgnoreFilter>()

  constructor(private options: FileSystemOptions = { ignorePatterns: [] }) {}

  /**
   * Checks if a file is a hidden file (starts with .)
   */
  private isHiddenFile(filePath: string, root: string): boolean {
    const relativePath = path.relative(root, filePath)
    const parts = relativePath.split(path.sep)
    return parts.some((part) => part.startsWith(".") && part !== "." && part !== "..")
  }

  /**
   * Gets all files recursively from a directory
   */
  private async *getAllFilesRecursive(dir: string, root: string): AsyncGenerator<string> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)

        if (this.isHiddenFile(fullPath, root)) {
          continue
        }

        if (this.isIgnored(fullPath, root)) {
          continue
        }

        if (entry.isDirectory()) {
          yield* this.getAllFilesRecursive(fullPath, root)
        } else if (entry.isFile()) {
          yield fullPath
        }
      }
    } catch (error) {
      log.error("Failed to read directory", { dir, error: error instanceof Error ? error.message : error })
    }
  }

  async *getFiles(dirRoot: string): AsyncGenerator<string> {
    // Preload root .mgrepignore to ensure it's cached
    this.getDirectoryIgnoreFilter(dirRoot)

    if (await this.isGitRepository(dirRoot)) {
      yield* this.getGitFiles(dirRoot)
    } else {
      yield* this.getAllFilesRecursive(dirRoot, dirRoot)
    }
  }

  private getDirectoryIgnoreFilter(dir: string): IgnoreFilter {
    if (this.ignoreCache.has(dir)) {
      return this.ignoreCache.get(dir)!
    }

    const filter = new IgnoreFilter()

    // Load .gitignore
    const gitignorePath = path.join(dir, ".gitignore")
    try {
      if (await this.fileExists(gitignorePath)) {
        const content = await fs.readFile(gitignorePath, "utf8")
        filter.addPatterns(content)
      }
    } catch (error) {
      log.error("Failed to read .gitignore", { path: gitignorePath, error })
    }

    // Load .mgrepignore
    const mgrepignorePath = path.join(dir, ".mgrepignore")
    try {
      if (await this.fileExists(mgrepignorePath)) {
        const content = await fs.readFile(mgrepignorePath, "utf8")
        filter.addPatterns(content)
      }
    } catch (error) {
      log.error("Failed to read .mgrepignore", { path: mgrepignorePath, error })
    }

    this.ignoreCache.set(dir, filter)
    return filter
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  isIgnored(filePath: string, root: string): boolean {
    // Always ignore hidden files
    if (this.isHiddenFile(filePath, root)) {
      return true
    }

    // Check custom ignore patterns (global/CLI)
    const relativeToRoot = path.relative(root, filePath)
    const normalizedRootPath = relativeToRoot.replace(/\\/g, "/")

    // Check if it's a directory
    let isDirectory = false
    try {
      const stat = fs.statSync(filePath)
      isDirectory = stat.isDirectory()
    } catch {
      isDirectory = false
    }

    const pathToCheckRoot = isDirectory ? `${normalizedRootPath}/` : normalizedRootPath

    // Check custom patterns
    const customFilter = new IgnoreFilter()
    customFilter.addPatterns(this.options.ignorePatterns.join("\n"))
    if (customFilter.ignores(pathToCheckRoot)) {
      return true
    }

    // Hierarchical check
    let currentDir = isDirectory ? filePath : path.dirname(filePath)
    const absoluteRoot = path.resolve(root)

    // Walk up from file directory to root
    while (true) {
      const relativeToCurrent = path.relative(currentDir, filePath)
      if (relativeToCurrent !== "") {
        const normalizedRelative = relativeToCurrent.replace(/\\/g, "/")
        const pathToCheck = isDirectory ? `${normalizedRelative}/` : normalizedRelative

        const filter = this.getDirectoryIgnoreFilter(currentDir)

        if (filter.ignores(pathToCheck)) {
          return true
        }
      }

      if (path.resolve(currentDir) === absoluteRoot) {
        break
      }
      const parent = path.dirname(currentDir)
      if (parent === currentDir) break // Safety break for root of fs
      currentDir = parent
    }

    return false
  }

  loadMgrepignore(dirRoot: string): void {
    this.getDirectoryIgnoreFilter(dirRoot)
  }

  async getFileInfo(filePath: string, root: string): Promise<FileInfo | null> {
    try {
      const stat = await fs.stat(filePath)
      const fileType = await this.detectFileType(filePath)

      return {
        path: filePath,
        name: path.basename(filePath),
        extension: path.extname(filePath),
        size: stat.size,
        modified: stat.mtime.getTime(),
        type: fileType,
        ignored: this.isIgnored(filePath, root),
      }
    } catch (error) {
      log.error("Failed to get file info", { filePath, error })
      return null
    }
  }

  async readFile(filePath: string, options: FileReadOptions = {}): Promise<string | Uint8Array> {
    const {
      encoding = "utf8",
      maxSize = 10 * 1024 * 1024, // 10MB default
      stream = false,
      preview,
    } = options

    try {
      // Check file size first
      const stat = await fs.stat(filePath)
      if (stat.size > maxSize) {
        throw new Error(`File too large: ${stat.size} bytes (max: ${maxSize})`)
      }

      if (preview && preview < stat.size) {
        // Read preview bytes
        const file = Bun.file(filePath)
        return await file.slice(0, preview).text()
      }

      if (stream) {
        const file = Bun.file(filePath)
        return new Uint8Array(await file.arrayBuffer())
      }

      // Detect if file is binary
      const fileType = await this.detectFileType(filePath)
      if (!fileType.isText) {
        const file = Bun.file(filePath)
        return new Uint8Array(await file.arrayBuffer())
      }

      return await fs.readFile(filePath, encoding)
    } catch (error) {
      log.error("Failed to read file", { filePath, error })
      throw error
    }
  }

  async createFileStream(filePath: string): Promise<FileStreamResult | null> {
    try {
      const stat = await fs.stat(filePath)
      const file = Bun.file(filePath)

      return {
        stream: file.stream(),
        size: stat.size,
        path: filePath,
      }
    } catch (error) {
      log.error("Failed to create file stream", { filePath, error })
      return null
    }
  }

  async detectFileType(filePath: string): Promise<FileTypeResult> {
    try {
      const file = Bun.file(filePath)
      const exists = await file.exists()

      if (!exists) {
        return { isText: false, isBinary: true }
      }

      // Use Bun's built-in type detection
      const type = await file.type()

      // Check common text extensions
      const textExtensions = [
        ".ts",
        ".js",
        ".jsx",
        ".tsx",
        ".vue",
        ".svelte",
        ".py",
        ".rb",
        ".php",
        ".java",
        ".c",
        ".cpp",
        ".h",
        ".hpp",
        ".go",
        ".rs",
        ".swift",
        ".kt",
        ".scala",
        ".html",
        ".htm",
        ".css",
        ".scss",
        ".sass",
        ".less",
        ".json",
        ".yaml",
        ".yml",
        ".toml",
        ".ini",
        ".cfg",
        ".md",
        ".txt",
        ".rst",
        ".adoc",
        ".sh",
        ".bash",
        ".zsh",
        ".fish",
        ".ps1",
        ".sql",
        ".graphql",
        ".proto",
        ".xml",
        ".csv",
        ".tsv",
      ]

      const ext = path.extname(filePath).toLowerCase()
      const isLikelyText =
        textExtensions.includes(ext) ||
        type.startsWith("text/") ||
        type === "application/json" ||
        type === "application/xml" ||
        type.includes("javascript")

      // For small files, do content-based detection
      if (file.size <= 8192) {
        const buffer = await file.arrayBuffer()
        const view = new Uint8Array(buffer)

        // Check for null bytes (indicator of binary)
        const hasNullBytes = view.includes(0)

        // Check for high ratio of non-printable characters
        let printableCount = 0
        for (let i = 0; i < Math.min(view.length, 1024); i++) {
          const byte = view[i]
          if ((byte >= 32 && byte <= 126) || byte === 9 || byte === 10 || byte === 13) {
            printableCount++
          }
        }

        const printableRatio = printableCount / Math.min(view.length, 1024)
        const isTextByContent = !hasNullBytes && printableRatio > 0.7

        return {
          isText: isTextByContent,
          isBinary: !isTextByContent,
          mimeType: type,
          encoding: isTextByContent ? "utf8" : undefined,
        }
      }

      return {
        isText: isLikelyText,
        isBinary: !isLikelyText,
        mimeType: type,
        encoding: isLikelyText ? "utf8" : undefined,
      }
    } catch (error) {
      log.error("Failed to detect file type", { filePath, error })
      return { isText: false, isBinary: true }
    }
  }

  private async isGitRepository(dir: string): Promise<boolean> {
    try {
      const result = Bun.spawnSync(["git", "rev-parse", "--git-dir"], {
        cwd: dir,
        stdout: "pipe",
        stderr: "pipe",
      })
      return result.exitCode === 0
    } catch {
      return false
    }
  }

  private async *getGitFiles(dirRoot: string): AsyncGenerator<string> {
    try {
      const run = async (args: string[]) => {
        const result = Bun.spawnSync(["git", ...args], {
          cwd: dirRoot,
          stdout: "pipe",
          stderr: "pipe",
        })

        if (result.exitCode !== 0) {
          log.error("Git command failed", { args, exitCode: result.exitCode })
          return ""
        }

        return new TextDecoder().decode(result.stdout as Uint8Array)
      }

      const tracked = await run(["ls-files", "-z"])
      const untracked = await run(["ls-files", "--others", "--exclude-standard", "-z"])

      const trackedFiles = tracked.split("\u0000").filter(Boolean)
      const untrackedFiles = untracked.split("\u0000").filter(Boolean)
      const allRel = Array.from(new Set([...trackedFiles, ...untrackedFiles]))

      for (const rel of allRel) {
        yield path.join(dirRoot, rel)
      }
    } catch (error) {
      log.error("Failed to get files from git", { dirRoot, error })
    }
  }
}

/**
 * Simple ignore filter implementation
 */
class IgnoreFilter {
  private patterns: string[] = []

  addPatterns(patterns: string): void {
    const lines = patterns
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))

    this.patterns.push(...lines)
  }

  ignores(filePath: string): boolean {
    for (const pattern of this.patterns) {
      if (this.matchesPattern(filePath, pattern)) {
        return true
      }
    }
    return false
  }

  private matchesPattern(filePath: string, pattern: string): boolean {
    // Simple glob pattern matching
    const regex = new RegExp("^" + pattern.replace(/\./g, "\\.").replace(/\*/g, ".*").replace(/\?/g, ".") + "$")

    return regex.test(filePath)
  }
}

/**
 * Default file system instance
 */
export const defaultFileSystem = new NodeFileSystem({
  ignorePatterns: [...DEFAULT_IGNORE_PATTERNS],
})

/**
 * File utilities
 */
export namespace FileUtils {
  /**
   * Gets all files from a directory with filtering
   */
  export async function getAllFiles(
    root: string,
    options?: FileSystemOptions & {
      includeIgnored?: boolean
      maxDepth?: number
    },
  ): Promise<FileInfo[]> {
    const fs = new NodeFileSystem(options || { ignorePatterns: [] })
    const files: FileInfo[] = []
    const { includeIgnored = false } = options || {}

    for await (const filePath of fs.getFiles(root)) {
      if (!includeIgnored && fs.isIgnored(filePath, root)) {
        continue
      }

      const fileInfo = await fs.getFileInfo(filePath, root)
      if (fileInfo) {
        files.push(fileInfo)
      }
    }

    return files
  }

  /**
   * Reads a text file safely
   */
  export async function readTextFile(filePath: string, options?: FileReadOptions): Promise<string> {
    const fs = new NodeFileSystem()
    const content = await fs.readFile(filePath, { ...options, encoding: "utf8" })

    if (typeof content !== "string") {
      throw new Error("File is not text")
    }

    return content
  }

  /**
   * Reads a binary file safely
   */
  export async function readBinaryFile(filePath: string, options?: FileReadOptions): Promise<Uint8Array> {
    const fs = new NodeFileSystem()
    const content = await fs.readFile(filePath, options)

    if (typeof content === "string") {
      throw new Error("File is not binary")
    }

    return content
  }

  /**
   * Checks if a file is likely text based on extension and content
   */
  export async function isTextFile(filePath: string): Promise<boolean> {
    const fs = new NodeFileSystem()
    const result = await fs.detectFileType(filePath)
    return result.isText
  }

  /**
   * Creates a file stream for large files
   */
  export async function createFileStream(filePath: string): Promise<FileStreamResult | null> {
    const fs = new NodeFileSystem()
    return fs.createFileStream(filePath)
  }

  /**
   * Gets file preview (first N bytes)
   */
  export async function getFilePreview(filePath: string, bytes: number = 1024): Promise<string> {
    const fs = new NodeFileSystem()
    const content = await fs.readFile(filePath, { preview: bytes, encoding: "utf8" })

    if (typeof content !== "string") {
      throw new Error("Cannot create preview for binary file")
    }

    return content
  }
}
