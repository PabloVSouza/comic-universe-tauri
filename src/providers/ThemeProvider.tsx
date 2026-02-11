import { FC, ReactNode } from 'react'
import { useAppStore } from 'stores'

interface ThemeProviderProps {
  children?: ReactNode
}

export const ThemeProvider: FC<ThemeProviderProps> = ({ children }) => {
  const { theme } = useAppStore((state) => state)

  return <div className={`size-full ${theme}`}>{children}</div>
}
