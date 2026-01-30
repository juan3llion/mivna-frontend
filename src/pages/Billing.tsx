import { useEffect, useState } from 'react'
import { CreditCard, Calendar, DollarSign, ExternalLink, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { showToast } from '../lib/toast'
import './Billing.css'

interface Subscription {
    tier: string
    status: string
    current_period_end: string
    cancel_at_period_end: boolean
}

interface PaymentRecord {
    id: string
    amount: number
    currency: string
    status: string
    description: string
    created_at: string
}

export default function Billing() {
    const { user } = useAuth()
    const [subscription, setSubscription] = useState<Subscription | null>(null)
    const [paymentHistory, setPaymentHistory] = useState<PaymentRecord[]>([])
    const [profileData, setProfileData] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [loadingPortal, setLoadingPortal] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (user) {
            fetchBillingData()
        }
    }, [user])

    // Handle success/cancel from Stripe checkout redirect
    useEffect(() => {
        const params = new URLSearchParams(window.location.search)

        if (params.get('success') === 'true') {
            showToast.success('Payment successful! Your subscription is now active.')
            // Clean up URL
            window.history.replaceState({}, '', '/settings/billing')
        }

        if (params.get('canceled') === 'true') {
            showToast.success('Checkout canceled. No charges were made.')
            window.history.replaceState({}, '', '/settings/billing')
        }
    }, [])

    const fetchBillingData = async () => {
        try {
            // Fetch subscription info from profile
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('subscription_tier, subscription_status, subscription_current_period_end, diagrams_generated, readmes_generated, stripe_customer_id')
                .eq('id', user?.id)
                .single()

            if (profileError) throw profileError

            // Save profile data to state for use in JSX
            setProfileData(profile)

            if (profile.subscription_tier && profile.subscription_tier !== 'free') {
                setSubscription({
                    tier: profile.subscription_tier,
                    status: profile.subscription_status,
                    current_period_end: profile.subscription_current_period_end,
                    cancel_at_period_end: false,
                })
            }

            // Fetch payment history
            const { data: payments, error: paymentsError } = await supabase
                .from('payment_history')
                .select('*')
                .eq('user_id', user?.id)
                .order('created_at', { ascending: false })
                .limit(10)

            if (paymentsError) throw paymentsError
            setPaymentHistory(payments || [])
        } catch (err: any) {
            console.error('Error fetching billing data:', err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const openCustomerPortal = async () => {
        setLoadingPortal(true)
        setError(null)

        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) throw new Error('Not authenticated')

            const response = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-portal-session`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`,
                    },
                }
            )

            if (!response.ok) {
                throw new Error('Failed to create portal session')
            }

            const { url } = await response.json()
            window.location.href = url
        } catch (err: any) {
            console.error('Error opening customer portal:', err)
            setError(err.message)
        } finally {
            setLoadingPortal(false)
        }
    }

    if (loading) {
        return (
            <div className="billing-page">
                <div className="billing-loading">Loading billing information...</div>
            </div>
        )
    }

    return (
        <div className="billing-page">
            <div className="billing-container">
                <div className="billing-header">
                    <h1>Billing & Subscription</h1>
                    <p>Manage your subscription and view payment history</p>
                </div>

                {error && (
                    <div className="error-banner">
                        <AlertCircle size={20} />
                        <span>{error}</span>
                    </div>
                )}

                <div className="billing-grid">
                    {/* Current Plan */}
                    <div className="billing-card">
                        <div className="card-header">
                            <CreditCard size={24} />
                            <h3>Current Plan</h3>
                        </div>
                        <div className="card-content">
                            <div className="plan-info">
                                <span className="plan-name">
                                    {subscription?.tier ? (
                                        subscription.tier.charAt(0).toUpperCase() + subscription.tier.slice(1)
                                    ) : 'Free'}
                                </span>
                                <span className={`plan-status ${subscription?.status || 'inactive'}`}>
                                    {subscription?.status || 'Active'}
                                </span>
                            </div>

                            {subscription && (
                                <div className="plan-details">
                                    <div className="detail-item">
                                        <Calendar size={16} />
                                        <span>
                                            Renews on {new Date(subscription.current_period_end).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {subscription ? (
                                <button
                                    className="manage-button"
                                    onClick={openCustomerPortal}
                                    disabled={loadingPortal}
                                >
                                    <ExternalLink size={16} />
                                    {loadingPortal ? 'Loading...' : 'Manage Subscription'}
                                </button>
                            ) : (
                                <a href="/pricing" className="upgrade-button">
                                    Upgrade to Pro
                                </a>
                            )}
                        </div>
                    </div>

                    {/* Usage Stats */}
                    <div className="billing-card">
                        <div className="card-header">
                            <DollarSign size={24} />
                            <h3>Usage This Month</h3>
                        </div>
                        <div className="card-content">
                            <div className="usage-stats">
                                <div className="stat-item">
                                    <span className="stat-label">Diagrams Generated</span>
                                    <span className="stat-value">
                                        {subscription?.tier === 'pro' || subscription?.tier === 'enterprise'
                                            ? `${profileData?.diagrams_generated || 0} (Unlimited)`
                                            : `${profileData?.diagrams_generated || 0} / 3`
                                        }
                                    </span>
                                </div>
                                <div className="stat-item">
                                    <span className="stat-label">READMEs Generated</span>
                                    <span className="stat-value">
                                        {subscription?.tier === 'pro' || subscription?.tier === 'enterprise'
                                            ? `${profileData?.readmes_generated || 0} (Unlimited)`
                                            : `${profileData?.readmes_generated || 0} / 3`
                                        }
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Payment History */}
                <div className="payment-history">
                    <h2>Payment History</h2>
                    {paymentHistory.length > 0 ? (
                        <table className="history-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Description</th>
                                    <th>Amount</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paymentHistory.map((payment) => (
                                    <tr key={payment.id}>
                                        <td>{new Date(payment.created_at).toLocaleDateString()}</td>
                                        <td>{payment.description || 'Subscription payment'}</td>
                                        <td>
                                            ${(payment.amount / 100).toFixed(2)} {payment.currency.toUpperCase()}
                                        </td>
                                        <td>
                                            <span className={`payment-status ${payment.status}`}>
                                                {payment.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <p className="no-history">No payment history yet</p>
                    )}
                </div>
            </div>
        </div>
    )
}
