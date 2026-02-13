import { create } from 'zustand'

const ACCOUNT_STORAGE_KEY = 'comic-universe.account'

export interface AccountSession {
  token: string
  expiresAt: string
  deviceName: string
  email: string
  websiteUserId: string
  username?: string | null
  displayName?: string | null
}

const readStoredAccount = (): AccountSession | null => {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(ACCOUNT_STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as Partial<AccountSession>
    if (!parsed.token || typeof parsed.token !== 'string') return null
    if (!parsed.expiresAt || typeof parsed.expiresAt !== 'string') return null
    if (!parsed.deviceName || typeof parsed.deviceName !== 'string') return null
    if (!parsed.email || typeof parsed.email !== 'string') return null
    if (!parsed.websiteUserId || typeof parsed.websiteUserId !== 'string') return null

    return {
      token: parsed.token,
      expiresAt: parsed.expiresAt,
      deviceName: parsed.deviceName,
      email: parsed.email,
      websiteUserId: parsed.websiteUserId,
      username: parsed.username ?? null,
      displayName: parsed.displayName ?? null
    }
  } catch {
    return null
  }
}

const writeStoredAccount = (account: AccountSession | null): void => {
  if (typeof window === 'undefined') return

  if (!account) {
    window.localStorage.removeItem(ACCOUNT_STORAGE_KEY)
    return
  }

  window.localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(account))
}

interface AppStore {
  theme: string
  setTheme: (newTheme: string) => void
  wallpaper: string
  setWallpaper: (newWallpaper: string) => void
  account: AccountSession | null
  setAccount: (account: AccountSession | null) => void
  logout: () => void
}

export const useAppStore = create<AppStore>((set) => ({
  theme: 'dark',
  setTheme: (newTheme: string) => set({ theme: newTheme }),
  wallpaper: 'starrySky',
  setWallpaper: (newWallpaper: string) => set({ wallpaper: newWallpaper }),
  account: readStoredAccount(),
  setAccount: (account: AccountSession | null) => {
    writeStoredAccount(account)
    set({ account })
  },
  logout: () => {
    writeStoredAccount(null)
    set({ account: null })
  }
}))
