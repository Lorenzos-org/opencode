export namespace Utils {
  /**
   * Checks if the current environment is development
   */
  export function isDevelopment(): boolean {
    return process.env.NODE_ENV === "development" || process.env.NODE_ENV === "dev" || !process.env.NODE_ENV
  }

  /**
   * Gets the current environment
   */
  export function getEnvironment(): "development" | "production" | "test" {
    const env = process.env.NODE_ENV?.toLowerCase()
    if (env === "production" || env === "prod") return "production"
    if (env === "test") return "test"
    return "development"
  }

  /**
   * Sleeps for the specified number of milliseconds
   */
  export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Retries a function with exponential backoff
   */
  export async function retry<T>(fn: () => Promise<T>, maxAttempts: number = 3, baseDelay: number = 1000): Promise<T> {
    let lastError: Error

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        if (attempt === maxAttempts) {
          throw lastError
        }

        const delay = baseDelay * Math.pow(2, attempt - 1)
        await sleep(delay)
      }
    }

    throw lastError!
  }

  /**
   * Formats a timestamp for display
   */
  export function formatTimestamp(timestamp: number): string {
    return new Date(timestamp).toISOString()
  }

  /**
   * Validates that a value is not null or undefined
   */
  export function assertNotNull<T>(value: T | null | undefined, message?: string): T {
    if (value === null || value === undefined) {
      throw new Error(message || "Value cannot be null or undefined")
    }
    return value
  }
}
