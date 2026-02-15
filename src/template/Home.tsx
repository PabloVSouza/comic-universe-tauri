import { FC, useCallback, useEffect, useRef, useState } from 'react'
import { useOpenWindow } from '@pablovsouza/react-window-manager'
import { useAppStore } from 'stores'
import {
  useAccountSessionQuery,
  useClearAccountSessionMutation,
  useSaveAccountSessionMutation,
  useWebsiteGenerateAppTokenMutation,
  useWebsiteVerifyTokenQuery
} from '../services'
import { LeftList, TopBar } from 'components'
import { LeftNav } from './LeftNav'
import { MainContent } from './MainContent'

export const Home: FC = () => {
  const [selectedComicId, setSelectedComicId] = useState<string | null>(null)
  const [isMobileListVisible, setMobileListVisible] = useState(false)
  const account = useAppStore((state) => state.account)
  const accountHydrated = useAppStore((state) => state.accountHydrated)
  const hydrateAccount = useAppStore((state) => state.hydrateAccount)
  const setAccount = useAppStore((state) => state.setAccount)
  const logout = useAppStore((state) => state.logout)
  const isMobileListOpen = useAppStore((state) => state.isMobileListOpen)
  const setMobileListOpen = useAppStore((state) => state.setMobileListOpen)
  const openWindow = useOpenWindow()
  const accountSessionQuery = useAccountSessionQuery()
  const { mutate: saveAccountSession } = useSaveAccountSessionMutation()
  const { mutate: clearAccountSession } = useClearAccountSessionMutation()
  const renewTokenMutation = useWebsiteGenerateAppTokenMutation()
  const verifyTokenQuery = useWebsiteVerifyTokenQuery(account?.token)
  const renewingTokenRef = useRef(false)
  const renewedFromTokenRef = useRef<string | null>(null)
  const mobileListAnimationMs = 200

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
    if (
      account &&
      verifyTokenQuery.isError &&
      !renewingTokenRef.current &&
      renewedFromTokenRef.current !== account.token
    ) {
      renewingTokenRef.current = true
      renewedFromTokenRef.current = account.token

      void (async () => {
        try {
          const renewal = await renewTokenMutation.mutateAsync({
            userId: account.websiteUserId,
            deviceName: account.deviceName
          })

          if (cancelled) return

          const renewedAccount = {
            ...account,
            token: renewal.token,
            expiresAt: renewal.expiresAt,
            deviceName: renewal.deviceName
          }

          setAccount(renewedAccount)
          saveAccountSession(renewedAccount)
        } catch {
          if (cancelled) return

          logout()
          clearAccountSession()
          openFrame = window.requestAnimationFrame(() => {
            if (!cancelled) {
              openLoginWindow()
            }
          })
        } finally {
          renewingTokenRef.current = false
        }
      })()
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
    renewTokenMutation,
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

  useEffect(() => {
    let timeoutId: number | undefined

    if (isMobileListOpen) {
      setMobileListVisible(true)
    } else {
      timeoutId = window.setTimeout(() => {
        setMobileListVisible(false)
      }, mobileListAnimationMs)
    }

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [isMobileListOpen, mobileListAnimationMs])

  return (
    <>
      <div className="grid size-full grid-cols-1 grid-rows-[3.5rem_minmax(0,1fr)] gap-px md:grid-cols-[15rem_minmax(0,1fr)] md:grid-rows-[3.5rem_3.5rem_minmax(0,1fr)]">
        <TopBar className="col-start-1 row-start-1 md:col-span-2" />
        <LeftNav
          className="hidden md:flex md:col-start-1 md:row-start-2"
        />
        <LeftList
          className="hidden md:block md:col-start-1 md:row-start-3"
          selectedComicId={selectedComicId}
          onSelectComic={setSelectedComicId}
        />
        <MainContent
          className="col-start-1 row-start-2 md:col-start-2 md:row-start-2 md:row-span-2"
          selectedComicId={selectedComicId}
        />
      </div>

      <div
        className={`fixed inset-0 z-50 transition-[visibility] duration-0 md:hidden ${
          isMobileListOpen || isMobileListVisible ? 'visible pointer-events-auto' : 'invisible pointer-events-none'
        }`}
      >
        <button
          type="button"
          aria-label="Close comic list"
          className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${
            isMobileListOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setMobileListOpen(false)}
        />

        <aside
          className={`relative h-full w-[85vw] max-w-[20rem] border-r border-border/50 bg-background transition-transform duration-200 ease-out will-change-transform ${
            isMobileListOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="grid h-full grid-rows-[3.5rem_minmax(0,1fr)] gap-px">
            <LeftNav className="row-start-1" />
            <LeftList
              className="row-start-2 min-h-0"
              selectedComicId={selectedComicId}
              onSelectComic={(comicId) => {
                setSelectedComicId(comicId)
                setMobileListOpen(false)
              }}
            />
          </div>
        </aside>
      </div>
    </>
  )
}
