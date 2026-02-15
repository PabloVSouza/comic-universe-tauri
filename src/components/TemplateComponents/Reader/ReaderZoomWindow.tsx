import { FC, RefObject, useEffect, useRef, useState } from 'react'

interface ReaderZoomWindowProps {
  containerRef: RefObject<HTMLDivElement | null>
  visible: boolean
  imageKey?: string
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

interface DrawRect {
  left: number
  top: number
  width: number
  height: number
}

const getRenderedContainRect = (image: HTMLImageElement): DrawRect => {
  const rect = image.getBoundingClientRect()
  const naturalWidth = image.naturalWidth || 0
  const naturalHeight = image.naturalHeight || 0

  if (!naturalWidth || !naturalHeight || !rect.width || !rect.height) {
    return {
      left: rect.left,
      top: rect.top,
      width: Math.max(1, rect.width),
      height: Math.max(1, rect.height)
    }
  }

  const scale = Math.min(rect.width / naturalWidth, rect.height / naturalHeight)
  const width = Math.max(1, naturalWidth * scale)
  const height = Math.max(1, naturalHeight * scale)

  return {
    left: rect.left + (rect.width - width) / 2,
    top: rect.top + (rect.height - height) / 2,
    width,
    height
  }
}

export const ReaderZoomWindow: FC<ReaderZoomWindowProps> = ({ containerRef, visible, imageKey }) => {
  const windowRef = useRef<HTMLDivElement>(null)
  const [zoomFactor, setZoomFactor] = useState(2)
  const [lens, setLens] = useState({
    left: 0,
    top: 0,
    xRatio: 0.5,
    yRatio: 0.5,
    drawWidth: 1,
    drawHeight: 1,
    source: '',
    active: false
  })
  const zoomSource = lens.source.trim()

  useEffect(() => {
    setZoomFactor(2)
  }, [imageKey])

  useEffect(() => {
    const container = containerRef.current
    if (!container || !visible) return

    const lensSize = 320
    let rafId: number | null = null

    const updateZoomByWheel = (event: WheelEvent) => {
      if (!visible || !lens.active) return
      event.preventDefault()
      event.stopPropagation()
      applyWheelZoom(event.deltaY)
    }

    const resolveImageAtPoint = (x: number, y: number): HTMLImageElement | null => {
      const elements = document.elementsFromPoint(x, y)
      for (const element of elements) {
        if (
          element instanceof HTMLImageElement &&
          element.dataset.readerZoomSource === 'true'
        ) {
          return element
        }
      }
      return null
    }

    const updateLens = (event: MouseEvent) => {
      const targetImage = resolveImageAtPoint(event.clientX, event.clientY)
      if (!targetImage) {
        setLens((current) => ({ ...current, active: false }))
        return
      }

      const drawRect = getRenderedContainRect(targetImage)
      const x = clamp(event.clientX, drawRect.left, drawRect.left + drawRect.width)
      const y = clamp(event.clientY, drawRect.top, drawRect.top + drawRect.height)
      const xRatio = clamp((x - drawRect.left) / Math.max(1, drawRect.width), 0, 1)
      const yRatio = clamp((y - drawRect.top) / Math.max(1, drawRect.height), 0, 1)
      const source = (targetImage.currentSrc || targetImage.src || '').trim()

      setLens({
        left: x - lensSize / 2,
        top: y - lensSize / 2,
        xRatio,
        yRatio,
        drawWidth: drawRect.width,
        drawHeight: drawRect.height,
        source,
        active: true
      })
    }

    const onMouseMove = (event: MouseEvent) => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        updateLens(event)
      })
    }

    const onMouseLeave = () => {
      setLens((current) => ({ ...current, active: false }))
    }

    container.addEventListener('mousemove', onMouseMove)
    container.addEventListener('mouseleave', onMouseLeave)
    container.addEventListener('wheel', updateZoomByWheel, { passive: false })

    return () => {
      container.removeEventListener('mousemove', onMouseMove)
      container.removeEventListener('mouseleave', onMouseLeave)
      container.removeEventListener('wheel', updateZoomByWheel)
      if (rafId !== null) cancelAnimationFrame(rafId)
    }
  }, [containerRef, visible, lens.active])

  const applyWheelZoom = (deltaY: number) => {
    if (deltaY > 0) {
      setZoomFactor((current) => Math.max(2, current - 0.2))
    } else {
      setZoomFactor((current) => Math.min(6, current + 0.2))
    }
  }

  return (
    <div
      ref={windowRef}
      className={`pointer-events-none fixed z-30 aspect-square w-80 cursor-zoom-in overflow-hidden rounded-full border border-border/50 bg-background/30 shadow-2xl shadow-black transition-opacity duration-150 ${
        visible && lens.active ? 'opacity-100' : 'invisible opacity-0'
      }`}
      style={{ top: lens.top, left: lens.left }}
    >
      {/* Render based on actual displayed image rect to keep cursor tracking exact with object-contain */}
      {zoomSource ? (
        <img
          src={zoomSource}
          alt="Zoom"
          className="absolute max-h-none max-w-none select-none pointer-events-none will-change-transform"
          style={{
            width: `${lens.drawWidth * zoomFactor}px`,
            height: `${lens.drawHeight * zoomFactor}px`,
            left: `${-lens.xRatio * lens.drawWidth * zoomFactor + 160}px`,
            top: `${-lens.yRatio * lens.drawHeight * zoomFactor + 160}px`
          }}
        />
      ) : null}
    </div>
  )
}
