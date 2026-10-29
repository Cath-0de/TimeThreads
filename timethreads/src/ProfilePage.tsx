import type { User } from 'firebase/auth'

type ProfilePageProps = {
  user: User
  errorMessage: string
  isSubmitting: boolean
  onSignOut: () => void
}

export default function ProfilePage({
  user,
  errorMessage,
  isSubmitting,
  onSignOut,
}: ProfilePageProps) {
  return (
    <section className="page-card profile-card" aria-labelledby="profile-title">
      <p className="eyebrow">ACCOUNT</p>
      <h1 id="profile-title">Profile &amp; settings</h1>
      <dl className="profile-details">
        <div>
          <dt>Email</dt>
          <dd>{user.email ?? 'No email available'}</dd>
        </div>
      </dl>
      {errorMessage && <p className="auth-error" role="alert">{errorMessage}</p>}
      <button
        type="button"
        className="sign-in"
        onClick={onSignOut}
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Signing out…' : 'Sign out'}
      </button>
    </section>
  )
}
