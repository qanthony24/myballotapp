import React, { useState, FormEvent, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom'; // Removed Link
import { useAuth } from '../hooks/useAuth.tsx';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { UserPlusIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';

// Placeholder SVG icons for social logins
const GoogleIcon = () => <svg viewBox="0 0 48 48" width="24" height="24"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path><path fill="none" d="M0 0h48v48H0z"></path></svg>;
const FacebookIcon = () => <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24" className="text-[#1877F2]"><path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878V15.89H8.322V12.88h2.116v-2.2c0-2.085 1.262-3.223 3.138-3.223.891 0 1.658.067 1.881.097v2.713h-1.602c-1.012 0-1.208.481-1.208 1.186v1.555H16.3l-.356 3.01H13.05v6.008C18.343 21.128 22 16.991 22 12z"/></svg>;
const XIcon = () => <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24" className="text-black"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>;
const PhoneIconOutline = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width="24" height="24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>


const AuthPage: React.FC = () => {
  const location = useLocation(); // Get location
  const [isLoginView, setIsLoginView] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState(''); // For signup
  const { login, signup, signInWithGoogle, signInWithTwitter, signInWithFacebook, isLoading, error, currentUser } = useAuth(); // Added signInWithFacebook
  const navigate = useNavigate();

  useEffect(() => {
    // Check for #signup fragment in URL to default to signup view
    if (location.hash === '#signup') {
      setIsLoginView(false);
    }
  }, [location.hash]);

  useEffect(() => {
    if (currentUser) {
      // If user is already logged in, redirect based on onboarding status
      if (!currentUser.profileData?.onboardingCompleted) { // Added optional chaining for profileData
        navigate('/onboarding', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [currentUser, navigate]);


  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isLoginView) {
      await login(email, password);
    } else {
      if (!displayName.trim()) {
        alert("Please enter a display name for signup."); // Or set an error state
        return;
      }
      await signup(email, password, displayName);
    }
  };
  
  const handleSocialLogin = async (provider: 'google' | 'facebook' | 'x' | 'phone') => {
    if (provider === 'google') {
      await signInWithGoogle();
    } else if (provider === 'x') {
      await signInWithTwitter();
    } else if (provider === 'facebook') {
      await signInWithFacebook();
    } else if (provider === 'phone') {
      alert("Phone sign-in is conceptual in this demo.");
    }
  };


  if (isLoading && !error && !currentUser) { // Show loading only if not yet redirected
    return <div className="auth-container"><LoadingSpinner /></div>;
  }
  if (currentUser) return null; // Already handled by useEffect redirect

  return (
    <div className="auth-container py-8 md:py-12"> {/* Added padding from styles.css as Tailwind class */}
      <h1 className="font-display text-3xl md:text-4xl font-bold">{isLoginView ? 'Welcome Back!' : 'Create Your Account'}</h1>
      <p className="text-center text-midnight-navy/80 mb-8">
        {isLoginView ? 'Log in to access your ballot and settings.' : 'Join to personalize your voting experience.'}
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {!isLoginView && (
          <div className="form-group">
            <label htmlFor="displayName" className="form-label">Display Name</label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="E.g., Voter One"
              className="form-input"
              required={!isLoginView}
            />
          </div>
        )}
        <div className="form-group">
          <label htmlFor="email" className="form-label">Email Address</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="form-input"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="password" className="form-label">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="form-input"
            required
          />
        </div>

        {error && <p className="text-sm text-red-600 bg-red-100 p-3 rounded-md text-center">{error}</p>}

        <button type="submit" className="btn-primary w-full" disabled={isLoading}>
          {isLoading ? (
            <LoadingSpinner size="sm" />
          ) : (
            isLoginView ? (
              <><ArrowRightOnRectangleIcon className="h-5 w-5 mr-2" /> Log In</>
            ) : (
              <><UserPlusIcon className="h-5 w-5 mr-2" /> Sign Up</>
            )
          )}
        </button>
      </form>

      <div className="social-login-divider">Or continue with</div>

      <div className="space-y-3">
        <button onClick={() => handleSocialLogin('google')} className="social-btn">
          <GoogleIcon /> Sign in with Google
        </button>
        <button onClick={() => handleSocialLogin('x')} className="social-btn">
          <XIcon /> Sign in with X (Twitter)
        </button>
        <button onClick={() => handleSocialLogin('facebook')} className="social-btn"> {/* Changed from commented out to active */}
          <FacebookIcon /> Sign in with Facebook
        </button>
        {/* <button onClick={() => handleSocialLogin('phone')} className="social-btn">
          <PhoneIconOutline /> Sign in with Phone
        </button> */}
      </div>

      <p className="mt-8 text-center text-sm">
        {isLoginView ? "Don't have an account?" : "Already have an account?"}
        <button 
          onClick={() => setIsLoginView(!isLoginView)} 
          className="font-medium text-civic-blue hover:text-civic-blue/80 ml-1 focus:outline-none focus:underline"
        >
          {isLoginView ? 'Sign up' : 'Log in'}
        </button>
      </p>
    </div>
  );
};

export default AuthPage;
