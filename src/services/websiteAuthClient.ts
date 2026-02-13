const normalizeBaseUrl = (value: string): string => value.replace(/\/+$/, '')

const defaultWebsiteBaseUrl = 'https://www.comicuniverse.app'

const configuredWebsiteBaseUrl = normalizeBaseUrl(
  import.meta.env.VITE_WEBSITE_API_BASE_URL || defaultWebsiteBaseUrl
)

let websiteApiBaseUrl = configuredWebsiteBaseUrl

interface RequestErrorPayload {
  error?: string
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const hasBody = init?.body !== undefined && init?.body !== null
  const baseHeaders = new Headers(init?.headers)

  // Avoid forcing CORS preflight for public website endpoints.
  // The body is still JSON, but we let fetch use its default content-type.
  if (!baseHeaders.has('Content-Type') && hasBody) {
    baseHeaders.set('Accept', 'application/json')
  }

  const response = await fetch(url, {
    headers: baseHeaders,
    ...init
  })

  const text = await response.text()
  if (!response.ok) {
    let message = `Website request failed (${response.status})`
    try {
      const payload = JSON.parse(text) as RequestErrorPayload
      if (payload.error) {
        message = payload.error
      }
    } catch {
      if (text) {
        message = text
      }
    }

    throw new Error(message)
  }

  return JSON.parse(text) as T
}

export interface WebsiteAppLoginRequest {
  email: string
  password: string
  userId?: string
  deviceName: string
}

export interface WebsiteAppLoginResponse {
  token: string
  expiresAt: string
  deviceName: string
  websiteUserId: string
  email: string
}

interface WebsiteUser {
  id: string
  email: string
  username: string | null
  displayName: string | null
}

export interface WebsiteVerifyTokenResponse {
  message: string
  user: WebsiteUser
  deviceName: string
  expiresAt: string
}

export interface WebsiteRegisterRequest {
  email: string
  username: string
  displayName: string
  password: string
}

export interface WebsiteRegisterResponse {
  message: string
  user: {
    id: string
    email: string
    username: string
    displayName: string
    avatarUrl: string | null
    isEmailVerified: boolean
  }
}

export async function websiteAppLogin(
  payload: WebsiteAppLoginRequest
): Promise<WebsiteAppLoginResponse> {
  return requestJson<WebsiteAppLoginResponse>(`${websiteApiBaseUrl}/api/auth/app-login`, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export async function websiteVerifyAppToken(token: string): Promise<WebsiteVerifyTokenResponse> {
  return requestJson<WebsiteVerifyTokenResponse>(`${websiteApiBaseUrl}/api/auth/verify-app-token`, {
    method: 'POST',
    body: JSON.stringify({ token })
  })
}

export async function websiteRegister(
  payload: WebsiteRegisterRequest
): Promise<WebsiteRegisterResponse> {
  return requestJson<WebsiteRegisterResponse>(`${websiteApiBaseUrl}/api/auth/register`, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function setWebsiteApiBaseUrl(value: string): void {
  websiteApiBaseUrl = normalizeBaseUrl(value)
}

export function getWebsiteApiBaseUrl(): string {
  return websiteApiBaseUrl
}
