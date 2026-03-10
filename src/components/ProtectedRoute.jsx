import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const { user, profile, loading } = useAuthStore();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If roles are specified and we have a profile, check access
  if (allowedRoles.length > 0 && profile) {
      if (!allowedRoles.includes(profile.role)) {
          // Redirect to their appropriate dashboard or a 403 page
          // For simplicity, let's bump them to their role's home or root
          if (profile.role === 'admin') return <Navigate to="/admin" replace />;
          if (profile.role === 'driver') return <Navigate to="/driver" replace />;
          if (profile.role === 'passenger') return <Navigate to="/passenger" replace />;
      }
  }

  return children;
}
