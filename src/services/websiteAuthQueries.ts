import { useMutation, useQuery } from '@tanstack/react-query'
import {
  websiteAppLogin,
  websiteRegister,
  websiteVerifyAppToken,
  type WebsiteAppLoginRequest,
  type WebsiteRegisterRequest
} from './websiteAuthClient'

export const websiteAuthQueryKeys = {
  verifyToken: (token: string | null | undefined) => ['website-auth', 'verify-token', token] as const
}

export function useWebsiteVerifyTokenQuery(token: string | null | undefined) {
  return useQuery({
    queryKey: websiteAuthQueryKeys.verifyToken(token),
    queryFn: () => websiteVerifyAppToken(token as string),
    enabled: Boolean(token),
    retry: 1,
    staleTime: 60_000
  })
}

export function useWebsiteLoginMutation() {
  return useMutation({
    mutationFn: (payload: WebsiteAppLoginRequest) => websiteAppLogin(payload)
  })
}

export function useWebsiteRegisterMutation() {
  return useMutation({
    mutationFn: (payload: WebsiteRegisterRequest) => websiteRegister(payload)
  })
}

