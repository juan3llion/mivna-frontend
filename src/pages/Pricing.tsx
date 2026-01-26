import React from 'react'
import { Check } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import './Pricing.css'

interface PricingTier {
    name: string
    price: string
    period: string
    description: string
    features: string[]
    tier: 'free' | 'pro' | 'enterprise'
    cta: string
    highlighted?: boolean
}

const tiers: PricingTier[] = [
    {
        name: 'Free',
        price: '$0',
        period: 'forever',
        description: 'Perfect for trying out Mivna',
        tier: 'free',
        cta: 'Get Started',
        features: [
            '3 diagrams total',
            '3 READMEs total',
            '1 organization (3 members)',
            'Public repositories only',
            'Community support',
            'Basic diagram types',
        ],
    },
    {
        name: 'Pro',
        price: '$29',
        period: 'month',
        description: 'For professional developers and teams',
        tier: 'pro',
        cta: 'Upgrade to Pro',
        highlighted: true,
        features: [
            'Unlimited diagrams',
            'Unlimited READMEs',
            '5 organizations (unlimited members)',
            'Private repositories',
            'All diagram types',
            'Advanced analytics',
            'Priority support (24h)',
            'API access',
        ],
    },
    {
        name: 'Enterprise',
        price: 'Custom',
        period: '',
        description: 'For large teams with custom needs',
        tier: 'enterprise',
        cta: 'Contact Sales',
        features: [
            'Everything in Pro',
            'Custom limits',
            'Dedicated support',
            'SLA guarantees',
            'SSO/SAML (coming soon)',
            'On-premise option',
            'White-labeling',
            'Custom integrations',
        ],
    },
]

export default function Pricing() {
    const navigate = useNavigate()
    const [loading, setLoading] = React.useState<string | null>(null)
    const [error, setError] = React.useState<string | null>(null)

    const handleSelectPlan = async (tier: 'free' | 'pro' | 'enterprise') => {
        if (tier === 'free') {
            navigate('/signup')
            return
        }

        if (tier === 'enterprise') {
            window.location.href = 'mailto:sales@mivna.app?subject=Enterprise%20Plan%20Inquiry'
            return
        }

        // Pro tier - create checkout session
        setLoading(tier)
        setError(null)

        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                navigate('/login?redirect=/pricing')
                return
            }

            const response = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({ tier: 'pro' }),
                }
            )

            if (!response.ok) {
                throw new Error('Failed to create checkout session')
            }

            const { url } = await response.json()
            window.location.href = url
        } catch (err) {
            console.error('Error creating checkout session:', err)
            setError('Failed to start checkout. Please try again.')
        } finally {
            setLoading(null)
        }
    }

    return (
        <div className="pricing-page">
            <div className="pricing-container">
                <div className="pricing-header">
                    <h1>Simple, Transparent Pricing</h1>
                    <p>Choose the plan that works best for you</p>
                </div>

                <div className="pricing-tiers">
                    {tiers.map((tier) => (
                        <div
                            key={tier.tier}
                            className={`pricing-card ${tier.highlighted ? 'highlighted' : ''}`}
                        >
                            {tier.highlighted && <div className="badge">Most Popular</div>}

                            <div className="tier-header">
                                <h3>{tier.name}</h3>
                                <div className="price">
                                    <span className="amount">{tier.price}</span>
                                    {tier.period && <span className="period">/{tier.period}</span>}
                                </div>
                                <p className="description">{tier.description}</p>
                            </div>

                            <ul className="features">
                                {tier.features.map((feature, idx) => (
                                    <li key={idx}>
                                        <Check size={16} />
                                        <span>{feature}</span>
                                    </li>
                                ))}
                            </ul>

                            <button
                                className={`cta-button ${tier.highlighted ? 'primary' : 'secondary'}`}
                                onClick={() => handleSelectPlan(tier.tier)}
                                disabled={loading === tier.tier}
                            >
                                {loading === tier.tier ? 'Loading...' : tier.cta}
                            </button>

                            {error && loading === tier.tier && (
                                <p className="error">{error}</p>
                            )}
                        </div>
                    ))}
                </div>

                <div className="pricing-faq">
                    <h2>Frequently Asked Questions</h2>
                    <div className="faq-grid">
                        <div className="faq-item">
                            <h4>Can I change plans later?</h4>
                            <p>Yes! You can upgrade or downgrade at any time from your billing settings.</p>
                        </div>
                        <div className="faq-item">
                            <h4>What payment methods do you accept?</h4>
                            <p>We accept all major credit cards via Stripe.</p>
                        </div>
                        <div className="faq-item">
                            <h4>Is there a free trial?</h4>
                            <p>The Free plan is free forever. Try it risk-free!</p>
                        </div>
                        <div className="faq-item">
                            <h4>Do you offer refunds?</h4>
                            <p>Yes, we offer a 14-day money-back guarantee on all paid plans.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
