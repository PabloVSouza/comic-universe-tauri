import type { TFunction } from 'i18next'

const normalize = (value: string): string => value.trim().toLowerCase()

export function mapAuthErrorMessage(error: unknown, t: TFunction, fallbackKey: string): string {
  const rawMessage = error instanceof Error ? error.message : ''
  const message = normalize(rawMessage)

  if (!message) return t(fallbackKey)

  if (message.includes('failed to fetch') || message.includes('networkerror')) {
    return t('auth.common.errors.network')
  }

  if (message.includes('validation failed')) {
    return t('auth.common.errors.validation')
  }

  if (message.includes('invalid email or password')) {
    return t('auth.login.errors.invalidCredentials')
  }

  if (message.includes('email is already registered')) {
    return t('auth.register.errors.emailTaken')
  }

  if (message.includes('username is already taken')) {
    return t('auth.register.errors.usernameTaken')
  }

  if (message.includes('internal server error')) {
    return t('auth.common.errors.server')
  }

  return t(fallbackKey)
}
