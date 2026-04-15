import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Clean up the email to prevent any invisible unicode or trailing spaces/periods
      const cleanEmail = email.toLowerCase().replace(/[\u200B-\u200D\uFEFF]/g, '').trim().replace(/\.$/, '');
      console.log(`Sending reset for email: '${cleanEmail}' (length: ${cleanEmail.length})`);

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        cleanEmail,
        {
          redirectTo: `${window.location.origin}/reset-password`,
        }
      );

      if (resetError) {
        console.error("Supabase Reset Error:", resetError);
        // Sometimes Supabase returns an obscure validation error if an email isn't in auth.users
        if (resetError.message.includes('is invalid')) {
          setError(`Supabase couldn't validate this email. Please check if it was typed correctly and that the account exists and is confirmed.`);
        } else {
          setError(resetError.message || 'Failed to send reset email');
        }
        setIsLoading(false);
        return;
      }

      setSent(true);
      setIsLoading(false);
    } catch (err) {
      setError(err.message || 'An unexpected error occurred');
      setIsLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Check your email</h2>
          <p className="mt-3 text-sm text-gray-600">
            We've sent a password reset link to <span className="font-semibold text-gray-800">{email}</span>. 
            Click the link in the email to reset your password.
          </p>
          <p className="mt-2 text-xs text-gray-500">
            Didn't receive the email? Check your spam folder, or try again.
          </p>
        </div>

        <div className="space-y-3">
          <Button
            className="w-full"
            variant="outline"
            onClick={() => { setSent(false); setEmail(''); }}
          >
            Try a different email
          </Button>

          <div className="text-center text-sm text-gray-600">
            Remember your password?{' '}
            <Link to="/login" className="font-semibold text-purple-600 hover:text-purple-500">
              Back to login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">Forgot password?</h2>
        <p className="mt-2 text-sm text-gray-600">
          No worries! Enter your email and we'll send you a reset link.
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
            Email address
          </label>
          <Input 
            type="email" 
            placeholder="m@example.com" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </div>

        <Button className="w-full" type="submit" isLoading={isLoading}>
          Send Reset Link
        </Button>
      </form>

      <div className="text-center text-sm text-gray-600">
        Remember your password?{' '}
        <Link to="/login" className="font-semibold text-purple-600 hover:text-purple-500">
          Back to login
        </Link>
      </div>
    </div>
  );
}
