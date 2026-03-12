import { Outlet } from 'react-router-dom';

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="bg-white shadow p-4 sticky top-0 z-50">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold text-purple-600">SheMove</h1>
        </div>
      </header>
      <main className="flex-1 flex flex-col relative h-full">
        <Outlet />
      </main>
    </div>
  );
}
