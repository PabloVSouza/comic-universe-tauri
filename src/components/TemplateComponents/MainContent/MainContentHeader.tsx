import { FC } from 'react'
import { logoIcon } from 'assets'

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
    <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-px bg-border/40">
      <div className="bg-background/80 p-3">
        <div className="text-center">
          <h1 className="text-[2rem] leading-tight">{title}</h1>
          {publisher ? <p className="text-sm text-muted-foreground">{publisher}</p> : null}
          {status ? <p className="text-base">{status}</p> : null}
        </div>
        <p className="mt-3 text-sm leading-relaxed text-foreground/90">{synopsis || '-'}</p>
      </div>
      <div className="bg-background/80 p-1">
        <img
          src={coverUrl || logoIcon}
          alt={title}
          className="h-full w-full rounded-sm object-cover"
          loading="lazy"
        />
      </div>
    </div>
  )
}
