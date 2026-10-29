import { FirebaseError } from 'firebase/app'
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'
import { useEffect, useState, type FormEvent } from 'react'
// @ts-expect-error CSS is loaded as a side effect by the bundler.
import './App.css'
import { auth } from './firebase'

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [isCreatingAccount, setIsCreatingAccount] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    return onAuthStateChanged(
      auth,
      (currentUser) => {
        setUser(currentUser)
        setAuthReady(true)
      },
      () => {
        setErrorMessage('Could not check your sign-in status. Please refresh and try again.')
        setAuthReady(true)
      },
    )
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    setIsSubmitting(true)

    const formData = new FormData(event.currentTarget)
    const email = String(formData.get('email')).trim()
    const password = String(formData.get('password'))

    try {
      if (isCreatingAccount) {
        await createUserWithEmailAndPassword(auth, email, password)
      } else {
        await signInWithEmailAndPassword(auth, email, password)
      }
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSignOut() {
    setErrorMessage('')
    setIsSubmitting(true)
    try {
      await signOut(auth)
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleGoogleSignIn() {
    setErrorMessage('')
    setIsSubmitting(true)
    try {
      await signInWithPopup(auth, new GoogleAuthProvider())
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  function toggleAccountMode() {
    setIsCreatingAccount((creating) => !creating)
    setErrorMessage('')
  }

  return (
    <main id="home">
      <h1>TimeThreads</h1>
      {!authReady ? (
        <p role="status">Checking sign-in status…</p>
      ) : user ? (
        <section className="auth-panel" aria-label="Account">
          <p className="account-status">
            Signed in as <strong>{user.email ?? 'your account'}</strong>
          </p>
          {errorMessage && <p className="auth-error" role="alert">{errorMessage}</p>}
          <button
            type="button"
            className="sign-in"
            onClick={handleSignOut}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Signing out…' : 'Sign out'}
          </button>
        </section>
      ) : (
        <section className="auth-panel" aria-label="Sign in">
          <h2>{isCreatingAccount ? 'Create your account' : 'Sign in'}</h2>
          <form className="auth-form" onSubmit={handleSubmit}>
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
            onClick={handleGoogleSignIn}
            disabled={isSubmitting}
          >
            Continue with Google
          </button>
          <p className="auth-switch">
            {isCreatingAccount ? 'Already have an account?' : 'New to TimeThreads?'}{' '}
            <button type="button" onClick={toggleAccountMode} disabled={isSubmitting}>
              {isCreatingAccount ? 'Sign in' : 'Create an account'}
            </button>
          </p>
        </section>
      )}
    </main>
  )
}

function getAuthErrorMessage(error: unknown) {
  if (!(error instanceof FirebaseError)) {
    return 'Something went wrong. Please try again.'
  }

  switch (error.code) {
    case 'auth/email-already-in-use':
      return 'An account already exists for this email. Try signing in instead.'
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'The email or password is incorrect.'
    case 'auth/invalid-email':
      return 'Enter a valid email address.'
    case 'auth/weak-password':
      return 'Choose a stronger password with at least 6 characters.'
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not enabled for this Firebase project.'
    case 'auth/unauthorized-domain':
      return 'This app domain is not authorized in Firebase Authentication settings.'
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google sign-in popup. Allow popups and try again.'
    case 'auth/popup-closed-by-user':
      return 'Google sign-in was closed before it finished.'
    case 'auth/cancelled-popup-request':
      return 'Another sign-in popup is already open. Finish it or try again.'
    case 'auth/too-many-requests':
      return 'There have been too many attempts. Please wait and try again.'
    case 'auth/network-request-failed':
      return 'Could not connect to Firebase. Check your internet connection and try again.'
    default:
      return 'Could not complete that request. Please try again.'
  }
}

export default App
