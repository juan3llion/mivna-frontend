import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useOrganization, type OrgMember } from '../hooks/useOrganization'
import { useAuth } from '../hooks/useAuth'
import { showToast } from '../lib/toast'
import { Users, Settings, Trash2, UserPlus, Crown, Shield, Eye, ArrowLeft } from 'lucide-react'
import './TeamSettings.css'

export function TeamSettings() {
    const navigate = useNavigate()
    const { orgId } = useParams<{ orgId: string }>()
    const { user } = useAuth()
    const {
        userOrgs,
        currentOrg,
        getMembers,
        updateMemberRole,
        removeMember,
        deleteOrg,
        userRole,
        canManageMembers
    } = useOrganization()

    const [members, setMembers] = useState<OrgMember[]>([])
    const [loading, setLoading] = useState(true)
    const [showInviteModal, setShowInviteModal] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

    // Find the org we're viewing
    const org = orgId ? userOrgs.find(o => o.id === orgId) : currentOrg

    useEffect(() => {
        if (org) {
            loadMembers()
        }
    }, [org?.id])

    const loadMembers = async () => {
        if (!org) return
        setLoading(true)
        const memberList = await getMembers(org.id)
        setMembers(memberList)
        setLoading(false)
    }

    const handleRoleChange = async (memberId: string, newRole: OrgMember['role']) => {
        const success = await updateMemberRole(memberId, newRole)
        if (success) {
            showToast.success('Role updated')
            loadMembers()
        } else {
            showToast.error('Failed to update role')
        }
    }

    const handleRemoveMember = async (member: OrgMember) => {
        if (member.role === 'owner') {
            showToast.error('Cannot remove the owner')
            return
        }

        const success = await removeMember(member.id)
        if (success) {
            showToast.success('Member removed')
            loadMembers()
        } else {
            showToast.error('Failed to remove member')
        }
    }

    const handleDeleteOrg = async () => {
        if (!org) return

        const success = await deleteOrg(org.id)
        if (success) {
            showToast.success('Organization deleted')
            navigate('/dashboard')
        } else {
            showToast.error('Failed to delete organization')
        }
    }

    const getRoleIcon = (role: OrgMember['role']) => {
        switch (role) {
            case 'owner': return <Crown size={16} className="role-icon owner" />
            case 'admin': return <Shield size={16} className="role-icon admin" />
            case 'viewer': return <Eye size={16} className="role-icon viewer" />
            default: return <Users size={16} className="role-icon member" />
        }
    }

    if (!org) {
        return (
            <div className="team-settings">
                <div className="empty-state">
                    <Users size={48} />
                    <h2>No organization selected</h2>
                    <p>Select an organization from the switcher or create a new one.</p>
                    <button className="primary-btn" onClick={() => navigate('/team/new')}>
                        Create Organization
                    </button>
                </div>
            </div>
        )
    }

    const myRole = userRole(org.id)
    const isOwner = myRole === 'owner'

    return (
        <div className="team-settings">
            <header className="team-header">
                <button className="back-btn" onClick={() => navigate('/dashboard')}>
                    <ArrowLeft size={20} />
                    Back
                </button>
                <div className="team-info">
                    <h1>
                        <Settings size={28} />
                        {org.name}
                    </h1>
                    <span className="team-slug">@{org.slug}</span>
                </div>
            </header>

            <section className="team-section">
                <div className="section-header">
                    <h2><Users size={20} /> Members ({members.length})</h2>
                    {canManageMembers && (
                        <button className="primary-btn" onClick={() => setShowInviteModal(true)}>
                            <UserPlus size={18} />
                            Invite Member
                        </button>
                    )}
                </div>

                {loading ? (
                    <div className="loading-state">Loading members...</div>
                ) : (
                    <div className="members-list">
                        {members.map(member => (
                            <div key={member.id} className="member-row">
                                <div className="member-info">
                                    <img
                                        src={member.profile?.avatar_url || '/avatar.png'}
                                        alt={member.profile?.github_username}
                                        className="member-avatar"
                                    />
                                    <div>
                                        <span className="member-name">
                                            {member.profile?.github_username || 'Unknown User'}
                                            {member.user_id === user?.id && <span className="you-badge">You</span>}
                                        </span>
                                        <span className="member-joined">
                                            Joined {new Date(member.joined_at || member.invited_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>

                                <div className="member-actions">
                                    {getRoleIcon(member.role)}
                                    {canManageMembers && member.role !== 'owner' ? (
                                        <select
                                            value={member.role}
                                            onChange={(e) => handleRoleChange(member.id, e.target.value as OrgMember['role'])}
                                            className="role-select"
                                        >
                                            <option value="admin">Admin</option>
                                            <option value="member">Member</option>
                                            <option value="viewer">Viewer</option>
                                        </select>
                                    ) : (
                                        <span className="role-badge">{member.role}</span>
                                    )}

                                    {canManageMembers && member.role !== 'owner' && member.user_id !== user?.id && (
                                        <button
                                            className="icon-btn danger"
                                            onClick={() => handleRemoveMember(member)}
                                            title="Remove member"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {isOwner && (
                <section className="team-section danger-zone">
                    <h2>Danger Zone</h2>
                    <div className="danger-actions">
                        <div className="danger-item">
                            <div>
                                <h3>Delete Organization</h3>
                                <p>Permanently delete this organization and all its data.</p>
                            </div>
                            <button
                                className="danger-btn"
                                onClick={() => setShowDeleteConfirm(true)}
                            >
                                Delete Organization
                            </button>
                        </div>
                    </div>
                </section>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <h2>Delete Organization?</h2>
                        <p>This will permanently delete <strong>{org.name}</strong> and all associated data. This action cannot be undone.</p>
                        <div className="modal-actions">
                            <button className="secondary-btn" onClick={() => setShowDeleteConfirm(false)}>
                                Cancel
                            </button>
                            <button className="danger-btn" onClick={handleDeleteOrg}>
                                Delete Forever
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Invite Modal - Placeholder for now */}
            {showInviteModal && (
                <div className="modal-overlay" onClick={() => setShowInviteModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <h2>Invite Team Member</h2>
                        <p>Coming soon: Invite members by email or GitHub username.</p>
                        <div className="modal-actions">
                            <button className="secondary-btn" onClick={() => setShowInviteModal(false)}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
