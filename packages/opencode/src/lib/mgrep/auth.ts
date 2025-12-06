import { Log } from "../../util/log"
import { Token } from "./token"
import { Utils } from "./utils"

const log = Log.create({ service: "mgrep-auth" })

export const SERVER_URL = Utils.isDevelopment() ? "http://localhost:3001" : "https://www.platform.mixedbread.com"

export interface DeviceAuthResponse {
  userCode: string
  deviceCode: string
  verificationUri: string
  expiresIn: number
  interval: number
}

export interface Session {
  user: {
    id: string
    email: string
    name: string
    image?: string
    emailVerified: boolean
  }
  organization?: {
    id: string
    name: string
    slug: string
    logo?: string
    createdAt: Date
    updatedAt: Date
  }
}

/**
 * Authentication client for Mixedbread platform
 */
export namespace AuthClient {
  /**
   * Initiates device authorization flow
   */
  export async function deviceAuthorization(options?: { callbackURL?: string }): Promise<DeviceAuthResponse> {
    log.info("Starting device authorization flow", { options })

    const response = await fetch(`${SERVER_URL}/oauth/device_authorization`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_name: "opencode-mgrep",
        callback_url: options?.callbackURL,
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to initiate device authorization: ${response.statusText}`)
    }

    const data = await response.json()
    log.info("Device authorization initiated", { userCode: data.user_code })

    return {
      userCode: data.user_code,
      deviceCode: data.device_code,
      verificationUri: data.verification_uri,
      expiresIn: data.expires_in,
      interval: data.interval,
    }
  }

  /**
   * Polls for device authorization completion
   */
  export async function pollDeviceAuthorization(
    deviceCode: string,
    interval: number,
    maxAttempts: number = 60,
  ): Promise<{ accessToken: string; refreshToken?: string; expiresIn: number }> {
    log.info("Polling for device authorization completion", { deviceCode })

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const response = await fetch(`${SERVER_URL}/oauth/device_token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          device_code: deviceCode,
          client_id: "opencode-mgrep",
        }),
      })

      if (response.ok) {
        const data = await response.json()
        log.info("Device authorization successful")
        return {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresIn: data.expires_in,
        }
      }

      if (response.status !== 400) {
        throw new Error(`Authorization failed: ${response.statusText}`)
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, interval * 1000))
    }

    throw new Error("Device authorization timed out. Please try again.")
  }

  /**
   * Gets current user session
   */
  export async function getSession(): Promise<Session | null> {
    try {
      const token = await Token.getStoredToken()
      if (!token) {
        return null
      }

      const response = await fetch(`${SERVER_URL}/api/session`, {
        headers: {
          Authorization: `Bearer ${token.access_token}`,
        },
      })

      if (!response.ok) {
        if (response.status === 401) {
          log.info("Token expired, removing stored token")
          await Token.removeStoredToken()
        }
        return null
      }

      const data = await response.json()
      return {
        user: {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
          image: data.user.image,
          emailVerified: data.user.email_verified,
        },
        organization: data.organization
          ? {
              id: data.organization.id,
              name: data.organization.name,
              slug: data.organization.slug,
              logo: data.organization.logo,
              createdAt: new Date(data.organization.created_at),
              updatedAt: new Date(data.organization.updated_at),
            }
          : undefined,
      }
    } catch (error) {
      log.error("Failed to get session", { error: error instanceof Error ? error.message : error })
      return null
    }
  }

  /**
   * Signs out current user
   */
  export async function signOut(redirectURL?: string): Promise<void> {
    try {
      const token = await Token.getStoredToken()
      if (token) {
        await fetch(`${SERVER_URL}/api/signout`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token.access_token}`,
          },
        })
      }

      await Token.removeStoredToken()
      log.info("User signed out successfully")
    } catch (error) {
      log.error("Sign out failed", { error: error instanceof Error ? error.message : error })
      // Still remove local token even if server sign out fails
      await Token.removeStoredToken()
    }
  }

  /**
   * Lists available organizations for the user
   */
  export async function listOrganizations(): Promise<Array<{ id: string; name: string; slug: string }>> {
    const session = await AuthClient.getSession()
    if (!session) {
      throw new Error("Not authenticated")
    }

    const token = await Token.getStoredToken()
    if (!token) {
      throw new Error("No authentication token found")
    }

    const response = await fetch(`${SERVER_URL}/api/organizations`, {
      headers: {
        Authorization: `Bearer ${token.access_token}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to list organizations: ${response.statusText}`)
    }

    const data = await response.json()
    return data.organizations || []
  }

  /**
   * Switches to a specific organization
   */
  export async function switchOrganization(organizationId: string): Promise<void> {
    const token = await Token.getStoredToken()
    if (!token) {
      throw new Error("No authentication token found")
    }

    const response = await fetch(`${SERVER_URL}/api/organizations/${organizationId}/switch`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.access_token}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to switch organization: ${response.statusText}`)
    }

    log.info("Switched to organization", { organizationId })
  }
}

/**
 * Gets API key from environment variable or exchanges stored token for JWT
 */
export async function getJWTToken(): Promise<string> {
  // Check for API key in environment variable first
  const apiKey = process.env.MXBAI_API_KEY
  if (apiKey) {
    return apiKey
  }

  // Fall back to OAuth token exchange
  const token = await Token.getStoredToken()
  if (!token) {
    throw new Error(
      "No authentication token found. Please run 'mgrep login' to authenticate or set MXBAI_API_KEY environment variable.",
    )
  }

  const response = await fetch(`${SERVER_URL}/api/auth/token`, {
    headers: {
      Authorization: `Bearer ${token.access_token}`,
    },
  })

  if (!response.ok) {
    throw new Error("Failed to get JWT token. Your token might have expired. Please run 'mgrep login' to authenticate.")
  }

  const data = await response.json()
  if (!data.token) {
    throw new Error("Failed to get JWT token. Your token might have expired. Please run 'mgrep login' to authenticate.")
  }

  return data.token
}

/**
 * Performs complete device authentication flow
 */
export async function performDeviceFlow(options?: { callbackURL?: string }): Promise<void> {
  try {
    log.info("Starting device authentication flow")

    const deviceAuth = await AuthClient.deviceAuthorization(options)

    console.log(`\nPlease visit: ${deviceAuth.verificationUri}`)
    console.log(`And enter code: ${deviceAuth.userCode}`)
    console.log("\nWaiting for authentication...")

    // Poll for authorization completion
    const tokenData = await AuthClient.pollDeviceAuthorization(deviceAuth.deviceCode, deviceAuth.interval)

    // Store the received tokens
    await Token.storeToken({
      access_token: tokenData.accessToken,
      refresh_token: tokenData.refreshToken,
      expires_at: Date.now() + tokenData.expiresIn * 1000,
      token_type: "Bearer",
    })

    log.info("Device authentication completed successfully")
    console.log("\n✓ Authentication successful!")
  } catch (error) {
    log.error("Device authentication failed", { error: error instanceof Error ? error.message : error })
    throw error
  }
}

/**
 * Gets current user session
 */
export async function getCurrentSession(): Promise<Session | null> {
  return await AuthClient.getSession()
}

/**
 * Signs out current user
 */
export async function signOut(redirectURL?: string): Promise<void> {
  await AuthClient.signOut(redirectURL)
}

/**
 * Error class for authentication failures
 */
export class AuthenticationError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message)
    this.name = "AuthenticationError"
  }
}

/**
 * Handles authentication errors with proper logging
 */
export function handleAuthError(error: unknown): never {
  if (error instanceof AuthenticationError) {
    throw error
  }

  if (error instanceof Error) {
    log.error("Authentication error", { message: error.message, stack: error.stack })
    throw new AuthenticationError(error.message)
  }

  log.error("Unknown authentication error", { error })
  throw new AuthenticationError("An unknown authentication error occurred")
}
