import { FC } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export interface HorizontalReaderPage {
  key: string
  src?: string
  alt: string
  originalIndex: number
}

export interface HorizontalReaderSlide {
  key: string
  pages: HorizontalReaderPage[]
}

interface HorizontalReaderProps {
  slides: HorizontalReaderSlide[]
  currentSlideIndex: number
  viewportWidth: number
  setViewportRef: (node: HTMLDivElement | null) => void
  onPreviousPage: () => void
  onNextPage: () => void
  previousPageLabel: string
  nextPageLabel: string
  noPagesLabel: string
}

export const HorizontalReader: FC<HorizontalReaderProps> = ({
  slides,
  currentSlideIndex,
  viewportWidth,
  setViewportRef,
  onPreviousPage,
  onNextPage,
  previousPageLabel,
  nextPageLabel,
  noPagesLabel
}) => {
  return (
    <div ref={setViewportRef} className="relative h-full select-none overflow-hidden">
      <div
        className="flex h-full transition-transform duration-300 ease-out will-change-transform"
        style={{ transform: `translate3d(-${currentSlideIndex * viewportWidth}px,0,0)` }}
      >
        {slides.map((slide) => {
          const slideIsDouble = slide.pages.length === 2
          return (
            <div
              key={slide.key}
              className={`flex h-full w-full shrink-0 items-center justify-center ${
                slideIsDouble ? 'gap-0 px-0' : 'gap-2 px-3'
              }`}
            >
              {slide.pages.map((page, index) => (
                <div
                  key={`${slide.key}-${page.key}`}
                  className={`flex h-full min-w-0 items-center ${
                    slideIsDouble
                      ? index === 0
                        ? 'w-1/2 shrink-0 justify-end'
                        : 'w-1/2 shrink-0 justify-start'
                      : 'flex-1 justify-center'
                  }`}
                >
                  {page.src ? (
                    <img
                      src={page.src}
                      alt={page.alt}
                      data-reader-zoom-source="true"
                      className={slideIsDouble ? 'h-full w-auto object-contain' : 'h-full w-full object-contain'}
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-xs text-foreground/60">
                      {noPagesLabel}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        })}
      </div>

      <div className="pointer-events-none absolute inset-0 z-10 flex justify-between">
        <button
          type="button"
          className="pointer-events-auto flex h-full w-16 items-center justify-center text-foreground/80 transition-colors hover:bg-accent/70 hover:text-foreground"
          onClick={onPreviousPage}
          aria-label={previousPageLabel}
        >
          <ChevronLeft className="size-6" />
        </button>
        <div className="h-full flex-1" />
        <button
          type="button"
          className="pointer-events-auto flex h-full w-16 items-center justify-center text-foreground/80 transition-colors hover:bg-accent/70 hover:text-foreground"
          onClick={onNextPage}
          aria-label={nextPageLabel}
        >
          <ChevronRight className="size-6" />
        </button>
      </div>
    </div>
  )
}
