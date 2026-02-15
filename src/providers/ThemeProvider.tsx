import { FC, ReactNode, useEffect } from 'react'
import { useAppStore } from 'stores'

interface ThemeProviderProps {
  children?: ReactNode
}

export const ThemeProvider: FC<ThemeProviderProps> = ({ children }) => {
  const { theme } = useAppStore((state) => state)

  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const knownThemes = ['light', 'dark']

    html.classList.remove(...knownThemes)
    body.classList.remove(...knownThemes)
    html.classList.add(theme)
    body.classList.add(theme)

    return () => {
      html.classList.remove(theme)
      body.classList.remove(theme)
    }
  }, [theme])

  return <div className={`size-full ${theme}`}>{children}</div>
}
