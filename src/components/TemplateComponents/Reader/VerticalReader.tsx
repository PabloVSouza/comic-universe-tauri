import { FC, MutableRefObject } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface VerticalReaderPage {
  key: string
  src?: string
  alt: string
}

interface VerticalReaderProps {
  pages: VerticalReaderPage[]
  isMobileViewport: boolean
  desktopPageHeight: number
  setScrollContainerRef: (node: HTMLDivElement | null) => void
  pageRefs: MutableRefObject<Array<HTMLDivElement | null>>
  onPreviousPage: () => void
  onNextPage: () => void
  previousPageLabel: string
  nextPageLabel: string
  noPagesLabel: string
}

export const VerticalReader: FC<VerticalReaderProps> = ({
  pages,
  isMobileViewport,
  desktopPageHeight,
  setScrollContainerRef,
  pageRefs,
  onPreviousPage,
  onNextPage,
  previousPageLabel,
  nextPageLabel,
  noPagesLabel
}) => {
  return (
    <div className="relative h-full select-none">
      <div ref={setScrollContainerRef} className="h-full overflow-y-auto">
        <div className="flex flex-col">
          {pages.map((page, index) => (
            <div
              key={page.key}
              ref={(node) => {
                pageRefs.current[index] = node
              }}
              data-page-index={index}
              className={
                isMobileViewport
                  ? 'flex w-full items-center justify-center'
                  : 'flex h-full w-full shrink-0 items-center justify-center overflow-hidden'
              }
              style={
                !isMobileViewport && desktopPageHeight > 0
                  ? { height: `${desktopPageHeight}px` }
                  : undefined
              }
            >
              {page.src ? (
                <img
                  src={page.src}
                  alt={page.alt}
                  data-reader-zoom-source="true"
                  className={isMobileViewport ? 'h-auto w-full object-contain' : 'h-full w-full object-contain'}
                />
              ) : (
                <div className="grid h-full w-full place-items-center text-xs text-foreground/60">
                  {noPagesLabel}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between">
        <button
          type="button"
          className="pointer-events-auto flex h-14 w-full items-center justify-center text-foreground/80 transition-colors hover:bg-accent/70 hover:text-foreground"
          onClick={onPreviousPage}
          aria-label={previousPageLabel}
        >
          <ChevronUp className="size-5" />
        </button>
        <div className="w-full flex-1" />
        <button
          type="button"
          className="pointer-events-auto flex h-14 w-full items-center justify-center text-foreground/80 transition-colors hover:bg-accent/70 hover:text-foreground"
          onClick={onNextPage}
          aria-label={nextPageLabel}
        >
          <ChevronDown className="size-5" />
        </button>
      </div>
    </div>
  )
}
