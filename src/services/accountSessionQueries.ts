import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { dbDelete, dbGet, dbUpsert } from './restClient'
import type { AccountSession } from 'stores'

const SESSION_TABLE = 'app_state'
const ACCOUNT_SESSION_ID = 'account_session'

type AccountSessionRecord = AccountSession & Record<string, unknown>

export const accountSessionQueryKey = ['app-state', 'account-session'] as const

export function useAccountSessionQuery() {
  return useQuery({
    queryKey: accountSessionQueryKey,
    queryFn: async (): Promise<AccountSession | null> => {
      const record = await dbGet<AccountSessionRecord>(SESSION_TABLE, ACCOUNT_SESSION_ID)
      return record?.data ?? null
    },
    staleTime: Infinity
  })
}

export function useSaveAccountSessionMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (account: AccountSession) => {
      await dbUpsert<AccountSessionRecord>(
        SESSION_TABLE,
        account as AccountSessionRecord,
        ACCOUNT_SESSION_ID
      )
      return account
    },
    onSuccess: (account) => {
      queryClient.setQueryData(accountSessionQueryKey, account)
    }
  })
}

export function useClearAccountSessionMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      await dbDelete(SESSION_TABLE, ACCOUNT_SESSION_ID)
    },
    onSuccess: () => {
      queryClient.setQueryData(accountSessionQueryKey, null)
    }
  })
}
