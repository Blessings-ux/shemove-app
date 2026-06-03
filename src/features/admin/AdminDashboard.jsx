import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Users, Car, TrendingUp, CreditCard, 
  Map as MapIcon, Settings, Bell, Search, LogOut,
  CheckCircle, XCircle, Clock, Menu, X, ChevronRight,
  Eye, UserCheck, UserX, RefreshCw
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../services/supabase';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { signOut } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeView, setActiveView] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Data States
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalTransferred: 0,
    activeDrivers: 0,
    offlineDrivers: 0,
    totalRides: 0,
    totalPassengers: 0,
    pendingDrivers: 0
  });
  const [recentRides, setRecentRides] = useState([]);
  const [allDrivers, setAllDrivers] = useState([]);
  const [allPassengers, setAllPassengers] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [allTransactions, setAllTransactions] = useState([]);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  // Fetch Dashboard Data
  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      // Fetch all stats in parallel
      const [
        { data: drivers, error: driversError },
        { data: passengers },
        { data: rides },
        { data: transactions, error: transactionsError },
      ] = await Promise.all([
        // Use explicit relationship: drivers.id -> profiles.id (not owner_id)
        supabase.from('drivers').select('*, profiles!drivers_id_fkey(full_name, phone)'),
        supabase.from('profiles').select('*').eq('role', 'passenger'),
        supabase.from('rides').select('*, passenger:profiles!rides_passenger_id_fkey(full_name), driver:profiles!rides_driver_id_fkey(full_name)').order('created_at', { ascending: false }).limit(50),
        supabase.from('mpesa_transactions').select('*, ride:rides(*, passenger:profiles!rides_passenger_id_fkey(full_name), driver:profiles!rides_driver_id_fkey(full_name))').order('created_at', { ascending: false }),
      ]);

      console.log('Fetched drivers:', drivers);
      console.log('Drivers error:', driversError);
      console.log('Fetched transactions:', transactions);
      if (transactionsError) console.error('Transactions error:', transactionsError);

      // Calculate stats
      const activeDrivers = drivers?.filter(d => d.is_online) || [];
      const offlineDrivers = drivers?.filter(d => !d.is_online) || [];
      const completedRides = rides?.filter(r => r.status === 'completed') || [];
      const totalRevenue = completedRides.reduce((sum, r) => sum + (r.fare || 0), 0);

      // Calculate transferred amount from completed mpesa transactions
      const completedTransactions = transactions?.filter(t => t.status === 'completed') || [];
      const totalTransferred = completedTransactions.reduce((sum, t) => sum + Number(t.amount || 0), 0);

      // Get pending drivers (profiles with role=driver but no matching drivers record)
      const { data: driverProfiles } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'driver');
      
      console.log('Driver profiles:', driverProfiles);
      
      const driverIds = new Set(drivers?.map(d => d.id) || []);
      const pending = driverProfiles?.filter(p => !driverIds.has(p.id)) || [];

      setStats({
        totalRevenue,
        totalTransferred,
        activeDrivers: activeDrivers.length,
        offlineDrivers: offlineDrivers.length,
        totalRides: rides?.length || 0,
        totalPassengers: passengers?.length || 0,
        pendingDrivers: pending.length
      });

      setAllDrivers(drivers || []);
      setAllPassengers(passengers || []);
      setRecentRides(rides || []);
      setAllTransactions(transactions || []);
      setPendingApprovals(pending);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      navigate('/login');
    }
  };

  const handleNavClick = (view) => {
    setActiveView(view);
    setMobileMenuOpen(false);
  };

  const approveDriver = async (profileId) => {
    try {
      // Find the profile being approved
      const approvedProfile = pendingApprovals.find(p => p.id === profileId);
      
      // Use upsert to handle case where driver record might already exist
      const { error } = await supabase.from('drivers').upsert({
        id: profileId,
        vehicle_type: 'boda', // Default vehicle type
        is_online: false
      }, { onConflict: 'id' });
      
      if (error) {
        console.error('Error approving driver:', error);
        alert(`Failed to approve driver: ${error.message}`);
        return;
      }
      
      // Success - immediately update local state
      const newDriver = {
        id: profileId,
        vehicle_type: 'boda',
        is_online: false,
        profiles: approvedProfile ? { full_name: approvedProfile.full_name, phone: approvedProfile.phone } : null
      };
      
      setAllDrivers(prev => [...prev, newDriver]);
      setPendingApprovals(prev => prev.filter(p => p.id !== profileId));
      setStats(prev => ({ 
        ...prev, 
        pendingDrivers: prev.pendingDrivers - 1,
        offlineDrivers: prev.offlineDrivers + 1 
      }));
      
      // Also refresh from server to sync
      fetchDashboardData();
      alert('Driver approved successfully!');
    } catch (error) {
      console.error('Error approving driver:', error);
      alert(`Failed to approve driver: ${error.message}`);
    }
  };

  const rejectDriver = async (profileId) => {
    try {
      // Change role back to passenger
      const { error } = await supabase.from('profiles').update({ role: 'passenger' }).eq('id', profileId);
      if (!error) {
        setPendingApprovals(prev => prev.filter(p => p.id !== profileId));
        setStats(prev => ({ ...prev, pendingDrivers: prev.pendingDrivers - 1 }));
      }
    } catch (error) {
      console.error('Error rejecting driver:', error);
    }
  };

  const deleteUser = async (userId, type, displayName) => {
    setIsDeletingUser(true);

    try {
      const { error: rpcError } = await supabase.rpc('admin_delete_user', {
        target_user_id: userId,
      });

      if (rpcError) {
        const { error: profileError } = await supabase
          .from('profiles')
          .delete()
          .eq('id', userId);

        if (profileError) {
          throw profileError;
        }
      }

      if (type === 'driver') {
        setAllDrivers((prev) => prev.filter((d) => d.id !== userId));
        setStats((prev) => ({
          ...prev,
          activeDrivers:
            prev.activeDrivers -
            (allDrivers.find((d) => d.id === userId)?.is_online ? 1 : 0),
          offlineDrivers:
            prev.offlineDrivers -
            (allDrivers.find((d) => d.id === userId)?.is_online ? 0 : 1),
        }));
      } else {
        setAllPassengers((prev) => prev.filter((p) => p.id !== userId));
        setStats((prev) => ({ ...prev, totalPassengers: prev.totalPassengers - 1 }));
      }

      setUserToDelete(null);
    } catch (error) {
      console.error('Error deleting user:', error);
      alert(
        `Failed to delete user: ${error.message}\n\nEnsure migration 017_pickup_coordination.sql has been applied.`,
      );
    } finally {
      setIsDeletingUser(false);
    }
  };

  // Generate chart data from rides
  const getRevenueChartData = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    const last7Days = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dayName = days[date.getDay()];
      const dayRides = recentRides.filter(r => {
        const rideDate = new Date(r.created_at);
        return rideDate.toDateString() === date.toDateString() && r.status === 'completed';
      });
      const dayRevenue = dayRides.reduce((sum, r) => sum + (r.fare || 0), 0);
      last7Days.push({ name: dayName, ksh: dayRevenue });
    }
    return last7Days;
  };

  // Filter data based on search
  const filteredRides = recentRides.filter(r => 
    r.passenger?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.driver?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.id?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredDrivers = allDrivers.filter(d =>
    d.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.plate_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPassengers = allPassengers.filter(p =>
    p.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.phone?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTransactions = allTransactions.filter(t =>
    t.phone_number?.includes(searchQuery) ||
    t.mpesa_receipt?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.checkout_request_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.ride?.passenger?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.ride?.driver?.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-white font-sans text-slate-900">
      
      {/* --- MOBILE HEADER --- */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 h-16 bg-white border-b border-slate-200 px-4 flex items-center justify-between">
        <button onClick={() => setMobileMenuOpen(true)} className="p-2 hover:bg-slate-100 rounded-xl">
          <Menu className="w-6 h-6 text-slate-700" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center font-bold text-white text-sm">SM</div>
          <span className="font-bold text-lg text-slate-800">Admin</span>
        </div>
        <button onClick={fetchDashboardData} className="p-2 hover:bg-slate-100 rounded-xl">
          <RefreshCw className={`w-6 h-6 text-slate-600 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* --- MOBILE SIDEBAR OVERLAY --- */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 bg-white shadow-2xl flex flex-col animate-in slide-in-from-left">
            <div className="h-16 flex items-center justify-between px-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center font-bold text-white">SM</div>
                <span className="font-bold text-lg text-slate-800">SheMove</span>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl">
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>
            <nav className="flex-1 py-4 px-3 space-y-1">
              <NavItem icon={LayoutDashboard} label="Dashboard" active={activeView === 'dashboard'} onClick={() => handleNavClick('dashboard')} isOpen={true} />
              <NavItem icon={Car} label="Drivers" badge={stats.activeDrivers} active={activeView === 'drivers'} onClick={() => handleNavClick('drivers')} isOpen={true} />
              <NavItem icon={Users} label="Passengers" badge={stats.totalPassengers} active={activeView === 'passengers'} onClick={() => handleNavClick('passengers')} isOpen={true} />
              <NavItem icon={MapIcon} label="All Rides" badge={stats.totalRides} active={activeView === 'rides'} onClick={() => handleNavClick('rides')} isOpen={true} />
              <NavItem icon={CreditCard} label="Payments" badge={allTransactions.length} active={activeView === 'payments'} onClick={() => handleNavClick('payments')} isOpen={true} />
            </nav>
            <div className="p-4 border-t border-slate-100">
              <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 p-3 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition">
                <LogOut className="w-5 h-5" /> Log Out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* --- DESKTOP SIDEBAR --- */}
      <aside className={`hidden lg:flex ${sidebarOpen ? 'w-64' : 'w-20'} bg-slate-50 border-r border-slate-200 transition-all duration-300 flex-col`}>
        <div className="h-16 flex items-center px-4 border-b border-slate-100">
          <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center font-bold text-white mr-3">SM</div>
          {sidebarOpen && <span className="font-bold text-lg text-slate-800">SheMove</span>}
        </div>

        <nav className="flex-1 py-6 space-y-1 px-3">
          <NavItem icon={LayoutDashboard} label="Dashboard" active={activeView === 'dashboard'} onClick={() => handleNavClick('dashboard')} isOpen={sidebarOpen} />
          <NavItem icon={Car} label="Drivers" badge={stats.activeDrivers} active={activeView === 'drivers'} onClick={() => handleNavClick('drivers')} isOpen={sidebarOpen} />
          <NavItem icon={Users} label="Passengers" badge={stats.totalPassengers} active={activeView === 'passengers'} onClick={() => handleNavClick('passengers')} isOpen={sidebarOpen} />
          <NavItem icon={MapIcon} label="All Rides" badge={stats.totalRides} active={activeView === 'rides'} onClick={() => handleNavClick('rides')} isOpen={sidebarOpen} />
          <NavItem icon={CreditCard} label="Payments" badge={allTransactions.length} active={activeView === 'payments'} onClick={() => handleNavClick('payments')} isOpen={sidebarOpen} />
        </nav>

        <div className="p-4 border-t border-slate-100">
           <div className="flex items-center gap-3 mb-4">
             <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold">A</div>
             {sidebarOpen && (
               <div className="overflow-hidden">
                 <div className="text-sm font-bold text-slate-900 truncate">Admin User</div>
                 <div className="text-xs text-slate-500">Super Admin</div>
               </div>
             )}
           </div>
           {sidebarOpen && (
             <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 p-3 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition">
               <LogOut className="w-5 h-5" /> Log Out
             </button>
           )}
        </div>
      </aside>

      {/* --- MAIN CONTENT AREA --- */}
      <main className="flex-1 overflow-y-auto pt-16 lg:pt-0">
        
        {/* Desktop Header */}
        <header className="hidden lg:flex h-16 bg-white border-b border-slate-200 px-8 justify-between items-center sticky top-0 z-10">
          <h1 className="text-xl font-bold text-slate-800 capitalize">{activeView === 'dashboard' ? 'System Overview' : activeView}</h1>
          
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Search..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 rounded-full bg-slate-100 border-none focus:ring-2 focus:ring-purple-500 text-sm w-64"
              />
            </div>
            <button onClick={fetchDashboardData} className="p-2 rounded-full hover:bg-slate-100" title="Refresh Data">
              <RefreshCw className={`w-5 h-5 text-slate-600 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            {stats.pendingDrivers > 0 && (
              <button onClick={() => setShowApprovalModal(true)} className="relative p-2 rounded-full hover:bg-slate-100">
                <Bell className="w-6 h-6 text-slate-600" />
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full border-2 border-white text-[10px] text-white font-bold flex items-center justify-center">
                  {stats.pendingDrivers}
                </span>
              </button>
            )}
          </div>
        </header>

        <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6 lg:space-y-8">
          
          {/* === DASHBOARD VIEW === */}
          {activeView === 'dashboard' && (
            <>
              {/* KEY METRICS */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 lg:gap-6">
                <StatCard 
                  title="Total Revenue" 
                  value={`KES ${stats.totalRevenue.toLocaleString()}`} 
                  subtitle="All completed rides"
                  icon={TrendingUp} 
                  color="bg-purple-500"
                  isLoading={isLoading}
                />
                <StatCard 
                  title="Amount Transferred" 
                  value={`KES ${stats.totalTransferred.toLocaleString()}`} 
                  subtitle="Successful payments"
                  icon={CreditCard} 
                  color="bg-emerald-500"
                  isLoading={isLoading}
                />
                <StatCard 
                  title="Passengers" 
                  value={stats.totalPassengers} 
                  subtitle="Registered users"
                  icon={Users} 
                  color="bg-blue-500"
                  isLoading={isLoading}
                />
                <StatCard 
                  title="Total Rides" 
                  value={stats.totalRides} 
                  subtitle="Total requests"
                  icon={MapIcon} 
                  color="bg-purple-500"
                  isLoading={isLoading}
                />
                <StatCard 
                  title="Drivers" 
                  value={stats.activeDrivers + stats.offlineDrivers} 
                  subtitle={stats.activeDrivers > 0 ? `${stats.activeDrivers} Online` : `${stats.offlineDrivers} Offline`}
                  icon={Car} 
                  color={stats.activeDrivers > 0 ? "bg-purple-500" : "bg-slate-400"}
                  isLoading={isLoading}
                />
              </div>

              {/* CHARTS & HEALTH */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
                {/* Revenue Chart */}
                <div className="lg:col-span-2 bg-white p-4 lg:p-6 rounded-2xl shadow-sm border border-slate-200">
                  <div className="flex justify-between items-center mb-4 lg:mb-6">
                    <h3 className="font-bold text-lg text-slate-800">Revenue (Last 7 Days)</h3>
                  </div>
                  <div className="h-64 lg:h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={getRevenueChartData()}>
                        <defs>
                          <linearGradient id="colorKsh" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12}} />
                        <Tooltip contentStyle={{backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0'}} />
                        <Area type="monotone" dataKey="ksh" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorKsh)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* System Health & Pending */}
                <div className="bg-white p-4 lg:p-6 rounded-2xl shadow-sm border border-slate-200">
                  <h3 className="font-bold text-lg text-slate-800 mb-4 lg:mb-6">Quick Actions</h3>
                  
                  <div className="space-y-4">
                    {stats.pendingDrivers > 0 && (
                      <div className="p-4 bg-orange-50 rounded-xl border border-orange-100">
                        <div className="text-orange-800 font-bold text-sm mb-1">Pending Approvals</div>
                        <div className="text-orange-600 text-xs mb-3">{stats.pendingDrivers} drivers waiting for verification.</div>
                        <button 
                          onClick={() => setShowApprovalModal(true)}
                          className="w-full bg-orange-500 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-orange-600 transition"
                        >
                          Review Applications
                        </button>
                      </div>
                    )}

                    <button onClick={() => handleNavClick('drivers')} className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition">
                      <span className="font-medium text-slate-700">Manage Drivers</span>
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    </button>
                    <button onClick={() => handleNavClick('passengers')} className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition">
                      <span className="font-medium text-slate-700">View Passengers</span>
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    </button>
                    <button onClick={() => handleNavClick('rides')} className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition">
                      <span className="font-medium text-slate-700">All Rides</span>
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    </button>
                  </div>
                </div>
              </div>

              {/* RECENT RIDES */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 lg:p-6 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="font-bold text-lg text-slate-800">Recent Rides</h3>
                  <button onClick={() => handleNavClick('rides')} className="text-purple-600 font-bold text-sm hover:underline">View All</button>
                </div>
                <RidesTable rides={filteredRides.slice(0, 5)} />
              </div>
            </>
          )}

          {/* === DRIVERS VIEW === */}
          {activeView === 'drivers' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 lg:p-6 border-b border-slate-100">
                <h3 className="font-bold text-lg text-slate-800">All Drivers ({filteredDrivers.length})</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-500 text-xs lg:text-sm uppercase">
                    <tr>
                      <th className="px-4 lg:px-6 py-3 font-semibold">Driver</th>
                      <th className="px-4 lg:px-6 py-3 font-semibold">Phone</th>
                      <th className="px-4 lg:px-6 py-3 font-semibold">Vehicle</th>
                      <th className="px-4 lg:px-6 py-3 font-semibold">Plate</th>
                      <th className="px-4 lg:px-6 py-3 font-semibold">Status</th>
                      <th className="px-4 lg:px-6 py-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredDrivers.map(driver => (
                      <tr key={driver.id} className="hover:bg-slate-50">
                        <td className="px-4 lg:px-6 py-4 font-medium text-slate-900">{driver.profiles?.full_name || 'Unknown'}</td>
                        <td className="px-4 lg:px-6 py-4 text-slate-600">{driver.profiles?.phone || '-'}</td>
                        <td className="px-4 lg:px-6 py-4 text-slate-600 capitalize">{driver.vehicle_type || '-'}</td>
                        <td className="px-4 lg:px-6 py-4 text-slate-600">{driver.plate_number || '-'}</td>
                        <td className="px-4 lg:px-6 py-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${driver.is_online ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>
                            {driver.is_online ? 'Online' : 'Offline'}
                          </span>
                        </td>
                        <td className="px-4 lg:px-6 py-4 text-right">
                          <button 
                            onClick={() => setUserToDelete({
                              id: driver.id,
                              type: 'driver',
                              name: driver.profiles?.full_name || 'Unknown driver',
                            })}
                            className="inline-flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-600 transition hover:bg-red-100"
                          >
                            <UserX className="w-4 h-4" />
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredDrivers.length === 0 && (
                      <tr><td colSpan="6" className="px-6 py-8 text-center text-slate-400">No drivers found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* === PASSENGERS VIEW === */}
          {activeView === 'passengers' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 lg:p-6 border-b border-slate-100">
                <h3 className="font-bold text-lg text-slate-800">All Passengers ({filteredPassengers.length})</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-500 text-xs lg:text-sm uppercase">
                    <tr>
                      <th className="px-4 lg:px-6 py-3 font-semibold">Name</th>
                      <th className="px-4 lg:px-6 py-3 font-semibold">Phone</th>
                      <th className="px-4 lg:px-6 py-3 font-semibold">Points</th>
                      <th className="px-4 lg:px-6 py-3 font-semibold">Joined</th>
                      <th className="px-4 lg:px-6 py-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredPassengers.map(passenger => (
                      <tr key={passenger.id} className="hover:bg-slate-50">
                        <td className="px-4 lg:px-6 py-4 font-medium text-slate-900">{passenger.full_name || 'Unknown'}</td>
                        <td className="px-4 lg:px-6 py-4 text-slate-600">{passenger.phone || '-'}</td>
                        <td className="px-4 lg:px-6 py-4 text-purple-600 font-bold">{passenger.loyalty_points || 0}</td>
                        <td className="px-4 lg:px-6 py-4 text-slate-600">{new Date(passenger.created_at).toLocaleDateString()}</td>
                        <td className="px-4 lg:px-6 py-4 text-right">
                          <button 
                            onClick={() => setUserToDelete({
                              id: passenger.id,
                              type: 'passenger',
                              name: passenger.full_name || 'Unknown passenger',
                            })}
                            className="inline-flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-600 transition hover:bg-red-100"
                          >
                            <UserX className="w-4 h-4" />
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredPassengers.length === 0 && (
                      <tr><td colSpan="5" className="px-6 py-8 text-center text-slate-400">No passengers found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* === ALL RIDES VIEW === */}
          {activeView === 'rides' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 lg:p-6 border-b border-slate-100">
                <h3 className="font-bold text-lg text-slate-800">All Rides ({filteredRides.length})</h3>
              </div>
              <RidesTable rides={filteredRides} />
            </div>
          )}

          {/* === PAYMENTS VIEW === */}
          {activeView === 'payments' && (
            <div className="space-y-6">
              {/* Payment specific stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
                <StatCard 
                  title="Completed Transfers" 
                  value={`KES ${stats.totalTransferred.toLocaleString()}`} 
                  subtitle={`${allTransactions.filter(t => t.status === 'completed').length} successful payments`}
                  icon={CheckCircle} 
                  color="bg-emerald-500"
                  isLoading={isLoading}
                />
                <StatCard 
                  title="Pending Requests" 
                  value={`KES ${allTransactions.filter(t => t.status === 'pending').reduce((sum, t) => sum + Number(t.amount || 0), 0).toLocaleString()}`} 
                  subtitle={`${allTransactions.filter(t => t.status === 'pending').length} pending requests`}
                  icon={Clock} 
                  color="bg-yellow-500"
                  isLoading={isLoading}
                />
                <StatCard 
                  title="Failed / Cancelled" 
                  value={`KES ${allTransactions.filter(t => ['failed', 'cancelled'].includes(t.status)).reduce((sum, t) => sum + Number(t.amount || 0), 0).toLocaleString()}`} 
                  subtitle={`${allTransactions.filter(t => ['failed', 'cancelled'].includes(t.status)).length} failed attempts`}
                  icon={XCircle} 
                  color="bg-red-500"
                  isLoading={isLoading}
                />
              </div>

              {/* Transactions table */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 lg:p-6 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="font-bold text-lg text-slate-800">M-Pesa Transaction Logs ({filteredTransactions.length})</h3>
                </div>
                <TransactionsTable transactions={filteredTransactions} />
              </div>
            </div>
          )}

        </div>
      </main>

      {/* === APPROVAL MODAL === */}
      {showApprovalModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowApprovalModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-800">Pending Driver Approvals</h3>
              <button onClick={() => setShowApprovalModal(false)} className="p-2 hover:bg-slate-100 rounded-xl">
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh] space-y-3">
              {pendingApprovals.length === 0 ? (
                <p className="text-center text-slate-400 py-8">No pending approvals</p>
              ) : (
                pendingApprovals.map(applicant => (
                  <div key={applicant.id} className="p-4 bg-slate-50 rounded-xl flex items-center justify-between gap-4">
                    <div>
                      <div className="font-bold text-slate-900">{applicant.full_name || 'Unknown'}</div>
                      <div className="text-sm text-slate-500">{applicant.phone || 'No phone'}</div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => approveDriver(applicant.id)}
                        className="p-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition"
                        title="Approve"
                      >
                        <UserCheck className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => rejectDriver(applicant.id)}
                        className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition"
                        title="Reject"
                      >
                        <UserX className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {userToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => !isDeletingUser && setUserToDelete(null)} />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <UserX className="h-6 w-6 text-red-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Delete user?</h3>
            <p className="mt-2 text-sm text-slate-600">
              This will permanently remove <span className="font-bold">{userToDelete.name}</span> ({userToDelete.type}) and their account data. This action cannot be undone.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setUserToDelete(null)}
                disabled={isDeletingUser}
                className="flex-1 rounded-xl border border-slate-200 py-3 font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteUser(userToDelete.id, userToDelete.type, userToDelete.name)}
                disabled={isDeletingUser}
                className="flex-1 rounded-xl bg-red-600 py-3 font-bold text-white transition hover:bg-red-700 disabled:opacity-60"
              >
                {isDeletingUser ? 'Deleting...' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- SUB-COMPONENTS ---

function NavItem({ icon: Icon, label, active, badge, isOpen, onClick }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${active ? 'bg-purple-100 text-purple-700 font-bold' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      {isOpen && <span className="flex-1 text-left whitespace-nowrap">{label}</span>}
      {isOpen && badge !== undefined && (
        <span className="bg-purple-600 text-white text-xs px-2 py-0.5 rounded-full">{badge}</span>
      )}
    </button>
  );
}

function StatCard({ title, value, subtitle, icon: Icon, color, isLoading }) {
  return (
    <div className="bg-white p-4 lg:p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition">
      <div className="flex justify-between items-start mb-3 lg:mb-4">
        <div className={`p-2 lg:p-3 rounded-xl ${color} bg-opacity-10`}>
          <Icon className={`w-5 h-5 lg:w-6 lg:h-6 ${color.replace('bg-', 'text-')}`} />
        </div>
      </div>
      <div className="text-slate-500 text-xs lg:text-sm font-medium mb-1">{title}</div>
      <div className="text-xl lg:text-2xl font-bold text-slate-800">
        {isLoading ? <span className="animate-pulse">...</span> : value}
      </div>
      {subtitle && <div className="text-xs text-slate-400 mt-1">{subtitle}</div>}
    </div>
  );
}

function RidesTable({ rides }) {
  const statusColors = {
    completed: 'bg-purple-100 text-purple-700',
    ongoing: 'bg-blue-100 text-blue-700',
    accepted: 'bg-blue-100 text-blue-700',
    pending: 'bg-yellow-100 text-yellow-700',
    cancelled: 'bg-red-100 text-red-700',
  };

  const statusIcons = {
    completed: CheckCircle,
    ongoing: Clock,
    accepted: Clock,
    pending: Clock,
    cancelled: XCircle,
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead className="bg-slate-50 text-slate-500 text-xs lg:text-sm uppercase">
          <tr>
            <th className="px-4 lg:px-6 py-3 font-semibold">Ride ID</th>
            <th className="px-4 lg:px-6 py-3 font-semibold">Passenger</th>
            <th className="px-4 lg:px-6 py-3 font-semibold hidden md:table-cell">Driver</th>
            <th className="px-4 lg:px-6 py-3 font-semibold">Fare</th>
            <th className="px-4 lg:px-6 py-3 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-sm">
          {rides.map(ride => {
            const StatusIcon = statusIcons[ride.status] || Clock;
            return (
              <tr key={ride.id} className="hover:bg-slate-50">
                <td className="px-4 lg:px-6 py-4 font-medium text-slate-900">#{ride.id.slice(0, 8)}</td>
                <td className="px-4 lg:px-6 py-4 text-slate-600">{ride.passenger?.full_name || 'Unknown'}</td>
                <td className="px-4 lg:px-6 py-4 text-slate-600 hidden md:table-cell">{ride.driver?.full_name || '-'}</td>
                <td className="px-4 lg:px-6 py-4 font-bold text-slate-900">KES {ride.fare || 0}</td>
                <td className="px-4 lg:px-6 py-4">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold capitalize ${statusColors[ride.status] || 'bg-slate-100 text-slate-600'}`}>
                    <StatusIcon className="w-3 h-3" />
                    {ride.status}
                  </span>
                </td>
              </tr>
            );
          })}
          {rides.length === 0 && (
            <tr><td colSpan="5" className="px-6 py-8 text-center text-slate-400">No rides found</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function TransactionsTable({ transactions }) {
  const statusColors = {
    completed: 'bg-emerald-100 text-emerald-700',
    pending: 'bg-yellow-100 text-yellow-700',
    failed: 'bg-red-100 text-red-700',
    cancelled: 'bg-slate-100 text-slate-700',
  };

  const statusIcons = {
    completed: CheckCircle,
    pending: Clock,
    failed: XCircle,
    cancelled: XCircle,
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead className="bg-slate-50 text-slate-500 text-xs lg:text-sm uppercase">
          <tr>
            <th className="px-4 lg:px-6 py-3 font-semibold">Receipt / Request ID</th>
            <th className="px-4 lg:px-6 py-3 font-semibold">Passenger / Phone</th>
            <th className="px-4 lg:px-6 py-3 font-semibold hidden md:table-cell">Driver</th>
            <th className="px-4 lg:px-6 py-3 font-semibold">Amount</th>
            <th className="px-4 lg:px-6 py-3 font-semibold">Status</th>
            <th className="px-4 lg:px-6 py-3 font-semibold">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-sm">
          {transactions.map(t => {
            const StatusIcon = statusIcons[t.status] || Clock;
            return (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="px-4 lg:px-6 py-4 font-medium text-slate-900">
                  <div className="font-mono text-xs">{t.mpesa_receipt || 'No Receipt'}</div>
                  <div className="text-[10px] text-slate-400 font-mono truncate max-w-[150px]">{t.checkout_request_id}</div>
                </td>
                <td className="px-4 lg:px-6 py-4 text-slate-600">
                  <div className="font-medium">{t.ride?.passenger?.full_name || 'M-Pesa User'}</div>
                  <div className="text-xs text-slate-400">{t.phone_number}</div>
                </td>
                <td className="px-4 lg:px-6 py-4 text-slate-600 hidden md:table-cell">
                  {t.ride?.driver?.full_name || '-'}
                </td>
                <td className="px-4 lg:px-6 py-4 font-bold text-slate-900">KES {t.amount || 0}</td>
                <td className="px-4 lg:px-6 py-4">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold capitalize ${statusColors[t.status] || 'bg-slate-100 text-slate-600'}`}>
                    <StatusIcon className="w-3 h-3" />
                    {t.status}
                  </span>
                </td>
                <td className="px-4 lg:px-6 py-4 text-slate-500 text-xs">
                  {new Date(t.created_at).toLocaleString()}
                </td>
              </tr>
            );
          })}
          {transactions.length === 0 && (
            <tr><td colSpan="6" className="px-6 py-8 text-center text-slate-400">No transactions found</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
