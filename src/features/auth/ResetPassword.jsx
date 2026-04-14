import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    // Supabase automatically handles the token exchange from the email link.
    // We just need to listen for the PASSWORD_RECOVERY event.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === 'PASSWORD_RECOVERY') {
          setSessionReady(true);
        }
      }
    );

    // Also check if there's already a session (user might have landed here directly)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionReady(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        setError(updateError.message || 'Failed to update password');
        setIsLoading(false);
        return;
      }

      setSuccess(true);
      setIsLoading(false);

      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err) {
      setError(err.message || 'An unexpected error occurred');
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Password updated!</h2>
          <p className="mt-3 text-sm text-gray-600">
            Your password has been successfully reset. You'll be redirected to the login page shortly.
          </p>
        </div>

        <Button className="w-full" onClick={() => navigate('/login')}>
          Go to Login
        </Button>
      </div>
    );
  }

  if (!sessionReady) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="mx-auto w-12 h-12 mb-4">
            <span className="block h-12 w-12 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Verifying reset link...</h2>
          <p className="mt-2 text-sm text-gray-600">
            Please wait while we verify your password reset link.
          </p>
          <p className="mt-4 text-xs text-gray-500">
            If this takes too long, the link may have expired.{' '}
            <a href="/forgot-password" className="font-semibold text-purple-600 hover:text-purple-500">
              Request a new one
            </a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">Reset your password</h2>
        <p className="mt-2 text-sm text-gray-600">
          Enter your new password below
        </p>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        {error && (
          <div className="p-3 text-sm text-red-500 bg-red-50 rounded-md">
            {error}
          </div>
        )}
        
        <div className="space-y-2">
          <label className="text-sm font-medium leading-none">
            New Password
          </label>
          <Input 
            type="password"
            placeholder="At least 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium leading-none">
            Confirm New Password
          </label>
          <Input 
            type="password"
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>

        <Button className="w-full" type="submit" isLoading={isLoading}>
          Update Password
        </Button>
      </form>
    </div>
  );
}
