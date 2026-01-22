import { useState, useEffect, createContext, useContext, useCallback } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { User, Profile } from '../lib/supabase'
import type { Session } from '@supabase/supabase-js'

interface AuthContextType {
    user: User | null
    profile: Profile | null
    session: Session | null
    loading: boolean
    signInWithGitHub: () => Promise<void>
    signOut: () => Promise<void>
    refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Bulletproof timeout wrapper - NEVER hangs
async function withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    fallback: T
): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs))
    ])
}

// Storage key for Supabase session
const STORAGE_KEY = `sb-${import.meta.env.VITE_SUPABASE_URL?.split('//')[1]?.split('.')[0]}-auth-token`

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [profile, setProfile] = useState<Profile | null>(null)
    const [session, setSession] = useState<Session | null>(null)
    const [loading, setLoading] = useState(true)

    // Fetch or create user profile with timeout
    const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
        try {
            // Manual timeout using Promise.race
            const fetchPromise = supabase.from('profiles').select('*').eq('id', userId).single()
            const timeoutPromise = new Promise<{ data: null; error: { code: string } }>((resolve) =>
                setTimeout(() => resolve({ data: null, error: { code: 'TIMEOUT' } }), 3000)
            )

            const { data, error } = await Promise.race([fetchPromise, timeoutPromise])

            if (error && error.code === 'PGRST116') {
                // Profile doesn't exist, create it
                const { data: userData } = await supabase.auth.getUser()
                const newProfile = {
                    id: userId,
                    github_username: userData.user?.user_metadata?.user_name || null,
                    avatar_url: userData.user?.user_metadata?.avatar_url || null,
                    diagrams_generated: 0,
                    readmes_generated: 0,
                }

                const { data: createdProfile } = await supabase
                    .from('profiles')
                    .insert(newProfile)
                    .select()
                    .single()

                return createdProfile
            }

            if (error && error.code === 'TIMEOUT') {
                console.warn('Profile fetch timed out')
                return null
            }

            return data
        } catch (error) {
            console.error('Error fetching profile:', error)
            return null
        }
    }, [])

    // Get cached session from localStorage (SYNC - instant)
    const getCachedSession = useCallback((): Session | null => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY)
            if (!stored) return null

            const parsed = JSON.parse(stored)

            // Validate structure
            if (!parsed.access_token || !parsed.user) {
                console.log('📦 Invalid cached session structure')
                return null
            }

            // Check if token is expired (with 5 minute buffer)
            const expiresAt = parsed.expires_at
            if (expiresAt) {
                const expiryTime = expiresAt * 1000
                const bufferMs = 5 * 60 * 1000 // 5 minutes
                if (expiryTime - bufferMs < Date.now()) {
                    console.log('📦 Cached session expired')
                    return null
                }
            }

            console.log('📦 Found valid cached session')
            return {
                access_token: parsed.access_token,
                refresh_token: parsed.refresh_token,
                expires_at: parsed.expires_at,
                expires_in: parsed.expires_in,
                token_type: 'bearer',
                user: parsed.user,
                provider_token: parsed.provider_token,
                provider_refresh_token: parsed.provider_refresh_token,
            } as Session
        } catch (e) {
            console.warn('Failed to read cached session:', e)
            return null
        }
    }, [])

    // Initialize session - NEVER blocks for more than 100ms for initial render
    useEffect(() => {
        let isMounted = true

        const initSession = async () => {
            // STEP 1: Check localStorage IMMEDIATELY (sync operation)
            const cachedSession = getCachedSession()

            if (cachedSession) {
                // We have a cached session - use it immediately!
                console.log('✅ Using cached session immediately')
                setSession(cachedSession)
                setUser(cachedSession.user as User)
                setLoading(false) // UI is ready NOW

                // Fetch profile in background (don't block)
                fetchProfile(cachedSession.user.id).then(p => {
                    if (isMounted && p) setProfile(p)
                })

                // Validate/refresh session in background (don't block)
                // Use timeout to prevent hanging
                withTimeout(
                    supabase.auth.getSession(),
                    3000,
                    { data: { session: null }, error: null }
                ).then(({ data: { session: freshSession } }) => {
                    if (!isMounted) return

                    if (freshSession) {
                        console.log('✅ Background refresh: got fresh session')
                        setSession(freshSession)
                        setUser(freshSession.user as User)
                    } else {
                        // Background refresh failed, but we still have cached session
                        // Keep using it - it might still work for API calls
                        console.log('⚠️ Background refresh returned null, keeping cached session')
                    }
                }).catch(() => {
                    console.warn('⚠️ Background session refresh failed, keeping cached session')
                })

                return
            }

            // STEP 2: No cached session - check with Supabase (with strict timeout)
            console.log('🔄 No cached session, checking Supabase...')

            const { data: { session: freshSession } } = await withTimeout(
                supabase.auth.getSession(),
                3000, // 3 second timeout
                { data: { session: null }, error: null }
            )

            if (!isMounted) return

            if (freshSession) {
                console.log('✅ Got fresh session from Supabase')
                setSession(freshSession)
                setUser(freshSession.user as User)

                // Fetch profile
                const p = await fetchProfile(freshSession.user.id)
                if (isMounted && p) setProfile(p)
            } else {
                console.log('ℹ️ No session found - user needs to login')
                setSession(null)
                setUser(null)
                setProfile(null)
            }

            if (isMounted) {
                setLoading(false)
            }
        }

        initSession()

        // Listen for auth changes (login, logout, token refresh)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, newSession) => {
                if (!isMounted) return

                console.log('🔔 Auth state changed:', event)

                setSession(newSession)
                setUser(newSession?.user as User | null)

                if (newSession?.user) {
                    const p = await fetchProfile(newSession.user.id)
                    if (isMounted && p) setProfile(p)
                } else {
                    setProfile(null)
                }

                setLoading(false)
            }
        )

        return () => {
            isMounted = false
            subscription.unsubscribe()
        }
    }, [getCachedSession, fetchProfile])

    const signInWithGitHub = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'github',
            options: {
                scopes: 'repo read:user',
                redirectTo: `${window.location.origin}/dashboard`,
            },
        })
        if (error) throw error
    }

    const signOut = async () => {
        try {
            // Sign out from Supabase (with timeout to prevent hanging)
            await withTimeout(supabase.auth.signOut(), 3000, undefined)
        } catch (error) {
            console.error('Error during Supabase signOut:', error)
        }

        // Always clear local state regardless of Supabase response
        setUser(null)
        setProfile(null)
        setSession(null)
        localStorage.clear()
        sessionStorage.clear()

        console.log('✅ Logged out successfully - all session data cleared')
    }

    // Refresh profile data (call after generating diagrams/READMEs)
    const refreshProfile = useCallback(async () => {
        if (!user) return
        const updatedProfile = await fetchProfile(user.id)
        if (updatedProfile) {
            setProfile(updatedProfile)
        }
    }, [user, fetchProfile])

    return (
        <AuthContext.Provider value={{ user, profile, session, loading, signInWithGitHub, signOut, refreshProfile }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
