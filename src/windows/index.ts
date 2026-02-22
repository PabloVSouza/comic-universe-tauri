import type { WindowRegistry } from '@pablovsouza/react-window-manager'
import { loginWindowDefinition } from './LoginWindow'
import { registerWindowDefinition } from './RegisterWindow'
import { searchContentWindowDefinition } from './SearchContentWindow'

export const windowRegistry: WindowRegistry = {
  LoginWindow: loginWindowDefinition,
  RegisterWindow: registerWindowDefinition,
  SearchContentWindow: searchContentWindowDefinition
}
