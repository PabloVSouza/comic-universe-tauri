import { createElement, createRef, FC, ReactNode, RefObject, useRef } from 'react'
import { CSSTransition, TransitionGroup } from 'react-transition-group'
import { StarrySky } from 'components'
import { useAppStore } from 'stores'
import { wallpaper as defaultWallpaper } from '@/assets'

interface WallpaperProviderProps {
  children?: ReactNode
}

interface WallpaperImageProps {
  wallpaper: string
}

const WallpaperImage: FC<WallpaperImageProps> = ({ wallpaper }) => {
  return <img src={wallpaper} alt="default" className="size-full object-cover" />
}

export const WallpaperProvider: FC<WallpaperProviderProps> = ({ children }) => {
  const { wallpaper } = useAppStore()
  const FADE_MS = 280
  const wallpaperRefs = useRef<Record<string, RefObject<HTMLDivElement | null>>>({})

  const componentWallpapers = { starrySky: StarrySky } as Record<string, FC>

  const imageWallpapers = { default: defaultWallpaper } as Record<string, string>

  const getWallpaperRef = (key: string) => {
    if (!wallpaperRefs.current[key]) {
      wallpaperRefs.current[key] = createRef<HTMLDivElement>()
    }

    return wallpaperRefs.current[key]
  }

  const wallpaperRef = getWallpaperRef(wallpaper)

  const returnWallpaper = (wallpaperKey: string) => {
    if (componentWallpapers[wallpaperKey]) return createElement(componentWallpapers[wallpaperKey])
    if (imageWallpapers[wallpaperKey])
      return <WallpaperImage wallpaper={imageWallpapers[wallpaperKey]} />
    return <WallpaperImage wallpaper={wallpaperKey} />
  }

  return (
    <div className="h-screen w-screen">
      <div className="size-full absolute -z-10 overflow-hidden">
        <TransitionGroup component={null}>
          <CSSTransition
            key={wallpaper}
            timeout={FADE_MS}
            classNames="wallpaper-fade"
            nodeRef={wallpaperRef}
            unmountOnExit
          >
            <div ref={wallpaperRef} className="absolute inset-0 will-change-[opacity]">
              {returnWallpaper(wallpaper)}
            </div>
          </CSSTransition>
        </TransitionGroup>
      </div>
      {children}
    </div>
  )
}
