import { useWindowManager } from 'providers/WindowProvider'

type MinimizedItemProps = {
  id: string
  title?: string
}

export function MinimizedItem({ id, title }: MinimizedItemProps) {
  const { setWindowMinimized, closeWindow } = useWindowManager()

  return (
    <button
      type="button"
      className="h-9 min-w-28 max-w-72 truncate rounded-md border border-border/60 bg-card/90 px-3 text-left text-xs shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
      onClick={() => setWindowMinimized(id, false)}
      onContextMenu={(event) => {
        event.preventDefault()
        closeWindow(id)
      }}
      title={title || id}
    >
      {title || id}
    </button>
  )
}
