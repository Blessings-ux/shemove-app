import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { supabase } from '../../services/supabase';

export default function Signup() {
  const navigate = useNavigate();
  const { signUp } = useAuthStore();
  const [formData, setFormData] = useState({ 
    fullName: '', 
    email: '', 
    phone: '',
    password: '',
    role: 'passenger' 
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Trim inputs
    const trimmedData = {
      ...formData,
      fullName: formData.fullName.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
    };

    // 1. Check if phone number already exists in profiles (to prevent 500 error)
    try {
      const { data: existingPhone } = await supabase
        .from('profiles')
        .select('id')
        .eq('phone', trimmedData.phone)
        .maybeSingle();

      if (existingPhone) {
        setError('This phone number is already registered.');
        setIsLoading(false);
        return;
      }
    } catch (checkErr) {
      console.error('Phone check failed:', checkErr);
      // Continue anyway, maybe it's fine
    }

    const { error: signUpError, data } = await signUp(trimmedData);

    if (signUpError) {
      setError(signUpError.message || 'Failed to sign up');
      setIsLoading(false);
      return;
    }

    setIsLoading(false);

    // If email confirmation is disabled, redirect directly to dashboard
    if (data?.user && !data.user.identities?.length === 0) {
      // Redirect based on selected role
      switch (formData.role) {
        case 'driver':
          navigate('/driver');
          break;
        case 'fleet_owner':
          navigate('/fleet');
          break;
        case 'passenger':
        default:
          navigate('/passenger');
          break;
      }
    } else {
      // Show success message for email confirmation
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <div className="text-center space-y-4">
        <h2 className="text-2xl font-bold text-emerald-600">Account Created!</h2>
        <p className="text-gray-600">
          Your account has been successfully created. Please check your email to verify your account, then log in.
        </p>
        <Button onClick={() => navigate('/login')} className="w-full">
          Go to Login
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">Create an account</h2>
        <p className="mt-2 text-sm text-gray-600">
          Join JiraniRide today
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && (
          <div className="p-3 text-sm text-red-500 bg-red-50 rounded-md">
            {error}
          </div>
        )}
        
        <div className="space-y-2">
          <label className="text-sm font-medium">Full Name</label>
          <Input 
            placeholder="John Doe" 
            value={formData.fullName}
            onChange={(e) => setFormData({...formData, fullName: e.target.value})}
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Phone Number</label>
          <Input 
            placeholder="+254..." 
            value={formData.phone}
            onChange={(e) => setFormData({...formData, phone: e.target.value})}
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Email</label>
          <Input 
            type="email" 
            placeholder="m@example.com" 
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Password</label>
          <Input 
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({...formData, password: e.target.value})}
            required 
            minLength={6}
          />
        </div>

        <div className="space-y-2">
           <label className="text-sm font-medium">I want to be a:</label>
           <div className="grid grid-cols-3 gap-3">
             <label className="flex flex-col items-center gap-2 border p-3 rounded-lg cursor-pointer has-[:checked]:border-emerald-600 has-[:checked]:bg-emerald-50 text-center">
               <input 
                 type="radio" 
                 name="role" 
                 value="passenger"
                 checked={formData.role === 'passenger'}
                 onChange={(e) => setFormData({...formData, role: e.target.value})}
                 className="accent-primary"
               />
               <span className="font-medium text-sm">Passenger</span>
               <span className="text-xs text-slate-500">Book rides</span>
             </label>
             <label className="flex flex-col items-center gap-2 border p-3 rounded-lg cursor-pointer has-[:checked]:border-emerald-600 has-[:checked]:bg-emerald-50 text-center">
               <input 
                 type="radio" 
                 name="role" 
                 value="driver"
                 checked={formData.role === 'driver'}
                 onChange={(e) => setFormData({...formData, role: e.target.value})}
                 className="accent-primary"
               />
               <span className="font-medium text-sm">Driver</span>
               <span className="text-xs text-slate-500">Earn money</span>
             </label>
             <label className="flex flex-col items-center gap-2 border p-3 rounded-lg cursor-pointer has-[:checked]:border-purple-600 has-[:checked]:bg-purple-50 text-center">
               <input 
                 type="radio" 
                 name="role" 
                 value="fleet_owner"
                 checked={formData.role === 'fleet_owner'}
                 onChange={(e) => setFormData({...formData, role: e.target.value})}
                 className="accent-purple-600"
               />
               <span className="font-medium text-sm">Fleet Owner</span>
               <span className="text-xs text-slate-500">Manage vehicles</span>
             </label>
           </div>
        </div>

        <Button className="w-full mt-4" type="submit" isLoading={isLoading}>
          Sign Up
        </Button>
      </form>

      <div className="text-center text-sm text-gray-600">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-emerald-600 hover:text-emerald-500">
          Sign in
        </Link>
      </div>
    </div>
  );
}
