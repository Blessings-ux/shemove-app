import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Car, Users, TrendingUp, Plus, Settings, 
  Bell, Search, LogOut, Menu, X, ChevronRight, RefreshCw, 
  Phone, UserPlus, UserX, CheckCircle, XCircle, Clock,
  DollarSign, AlertTriangle
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../services/supabase';

export default function FleetDashboard() {
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeView, setActiveView] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  // Modal states
  const [showAddDriver, setShowAddDriver] = useState(false);
  const [showPendingInvites, setShowPendingInvites] = useState(false);
  const [newDriverPhone, setNewDriverPhone] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');

  // Data states
  const [myDrivers, setMyDrivers] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [stats, setStats] = useState({
    weeklyRevenue: 0,
    totalRides: 0,
    activeDrivers: 0,
    totalDrivers: 0
  });
  const [recentRides, setRecentRides] = useState([]);

  useEffect(() => {
    if (user) {
      fetchFleetData();
    }
  }, [user]);

  const fetchFleetData = async () => {
    setIsLoading(true);
    try {
      // Try to fetch drivers belonging to this fleet owner
      // This may fail if owner_id column doesn't exist yet (migration not run)
      let myDriversList = [];
      try {
        const { data: drivers, error: driversError } = await supabase
          .from('drivers')
          .select('*, profiles(full_name, phone)')
          .eq('owner_id', user.id);

        if (driversError) {
          // owner_id column might not exist - that's okay
          console.log('Drivers query info:', driversError.message);
        } else {
          myDriversList = drivers || [];
        }
      } catch (e) {
        console.log('Drivers fetch skipped - run migration first');
      }
      
      setMyDrivers(myDriversList);

      // Calculate stats from drivers' rides
      const driverIds = myDriversList.map(d => d.id);
      let weeklyRev = 0;
      let totalRidesCount = 0;
      let ridesList = [];

      if (driverIds.length > 0) {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);

        const { data: rides } = await supabase
          .from('rides')
          .select('*, passenger:profiles!rides_passenger_id_fkey(full_name)')
          .in('driver_id', driverIds)
          .eq('status', 'completed')
          .gte('created_at', weekAgo.toISOString())
          .order('created_at', { ascending: false })
          .limit(50);

        if (rides) {
          weeklyRev = rides.reduce((sum, r) => sum + (r.fare || 0), 0);
          totalRidesCount = rides.length;
          ridesList = rides;
        }
      }

      // Try to fetch pending invites - may fail if table doesn't exist
      let invitesList = [];
      try {
        const { data: invites, error: invitesError } = await supabase
          .from('fleet_invites')
          .select('*, driver:profiles!fleet_invites_driver_id_fkey(full_name, phone)')
          .eq('fleet_owner_id', user.id)
          .eq('status', 'pending');

        if (!invitesError && invites) {
          invitesList = invites;
        }
      } catch (e) {
        console.log('Fleet invites table not set up yet - run migration');
      }

      setPendingInvites(invitesList);

      setStats({
        weeklyRevenue: weeklyRev,
        totalRides: totalRidesCount,
        activeDrivers: myDriversList.filter(d => d.is_online).length,
        totalDrivers: myDriversList.length
      });

      setRecentRides(ridesList);
    } catch (err) {
      console.error('Error fetching fleet data:', err);
    }
    setIsLoading(false);
  };

  const handleAddDriver = async () => {
    if (!newDriverPhone.trim()) {
      setInviteError('Please enter a phone number');
      return;
    }

    setInviteLoading(true);
    setInviteError('');

    try {
      // Find driver by phone number
      const { data: driverProfile, error: findError } = await supabase
        .from('profiles')
        .select('id, full_name, phone, role')
        .eq('phone', newDriverPhone.trim())
        .single();

      if (findError || !driverProfile) {
        setInviteError('No driver found with this phone number. They must register as a driver first.');
        setInviteLoading(false);
        return;
      }

      if (driverProfile.role !== 'driver') {
        setInviteError('This user is not registered as a driver.');
        setInviteLoading(false);
        return;
      }

      // Check if driver is already in a fleet
      const { data: existingDriver } = await supabase
        .from('drivers')
        .select('owner_id')
        .eq('id', driverProfile.id)
        .single();

      if (existingDriver?.owner_id) {
        setInviteError('This driver is already part of another fleet.');
        setInviteLoading(false);
        return;
      }

      // Check for existing pending invite
      const { data: existingInvite } = await supabase
        .from('fleet_invites')
        .select('id')
        .eq('fleet_owner_id', user.id)
        .eq('driver_id', driverProfile.id)
        .eq('status', 'pending')
        .single();

      if (existingInvite) {
        setInviteError('You already have a pending invite for this driver.');
        setInviteLoading(false);
        return;
      }

      // Create invitation
      const { error: inviteError } = await supabase
        .from('fleet_invites')
        .insert({
          fleet_owner_id: user.id,
          driver_id: driverProfile.id,
          status: 'pending'
        });

      if (inviteError) throw inviteError;

      // Send notification to driver
      await supabase.from('notifications').insert({
        user_id: driverProfile.id,
        type: 'fleet_invite',
        title: 'Fleet Invitation! 🚗',
        message: `${profile?.full_name || 'A fleet owner'} invites you to join their fleet. You'll earn consistent rides!`,
        data: { fleet_owner_id: user.id }
      });

      setNewDriverPhone('');
      setShowAddDriver(false);
      fetchFleetData();
      alert(`Invitation sent to ${driverProfile.full_name || newDriverPhone}!`);
    } catch (err) {
      console.error('Error inviting driver:', err);
      setInviteError('Failed to send invitation. Please try again.');
    }
    setInviteLoading(false);
  };

  const cancelInvite = async (inviteId) => {
    try {
      await supabase.from('fleet_invites').delete().eq('id', inviteId);
      fetchFleetData();
    } catch (err) {
      console.error('Error canceling invite:', err);
    }
  };

  const suspendDriver = async (driverId) => {
    if (!confirm('Are you sure you want to remove this driver from your fleet?')) return;
    
    try {
      await supabase
        .from('drivers')
        .update({ owner_id: null })
        .eq('id', driverId);
      
      fetchFleetData();
    } catch (err) {
      console.error('Error removing driver:', err);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const handleNavClick = (view) => {
    setActiveView(view);
    setMobileMenuOpen(false);
  };

  // Generate chart data
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
        return rideDate.toDateString() === date.toDateString();
      });
      const dayRevenue = dayRides.reduce((sum, r) => sum + (r.fare || 0), 0);
      last7Days.push({ name: dayName, ksh: dayRevenue });
    }
    return last7Days;
  };

  // Filter drivers based on search
  const filteredDrivers = myDrivers.filter(d =>
    d.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.plate_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-white font-sans text-slate-900">
      
      {/* --- MOBILE HEADER --- */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 h-16 bg-white border-b border-slate-200 px-4 flex items-center justify-between">
        <button onClick={() => setMobileMenuOpen(true)} className="p-2 hover:bg-slate-100 rounded-xl">
          <Menu className="w-6 h-6 text-slate-700" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center font-bold text-white text-sm">F</div>
          <span className="font-bold text-lg text-slate-800">Fleet Portal</span>
        </div>
        <button onClick={fetchFleetData} className="p-2 hover:bg-slate-100 rounded-xl">
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
                <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center font-bold text-white">F</div>
                <span className="font-bold text-lg text-slate-800">Fleet Portal</span>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl">
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>
            <nav className="flex-1 py-4 px-3 space-y-1">
              <NavItem icon={LayoutDashboard} label="Dashboard" active={activeView === 'dashboard'} onClick={() => handleNavClick('dashboard')} isOpen={true} />
              <NavItem icon={Car} label="My Drivers" badge={stats.totalDrivers} active={activeView === 'drivers'} onClick={() => handleNavClick('drivers')} isOpen={true} />
              <NavItem icon={TrendingUp} label="Revenue" active={activeView === 'revenue'} onClick={() => handleNavClick('revenue')} isOpen={true} />
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
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center font-bold text-white mr-3">F</div>
          {sidebarOpen && <span className="font-bold text-lg text-slate-800">Fleet Portal</span>}
        </div>

        <nav className="flex-1 py-6 space-y-1 px-3">
          <NavItem icon={LayoutDashboard} label="Dashboard" active={activeView === 'dashboard'} onClick={() => handleNavClick('dashboard')} isOpen={sidebarOpen} />
          <NavItem icon={Car} label="My Drivers" badge={stats.totalDrivers} active={activeView === 'drivers'} onClick={() => handleNavClick('drivers')} isOpen={sidebarOpen} />
          <NavItem icon={TrendingUp} label="Revenue" active={activeView === 'revenue'} onClick={() => handleNavClick('revenue')} isOpen={sidebarOpen} />
        </nav>

        <div className="p-4 border-t border-slate-100">
           <div className="flex items-center gap-3 mb-4">
             <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
               {profile?.full_name?.charAt(0) || 'F'}
             </div>
             {sidebarOpen && (
               <div className="overflow-hidden">
                 <div className="text-sm font-bold text-slate-900 truncate">{profile?.full_name || 'Fleet Owner'}</div>
                 <div className="text-xs text-slate-500">Fleet Manager</div>
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
          <h1 className="text-xl font-bold text-slate-800 capitalize">{activeView === 'dashboard' ? 'Fleet Overview' : activeView}</h1>
          
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Search drivers..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 rounded-full bg-slate-100 border-none focus:ring-2 focus:ring-emerald-500 text-sm w-64"
              />
            </div>
            <button onClick={fetchFleetData} className="p-2 rounded-full hover:bg-slate-100" title="Refresh Data">
              <RefreshCw className={`w-5 h-5 text-slate-600 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            {pendingInvites.length > 0 && (
              <button onClick={() => setShowPendingInvites(true)} className="relative p-2 rounded-full hover:bg-slate-100">
                <Bell className="w-6 h-6 text-slate-600" />
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 rounded-full border-2 border-white text-[10px] text-white font-bold flex items-center justify-center">
                  {pendingInvites.length}
                </span>
              </button>
            )}
            <button 
              onClick={() => setShowAddDriver(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition"
            >
              <UserPlus className="w-4 h-4" /> Add Driver
            </button>
          </div>
        </header>

        <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6 lg:space-y-8">
          
          {/* === DASHBOARD VIEW === */}
          {activeView === 'dashboard' && (
            <>
              {/* KEY METRICS */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                <StatCard 
                  title="Weekly Revenue" 
                  value={`KES ${stats.weeklyRevenue.toLocaleString()}`} 
                  icon={DollarSign} 
                  color="bg-emerald-500"
                  isLoading={isLoading}
                />
                <StatCard 
                  title="Total Drivers" 
                  value={stats.totalDrivers} 
                  subtitle={`${stats.activeDrivers} Online`}
                  icon={Car} 
                  color="bg-emerald-500"
                  isLoading={isLoading}
                />
                <StatCard 
                  title="Weekly Rides" 
                  value={stats.totalRides} 
                  icon={TrendingUp} 
                  color="bg-blue-500"
                  isLoading={isLoading}
                />
                <div 
                  onClick={() => setShowAddDriver(true)}
                  className="bg-emerald-600 p-4 lg:p-6 rounded-2xl shadow-lg text-white cursor-pointer hover:bg-emerald-700 transition flex flex-col justify-center"
                >
                  <div className="flex items-center gap-2 font-bold text-lg mb-1">
                    <Plus className="w-5 h-5" /> Add Driver
                  </div>
                  <div className="text-sm text-emerald-200">Expand your fleet</div>
                </div>
              </div>

              {/* CHARTS & QUICK ACTIONS */}
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

                {/* Quick Actions */}
                <div className="bg-white p-4 lg:p-6 rounded-2xl shadow-sm border border-slate-200">
                  <h3 className="font-bold text-lg text-slate-800 mb-4 lg:mb-6">Quick Actions</h3>
                  
                  <div className="space-y-4">
                    <button 
                      onClick={() => setShowAddDriver(true)}
                      className="w-full flex items-center justify-between p-4 bg-emerald-50 rounded-xl hover:bg-emerald-100 transition text-emerald-700"
                    >
                      <div className="flex items-center gap-3">
                        <UserPlus className="w-5 h-5" />
                        <span className="font-medium">Invite New Driver</span>
                      </div>
                      <ChevronRight className="w-5 h-5" />
                    </button>
                    
                    <button onClick={() => handleNavClick('drivers')} className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition">
                      <span className="font-medium text-slate-700">Manage Drivers</span>
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    </button>
                    
                    <button onClick={() => handleNavClick('revenue')} className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition">
                      <span className="font-medium text-slate-700">View All Revenue</span>
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    </button>
                  </div>
                </div>
              </div>

              {/* DRIVERS QUICK VIEW */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 lg:p-6 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="font-bold text-lg text-slate-800">My Drivers</h3>
                  <button onClick={() => handleNavClick('drivers')} className="text-emerald-600 font-bold text-sm hover:underline">View All</button>
                </div>
                <DriversTable drivers={filteredDrivers.slice(0, 5)} onRemove={suspendDriver} />
              </div>
            </>
          )}

          {/* === DRIVERS VIEW === */}
          {activeView === 'drivers' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 lg:p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-bold text-lg text-slate-800">All Drivers ({filteredDrivers.length})</h3>
                <button 
                  onClick={() => setShowAddDriver(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition"
                >
                  <UserPlus className="w-4 h-4" /> Add Driver
                </button>
              </div>
              <DriversTable drivers={filteredDrivers} onRemove={suspendDriver} />
            </div>
          )}

          {/* === REVENUE VIEW === */}
          {activeView === 'revenue' && (
            <>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h3 className="font-bold text-lg text-slate-800 mb-6">Weekly Revenue Breakdown</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={getRevenueChartData()}>
                      <defs>
                        <linearGradient id="colorKsh2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12}} />
                      <Tooltip contentStyle={{backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0'}} />
                      <Area type="monotone" dataKey="ksh" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorKsh2)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 lg:p-6 border-b border-slate-100">
                  <h3 className="font-bold text-lg text-slate-800">Recent Rides ({recentRides.length})</h3>
                </div>
                <RidesTable rides={recentRides} />
              </div>
            </>
          )}
        </div>
      </main>

      {/* === ADD DRIVER MODAL === */}
      {showAddDriver && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => { setShowAddDriver(false); setInviteError(''); }} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h3 className="font-bold text-xl text-slate-800">Invite Driver to Your Fleet</h3>
              <p className="text-slate-500 text-sm mt-1">
                Enter the phone number of a registered JiraniRide driver.
              </p>
            </div>
            <div className="p-6 space-y-4">
              {inviteError && (
                <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  {inviteError}
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Driver's Phone Number</label>
                <input
                  type="tel"
                  value={newDriverPhone}
                  onChange={(e) => setNewDriverPhone(e.target.value)}
                  placeholder="e.g. +254712345678"
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="p-6 bg-slate-50 flex gap-3">
              <button
                onClick={() => { setShowAddDriver(false); setInviteError(''); setNewDriverPhone(''); }}
                className="flex-1 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleAddDriver}
                disabled={inviteLoading}
                className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition disabled:opacity-50"
              >
                {inviteLoading ? 'Sending...' : 'Send Invitation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === PENDING INVITES MODAL === */}
      {showPendingInvites && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowPendingInvites(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-800">Pending Invitations</h3>
              <button onClick={() => setShowPendingInvites(false)} className="p-2 hover:bg-slate-100 rounded-xl">
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh] space-y-3">
              {pendingInvites.length === 0 ? (
                <p className="text-center text-slate-400 py-8">No pending invitations</p>
              ) : (
                pendingInvites.map(invite => (
                  <div key={invite.id} className="p-4 bg-slate-50 rounded-xl flex items-center justify-between gap-4">
                    <div>
                      <div className="font-bold text-slate-900">{invite.driver?.full_name || 'Unknown'}</div>
                      <div className="text-sm text-slate-500">{invite.driver?.phone || 'No phone'}</div>
                    </div>
                    <button 
                      onClick={() => cancelInvite(invite.id)}
                      className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition"
                      title="Cancel Invite"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
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
      className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${active ? 'bg-emerald-100 text-emerald-700 font-bold' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      {isOpen && <span className="flex-1 text-left whitespace-nowrap">{label}</span>}
      {isOpen && badge !== undefined && (
        <span className="bg-emerald-600 text-white text-xs px-2 py-0.5 rounded-full">{badge}</span>
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

function DriversTable({ drivers, onRemove }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead className="bg-slate-50 text-slate-500 text-xs lg:text-sm uppercase">
          <tr>
            <th className="px-4 lg:px-6 py-3 font-semibold">Driver</th>
            <th className="px-4 lg:px-6 py-3 font-semibold">Vehicle</th>
            <th className="px-4 lg:px-6 py-3 font-semibold">Status</th>
            <th className="px-4 lg:px-6 py-3 font-semibold">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-sm">
          {drivers.map(driver => (
            <tr key={driver.id} className="hover:bg-slate-50">
              <td className="px-4 lg:px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 font-bold">
                    {driver.profiles?.full_name?.charAt(0) || 'D'}
                  </div>
                  <div>
                    <div className="font-medium text-slate-900">{driver.profiles?.full_name || 'Unknown'}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {driver.profiles?.phone || '-'}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-4 lg:px-6 py-4">
                <div className="font-bold text-slate-700 uppercase text-xs">{driver.plate_number || '-'}</div>
                <span className="text-xs text-slate-500 capitalize">{driver.vehicle_type || '-'}</span>
              </td>
              <td className="px-4 lg:px-6 py-4">
                <span className={`px-2 py-1 rounded-full text-xs font-bold ${driver.is_online ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                  {driver.is_online ? 'Online' : 'Offline'}
                </span>
              </td>
              <td className="px-4 lg:px-6 py-4">
                <button 
                  onClick={() => onRemove(driver.id)}
                  className="text-red-500 hover:text-red-700 text-sm font-medium hover:underline"
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
          {drivers.length === 0 && (
            <tr>
              <td colSpan="4" className="px-6 py-8 text-center text-slate-400">
                <div className="flex flex-col items-center gap-2">
                  <Car className="w-12 h-12 text-slate-300" />
                  <div>No drivers in your fleet yet</div>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function RidesTable({ rides }) {
  const statusColors = {
    completed: 'bg-emerald-100 text-emerald-700',
    ongoing: 'bg-blue-100 text-blue-700',
    accepted: 'bg-blue-100 text-blue-700',
    pending: 'bg-yellow-100 text-yellow-700',
    cancelled: 'bg-red-100 text-red-700',
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead className="bg-slate-50 text-slate-500 text-xs lg:text-sm uppercase">
          <tr>
            <th className="px-4 lg:px-6 py-3 font-semibold">Ride ID</th>
            <th className="px-4 lg:px-6 py-3 font-semibold">Passenger</th>
            <th className="px-4 lg:px-6 py-3 font-semibold">Fare</th>
            <th className="px-4 lg:px-6 py-3 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-sm">
          {rides.map(ride => (
            <tr key={ride.id} className="hover:bg-slate-50">
              <td className="px-4 lg:px-6 py-4 font-medium text-slate-900">#{ride.id.slice(0, 8)}</td>
              <td className="px-4 lg:px-6 py-4 text-slate-600">{ride.passenger?.full_name || 'Unknown'}</td>
              <td className="px-4 lg:px-6 py-4 font-bold text-emerald-600">KES {ride.fare || 0}</td>
              <td className="px-4 lg:px-6 py-4">
                <span className={`px-2 py-1 rounded-full text-xs font-bold capitalize ${statusColors[ride.status] || 'bg-slate-100 text-slate-600'}`}>
                  {ride.status}
                </span>
              </td>
            </tr>
          ))}
          {rides.length === 0 && (
            <tr><td colSpan="4" className="px-6 py-8 text-center text-slate-400">No rides found</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
