import { FC } from 'react'
import { Minus, Square, X } from 'lucide-react'
import { Button } from 'components/ui/button'
import { withCurrentWindow } from './WindowActions'

interface WindowControlsProps {
  isMac: boolean
}

export const WindowControls: FC<WindowControlsProps> = ({ isMac }) => {
  if (isMac) return null

  return (
    <div data-no-window-drag className="absolute left-3 z-30 flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="hover:bg-white/10"
        onClick={() => void withCurrentWindow(async (window) => window.minimize())}
        aria-label="Minimize"
      >
        <Minus className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="hover:bg-white/10"
        onClick={() => void withCurrentWindow(async (window) => window.toggleMaximize())}
        aria-label="Toggle maximize"
      >
        <Square className="size-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="hover:bg-red-500/25 hover:text-red-300"
        onClick={() => void withCurrentWindow(async (window) => window.close())}
        aria-label="Close"
      >
        <X className="size-4" />
      </Button>
    </div>
  )
}
