import type { WindowRegistry } from '@pablovsouza/react-window-manager'
import { loginWindowDefinition } from './LoginWindow'
import { registerWindowDefinition } from './RegisterWindow'

export const windowRegistry: WindowRegistry = {
  LoginWindow: loginWindowDefinition,
  RegisterWindow: registerWindowDefinition
}
