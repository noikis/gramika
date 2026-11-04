import { useState } from 'react'
import type { FormEvent } from 'react'
import { authClient } from '../../auth-client'
import './login-screen.css'

type Mode = 'sign-in' | 'sign-up' | 'forgot'

export function LoginScreen() {
  const [mode, setMode] = useState<Mode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      if (mode === 'forgot') {
        setMessage('Password recovery by email is not available yet.')
      } else if (mode === 'sign-up') {
        const result = await authClient.signUp.email({ email, password, name: email.split('@')[0] })
        if (result.error) setMessage(result.error.message || 'Unable to create account.')
      } else {
        const result = await authClient.signIn.email({ email, password })
        if (result.error) setMessage(result.error.message || 'Unable to sign in.')
      }
    } catch {
      setMessage('Authentication service is unavailable. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-promise">
        <p className="auth-kicker">A MORE THOUGHTFUL WRITING ASSISTANT</p>
        <h1>Your words.<br /><em>Just clearer.</em></h1>
        <p>Correct grammar and punctuation without losing the meaning and tone of what you want to say.</p>
      </section>
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-icon" aria-hidden="true">✓</div>
        <h2 id="auth-title">{mode === 'sign-up' ? 'Create your account' : mode === 'forgot' ? 'Forgot password?' : 'Welcome to Gramika'}</h2>
        <p className="auth-subtitle">{mode === 'sign-up' ? 'Start your personal writing workspace.' : 'Sign in to your personal writing workspace.'}</p>
        {mode !== 'forgot' && <button className="google-button" type="button" disabled={busy} onClick={() => void authClient.signIn.social({ provider: 'google' })}>Continue with Google</button>}
        {mode !== 'forgot' && <div className="auth-divider">or continue with email</div>}
        <form onSubmit={submit}>
          <label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label>
          {mode !== 'forgot' && <label>Password <button className="inline-link" type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? 'Hide' : 'Show'}</button><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'} /></label>}
          <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'sign-up' ? 'Create account' : mode === 'forgot' ? 'Request reset' : 'Sign in'}</button>
        </form>
        {message && <p className="auth-message" role="status">{message}</p>}
        {mode === 'sign-in' && <button className="text-button" type="button" onClick={() => setMode('forgot')}>Forgot password?</button>}
        {mode === 'forgot' && <button className="text-button" type="button" onClick={() => setMode('sign-in')}>Back to sign in</button>}
        {mode !== 'forgot' && <p className="auth-switch">{mode === 'sign-up' ? 'Already have an account?' : 'New to Gramika?'} <button className="text-button" type="button" onClick={() => setMode(mode === 'sign-up' ? 'sign-in' : 'sign-up')}>{mode === 'sign-up' ? 'Sign in' : 'Create account'}</button></p>}
      </section>
    </main>
  )
}
