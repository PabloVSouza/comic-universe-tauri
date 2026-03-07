import {
  HorizontalReader,
  ReaderBottomBar,
  ReaderOverlayControls,
  ReaderTopBar,
  ReaderZoomWindow,
  VerticalReader
} from 'components'
import { Button } from 'components/ui/button'
import { useReaderController } from 'hooks'
import { FC } from 'react'
import { useTranslation } from 'react-i18next'

export const Reader: FC = () => {
  const { t } = useTranslation()
  const {
    chapterPagesQuery,
    isResolvingPages,
    comicName,
    chapterName,
    readingMode,
    readingDirection,
    canUseDoublePageSpread,
    isMobileViewport,
    setReadingModeAndPersist,
    setReadingDirectionAndPersist,
    setDoublePageSpreadAndPersist,
    onClose,
    desktopControlsVisible,
    showDesktopControls,
    mainContainerRef,
    canUseCustomZoom,
    zoomVisible,
    setZoomVisible,
    currentZoomImageKey,
    externalChapterUrl,
    openExternalChapter,
    pages,
    horizontalSlides,
    currentHorizontalSlideIndex,
    horizontalViewportWidth,
    setHorizontalViewportRef,
    goToPreviousPage,
    goToNextPage,
    verticalOrderedPages,
    setVerticalScrollContainerRef,
    verticalPageRefs,
    safePage,
    totalPages,
    goToPreviousChapter,
    goToNextChapter,
    hasPreviousChapter,
    hasNextChapter
  } = useReaderController()

  return (
    <div
      className="relative flex h-full w-full select-none flex-col bg-background"
      onMouseMove={showDesktopControls}
      onMouseDown={showDesktopControls}
    >
      {isMobileViewport ? (
        <ReaderTopBar
          comicName={comicName}
          chapterName={chapterName}
          readingMode={readingMode}
          readingDirection={readingDirection}
          doublePageSpread={canUseDoublePageSpread}
          disableDoublePageSpread={isMobileViewport}
          onSetReadingMode={(vertical) => void setReadingModeAndPersist(vertical)}
          onSetReadingDirection={(rtl) => void setReadingDirectionAndPersist(rtl)}
          onSetDoublePageSpread={(enabled) => void setDoublePageSpreadAndPersist(enabled)}
          onClose={onClose}
        />
      ) : (
        <ReaderOverlayControls visible={desktopControlsVisible} position="top">
          <ReaderTopBar
            comicName={comicName}
            chapterName={chapterName}
            readingMode={readingMode}
            readingDirection={readingDirection}
            doublePageSpread={canUseDoublePageSpread}
            disableDoublePageSpread={isMobileViewport}
            onSetReadingMode={(vertical) => void setReadingModeAndPersist(vertical)}
            onSetReadingDirection={(rtl) => void setReadingDirectionAndPersist(rtl)}
            onSetDoublePageSpread={(enabled) => void setDoublePageSpreadAndPersist(enabled)}
            onClose={onClose}
          />
        </ReaderOverlayControls>
      )}

      <div
        ref={mainContainerRef}
        className="relative min-h-0 flex-1 overflow-hidden bg-background"
        onContextMenu={(event) => {
          if (!canUseCustomZoom) return
          event.preventDefault()
          setZoomVisible((current) => !current)
        }}
      >
        {canUseCustomZoom ? (
          <ReaderZoomWindow
            containerRef={mainContainerRef}
            visible={zoomVisible}
            imageKey={currentZoomImageKey}
          />
        ) : null}

        {(chapterPagesQuery.isLoading || isResolvingPages) ? (
          <div className="grid h-full place-items-center text-sm text-foreground/70">
            {t('reader.loadingPages')}
          </div>
        ) : null}

        {chapterPagesQuery.isError && !externalChapterUrl ? (
          <div className="grid h-full place-items-center px-4 text-center text-sm text-destructive/90">
            {t('reader.failedToLoadPages')}
          </div>
        ) : null}

        {!chapterPagesQuery.isLoading && !isResolvingPages && !chapterPagesQuery.isError && !pages.length && externalChapterUrl ? (
          <div className="grid h-full place-items-center gap-3 px-4 text-center">
            <p className="text-sm text-foreground/70">{t('reader.externalChapter')}</p>
            <Button type="button" onClick={openExternalChapter}>
              {t('reader.openExternalChapter')}
            </Button>
          </div>
        ) : null}

        {!chapterPagesQuery.isLoading && !isResolvingPages && !chapterPagesQuery.isError && !pages.length && !externalChapterUrl ? (
          <div className="grid h-full place-items-center text-sm text-foreground/70">
            {t('reader.noPages')}
          </div>
        ) : null}

        {pages.length ? (
          readingMode === 'horizontal' ? (
            <HorizontalReader
              slides={horizontalSlides}
              currentSlideIndex={currentHorizontalSlideIndex}
              viewportWidth={horizontalViewportWidth}
              setViewportRef={setHorizontalViewportRef}
              onPreviousPage={goToPreviousPage}
              onNextPage={goToNextPage}
              previousPageLabel={t('reader.previousPage')}
              nextPageLabel={t('reader.nextPage')}
              noPagesLabel={t('reader.noPages')}
            />
          ) : (
            <VerticalReader
              pages={verticalOrderedPages}
              setScrollContainerRef={setVerticalScrollContainerRef}
              pageRefs={verticalPageRefs}
              onPreviousPage={goToPreviousPage}
              onNextPage={goToNextPage}
              previousPageLabel={t('reader.previousPage')}
              nextPageLabel={t('reader.nextPage')}
              noPagesLabel={t('reader.noPages')}
            />
          )
        ) : null}
      </div>

      {isMobileViewport ? (
        <ReaderBottomBar
          chapterName={chapterName}
          currentPage={safePage}
          totalPages={totalPages || 1}
          onPreviousChapter={goToPreviousChapter}
          onNextChapter={goToNextChapter}
          hasPreviousChapter={hasPreviousChapter}
          hasNextChapter={hasNextChapter}
        />
      ) : (
        <ReaderOverlayControls visible={desktopControlsVisible} position="bottom">
          <ReaderBottomBar
            chapterName={chapterName}
            currentPage={safePage}
            totalPages={totalPages || 1}
            onPreviousChapter={goToPreviousChapter}
            onNextChapter={goToNextChapter}
            hasPreviousChapter={hasPreviousChapter}
            hasNextChapter={hasNextChapter}
          />
        </ReaderOverlayControls>
      )}
    </div>
  )
}
