import type { WindowRegistry } from '@pablovsouza/react-window-manager'
import { testWindowDefinition } from './TestWindow'
import { testWindowDefinition2 } from './TestWindow2'
import { loginWindowDefinition } from './LoginWindow'
import { registerWindowDefinition } from './RegisterWindow'

export const windowRegistry: WindowRegistry = {
  LoginWindow: loginWindowDefinition,
  RegisterWindow: registerWindowDefinition,
  TestWindow: testWindowDefinition,
  TestWindow2: testWindowDefinition2
}
