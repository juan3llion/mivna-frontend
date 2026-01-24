import { useState, useRef, useEffect } from 'react'
import { useOrganization } from '../hooks/useOrganization'
import { Users, ChevronDown, Plus, User } from 'lucide-react'
import './OrgSwitcher.css'

export function OrgSwitcher() {
    const { currentOrg, userOrgs, setCurrentOrg, isPersonalContext } = useOrganization()
    const [isOpen, setIsOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    return (
        <div className="org-switcher" ref={dropdownRef}>
            <button
                className="org-switcher-trigger"
                onClick={() => setIsOpen(!isOpen)}
                aria-expanded={isOpen}
                aria-haspopup="listbox"
            >
                <div className="org-switcher-current">
                    {isPersonalContext ? (
                        <>
                            <User size={18} />
                            <span>Personal</span>
                        </>
                    ) : (
                        <>
                            <Users size={18} />
                            <span>{currentOrg?.name}</span>
                        </>
                    )}
                </div>
                <ChevronDown size={16} className={`chevron ${isOpen ? 'open' : ''}`} />
            </button>

            {isOpen && (
                <div className="org-switcher-dropdown" role="listbox">
                    <div
                        className={`org-option ${isPersonalContext ? 'active' : ''}`}
                        onClick={() => {
                            setCurrentOrg(null)
                            setIsOpen(false)
                        }}
                        role="option"
                        aria-selected={isPersonalContext}
                    >
                        <User size={18} />
                        <div className="org-option-info">
                            <span className="org-name">Personal</span>
                            <span className="org-description">Your personal workspace</span>
                        </div>
                    </div>

                    {userOrgs.length > 0 && (
                        <>
                            <div className="org-switcher-divider" />
                            <div className="org-switcher-label">Organizations</div>
                            {userOrgs.map(org => (
                                <div
                                    key={org.id}
                                    className={`org-option ${currentOrg?.id === org.id ? 'active' : ''}`}
                                    onClick={() => {
                                        setCurrentOrg(org)
                                        setIsOpen(false)
                                    }}
                                    role="option"
                                    aria-selected={currentOrg?.id === org.id}
                                >
                                    {org.avatar_url ? (
                                        <img src={org.avatar_url} alt={org.name} className="org-avatar" />
                                    ) : (
                                        <Users size={18} />
                                    )}
                                    <div className="org-option-info">
                                        <span className="org-name">{org.name}</span>
                                        <span className="org-slug">@{org.slug}</span>
                                    </div>
                                </div>
                            ))}
                        </>
                    )}

                    <div className="org-switcher-divider" />
                    <a href="/team/new" className="org-option create-org">
                        <Plus size={18} />
                        <span>Create Organization</span>
                    </a>
                </div>
            )}
        </div>
    )
}
