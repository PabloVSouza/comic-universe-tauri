import { logoIcon } from 'assets'
import { FC, useEffect, useState } from 'react'

interface MainContentHeaderProps {
  title: string
  publisher?: string
  status?: string
  synopsis?: string
  coverUrl?: string
}

export const MainContentHeader: FC<MainContentHeaderProps> = ({
  title,
  publisher,
  status,
  synopsis,
  coverUrl
}) => {
  const [coverFailed, setCoverFailed] = useState(false)

  useEffect(() => {
    setCoverFailed(false)
  }, [coverUrl])

  const resolvedCoverUrl = !coverFailed && coverUrl ? coverUrl : logoIcon

  return (
    <div className="grid h-full max-h-72 min-h-0 w-full grid-cols-[minmax(0,1fr)_11rem] gap-px overflow-hidden">
      <div className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-background">
        <div className="p-3 text-center">
          <h1 className="break-words text-2xl font-thin leading-tight">{title}</h1>
          {publisher ? <p className="text-sm text-muted-foreground/90">{publisher}</p> : null}
          {status ? <p className="text-base">{status}</p> : null}
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain px-3 pb-3 pr-1 [touch-action:pan-y] [-webkit-overflow-scrolling:touch]">
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">{synopsis || '-'}</p>
        </div>
      </div>
      <div className="w-44 overflow-hidden bg-background p-1">
        <img
          src={resolvedCoverUrl}
          alt={title}
          className="h-full w-full rounded-sm object-contain object-center"
          loading="lazy"
          onError={() => setCoverFailed(true)}
        />
      </div>
    </div>
  )
}
