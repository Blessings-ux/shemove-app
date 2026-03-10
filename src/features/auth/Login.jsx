import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { supabase, isAbortError } from '../../services/supabase';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export default function Login() {
  const navigate = useNavigate();
  const { signIn } = useAuthStore();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const { error: signInError, data } = await signIn(formData);

      if (signInError) {
        let msg = signInError.message || 'Failed to sign in';
        if (msg === 'Bad Request' || msg.includes('400')) {
          msg = 'Invalid login credentials. Please check your email and password. If you just signed up, ensure you have confirmed your email address.';
        }
        setError(msg);
        setIsLoading(false);
        return;
      }

      // Get user ID from the auth response
      const userId = data?.user?.id;
      
      if (!userId) {
        setError('Login failed - no user ID returned');
        setIsLoading(false);
        return;
      }

      // Directly fetch profile from Supabase to ensure we get the role
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role, full_name, phone')
        .eq('id', userId)
        .single();

      if (profileError) {
        if (!isAbortError(profileError)) {
          console.error('Error fetching profile:', profileError);
        }
      }

      const role = profileData?.role || 'passenger';
      
      console.log('Login successful!');
      console.log('User ID:', userId);
      console.log('Profile data:', profileData);
      console.log('Role:', role);
      
      setIsLoading(false);
      
      // Navigate to the appropriate dashboard based on role
      switch (role) {
        case 'admin':
          navigate('/admin');
          break;
        case 'driver':
          navigate('/driver');
          break;
        default:
          navigate('/passenger');
      }
      
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'An error occurred during login');
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">Welcome back</h2>
        <p className="mt-2 text-sm text-gray-600">
          Sign in to your account
        </p>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        {error && (
          <div className="p-3 text-sm text-red-500 bg-red-50 rounded-md">
            {error}
          </div>
        )}
        
        <div className="space-y-2">
          <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            Email
          </label>
          <Input 
            type="email" 
            placeholder="m@example.com" 
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            Password
          </label>
          <Input 
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({...formData, password: e.target.value})}
            required 
          />
        </div>

        <Button className="w-full" type="submit" isLoading={isLoading}>
          Sign In
        </Button>
      </form>

      <div className="text-center text-sm text-gray-600">
        Don't have an account?{' '}
        <Link to="/signup" className="font-semibold text-purple-600 hover:text-purple-500">
          Sign up
        </Link>
      </div>
    </div>
  );
}
