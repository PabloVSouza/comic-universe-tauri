import { FC, useCallback, useEffect } from 'react'
import { useOpenWindow } from '@pablovsouza/react-window-manager'
import { useAppStore } from 'stores'
import { useWebsiteVerifyTokenQuery } from '../services'
import { TopBar } from './TopBar'
import { LeftNav } from './LeftNav'
import { MainContent } from './MainContent'
import { LeftList } from './LeftList'

export const Home: FC = () => {
  const account = useAppStore((state) => state.account)
  const setAccount = useAppStore((state) => state.setAccount)
  const logout = useAppStore((state) => state.logout)
  const openWindow = useOpenWindow()
  const verifyTokenQuery = useWebsiteVerifyTokenQuery(account?.token)

  const openLoginWindow = useCallback(() => {
    openWindow({
      component: 'LoginWindow'
    })
  }, [openWindow])

  useEffect(() => {
    let cancelled = false
    let openFrame = 0

    if (!account) {
      openFrame = window.requestAnimationFrame(() => {
        if (!cancelled) {
          openLoginWindow()
        }
      })
    }
    if (account && verifyTokenQuery.isError) {
      logout()
      openFrame = window.requestAnimationFrame(() => {
        if (!cancelled) {
          openLoginWindow()
        }
      })
    }
    if (account && verifyTokenQuery.data) {
      const verified = verifyTokenQuery.data
      const nextAccount = {
        ...account,
        websiteUserId: verified.user.id,
        email: verified.user.email,
        username: verified.user.username,
        displayName: verified.user.displayName,
        deviceName: verified.deviceName,
        expiresAt: verified.expiresAt
      }
      const unchanged =
        account.websiteUserId === nextAccount.websiteUserId &&
        account.email === nextAccount.email &&
        account.username === nextAccount.username &&
        account.displayName === nextAccount.displayName &&
        account.deviceName === nextAccount.deviceName &&
        account.expiresAt === nextAccount.expiresAt

      if (!unchanged) {
        setAccount(nextAccount)
      }
    }

    return () => {
      cancelled = true
      if (openFrame) {
        window.cancelAnimationFrame(openFrame)
      }
    }
  }, [account, verifyTokenQuery.data, verifyTokenQuery.isError, openLoginWindow, setAccount, logout])

  // const { wallpaper, setWallpaper } = useAppStore()

  // const wallpapers = [
  //   'starrySky',
  //   'default',
  //   'https://wallpapers-clan.com/wp-content/uploads/2026/01/monkey-d-luffy-floating-ring-summer-vibes-desktop-wallpaper-cover.jpg',
  //   'https://www.pixground.com/wp-content/uploads/2023/05/Yoriichi-Tsugikuni-Demon-Slayer-4K-Anime-Wallpaper-1081x608.jpg',
  //   'https://4kwallpapers.com/images/wallpapers/anime-girl-5120x2880-15604.jpg'
  // ]

  // const changeWallpaper = () => {
  //   const currentIndex = wallpapers.indexOf(wallpaper)
  //   const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % wallpapers.length : 0
  //   setWallpaper(wallpapers[nextIndex])
  // }

  // useEffect(() => {
  //   setTimeout(() => {
  //     changeWallpaper()
  //   }, 10000)
  // }, [wallpaper])

  return (
    <div className="grid size-full grid-cols-[15rem_minmax(0,1fr)] grid-rows-[3.5rem_3.5rem_minmax(0,1fr)] gap-px">
      <TopBar className="col-span-2 row-start-1" />
      <LeftNav className="col-start-1 row-start-2" />
      <LeftList className="col-start-1 row-start-3" />
      <MainContent className="col-start-2 row-start-2 row-span-2" />
    </div>
  )
}
