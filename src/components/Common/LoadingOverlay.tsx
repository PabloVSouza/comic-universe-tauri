import { FC } from 'react'
import { loadingIcon } from 'assets'

interface LoadingOverlayProps {
  isLoading: boolean
  message?: string
}

export const LoadingOverlay: FC<LoadingOverlayProps> = ({ isLoading, message }) => {
  if (!isLoading) return null

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4 supports-backdrop-filter:backdrop-blur-[2px]">
      <div className="flex min-h-32 min-w-32 max-w-xs flex-col items-center justify-center gap-3 rounded bg-background/95 px-6 py-5 text-center shadow-md supports-backdrop-filter:backdrop-blur-sm">
        <img src={loadingIcon} alt="" className="size-16" />
        {message ? <p className="text-sm text-foreground/90">{message}</p> : null}
      </div>
    </div>
  )
}
