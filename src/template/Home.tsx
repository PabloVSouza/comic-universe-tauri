import { FC, useCallback, useEffect, useState } from 'react'
import { useOpenWindow } from '@pablovsouza/react-window-manager'
import { useAppStore } from 'stores'
import { Sheet, SheetContent, SheetTitle } from 'components/ui/sheet'
import {
  useAccountSessionQuery,
  useClearAccountSessionMutation,
  useSaveAccountSessionMutation,
  useWebsiteVerifyTokenQuery
} from '../services'
import { LeftList, TopBar } from 'components'
import { LeftNav } from './LeftNav'
import { MainContent } from './MainContent'

export const Home: FC = () => {
  const [isMobileListOpen, setIsMobileListOpen] = useState(false)
  const [selectedComicId, setSelectedComicId] = useState<string | null>(null)
  const account = useAppStore((state) => state.account)
  const accountHydrated = useAppStore((state) => state.accountHydrated)
  const hydrateAccount = useAppStore((state) => state.hydrateAccount)
  const setAccount = useAppStore((state) => state.setAccount)
  const logout = useAppStore((state) => state.logout)
  const openWindow = useOpenWindow()
  const accountSessionQuery = useAccountSessionQuery()
  const { mutate: saveAccountSession } = useSaveAccountSessionMutation()
  const { mutate: clearAccountSession } = useClearAccountSessionMutation()
  const verifyTokenQuery = useWebsiteVerifyTokenQuery(account?.token)

  const openLoginWindow = useCallback(() => {
    openWindow({
      component: 'LoginWindow'
    })
  }, [openWindow])

  useEffect(() => {
    if (!accountHydrated && accountSessionQuery.isFetched) {
      hydrateAccount(accountSessionQuery.data ?? null)
    }
  }, [accountHydrated, accountSessionQuery.data, accountSessionQuery.isFetched, hydrateAccount])

  useEffect(() => {
    let cancelled = false
    let openFrame = 0

    if (!accountHydrated) {
      return () => {
        cancelled = true
        if (openFrame) {
          window.cancelAnimationFrame(openFrame)
        }
      }
    }

    if (!account) {
      openFrame = window.requestAnimationFrame(() => {
        if (!cancelled) {
          openLoginWindow()
        }
      })
    }
    if (account && verifyTokenQuery.isError) {
      logout()
      clearAccountSession()
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
        saveAccountSession(nextAccount)
      }
    }

    return () => {
      cancelled = true
      if (openFrame) {
        window.cancelAnimationFrame(openFrame)
      }
    }
  }, [
    account,
    accountHydrated,
    verifyTokenQuery.data,
    verifyTokenQuery.isError,
    openLoginWindow,
    setAccount,
    logout,
    clearAccountSession,
    saveAccountSession,
    hydrateAccount
  ])

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
    <>
      <div className="grid size-full grid-cols-1 grid-rows-[3.5rem_3.5rem_minmax(0,1fr)] gap-px md:grid-cols-[15rem_minmax(0,1fr)]">
        <TopBar className="col-start-1 row-start-1 md:col-span-2" />
        <LeftNav
          className="col-start-1 row-start-2"
          onOpenMobileList={() => setIsMobileListOpen(true)}
        />
        <LeftList
          className="hidden md:block md:col-start-1 md:row-start-3"
          selectedComicId={selectedComicId}
          onSelectComic={setSelectedComicId}
        />
        <MainContent
          className="col-start-1 row-start-3 md:col-start-2 md:row-start-2 md:row-span-2"
          selectedComicId={selectedComicId}
        />
      </div>

      <Sheet open={isMobileListOpen} onOpenChange={setIsMobileListOpen}>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="w-[85vw] max-w-[20rem] border-r border-white/10 bg-black/65 p-0 backdrop-blur-xl md:hidden"
        >
          <SheetTitle className="sr-only">Comics list</SheetTitle>
          <LeftList
            className="h-full"
            selectedComicId={selectedComicId}
            onSelectComic={(comicId) => {
              setSelectedComicId(comicId)
              setIsMobileListOpen(false)
            }}
          />
        </SheetContent>
      </Sheet>
    </>
  )
}
