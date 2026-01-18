# Authentication Documentation

## Overview
Authentication in JiraniRide is managed using **Supabase Auth**, providing secure and scalable identity management. The application supports functionality for user sign-up, login, and role-based access control (RBAC) to distinguish between Passengers, Drivers, and Administrators.

## Features

### 1. User Sign Up & Login
- **Email/Password**: Standard email and password authentication.
- **Session Management**: Persistent sessions using Supabase's local storage handling.

### 2. Role-Based Access Control (RBAC)
- **Roles**:
    - `passenger`: Can book rides, view history, and manage profile.
    - `driver`: Can manage availability, accept rides, and view earnings.
    - `admin`: Can oversee fleet, users, and system analytics.
    - `fleet_owner`: Can manage assigned vehicles and drivers.
- **Implementation**: User roles are likely stored in a `profiles` table linked to the `auth.users` table via `id`.

## Implementation Details

### Frontend
- **AuthProvider**: A React Context provider (`src/contexts/AuthContext.jsx` or similar) wraps the application to provide global access to the user session and profile.
- **Protected Routes**: A specialized component (e.g., `ProtectedRoute`) checks the user's authentication state and role before rendering restricted pages.

### Backend (Supabase)
- **RLS (Row Level Security)**: Database policies ensure users can only access data relevant to them (e.g., Drivers can only see their own trips, Passengers see available rides).
- **Triggers**: A generic trigger may exist to automatically create a user profile upon new user signup in `auth.users`.

## Security Considerations
- **Environment Variables**: API keys (Anon Key) are safe to expose on the client, but the Service Role Key must strictly remain on the server/Edge Functions.
- **Token Handling**: Supabase client automatically handles JWT refresh.
