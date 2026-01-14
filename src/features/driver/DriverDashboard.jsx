// src/features/driver/DriverDashboard.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Power, MapPin, Navigation, DollarSign, Bell, Shield, Menu, X, Phone, Star, Settings, Moon, Globe, ChevronRight, ArrowLeft, LogOut, RefreshCw } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useWakeLock } from '../../hooks/useWakeLock';
import { useAuthStore } from '../../store/authStore';

export default function DriverDashboard() {
  const navigate = useNavigate();
  const { signOut, user, profile } = useAuthStore();
  
  // Driver State
  const [driverData, setDriverData] = useState(null);
  const [isOnline, setIsOnline] = useState(false);
  const [incomingRequest, setIncomingRequest] = useState(null);
  const [activeRides, setActiveRides] = useState([]);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  
  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [appSettings, setAppSettings] = useState({
    notifications: true,
    darkMode: false,
    language: 'English'
  });
  
  // Profile Editing State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    full_name: '',
    phone: '',
    vehicle_type: 'boda',
    plate_number: ''
  });

  // Carpool Offer State
  const [showCarpoolForm, setShowCarpoolForm] = useState(false);
  const [isCreatingOffer, setIsCreatingOffer] = useState(false);
  const [carpoolOffer, setCarpoolOffer] = useState({
    pickup_name: '',
    dropoff_name: '',
    departure_time: '',
    total_seats: 4,
    fare_per_seat: 100
  });
  const [activeOffers, setActiveOffers] = useState([]);

  // Dark mode effect
  useEffect(() => {
    if (appSettings.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [appSettings.darkMode]);
  
  // Keep screen awake
  useWakeLock(); 

  // Fetch driver data on mount - run in parallel, don't block
  useEffect(() => {
    if (user) {
      // Fetch all data in parallel
      Promise.all([
        fetchDriverData(),
        fetchTodayEarnings(),
        fetchActiveRides()
      ]).catch(err => console.error('Error loading data:', err));
    } else {
      setIsLoading(false);
    }
  }, [user]);

  // Fetch profile if not loaded
  useEffect(() => {
    const fetchProfile = async () => {
      if (user && !profile) {
        console.log('Fetching driver profile for:', user.id);
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (error) {
          console.error('Driver profile fetch error:', error.message);
          // Fallback to user metadata
          if (user.user_metadata) {
            const fallbackProfile = {
              id: user.id,
              full_name: user.user_metadata.full_name || user.email?.split('@')[0] || 'Driver',
              phone: user.user_metadata.phone || '',
              role: user.user_metadata.role || 'driver'
            };
            useAuthStore.setState({ profile: fallbackProfile });
            console.log('Using fallback driver profile:', fallbackProfile);
          }
        } else if (data) {
          useAuthStore.setState({ profile: data });
          console.log('Driver profile loaded:', data);
        }
      }
    };
    fetchProfile();
  }, [user, profile]);

  // Subscribe to ride requests when online
  // Allow subscription even with active rides IF they are shared
  const canAcceptMore = activeRides.length === 0 || activeRides.every(r => r.ride_type === 'shared');

  useEffect(() => {
    let channel;
    if (isOnline && user && canAcceptMore) {
      console.log('🚗 Driver is ONLINE - subscribing to pending rides...');
      
      channel = supabase
        .channel(`driver-${user.id}-rides`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'rides',
          filter: 'status=eq.pending'
        }, async (payload) => {
          console.log('🔔 NEW RIDE REQUEST RECEIVED:', payload.new);
          
          // If driver already has solo ride, ignore new requests
          if (activeRides.some(r => r.ride_type === 'solo')) {
            console.log('Ignoring request - driver has active solo ride');
            return;
          }
          
          // Fetch passenger details
          const { data: passenger } = await supabase
            .from('profiles')
            .select('full_name, phone')
            .eq('id', payload.new.passenger_id)
            .single();
          
          setIncomingRequest({
            ...payload.new,
            passengerName: passenger?.full_name || 'Passenger',
            passengerPhone: passenger?.phone || '',
            rating: 4.8,
            pickup: 'Pickup Location',
            dropoff: 'Dropoff Location',
            distance: `${(payload.new.fare / 75).toFixed(1)} km`,
            paymentMethod: 'M-Pesa'
          });
        })
        .subscribe((status) => {
          console.log('📡 Subscription status:', status);
          if (status === 'SUBSCRIBED') {
            console.log('✅ Successfully listening for ride requests!');
          } else if (status === 'CHANNEL_ERROR') {
            console.error('❌ Subscription error - check Supabase Realtime settings');
          }
        });
    }
    
    return () => {
      if (channel) {
        console.log('🔌 Cleaning up ride subscription');
        supabase.removeChannel(channel);
      }
    };
  }, [isOnline, user, canAcceptMore, activeRides]);

  const fetchDriverData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (data) {
        setDriverData(data);
        setIsOnline(data.is_online);
      } else if (error?.code === 'PGRST116') {
        // Driver record doesn't exist - create it
        const { data: newDriver } = await supabase
          .from('drivers')
          .insert({ id: user.id, vehicle_type: 'boda', is_online: false })
          .select()
          .single();
        if (newDriver) setDriverData(newDriver);
      }
    } catch (error) {
      console.error('Error fetching driver data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTodayEarnings = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data } = await supabase
        .from('rides')
        .select('fare')
        .eq('driver_id', user.id)
        .eq('status', 'completed')
        .gte('created_at', today.toISOString());
      
      const total = data?.reduce((sum, r) => sum + (r.fare || 0), 0) || 0;
      setTodayEarnings(total);
    } catch (error) {
      console.error('Error fetching earnings:', error);
    }
  };

  const fetchActiveRides = async () => {
    try {
      const { data } = await supabase
        .from('rides')
        .select('*, passenger:profiles!rides_passenger_id_fkey(full_name, phone)')
        .eq('driver_id', user.id)
        .in('status', ['accepted', 'ongoing']);
      
      if (data && data.length > 0) {
        const formattedRides = data.map(ride => ({
          ...ride,
          passengerName: ride.passenger?.full_name || 'Passenger',
          passengerPhone: ride.passenger?.phone || '',
          rating: 4.8,
          pickup: 'Pickup Location',
          dropoff: 'Dropoff Location'
        }));
        setActiveRides(formattedRides);
        setIsOnline(true);
      }
    } catch (error) {
      console.error('Error fetching active rides:', error);
    }
  };

  const handleGoOnline = async () => {
    console.log('Going online...');
    try {
      // First ensure driver record exists (upsert)
      const { error: upsertError } = await supabase
        .from('drivers')
        .upsert({
          id: user.id,
          vehicle_type: driverData?.vehicle_type || 'boda',
          is_online: true,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });
      
      if (upsertError) {
        console.error('Error creating/updating driver:', upsertError);
        alert(`Could not go online: ${upsertError.message}`);
        return;
      }
      
      setIsOnline(true);
      console.log('Now online and listening for rides!');
    } catch (error) {
      console.error('Error going online:', error);
      alert('Failed to go online. Check console for details.');
    }
  };

  const handleGoOffline = async () => {
    console.log('Going offline...');
    try {
      const { error } = await supabase
        .from('drivers')
        .update({ is_online: false, updated_at: new Date().toISOString() })
        .eq('id', user.id);
      
      if (error) {
        console.error('Error updating driver status:', error);
      } else {
        console.log('Successfully went offline');
        setIsOnline(false);
        setIncomingRequest(null);
        setActiveRides([]); // Clear active rides when going offline
      }
    } catch (error) {
      console.error('Error going offline:', error);
    }
  };

  const acceptRide = async () => {
    if (!incomingRequest) return;
    
    try {
      const { error } = await supabase
        .from('rides')
        .update({ driver_id: user.id, status: 'accepted' })
        .eq('id', incomingRequest.id)
        .eq('status', 'pending'); // Only if still pending
      
      if (!error) {
        // Add the new ride to the array
        setActiveRides(prev => [...prev, { ...incomingRequest, status: 'accepted' }]);
        setIncomingRequest(null);
      }
    } catch (error) {
      console.error('Error accepting ride:', error);
    }
  };

  const declineRide = () => {
    setIncomingRequest(null);
  };

  const completeRide = async (rideId) => {
    const rideToComplete = activeRides.find(r => r.id === rideId);
    if (!rideToComplete) return;
    
    try {
      const { error } = await supabase
        .from('rides')
        .update({ status: 'completed', payment_status: 'paid' })
        .eq('id', rideId);
      
      if (!error) {
        setTodayEarnings(prev => prev + (rideToComplete.fare || 0));
        setActiveRides(prev => prev.filter(r => r.id !== rideId));
      }
    } catch (error) {
      console.error('Error completing ride:', error);
    }
  };
  
  const handleLogout = async () => {
    try {
      // Go offline before logging out
      if (isOnline) {
        await supabase.from('drivers').update({ is_online: false }).eq('id', user.id);
      }
      await supabase.auth.signOut();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      // Force navigate anyway
      navigate('/login');
    }
  };

  // Initialize profile form when settings open
  const openSettings = () => {
    setProfileForm({
      full_name: profile?.full_name || '',
      phone: profile?.phone || '',
      vehicle_type: driverData?.vehicle_type || 'boda',
      plate_number: driverData?.plate_number || ''
    });
    setIsEditingProfile(false);
    setShowSettings(true);
  };

  // Save profile changes
  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      // Update profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: profileForm.full_name,
          phone: profileForm.phone
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // Update drivers table
      const { error: driverError } = await supabase
        .from('drivers')
        .update({
          vehicle_type: profileForm.vehicle_type,
          plate_number: profileForm.plate_number,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (driverError) throw driverError;

      // Update local state
      useAuthStore.setState({
        profile: {
          ...profile,
          full_name: profileForm.full_name,
          phone: profileForm.phone
        }
      });
      setDriverData(prev => ({
        ...prev,
        vehicle_type: profileForm.vehicle_type,
        plate_number: profileForm.plate_number
      }));
      
      setIsEditingProfile(false);
      console.log('Profile saved successfully');
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Failed to save profile. Please try again.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Fetch driver's active carpool offers
  const fetchActiveOffers = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('carpool_offers')
        .select('*')
        .eq('driver_id', user.id)
        .in('status', ['open', 'full'])
        .order('departure_time', { ascending: true });
      
      if (!error && data) {
        setActiveOffers(data);
      }
    } catch (error) {
      console.error('Error fetching offers:', error);
    }
  };

  // Create a new carpool offer
  const handleCreateOffer = async () => {
    if (!carpoolOffer.pickup_name || !carpoolOffer.dropoff_name || !carpoolOffer.departure_time) {
      alert('Please fill in all fields');
      return;
    }

    setIsCreatingOffer(true);
    try {
      const { data, error } = await supabase
        .from('carpool_offers')
        .insert({
          driver_id: user.id,
          pickup_name: carpoolOffer.pickup_name,
          dropoff_name: carpoolOffer.dropoff_name,
          pickup_location: `POINT(36.8 -1.3)`, // Default Nairobi - would be geocoded
          dropoff_location: `POINT(36.9 -1.2)`, // Default - would be geocoded
          departure_time: new Date(carpoolOffer.departure_time).toISOString(),
          total_seats: carpoolOffer.total_seats,
          available_seats: carpoolOffer.total_seats,
          fare_per_seat: carpoolOffer.fare_per_seat,
          vehicle_type: driverData?.vehicle_type || 'taxi',
          status: 'open'
        })
        .select()
        .single();

      if (error) throw error;

      setActiveOffers(prev => [...prev, data]);
      setShowCarpoolForm(false);
      setCarpoolOffer({
        pickup_name: '',
        dropoff_name: '',
        departure_time: '',
        total_seats: 4,
        fare_per_seat: 100
      });
      console.log('Carpool offer created:', data);
    } catch (error) {
      console.error('Error creating offer:', error);
      alert('Failed to create offer. Please try again.');
    } finally {
      setIsCreatingOffer(false);
    }
  };

  // Cancel a carpool offer
  const cancelOffer = async (offerId) => {
    try {
      const { error } = await supabase
        .from('carpool_offers')
        .update({ status: 'cancelled' })
        .eq('id', offerId)
        .eq('driver_id', user.id);

      if (!error) {
        setActiveOffers(prev => prev.filter(o => o.id !== offerId));
      }
    } catch (error) {
      console.error('Error cancelling offer:', error);
    }
  };

  // Subscribe to real-time updates for driver's offers
  useEffect(() => {
    if (!user) return;

    fetchActiveOffers();

    const channel = supabase
      .channel(`driver-offers-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'carpool_offers',
        filter: `driver_id=eq.${user.id}`
      }, (payload) => {
        console.log('Offer update:', payload);
        if (payload.eventType === 'UPDATE') {
          setActiveOffers(prev => 
            prev.map(o => o.id === payload.new.id ? payload.new : o)
          );
        } else if (payload.eventType === 'DELETE') {
          setActiveOffers(prev => prev.filter(o => o.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const refreshData = () => {
    fetchDriverData();
    fetchTodayEarnings();
    fetchActiveRides();
    fetchActiveOffers();
  };

  return (
    <div className="h-[100dvh] w-full bg-white font-sans text-slate-900 flex flex-col lg:flex-row overflow-hidden">
      
      {/* =========================================================================
          #1. MOBILE LAYOUT (lg:hidden)
          - Original Mobile-First Design
          - Fixed Header + Split Screen
      ========================================================================= */}
      <div className="lg:hidden flex flex-col h-full w-full">
        {/* Fixed Header */}
        <div 
          className="fixed top-0 left-0 right-0 z-50 px-5 py-4 bg-gradient-to-b from-white/90 via-white/70 to-transparent backdrop-blur-sm"
          style={{ paddingTop: 'max(20px, env(safe-area-inset-top))' }}
        >
          <div className="flex justify-between items-center">
            <div className="bg-white px-4 py-2.5 rounded-2xl shadow-lg flex items-center gap-3 border border-slate-200/50">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-xl flex items-center justify-center text-white shadow-inner">
                <span className="text-[10px] font-bold">KES</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-slate-500">Today</span>
                <span className="font-bold text-base text-slate-800">
                  {isLoading ? '...' : `KES ${todayEarnings.toLocaleString()}`}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={refreshData}
                className="bg-white p-3 rounded-2xl shadow-lg hover:bg-slate-50 transition active:scale-95 border border-slate-200/50 text-slate-700"
              >
                <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button 
                onClick={openSettings}
                className="bg-white p-3 rounded-2xl shadow-lg hover:bg-slate-50 transition active:scale-95 border border-slate-200/50 text-slate-700"
              >
                <Settings className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>

        {/* Map Top */}
        <div className="relative h-[45vh] flex-shrink-0 mt-20">
          <DriverMap activeRides={activeRides} /> 
        </div>

        {/* Content Bottom */}
        <div className="flex-1 bg-white rounded-t-3xl -mt-6 z-10 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] overflow-y-auto relative">
          <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto my-3" />
          <div className="p-5 pb-8 space-y-6">
            <DashboardContent 
              isOnline={isOnline} 
              handleGoOnline={handleGoOnline}
              handleGoOffline={handleGoOffline} 
              incomingRequest={incomingRequest}
              setIncomingRequest={declineRide} 
              acceptRide={acceptRide}
              activeRides={activeRides} 
              completeRide={completeRide}
              isLoading={isLoading}
            />
          </div>
        </div>
      </div>

      {/* =========================================================================
          #2. DESKTOP LAYOUT (hidden lg:flex)
          - Side-by-Side: Map Left (Flex-1) | Sidebar Right (Fixed Width)
      ========================================================================= */}
      <div className="hidden lg:flex flex-row w-full h-full">
        
        {/* LEFT: Map Area */}
        <div className="flex-1 relative h-full">
          <DriverMap activeRides={activeRides} />
        </div>

        {/* RIGHT: Sidebar */}
        <div className="w-[450px] bg-slate-50 h-full border-l border-slate-200 flex flex-col z-20 shadow-2xl">
          
          {/* Desktop Header */}
          <div className="p-6 bg-white border-b border-slate-100 shadow-sm z-10">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-slate-800">Driver Dashboard</h1>
              <div className="flex gap-2">
                <button 
                  onClick={refreshData}
                  className="p-2 hover:bg-slate-100 rounded-xl transition text-slate-600"
                  title="Refresh"
                >
                  <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
                <button 
                  onClick={openSettings}
                  className="p-2 hover:bg-slate-100 rounded-xl transition text-slate-600"
                >
                  <Settings className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            {/* Earnings Card Desktop */}
            <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-2xl p-5 text-white shadow-lg shadow-emerald-200/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-xs font-bold ring-2 ring-white/10">
                  KES
                </div>
                <div>
                  <div className="text-emerald-100 text-sm font-medium">Total Earnings Today</div>
                  <div className="text-3xl font-bold">
                    {isLoading ? '...' : `KES ${todayEarnings.toLocaleString()}`}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            <DashboardContent 
              isOnline={isOnline} 
              handleGoOnline={handleGoOnline}
              handleGoOffline={handleGoOffline} 
              incomingRequest={incomingRequest}
              setIncomingRequest={declineRide} 
              acceptRide={acceptRide}
              activeRides={activeRides} 
              completeRide={completeRide}
              isLoading={isLoading}
            />
          </div>
        </div>
      </div>

      {/* --- SETTINGS OVERLAY (Shared) --- */}
      {showSettings && (
        <div className="fixed inset-0 z-[2000] bg-white overflow-y-auto animate-in slide-in-from-right duration-300">
             {/* Settings Header */}
             <div className="sticky top-0 z-10 bg-white border-b border-slate-100 p-4 flex items-center gap-4" style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
            <button onClick={() => setShowSettings(false)} className="p-2 -ml-2 hover:bg-slate-100 rounded-full transition active:scale-95">
              <ArrowLeft className="w-6 h-6 text-slate-700" />
            </button>
            <h2 className="text-lg font-bold text-slate-900">Settings</h2>
          </div>
          
          <div className="p-5 space-y-6 max-w-2xl mx-auto">
            {/* Driver Profile - Editable */}
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xl font-bold">
                    {profile?.full_name?.charAt(0) || 'D'}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">{profile?.full_name || 'Driver'}</div>
                    <div className="text-xs text-emerald-600 font-medium capitalize">
                      {driverData?.vehicle_type || 'Boda'} Driver
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setIsEditingProfile(!isEditingProfile)}
                  className="text-emerald-600 text-sm font-bold hover:underline"
                >
                  {isEditingProfile ? 'Cancel' : 'Edit'}
                </button>
              </div>
              
              {/* Editable Form */}
              {isEditingProfile && (
                <div className="space-y-3 pt-3 border-t border-emerald-200">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Full Name</label>
                    <input 
                      type="text"
                      value={profileForm.full_name}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, full_name: e.target.value }))}
                      className="w-full mt-1 p-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Phone Number</label>
                    <input 
                      type="tel"
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="+254 7XX XXX XXX"
                      className="w-full mt-1 p-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Vehicle Type</label>
                    <select 
                      value={profileForm.vehicle_type}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, vehicle_type: e.target.value }))}
                      className="w-full mt-1 p-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    >
                      <option value="boda">Boda (Motorcycle)</option>
                      <option value="tuktuk">Tuktuk (Auto-rickshaw)</option>
                      <option value="taxi">Taxi (Car)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Plate Number</label>
                    <input 
                      type="text"
                      value={profileForm.plate_number}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, plate_number: e.target.value.toUpperCase() }))}
                      placeholder="KXX 123X"
                      className="w-full mt-1 p-3 bg-white border border-slate-200 rounded-xl text-slate-800 uppercase focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>
                  <button 
                    onClick={handleSaveProfile}
                    disabled={isSavingProfile}
                    className="w-full mt-2 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition disabled:opacity-50"
                  >
                    {isSavingProfile ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              )}
              
              {/* Display View */}
              {!isEditingProfile && (
                <div className="text-sm text-slate-600 space-y-1">
                  <div><span className="text-slate-400">Phone:</span> {profile?.phone || 'Not set'}</div>
                  <div><span className="text-slate-400">Plate:</span> {driverData?.plate_number || 'Not set'}</div>
                </div>
              )}
            </div>

            {/* Carpool Offers Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Carpool Offers</h3>
                <button 
                  onClick={() => setShowCarpoolForm(!showCarpoolForm)}
                  className="text-purple-600 text-sm font-bold hover:underline"
                >
                  {showCarpoolForm ? 'Cancel' : '+ New Offer'}
                </button>
              </div>

              {/* Create Offer Form */}
              {showCarpoolForm && (
                <div className="p-4 bg-purple-50 rounded-xl border border-purple-200 space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">From (Pickup)</label>
                    <input 
                      type="text"
                      value={carpoolOffer.pickup_name}
                      onChange={(e) => setCarpoolOffer(prev => ({ ...prev, pickup_name: e.target.value }))}
                      placeholder="e.g. Westlands"
                      className="w-full mt-1 p-3 bg-white border border-slate-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">To (Dropoff)</label>
                    <input 
                      type="text"
                      value={carpoolOffer.dropoff_name}
                      onChange={(e) => setCarpoolOffer(prev => ({ ...prev, dropoff_name: e.target.value }))}
                      placeholder="e.g. CBD"
                      className="w-full mt-1 p-3 bg-white border border-slate-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Departure Time</label>
                    <input 
                      type="datetime-local"
                      value={carpoolOffer.departure_time}
                      onChange={(e) => setCarpoolOffer(prev => ({ ...prev, departure_time: e.target.value }))}
                      className="w-full mt-1 p-3 bg-white border border-slate-200 rounded-xl"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase">Seats</label>
                      <select 
                        value={carpoolOffer.total_seats}
                        onChange={(e) => setCarpoolOffer(prev => ({ ...prev, total_seats: parseInt(e.target.value) }))}
                        className="w-full mt-1 p-3 bg-white border border-slate-200 rounded-xl"
                      >
                        {[1, 2, 3, 4, 5, 6].map(n => (
                          <option key={n} value={n}>{n} seat{n > 1 ? 's' : ''}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase">Fare/Seat (KES)</label>
                      <input 
                        type="number"
                        value={carpoolOffer.fare_per_seat}
                        onChange={(e) => setCarpoolOffer(prev => ({ ...prev, fare_per_seat: parseInt(e.target.value) || 0 }))}
                        className="w-full mt-1 p-3 bg-white border border-slate-200 rounded-xl"
                      />
                    </div>
                  </div>
                  <button 
                    onClick={handleCreateOffer}
                    disabled={isCreatingOffer}
                    className="w-full py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition disabled:opacity-50"
                  >
                    {isCreatingOffer ? 'Creating...' : 'Create Offer'}
                  </button>
                </div>
              )}

              {/* Active Offers List */}
              {activeOffers.length > 0 ? (
                <div className="space-y-2">
                  {activeOffers.map(offer => (
                    <div key={offer.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="font-bold text-slate-800">{offer.pickup_name} → {offer.dropoff_name}</div>
                          <div className="text-xs text-slate-500">
                            {new Date(offer.departure_time).toLocaleString()}
                          </div>
                        </div>
                        <div className={`px-2 py-1 rounded-full text-xs font-bold ${
                          offer.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {offer.status === 'open' ? 'Open' : 'Full'}
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="text-sm">
                          <span className="font-bold text-purple-600">{offer.available_seats}/{offer.total_seats}</span>
                          <span className="text-slate-500"> seats • </span>
                          <span className="font-bold text-emerald-600">KES {offer.fare_per_seat}</span>
                          <span className="text-slate-500">/seat</span>
                        </div>
                        <button 
                          onClick={() => cancelOffer(offer.id)}
                          className="text-red-500 text-xs font-bold hover:underline"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-slate-50 rounded-xl text-center text-slate-400 text-sm">
                  No active carpool offers. Create one to start pooling!
                </div>
              )}
            </div>

            {/* App Settings */}
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">App Settings</h3>
              
              <button 
                onClick={() => setAppSettings(prev => ({ ...prev, notifications: !prev.notifications }))}
                className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition group"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shadow-sm transition-colors ${appSettings.notifications ? 'bg-purple-100 text-purple-600' : 'bg-white text-slate-400'}`}>
                    <Bell className="w-5 h-5" />
                  </div>
                  <span className="font-medium text-slate-700">Notifications</span>
                </div>
                <div className={`w-10 h-6 rounded-full relative transition-colors ${appSettings.notifications ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${appSettings.notifications ? 'right-1' : 'left-1'}`} />
                </div>
              </button>

              <button 
                onClick={() => setAppSettings(prev => ({ ...prev, darkMode: !prev.darkMode }))}
                className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition group mt-2"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shadow-sm transition-colors ${appSettings.darkMode ? 'bg-slate-800 text-white' : 'bg-white text-slate-600'}`}>
                    <Moon className="w-5 h-5" />
                  </div>
                  <span className="font-medium text-slate-700">Dark Mode</span>
                </div>
                <div className={`w-10 h-6 rounded-full relative transition-colors ${appSettings.darkMode ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${appSettings.darkMode ? 'right-1' : 'left-1'}`} />
                </div>
              </button>

              <button 
                onClick={() => setAppSettings(prev => ({ ...prev, language: prev.language === 'English' ? 'Swahili' : 'English' }))}
                className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition group mt-2"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-white rounded-full flex items-center justify-center text-blue-600 shadow-sm"><Globe className="w-5 h-5" /></div>
                  <span className="font-medium text-slate-700">Language</span>
                </div>
                <div className="flex items-center gap-2 text-slate-500 text-sm">
                  {appSettings.language} <ChevronRight className="w-4 h-4" />
                </div>
              </button>
            </div>

            {/* Support & Legal */}
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Support & Legal</h3>
              
              <a href="#" target="_blank" className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition group">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-white rounded-full flex items-center justify-center text-emerald-600 shadow-sm"><Shield className="w-5 h-5" /></div>
                  <span className="font-medium text-slate-700">Privacy & Security</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 transition" />
              </a>

              <button onClick={() => alert('Rating feature coming soon!')} className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition group mt-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-white rounded-full flex items-center justify-center text-yellow-500 shadow-sm"><Star className="w-5 h-5" /></div>
                  <span className="font-medium text-slate-700">Rate the App</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 transition" />
              </button>
            </div>

            {/* Logout Button */}
            <div className="pt-4">
              <button 
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-3 p-4 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition font-bold"
              >
                <LogOut className="w-5 h-5" />
                Log Out
              </button>
            </div>

            {/* App Info */}
            <div className="pt-8 pb-4 text-center">
              <div className="w-12 h-12 bg-slate-100 rounded-xl mx-auto mb-3 flex items-center justify-center text-xl font-bold text-slate-400">J</div>
              <h4 className="font-bold text-slate-900">JiraniRide Driver</h4>
              <p className="text-xs text-slate-400 mt-1">Version 2.0.1 (Build 452)</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// === SUB-COMPONENTS ===

function DriverMap({ activeRides }) {
  return (
    <div className="relative w-full h-full bg-slate-100">
      <iframe 
        width="100%" height="100%" frameBorder="0" 
        src="https://www.openstreetmap.org/export/embed.html?bbox=36.7%2C-1.3%2C37.1%2C-1.1&layer=mapnik" 
        className="w-full h-full opacity-100 mix-blend-multiply grayscale-[0.3]"
      ></iframe>
      
      {/* Navigation Overlay - Show for any active ride */}
      {activeRides && activeRides.length > 0 && (
        <div className="absolute top-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-emerald-700 text-white p-4 shadow-xl z-20 rounded-none md:rounded-lg">
            <div className="flex items-start gap-4">
              <Navigation className="w-10 h-10 mt-1 opacity-90" />
              <div>
                <div className="text-emerald-100 font-medium text-sm">
                  {activeRides.length} Active {activeRides.length === 1 ? 'Ride' : 'Rides'}
                </div>
                <div className="font-bold text-2xl leading-tight">Navigating...</div>
              </div>
            </div>
        </div>
      )}
    </div>
  );
}

function DashboardContent({ isOnline, handleGoOnline, handleGoOffline, incomingRequest, setIncomingRequest, acceptRide, activeRides, completeRide, isLoading }) {
  const hasActiveRides = activeRides && activeRides.length > 0;

  return (
    <>
      {/* 1. OFFLINE STATE - THE "GO" BUTTON */}
      {!isOnline && !hasActiveRides && (
        <div className="flex flex-col items-center justify-center h-full min-h-[40vh]">
          <button 
            onClick={handleGoOnline}
            disabled={isLoading}
            className="group relative w-32 h-32 md:w-40 md:h-40 rounded-full bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all duration-300 shadow-2xl shadow-blue-300 flex items-center justify-center mb-6 disabled:opacity-50"
          >
             <div className="absolute inset-0 rounded-full border-4 border-blue-400 opacity-30 group-hover:scale-110 transition-transform duration-500"></div>
             <span className="font-bold text-3xl md:text-4xl text-white tracking-widest">GO</span>
          </button>
          <h2 className="text-xl font-bold text-slate-800">You are Offline</h2>
          <p className="text-slate-500 text-sm mt-1">Go online to receive trips</p>
        </div>
      )}

      {/* 2. ONLINE / SEARCHING - MINIMAL STATUS */}
      {isOnline && !incomingRequest && !hasActiveRides && (
        <div className="flex flex-col items-center justify-center h-full py-10">
          <div className="relative mb-6">
            <span className="absolute inset-0 rounded-full bg-blue-100 animate-ping opacity-75 duration-1000"></span>
            <div className="w-16 h-16 bg-white border-4 border-blue-500 rounded-full flex items-center justify-center shadow-lg relative z-10">
               <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
            </div>
          </div>
          <h3 className="text-lg font-bold text-slate-800">Finding Trips...</h3>
          <p className="text-slate-400 text-sm mb-8">You're visible to passengers nearby</p>
          
          <button 
            onClick={handleGoOffline}
            className="flex items-center gap-2 px-6 py-3 rounded-full bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition text-sm uppercase tracking-wide"
          >
            <Power className="w-4 h-4" /> Go Offline
          </button>
        </div>
      )}

      {/* 3. INCOMING REQUEST - HIGH CONTRAST CARD */}
      {incomingRequest && (
        <div className="animate-in slide-in-from-bottom duration-300 h-full flex flex-col">
          <div className="flex-1">
             {/* Header */}
             <div className="flex items-center justify-between mb-8">
                <div className="flex gap-2">
                    <div className="bg-black text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                      {incomingRequest.paymentMethod || 'M-Pesa'}
                    </div>
                    {/* SHARED RIDE BADGE */}
                    {incomingRequest.ride_type === 'shared' && (
                        <div className="bg-purple-600 text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider animate-pulse border border-purple-400">
                           Shared Ride
                        </div>
                    )}
                </div>
                <div className="text-slate-500 text-sm font-medium">New Request</div>
             </div>
             
             {/* Fare */}
             <div className="text-center mb-10">
                <div className="text-5xl md:text-6xl font-black text-slate-900 tracking-tight">
                  <span className="text-2xl font-bold text-slate-400 align-top mr-1">KES</span>
                  {incomingRequest.fare || 0}
                </div>
                <div className="text-green-600 font-bold text-sm mt-1 uppercase tracking-wide">Expected Earnings</div>
             </div>

             {/* Route Visualization */}
             <div className="flex flex-col gap-6 px-4">
               <div className="flex gap-4 relative">
                 <div className="absolute left-[9px] top-3 bottom-0 w-0.5 bg-slate-200"></div>
                 <div className="w-5 h-5 bg-black rounded-sm z-10 flex-shrink-0"></div>
                 <div>
                   <div className="text-lg font-bold text-slate-900 leading-none mb-1">{incomingRequest.passengerName}</div>
                   <div className="text-slate-400 text-xs uppercase font-bold">Passenger</div>
                 </div>
               </div>
               
               <div className="flex gap-4 relative">
                 <div className="w-5 h-5 border-[3px] border-black bg-white z-10 flex-shrink-0"></div>
                 <div>
                   <div className="text-lg font-bold text-slate-900 leading-none mb-1">{incomingRequest.dropoff}</div>
                   <div className="text-slate-400 text-xs uppercase font-bold">Dropoff • {incomingRequest.distance}</div>
                 </div>
               </div>
             </div>
          </div>

          {/* Footer Actions */}
          <div className="mt-8 pt-6 border-t border-slate-100 grid grid-cols-6 gap-3">
             <button 
               onClick={setIncomingRequest}
               className="col-span-2 flex flex-col items-center justify-center p-4 rounded-xl bg-slate-100 hover:bg-slate-200 transition active:scale-95"
             >
               <X className="w-6 h-6 text-slate-600 mb-1" />
               <span className="text-xs font-bold text-slate-600 uppercase">Decline</span>
             </button>
             <button 
               onClick={acceptRide}
               className="col-span-4 flex flex-col items-center justify-center p-4 rounded-xl bg-black text-white hover:bg-slate-800 transition active:scale-95 shadow-xl"
             >
               <span className="text-xl font-bold">ACCEPT</span>
               <span className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5">Tap to confirm</span>
             </button>
          </div>
        </div>
      )}

      {/* 4. ACTIVE RIDES - MULTI-RIDE LIST */}
      {hasActiveRides && (
        <div className="animate-in fade-in space-y-4">
          {/* Header showing ride count */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-800">
              {activeRides.length} Active {activeRides.length === 1 ? 'Ride' : 'Rides'}
            </h3>
            {activeRides.some(r => r.ride_type === 'shared') && (
              <div className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-bold">
                Shared Pool
              </div>
            )}
          </div>

          {/* Render each active ride as a card */}
          {activeRides.map((ride) => (
            <div key={ride.id} className="bg-slate-50 border border-slate-100 rounded-xl p-4">
              {/* Passenger Strip */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold">
                    {ride.passengerName?.charAt(0) || 'P'}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">{ride.passengerName}</div>
                    <div className="text-xs text-slate-500">
                      {ride.ride_type === 'shared' && <span className="text-purple-600 font-bold mr-2">SHARED</span>}
                      {ride.dropoff}
                    </div>
                  </div>
                </div>
                {ride.passengerPhone && (
                  <a href={`tel:${ride.passengerPhone}`} className="p-2 bg-white border border-slate-200 rounded-full text-slate-700 hover:bg-slate-100">
                    <Phone className="w-4 h-4" />
                  </a>
                )}
              </div>

              {/* Fare & Complete */}
              <div className="flex items-center justify-between">
                <div className="font-black text-xl text-emerald-700">KES {ride.fare}</div>
                <button 
                  onClick={() => completeRide(ride.id)}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold text-sm hover:bg-emerald-700 transition"
                >
                  Complete
                </button>
              </div>
            </div>
          ))}

          {/* Go Offline button */}
          <button 
            onClick={handleGoOffline}
            className="w-full mt-4 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition text-sm uppercase tracking-wide"
          >
            <Power className="w-4 h-4" /> Go Offline
          </button>
        </div>
      )}
    </>
  );
}
