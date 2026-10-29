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
import './App.css'
import { auth } from './firebase'
import HomePage from './HomePage'
import ProfilePage from './ProfilePage'
import SignInPage from './SignInPage'

type Page = 'home' | 'profile'

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [isCreatingAccount, setIsCreatingAccount] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [currentPage, setCurrentPage] = useState<Page>('home')

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
    <>
      {!authReady ? (
        <main id="home">
          <h1>TimeThreads</h1>
          <p role="status">Checking sign-in status…</p>
        </main>
      ) : user ? (
        <div className="app-shell">
          <header className="app-header">
            <button type="button" className="brand" onClick={() => setCurrentPage('home')}>
              TimeThreads
            </button>
            <nav className="top-nav" aria-label="Main navigation">
              <button
                type="button"
                aria-current={currentPage === 'home' ? 'page' : undefined}
                className={currentPage === 'home' ? 'nav-link active' : 'nav-link'}
                onClick={() => setCurrentPage('home')}
              >
                Home
              </button>
              <button
                type="button"
                aria-current={currentPage === 'profile' ? 'page' : undefined}
                className={currentPage === 'profile' ? 'nav-link active' : 'nav-link'}
                onClick={() => setCurrentPage('profile')}
              >
                Profile
              </button>
            </nav>
          </header>

          <main className="page-content">
            {currentPage === 'home' ? (
              <HomePage />
            ) : (
              <ProfilePage
                user={user}
                errorMessage={errorMessage}
                isSubmitting={isSubmitting}
                onSignOut={handleSignOut}
              />
            )}
          </main>
        </div>
      ) : (
        <SignInPage
          isCreatingAccount={isCreatingAccount}
          isSubmitting={isSubmitting}
          errorMessage={errorMessage}
          onSubmit={handleSubmit}
          onGoogleSignIn={handleGoogleSignIn}
          onToggleAccountMode={toggleAccountMode}
        />
      )}
    </>
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
