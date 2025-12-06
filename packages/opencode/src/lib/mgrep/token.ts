import { Log } from "../../util/log"
import { Global } from "../../global"
import path from "path"
import fs from "fs/promises"

export namespace Token {
  const log = Log.create({ service: "mgrep-token" })

  export interface StoredToken {
    access_token: string
    refresh_token?: string
    expires_at: number
    token_type: string
    scope?: string
  }

  const TOKEN_FILE = path.join(Global.Path.home, ".mgrep", "token.json")

  /**
   * Gets the stored authentication token from disk
   */
  export async function getStoredToken(): Promise<StoredToken | null> {
    try {
      const tokenFile = Bun.file(TOKEN_FILE)
      if (!(await tokenFile.exists())) {
        return null
      }

      const content = await tokenFile.text()
      const token = JSON.parse(content) as StoredToken

      // Check if token is expired
      if (Date.now() >= token.expires_at) {
        log.info("Stored token has expired")
        await removeStoredToken()
        return null
      }

      log.info("Retrieved valid stored token")
      return token
    } catch (error) {
      log.error("Failed to get stored token", { error: error instanceof Error ? error.message : error })
      return null
    }
  }

  /**
   * Stores authentication token to disk
   */
  export async function storeToken(token: StoredToken): Promise<void> {
    try {
      // Ensure directory exists
      const dir = path.dirname(TOKEN_FILE)
      await fs.mkdir(dir, { recursive: true })

      // Write token to file
      await Bun.write(TOKEN_FILE, JSON.stringify(token, null, 2))

      // Set file permissions to be readable only by owner
      await fs.chmod(TOKEN_FILE, 0o600)

      log.info("Token stored successfully")
    } catch (error) {
      log.error("Failed to store token", { error: error instanceof Error ? error.message : error })
      throw new Error(`Failed to store token: ${error instanceof Error ? error.message : error}`)
    }
  }

  /**
   * Removes stored token from disk
   */
  export async function removeStoredToken(): Promise<void> {
    try {
      await fs.unlink(TOKEN_FILE)
      log.info("Stored token removed")
    } catch (error) {
      log.error("Failed to remove stored token", { error: error instanceof Error ? error.message : error })
    }
  }

  /**
   * Checks if a valid stored token exists
   */
  export async function hasValidToken(): Promise<boolean> {
    const token = await getStoredToken()
    return token !== null
  }
}
