import { Search, X } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import './SearchBar.css'

interface SearchBarProps {
    value: string
    onChange: (value: string) => void
    placeholder?: string
    debounceMs?: number
}

export function SearchBar({ value, onChange, placeholder = 'Search...', debounceMs = 300 }: SearchBarProps) {
    const [localValue, setLocalValue] = useState(value)

    // Debounce the onChange callback
    useEffect(() => {
        const timer = setTimeout(() => {
            if (localValue !== value) {
                onChange(localValue)
            }
        }, debounceMs)

        return () => clearTimeout(timer)
    }, [localValue, debounceMs, onChange, value])

    // Update local value when external value changes
    useEffect(() => {
        setLocalValue(value)
    }, [value])

    const handleClear = useCallback(() => {
        setLocalValue('')
        onChange('')
    }, [onChange])

    // Keyboard shortcut: / to focus search
    useEffect(() => {
        const handleKeyPress = (e: KeyboardEvent) => {
            if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
                e.preventDefault()
                document.getElementById('search-input')?.focus()
            }
        }

        document.addEventListener('keydown', handleKeyPress)
        return () => document.removeEventListener('keydown', handleKeyPress)
    }, [])

    return (
        <div className="search-bar">
            <Search size={20} className="search-icon" />
            <input
                id="search-input"
                type="text"
                value={localValue}
                onChange={e => setLocalValue(e.target.value)}
                placeholder={placeholder}
                className="search-input"
            />
            {localValue && (
                <button className="clear-button" onClick={handleClear} aria-label="Clear search">
                    <X size={18} />
                </button>
            )}
            <kbd className="search-shortcut">/</kbd>
        </div>
    )
}
