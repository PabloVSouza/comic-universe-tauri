import { FC, PropsWithChildren } from 'react'

interface ReaderOverlayControlsProps extends PropsWithChildren {
  visible: boolean
  position: 'top' | 'bottom'
}

export const ReaderOverlayControls: FC<ReaderOverlayControlsProps> = ({
  visible,
  position,
  children
}) => {
  const positionClass = position === 'top' ? 'inset-x-0 top-0' : 'inset-x-0 bottom-0'
  const hiddenTransformClass =
    position === 'top' ? '-translate-y-3 opacity-0' : 'translate-y-3 opacity-0'

  return (
    <div
      className={`pointer-events-none absolute z-30 transition-all duration-300 ${positionClass} ${
        visible ? 'translate-y-0 opacity-100' : hiddenTransformClass
      }`}
    >
      <div className="pointer-events-auto">{children}</div>
    </div>
  )
}

