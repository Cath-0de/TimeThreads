import type { FormEvent } from 'react'

type SignInPageProps = {
  isCreatingAccount: boolean
  isSubmitting: boolean
  errorMessage: string
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onGoogleSignIn: () => void
  onToggleAccountMode: () => void
}

export default function SignInPage({
  isCreatingAccount,
  isSubmitting,
  errorMessage,
  onSubmit,
  onGoogleSignIn,
  onToggleAccountMode,
}: SignInPageProps) {
  return (
    <main id="home">
      <h1>TimeThreads</h1>
      <section className="auth-panel" aria-label="Sign in">
        <h2>{isCreatingAccount ? 'Create your account' : 'Sign in'}</h2>
        <form className="auth-form" onSubmit={onSubmit}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            disabled={isSubmitting}
          />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={isCreatingAccount ? 'new-password' : 'current-password'}
            minLength={6}
            required
            disabled={isSubmitting}
          />
          {errorMessage && <p className="auth-error" role="alert">{errorMessage}</p>}
          <button type="submit" className="sign-in" disabled={isSubmitting}>
            {isSubmitting
              ? 'Please wait…'
              : isCreatingAccount
                ? 'Create account'
                : 'Sign in'}
          </button>
        </form>
        <div className="auth-divider" aria-hidden="true">
          <span>or</span>
        </div>
        <button
          type="button"
          className="google-sign-in"
          onClick={onGoogleSignIn}
          disabled={isSubmitting}
        >
          Continue with Google
        </button>
        <p className="auth-switch">
          {isCreatingAccount ? 'Already have an account?' : 'New to TimeThreads?'}{' '}
          <button type="button" onClick={onToggleAccountMode} disabled={isSubmitting}>
            {isCreatingAccount ? 'Sign in' : 'Create an account'}
          </button>
        </p>
      </section>
    </main>
  )
}
