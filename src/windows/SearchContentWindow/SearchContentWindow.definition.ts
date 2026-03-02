import { WindowDefinition } from '@pablovsouza/react-window-manager'
import { SearchContentWindow, SearchContentWindowProps } from './SearchContentWindow'

export const searchContentWindowDefinition: WindowDefinition<SearchContentWindowProps> = {
  component: SearchContentWindow,
  windowProps: {
    title: 'Search Content',
    overlay: true,
    unique: true,
    closeable: false,
    minimizable: false,
    maximizable: false,
    resizable: false,
    movable: false,
    titleBar: false,
    contentClassName: 'h-full w-full overflow-y-auto overscroll-none'
  },
  initialStatus: ({ isMobile }) =>
    isMobile
      ? {
          startPosition: 'center',
          positionAnchor: 'startPosition',
          width: '100%',
          height: '100%'
        }
      : {
          startPosition: 'center',
          positionAnchor: 'startPosition',
          width: '94%',
          height: '85%'
        }
}
