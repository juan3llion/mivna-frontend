import { useState, useEffect, createContext, useContext } from 'react'
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [profile, setProfile] = useState<Profile | null>(null)
    const [session, setSession] = useState<Session | null>(null)
    const [loading, setLoading] = useState(true)

    const fetchProfile = async (userId: string, isMounted: boolean = true) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single()

            if (!isMounted) return

            if (error && error.code === 'PGRST116') {
                // Profile doesn't exist, create it
                const { data: userData } = await supabase.auth.getUser()
                if (!isMounted) return

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

                if (isMounted) {
                    setProfile(createdProfile)
                }
            } else if (data && isMounted) {
                setProfile(data)
            }
        } catch (error) {
            // Silently handle errors when component is unmounted
            if (!isMounted) return
            console.error('Error fetching profile:', error)
        }
    }

    useEffect(() => {
        let isMounted = true

        // Clear any stale localhost auth data when on production
        const clearStaleAuth = async () => {
            const isProduction = window.location.hostname !== 'localhost'
            if (isProduction) {
                // Check if there's any cached localhost auth data
                const keys = Object.keys(localStorage)
                const hasLocalhostData = keys.some(key =>
                    key.includes('supabase') && localStorage.getItem(key)?.includes('localhost')
                )

                if (hasLocalhostData) {
                    console.log('🔄 Clearing stale localhost auth data...')
                    // Clear all Supabase auth data to force fresh login
                    keys.forEach(key => {
                        if (key.includes('supabase')) {
                            localStorage.removeItem(key)
                        }
                    })
                    // Force a fresh session check
                    await supabase.auth.signOut()
                }
            }
        }

        // Timeout wrapper to prevent hanging
        const withTimeout = (promise: Promise<any>, ms: number) => {
            const timeout = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Session check timeout')), ms)
            )
            return Promise.race([promise, timeout])
        }

        // Get initial session
        const initSession = async () => {
            try {
                await clearStaleAuth()

                // Add 5 second timeout to prevent infinite loading
                const { data: { session } } = await withTimeout(
                    supabase.auth.getSession(),
                    5000
                ) as any

                if (!isMounted) return

                setSession(session)
                setUser(session?.user as User | null)
                if (session?.user) {
                    await fetchProfile(session.user.id, isMounted)
                }
            } catch (error) {
                // Ignore AbortError as it's expected during navigation
                if (error instanceof Error && error.name === 'AbortError') {
                    return
                }

                // Handle timeout or corrupted session
                if (error instanceof Error && error.message === 'Session check timeout') {
                    console.error('⚠️ Session check timed out - clearing auth data')
                    // Clear potentially corrupted data
                    localStorage.clear()
                    await supabase.auth.signOut()
                } else {
                    console.error('Error getting session:', error)
                }

                // Always set loading to false even on error
                if (isMounted) {
                    setSession(null)
                    setUser(null)
                    setProfile(null)
                }
            } finally {
                if (isMounted) {
                    setLoading(false)
                }
            }
        }

        initSession()

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange
            (
                async (_event, session) => {
                    if (!isMounted) return

                    setSession(session)
                    setUser(session?.user as User | null)
                    if (session?.user) {
                        await fetchProfile(session.user.id, isMounted)
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
    }, [])

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
            // 1. Sign out from Supabase
            await supabase.auth.signOut()

            // 2. Clear all component state
            setUser(null)
            setProfile(null)
            setSession(null)

            // 3. Clear all localStorage (including any cached auth data)
            localStorage.clear()

            // 4. Clear all sessionStorage
            sessionStorage.clear()

            // 5. Log for debugging
            console.log('✅ Logged out successfully - all session data cleared')

            // Note: GitHub OAuth consent is still cached in the browser.
            // To fully logout from GitHub, user needs to go to:
            // https://github.com/settings/applications
            // and revoke Mivna's access
        } catch (error) {
            console.error('Error during logout:', error)
            // Still clear local state even if Supabase logout fails
            setUser(null)
            setProfile(null)
            setSession(null)
            localStorage.clear()
            sessionStorage.clear()
        }
    }

    return (
        <AuthContext.Provider value={{ user, profile, session, loading, signInWithGitHub, signOut }}>
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
