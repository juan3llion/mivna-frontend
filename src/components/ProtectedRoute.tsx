import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useState, useEffect } from 'react'

interface ProtectedRouteProps {
    children: React.ReactNode
}

// Maximum time to wait for auth to resolve before forcing redirect
const MAX_LOADING_TIME_MS = 5000

export function ProtectedRoute({ children }: ProtectedRouteProps) {
    const { user, loading } = useAuth()
    const [timedOut, setTimedOut] = useState(false)

    // Safety net: If loading takes too long, something is wrong
    // Force redirect to login to prevent infinite spinner
    useEffect(() => {
        if (!loading) {
            setTimedOut(false)
            return
        }

        const timeout = setTimeout(() => {
            if (loading) {
                console.warn('⚠️ Auth loading timed out after 5 seconds - forcing redirect to login')
                // Clear any potentially corrupted state
                try {
                    localStorage.clear()
                    sessionStorage.clear()
                } catch (e) {
                    console.error('Failed to clear storage:', e)
                }
                setTimedOut(true)
            }
        }, MAX_LOADING_TIME_MS)

        return () => clearTimeout(timeout)
    }, [loading])

    // Timed out - force redirect to login
    if (timedOut) {
        return <Navigate to="/login" replace />
    }

    // Still loading - show spinner (but will timeout after 5s)
    if (loading) {
        return (
            <div className="loading-screen">
                <div className="loading-spinner"></div>
                <p>Loading...</p>
            </div>
        )
    }

    // Not logged in - redirect to login
    if (!user) {
        return <Navigate to="/login" replace />
    }

    // Logged in - show protected content
    return <>{children}</>
}
