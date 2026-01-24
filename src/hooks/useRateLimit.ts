import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

interface RateLimitState {
    // Total limits (beta)
    diagramsTotal: number
    diagramsTotalLimit: number
    readmesTotal: number
    readmesTotalLimit: number
    // Hourly limits
    diagramsThisHour: number
    diagramsHourlyLimit: number
    readmesThisHour: number
    readmesHourlyLimit: number
    // Derived states
    canGenerateDiagram: boolean
    canGenerateReadme: boolean
    // Cooldown info
    diagramCooldownEndsAt: Date | null
    readmeCooldownEndsAt: Date | null
    // Loading
    loading: boolean
}

const HOURLY_LIMIT = 5
const BETA_LIMIT = 10

export function useRateLimit(userId: string | undefined) {
    const [state, setState] = useState<RateLimitState>({
        diagramsTotal: 0,
        diagramsTotalLimit: BETA_LIMIT,
        readmesTotal: 0,
        readmesTotalLimit: BETA_LIMIT,
        diagramsThisHour: 0,
        diagramsHourlyLimit: HOURLY_LIMIT,
        readmesThisHour: 0,
        readmesHourlyLimit: HOURLY_LIMIT,
        canGenerateDiagram: true,
        canGenerateReadme: true,
        diagramCooldownEndsAt: null,
        readmeCooldownEndsAt: null,
        loading: true,
    })

    const fetchRateLimits = useCallback(async () => {
        if (!userId) {
            setState(prev => ({ ...prev, loading: false }))
            return
        }

        try {
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('diagrams_generated, readmes_generated, last_diagram_at, diagrams_this_hour, last_readme_at, readmes_this_hour')
                .eq('id', userId)
                .single()

            if (error || !profile) {
                setState(prev => ({ ...prev, loading: false }))
                return
            }

            const now = new Date()
            const hourAgo = new Date(now.getTime() - 60 * 60 * 1000)

            // Calculate diagram rate limits
            const lastDiagramAt = profile.last_diagram_at ? new Date(profile.last_diagram_at) : null
            let diagramsThisHour = profile.diagrams_this_hour || 0
            if (!lastDiagramAt || lastDiagramAt < hourAgo) {
                diagramsThisHour = 0
            }

            // Calculate README rate limits
            const lastReadmeAt = profile.last_readme_at ? new Date(profile.last_readme_at) : null
            let readmesThisHour = profile.readmes_this_hour || 0
            if (!lastReadmeAt || lastReadmeAt < hourAgo) {
                readmesThisHour = 0
            }

            // Calculate cooldowns
            const diagramCooldownEndsAt = (diagramsThisHour >= HOURLY_LIMIT && lastDiagramAt)
                ? new Date(lastDiagramAt.getTime() + 60 * 60 * 1000)
                : null

            const readmeCooldownEndsAt = (readmesThisHour >= HOURLY_LIMIT && lastReadmeAt)
                ? new Date(lastReadmeAt.getTime() + 60 * 60 * 1000)
                : null

            setState({
                diagramsTotal: profile.diagrams_generated || 0,
                diagramsTotalLimit: BETA_LIMIT,
                readmesTotal: profile.readmes_generated || 0,
                readmesTotalLimit: BETA_LIMIT,
                diagramsThisHour,
                diagramsHourlyLimit: HOURLY_LIMIT,
                readmesThisHour,
                readmesHourlyLimit: HOURLY_LIMIT,
                canGenerateDiagram: profile.diagrams_generated < BETA_LIMIT && diagramsThisHour < HOURLY_LIMIT,
                canGenerateReadme: profile.readmes_generated < BETA_LIMIT && readmesThisHour < HOURLY_LIMIT,
                diagramCooldownEndsAt,
                readmeCooldownEndsAt,
                loading: false,
            })
        } catch (err) {
            console.error('Failed to fetch rate limits:', err)
            setState(prev => ({ ...prev, loading: false }))
        }
    }, [userId])

    useEffect(() => {
        fetchRateLimits()
    }, [fetchRateLimits])

    // Format time remaining for cooldown
    const formatCooldownTime = (endsAt: Date | null): string => {
        if (!endsAt) return ''
        const now = new Date()
        const diffMs = endsAt.getTime() - now.getTime()
        if (diffMs <= 0) return ''
        const minutes = Math.ceil(diffMs / 60000)
        return `${minutes} min`
    }

    return {
        ...state,
        refresh: fetchRateLimits,
        formatCooldownTime,
        diagramCooldownRemaining: formatCooldownTime(state.diagramCooldownEndsAt),
        readmeCooldownRemaining: formatCooldownTime(state.readmeCooldownEndsAt),
    }
}
