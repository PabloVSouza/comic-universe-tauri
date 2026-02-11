import { create } from 'zustand'

interface AppStore {
  theme: string
  setTheme: (newTheme: string) => void
  wallpaper: string
  setWallpaper: (newWallpaper: string) => void
}

export const useAppStore = create<AppStore>((set) => ({
  theme: 'dark',
  setTheme: (newTheme: string) => set({ theme: newTheme }),
  wallpaper: 'starrySky',
  setWallpaper: (newWallpaper: string) => set({ wallpaper: newWallpaper })
}))
