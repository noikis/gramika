import { useState } from 'react'
import type { FormEvent } from 'react'
import { authClient } from '../../auth-client'
import { useLocale } from '../../i18n/use-locale'
import { LOCALES } from '../../i18n'
import { Icon } from '../ui/icon'
import './login-screen.css'

type Mode = 'sign-in' | 'sign-up' | 'forgot'

export function LoginScreen() {
  const { locale, setLocale, t } = useLocale()
  const copy = {
    eyebrow: t('authEyebrow'), hero: t('authHero'), clearer: t('authHeroAccent'), lead: t('authLead'), welcome: t('authWelcome'), signinLead: t('authSigninLead'), signup: t('authSignup'), signupLead: t('authSignupLead'), reset: t('authReset'), resetLead: t('authResetLead'), google: t('authGoogle'), divider: t('authDivider'), email: t('authEmail'), password: t('authPassword'), confirm: t('authConfirmPassword'), forgot: t('authForgot'), show: t('authShowPassword'), hide: t('authHidePassword'), signIn: t('authSignin'), create: t('authCreateAccount'), back: t('authBackToSignin'), newAccount: t('authNewToGramika'), existing: t('authAlreadyAccount'), foot: t('authFootnote'), recovery: t('authPasswordRecoveryUnavailable'), mismatch: t('authPasswordMismatch'), unavailable: t('authServiceUnavailable'), sampleTitle: t('authSampleTitle'), sampleChanges: t('authSampleChanges'), sampleOriginal: t('authSampleOriginal'), sampleCorrected: t('authSampleCorrected'), footer: t('authFooter'),
  };
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === 'dark')
  const [mode, setMode] = useState<Mode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      if (mode === 'forgot') {
        setMessage(copy.recovery)
      } else if (mode === 'sign-up') {
        if (password !== confirm) { setMessage(copy.mismatch); setBusy(false); return }
        const result = await authClient.signUp.email({ email, password, name: email.split('@')[0] })
        if (result.error) setMessage(result.error.message || 'Unable to create account.')
      } else {
        const result = await authClient.signIn.email({ email, password })
        if (result.error) setMessage(result.error.message || 'Unable to sign in.')
      }
    } catch {
      setMessage(copy.unavailable)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <header className="auth-header">
        <div className="auth-wrap auth-header-inner">
          <div className="auth-brand"><img src="/gramika-brand.png" alt="" /><span>Грамика</span></div>
          <div className="auth-tools">
            <div className="auth-languages" role="group" aria-label="Interface language">
              {LOCALES.map((value) => <button key={value} type="button" aria-pressed={locale === value} onClick={() => setLocale(value)}>{value.toUpperCase()}</button>)}
            </div>
            <button className="auth-theme" type="button" aria-label="Toggle theme" onClick={() => { const next = !dark; setDark(next); document.documentElement.dataset.theme = next ? 'dark' : 'light' }}><Icon name={dark ? 'light' : 'dark'} /></button>
          </div>
        </div>
      </header>
      <main className="auth-wrap auth-main">
      <section className="auth-story">
        <p className="auth-kicker">{copy.eyebrow}</p>
        <h1>{copy.hero}<br /><em>{copy.clearer}</em></h1>
        <p>{copy.lead}</p>
        <div className="auth-sample"><div><b>✓ &nbsp; {copy.sampleTitle}</b><span>{copy.sampleChanges}</span></div><p>{copy.sampleOriginal}</p><strong>Пожалуйста уточните какие документы нужны.</strong><hr /><p>{copy.sampleCorrected}</p><strong>Пожалуйста<mark>,</mark> уточните<mark>,</mark> какие документы нужны.</strong></div>
      </section>
      <section className="auth-sign-zone"><section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-card-heading"><div className="auth-icon" aria-hidden="true">✓</div><h2 id="auth-title">{mode === 'sign-up' ? copy.signup : mode === 'forgot' ? copy.reset : copy.welcome}</h2></div>
        <p className="auth-subtitle">{mode === 'sign-up' ? copy.signupLead : mode === 'forgot' ? copy.resetLead : copy.signinLead}</p>
        {mode !== 'forgot' && <button className="google-button" type="button" disabled={busy} onClick={() => void authClient.signIn.social({ provider: 'google' })}><span className="google-logo" aria-hidden="true">G</span>{copy.google}</button>}
        {mode !== 'forgot' && <div className="auth-divider">{copy.divider}</div>}
        <form onSubmit={submit}>
          <label>{copy.email}<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label>
          {mode !== 'forgot' && <label><span>{copy.password}</span><span className="auth-password-wrap"><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'} /><button className="inline-link" type="button" aria-label={showPassword ? copy.hide : copy.show} onClick={() => setShowPassword((value) => !value)}><span className="material-symbols-rounded" aria-hidden="true">{showPassword ? 'visibility_off' : 'visibility'}</span></button></span></label>}
          {mode === 'sign-up' && <label><span>{copy.confirm}</span><span className="auth-password-wrap"><input type={showPassword ? 'text' : 'password'} value={confirm} onChange={(event) => setConfirm(event.target.value)} required minLength={8} autoComplete="new-password" /><button className="inline-link" type="button" aria-label={showPassword ? copy.hide : copy.show} onClick={() => setShowPassword((value) => !value)}><span className="material-symbols-rounded" aria-hidden="true">{showPassword ? 'visibility_off' : 'visibility'}</span></button></span></label>}
          <button className="primary-button" type="submit" disabled={busy}>{busy ? t('authPleaseWait') : mode === 'sign-up' ? copy.create : mode === 'forgot' ? copy.reset : copy.signIn}</button>
        </form>
        {message && <p className="auth-message" role="status">{message}</p>}
        {mode === 'sign-in' && <button className="text-button auth-forgot" type="button" onClick={() => setMode('forgot')}>{copy.forgot}</button>}
        {mode === 'forgot' && <button className="text-button" type="button" onClick={() => setMode('sign-in')}>{copy.back}</button>}
        {mode !== 'forgot' && <p className="auth-switch">{mode === 'sign-up' ? copy.existing : copy.newAccount} <button className="text-button" type="button" onClick={() => setMode(mode === 'sign-up' ? 'sign-in' : 'sign-up')}>{mode === 'sign-up' ? copy.signIn : copy.create}</button></p>}
        <div className="auth-foot">🔒 <span>{copy.foot}</span></div>
      </section></section>
      </main>
      <footer className="auth-wrap auth-footer"><span>{copy.footer}</span></footer>
    </div>
  )
}


