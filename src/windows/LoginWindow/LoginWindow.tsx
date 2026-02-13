import { FC, FormEvent, useState } from 'react'
import { useOpenWindow } from '@pablovsouza/react-window-manager'
import { useTranslation } from 'react-i18next'
import { Button } from 'components/ui/button'
import { Input } from 'components/ui/input'
import { logoIcon } from 'assets'
import { useAppStore } from 'stores'
import { useWebsiteLoginMutation } from '../../services'

export type LoginWindowProps = {
  closeSelf?: () => void
}

export const LoginWindow: FC<LoginWindowProps> = ({ closeSelf }) => {
  const { t } = useTranslation()
  const setAccount = useAppStore((state) => state.setAccount)
  const openWindow = useOpenWindow()
  const loginMutation = useWebsiteLoginMutation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const getDeviceNameFromHost = (): string => {
    if (typeof window === 'undefined') {
      return 'unknown-host'
    }

    const host = window.location.hostname?.trim()
    return host || 'unknown-host'
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!email.trim() || !password.trim()) {
      setError(t('auth.login.errors.required'))
      return
    }

    setError(null)

    try {
      const deviceName = getDeviceNameFromHost()
      const response = await loginMutation.mutateAsync({
        email: email.trim(),
        password,
        deviceName
      })

      setAccount({
        token: response.token,
        expiresAt: response.expiresAt,
        deviceName: response.deviceName,
        email: response.email,
        websiteUserId: response.websiteUserId,
        username: null,
        displayName: null
      })

      closeSelf?.()
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : t('auth.login.errors.failed')
      setError(message)
    }
  }

  return (
    <form
      className="flex flex-col gap-3 bg-card/90 align-middle items-center justify-between height-full"
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col items-center gap-1 text-center">
        <img src={logoIcon} alt="Comic Universe" className="w-64 mb-7" />
        <h2 className="font-bangers text-4xl leading-none tracking-wide text-yellow-400">
          {t('auth.login.title')}
        </h2>
        <p className="text-xs text-muted-foreground">{t('auth.login.subtitle')}</p>
      </div>

      <div className="space-y-0.5">
        <p className="text-sm text-muted-foreground">
          {t('auth.login.description')}
        </p>
      </div>

      <div className="space-y-2 w-full">
        <label className="text-sm font-medium" htmlFor="login-email">
          {t('auth.login.fields.email')}
        </label>
        <Input
          id="login-email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value)
            if (error) setError(null)
          }}
          placeholder={t('auth.login.placeholders.email')}
          autoFocus
          type="email"
          className="w-full"
        />
      </div>

      <div className="space-y-2 w-full">
        <label className="text-sm font-medium" htmlFor="login-password">
          {t('auth.login.fields.password')}
        </label>
        <Input
          id="login-password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value)
            if (error) setError(null)
          }}
          placeholder={t('auth.login.placeholders.password')}
          type="password"
          className="w-full"
        />
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex items-center justify-between gap-3 pt-1">
        <Button
          type="button"
          variant="ghost"
          className="text-yellow-400 hover:bg-yellow-400/10 hover:text-yellow-300"
          onClick={() => {
            openWindow({ component: 'RegisterWindow' })
            closeSelf?.()
          }}
        >
          {t('auth.login.actions.createAccount')}
        </Button>
        <Button
          type="submit"
          disabled={loginMutation.isPending}
          className="bg-yellow-400 text-gray-900 hover:bg-yellow-500"
        >
          {loginMutation.isPending ? t('auth.login.actions.signingIn') : t('auth.login.actions.continue')}
        </Button>
      </div>
    </form>
  )
}
