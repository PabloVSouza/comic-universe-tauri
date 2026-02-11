import type { WindowInstance } from 'providers/WindowProvider'
import { MinimizedItem } from './MinimizedItem'

type MinimizedBarProps = {
  windows: WindowInstance[]
}

export function MinimizedBar({ windows }: MinimizedBarProps) {
  return (
    <footer className="pointer-events-auto absolute bottom-0 left-0 z-[70] flex w-full items-center gap-2 overflow-x-auto border-t border-border/60 bg-background/95 p-2 backdrop-blur-sm">
      {[...windows].reverse().map((window) => (
        <MinimizedItem key={window.id} id={window.id} title={window.title} />
      ))}
    </footer>
  )
}
