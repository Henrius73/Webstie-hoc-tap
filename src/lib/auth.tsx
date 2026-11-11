// Quản lý phiên đăng nhập: giáo viên (email magic link) và học sinh (ẩn danh).
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { isConfigured, requireSupabase, supabase } from './supabase'

interface AuthState {
  ready: boolean
  user: User | null
  isAnonymous: boolean
  isTeacher: boolean
  // Giáo viên: gửi liên kết đăng nhập qua email.
  sendTeacherLink: (email: string) => Promise<void>
  // Học sinh: tự tạo phiên ẩn danh nếu chưa có.
  ensureAnonymous: () => Promise<User>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function isAnonymousUser(user: User | null): boolean {
  if (!user) return false
  if (typeof user.is_anonymous === 'boolean') return user.is_anonymous
  return user.app_metadata?.provider === 'anonymous'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!isConfigured)
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    if (!supabase) return
    let alive = true

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!alive) return
        setUser(data.session?.user ?? null)
        setReady(true)
      })
      .catch(() => {
        if (alive) setReady(true)
      })

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setReady(true)
    })
    return () => {
      alive = false
      data.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      ready,
      user,
      isAnonymous: isAnonymousUser(user),
      isTeacher: !!user && !isAnonymousUser(user),
      sendTeacherLink: async (email) => {
        const sb = requireSupabase()
        const { error } = await sb.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: location.href },
        })
        if (error) throw error
      },
      ensureAnonymous: async () => {
        const sb = requireSupabase()
        const { data: existing } = await sb.auth.getSession()
        if (existing.session?.user) return existing.session.user

        const { data, error } = await sb.auth.signInAnonymously()
        if (error) {
          if (/anonymous/i.test(error.message)) {
            throw new Error(
              'Project Supabase chưa bật đăng nhập ẩn danh. Vào Authentication → Sign In / Providers → bật Anonymous sign-ins.',
            )
          }
          throw error
        }
        if (!data.user) throw new Error('Không tạo được phiên cho học sinh.')
        return data.user
      },
      signOut: async () => {
        const sb = requireSupabase()
        const { error } = await sb.auth.signOut()
        if (error) throw error
      },
    }),
    [ready, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth phải được dùng bên trong AuthProvider')
  return ctx
}
