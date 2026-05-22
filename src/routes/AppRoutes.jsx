import { Routes, Route } from 'react-router-dom';
import AppLayout from '../layouts/AppLayout';
import AuthLayout from '../layouts/AuthLayout';
import Login from '../features/auth/Login';
import Signup from '../features/auth/Signup';
import ForgotPassword from '../features/auth/ForgotPassword';
import ResetPassword from '../features/auth/ResetPassword';
import LandingPage from '../features/landing/LandingPage';
import PassengerHome from '../features/passenger/PassengerHome';
import DriverDashboard from '../features/driver/DriverDashboard';
import AdminDashboard from '../features/admin/AdminDashboard';

import ProtectedRoute from '../components/ProtectedRoute';

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      
      {/* Public Auth Routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
      </Route>
      
      {/* Full Screen Routes (Passenger & Driver & Admin) */}
      <Route path="/passenger" element={
        <ProtectedRoute allowedRoles={['passenger']}>
          <PassengerHome />
        </ProtectedRoute>
      } />
      
      <Route path="/driver" element={
        <ProtectedRoute allowedRoles={['driver']}>
          <DriverDashboard />
        </ProtectedRoute>
      } />

      <Route path="/admin" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminDashboard />
        </ProtectedRoute>
      } />


      
      {/* Protected Routes with AppLayout (Shared) */}
      <Route element={<AppLayout />}>
        {/* Add shared protected routes here if any */}
      </Route>
    </Routes>
  );
};

export default AppRoutes;



