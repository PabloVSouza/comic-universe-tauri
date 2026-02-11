import { FC } from 'react'
import { TopBar } from './TopBar'
import { LeftNav } from './LeftNav'
import { MainContent } from './MainContent'
import { LeftList } from './LeftList'

export const Home: FC = () => {
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
