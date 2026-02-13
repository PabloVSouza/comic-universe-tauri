import { FC, FormEvent, useState } from 'react'
import { useOpenWindow } from '@pablovsouza/react-window-manager'
import { useTranslation } from 'react-i18next'
import { Button } from 'components/ui/button'
import { Input } from 'components/ui/input'
import { logoIcon } from 'assets'
import { useWebsiteRegisterMutation } from '../../services'

export type RegisterWindowProps = {
  closeSelf?: () => void
}

export const RegisterWindow: FC<RegisterWindowProps> = ({ closeSelf }) => {
  const { t } = useTranslation()
  const openWindow = useOpenWindow()
  const registerMutation = useWebsiteRegisterMutation()
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!email.trim() || !username.trim() || !displayName.trim() || !password.trim()) {
      setError(t('auth.register.errors.required'))
      return
    }

    if (password !== confirmPassword) {
      setError(t('auth.register.errors.passwordMismatch'))
      return
    }

    setError(null)
    setSuccessMessage(null)

    try {
      const response = await registerMutation.mutateAsync({
        email: email.trim(),
        username: username.trim(),
        displayName: displayName.trim(),
        password
      })

      setSuccessMessage(response.message || t('auth.register.feedback.success'))
      setTimeout(() => {
        openWindow({ component: 'LoginWindow' })
        closeSelf?.()
      }, 400)
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : t('auth.register.errors.failed')
      setError(message)
    }
  }

  return (
    <form className="flex h-full flex-col gap-4 bg-card/90 p-6" onSubmit={handleSubmit}>
      <div className="flex items-center gap-3">
        <img src={logoIcon} alt="Comic Universe" className="size-11 rounded-md object-contain" />
        <div className="space-y-1">
          <h2 className="font-bangers text-3xl leading-none tracking-wide text-yellow-400">
            {t('auth.register.title')}
          </h2>
          <p className="text-xs text-muted-foreground">{t('auth.register.subtitle')}</p>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">{t('auth.register.description')}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <label className="text-sm font-medium" htmlFor="register-email">
            {t('auth.register.fields.email')}
          </label>
          <Input
            id="register-email"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
              if (error) setError(null)
            }}
            placeholder={t('auth.register.placeholders.email')}
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="register-username">
            {t('auth.register.fields.username')}
          </label>
          <Input
            id="register-username"
            value={username}
            onChange={(event) => {
              setUsername(event.target.value)
              if (error) setError(null)
            }}
            placeholder={t('auth.register.placeholders.username')}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="register-display-name">
            {t('auth.register.fields.displayName')}
          </label>
          <Input
            id="register-display-name"
            value={displayName}
            onChange={(event) => {
              setDisplayName(event.target.value)
              if (error) setError(null)
            }}
            placeholder={t('auth.register.placeholders.displayName')}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="register-password">
            {t('auth.register.fields.password')}
          </label>
          <Input
            id="register-password"
            type="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value)
              if (error) setError(null)
            }}
            placeholder={t('auth.register.placeholders.password')}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="register-password-confirm">
            {t('auth.register.fields.confirmPassword')}
          </label>
          <Input
            id="register-password-confirm"
            type="password"
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value)
              if (error) setError(null)
            }}
            placeholder={t('auth.register.placeholders.confirmPassword')}
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {successMessage && <p className="text-sm text-green-500">{successMessage}</p>}

      <div className="mt-auto flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          className="text-yellow-400 hover:bg-yellow-400/10 hover:text-yellow-300"
          onClick={() => {
            openWindow({ component: 'LoginWindow' })
            closeSelf?.()
          }}
        >
          {t('auth.register.actions.backToSignIn')}
        </Button>
        <Button
          type="submit"
          disabled={registerMutation.isPending}
          className="bg-yellow-400 text-gray-900 hover:bg-yellow-500"
        >
          {registerMutation.isPending
            ? t('auth.register.actions.creating')
            : t('auth.register.actions.createAccount')}
        </Button>
      </div>
    </form>
  )
}
