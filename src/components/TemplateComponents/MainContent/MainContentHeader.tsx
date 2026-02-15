import { logoIcon } from 'assets'
import { FC } from 'react'

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
  return (
    <div className="flex h-72 min-h-0 w-full gap-px">
      <div className="flex min-w-0 flex-1 flex-col bg-background">
        <div className="shrink-0 p-3 text-center">
          <h1 className="text-2xl font-thin leading-tight">{title}</h1>
          {publisher ? <p className="text-sm text-muted-foreground/90">{publisher}</p> : null}
          {status ? <p className="text-base">{status}</p> : null}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          <p className="text-sm leading-relaxed text-foreground/90">{synopsis || '-'}</p>
        </div>
      </div>
      <div className="sticky right-0 shrink-0 bg-background p-1 ">
        <img
          src={coverUrl || logoIcon}
          alt={title}
          className="h-full w-full rounded-sm object-contain object-center"
          loading="lazy"
        />
      </div>
    </div>
  )
}
