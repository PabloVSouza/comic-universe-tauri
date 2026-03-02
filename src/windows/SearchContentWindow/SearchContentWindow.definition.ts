import { WindowDefinition } from '@pablovsouza/react-window-manager'
import { SearchContentWindow, SearchContentWindowProps } from './SearchContentWindow'

export const searchContentWindowDefinition: WindowDefinition<SearchContentWindowProps> = {
  component: SearchContentWindow,
  windowProps: {
    title: 'Search Content',
    overlay: true,
    unique: true,
    closeable: true,
    minimizable: false,
    maximizable: false,
    resizable: false,
    movable: false,
    titleBar: false,
    contentClassName: 'h-full w-full overflow-y-auto'
  },
  initialStatus: () =>
    ({
      startPosition: 'topLeft',
      positionAnchor: 'startPosition',
      width: '100%',
      height: '100%'
    })
}
