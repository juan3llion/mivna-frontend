import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useEffect } from 'react'
import { Github, Zap, Shield, FileCode } from 'lucide-react'

export function Login() {
    const { signInWithGitHub, user, loading } = useAuth()
    const navigate = useNavigate()

    useEffect(() => {
        if (user && !loading) {
            navigate('/dashboard')
        }
    }, [user, loading, navigate])

    const handleLogin = async () => {
        try {
            await signInWithGitHub()
        } catch (error) {
            console.error('Login failed:', error)
        }
    }

    return (
        <div className="login-page">
            <div className="login-background">
                <div className="gradient-orb orb-1"></div>
                <div className="gradient-orb orb-2"></div>
                <div className="gradient-orb orb-3"></div>
            </div>

            <div className="login-container">
                <div className="login-card">
                    <div className="login-header">
                        <div className="logo">
                            <Zap className="logo-icon" />
                            <h1>Mivna</h1>
                        </div>
                        <p className="tagline">AI-Powered Architecture Documentation</p>
                    </div>

                    <div className="features">
                        <div className="feature">
                            <FileCode className="feature-icon" />
                            <div>
                                <h3>Instant Diagrams</h3>
                                <p>Generate architecture diagrams from your code in seconds</p>
                            </div>
                        </div>
                        <div className="feature">
                            <Shield className="feature-icon" />
                            <div>
                                <h3>Secure by Design</h3>
                                <p>Your code is never stored - processed in memory only</p>
                            </div>
                        </div>
                    </div>

                    <button className="github-login-btn" onClick={handleLogin} disabled={loading}>
                        <Github className="btn-icon" />
                        {loading ? 'Loading...' : 'Continue with GitHub'}
                    </button>

                    <p className="beta-notice">
                        🚀 Beta: 3 diagrams & 3 READMEs per account
                    </p>
                </div>
            </div>
        </div>
    )
}
