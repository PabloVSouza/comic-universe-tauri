import { FC } from 'react'
import { Badge } from 'components/ui/badge'
import { ScrollArea } from 'components/ui/scroll-area'
import { Circle, CircleCheckBig } from 'lucide-react'
import { InstalledPlugin } from './pluginApi'

interface SearchPluginSelectorProps {
  plugins: InstalledPlugin[]
  selectedPluginIds: string[]
  onTogglePlugin: (pluginId: string) => void
}

export const SearchPluginSelector: FC<SearchPluginSelectorProps> = ({
  plugins,
  selectedPluginIds,
  onTogglePlugin
}) => {
  return (
    <ScrollArea className="h-full bg-background">
      <div className="flex flex-col gap-px p-px">
        {plugins.map((plugin) => {
          const selected = selectedPluginIds.includes(plugin.id)
          return (
            <button
              key={plugin.id}
              type="button"
              onClick={() => onTogglePlugin(plugin.id)}
              className={`flex items-start justify-between gap-3 bg-background px-3 py-2 text-left transition hover:bg-accent/40 ${
                selected ? 'ring-1 ring-primary/60' : ''
              }`}
            >
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm">{plugin.name}</span>
                <span className="truncate text-xs text-muted-foreground">{plugin.endpoint}</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {(plugin.languageCodes.length > 0 ? plugin.languageCodes : ['unknown']).map((lang) => (
                    <Badge key={`${plugin.id}-${lang}`} variant="secondary" className="text-[10px]">
                      {lang}
                    </Badge>
                  ))}
                </div>
              </div>
              {selected ? (
                <CircleCheckBig className="mt-0.5 size-4 shrink-0 text-primary" />
              ) : (
                <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              )}
            </button>
          )
        })}
      </div>
    </ScrollArea>
  )
}
