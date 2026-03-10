import { Outlet } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Left Side - Image/Branding (Hidden on mobile) */}
      <div className="hidden lg:flex w-1/2 bg-gray-900 justify-center items-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-600/80 to-purple-900/80 z-10" />
        <img 
          src="https://images.unsplash.com/photo-1558981403-c5f9899a28bc?q=80&w=2070&auto=format&fit=crop" 
          alt="Motorcycle transport" 
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="z-20 text-white p-12 max-w-lg">
          <h1 className="text-4xl font-bold mb-6">SheMove</h1>
          <p className="text-xl text-gray-200">
            Safe, reliable rides by women, for women. Join the movement today.
          </p>
        </div>
      </div>

      {/* Right Side - Forms */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12 lg:w-1/2">
        <div className="w-full max-w-md space-y-8">
            <Outlet />
        </div>
      </div>
    </div>
  );
}
