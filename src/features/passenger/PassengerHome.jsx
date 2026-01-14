// src/features/passenger/PassengerHome.jsx
import { useState, useEffect } from 'react';
import { MapPin, Menu, History, Star, CreditCard, User, LogOut, Navigation, Bike, Car, Zap, X, Loader2, Phone, ArrowLeft, Gift, CheckCircle, Save, Users, Settings, Bell, Moon, Globe, Shield, ChevronRight } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import Map from '../../components/ui/Map';
import { calculateDistance, calculateFare, PRICE_PER_KM, MIN_FARES, CARPOOL_DISCOUNT } from '../../utils/pricing';

export default function PassengerHome() {
  const navigate = useNavigate();
  const { profile, user } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [activePanel, setActivePanel] = useState(null);
  const [bookingStep, setBookingStep] = useState('idle');
  const [selectedVehicle, setSelectedVehicle] = useState('boda');
  const [pickupLocation, setPickupLocation] = useState(null);
  const [isRequestingRide, setIsRequestingRide] = useState(false);
  const [currentRide, setCurrentRide] = useState(null);
  const [destination, setDestination] = useState('');
  const [dropoffLocation, setDropoffLocation] = useState(null);
  const [pickupAddress, setPickupAddress] = useState('Current Location');
  const [estimatedFare, setEstimatedFare] = useState(0);
  const [estimatedDistance, setEstimatedDistance] = useState(0);
  const [isCarpool, setIsCarpool] = useState(false);
  const [rideHistory, setRideHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [profileForm, setProfileForm] = useState({ full_name: profile?.full_name || '', phone: profile?.phone || '' });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [appSettings, setAppSettings] = useState({
    notifications: true,
    darkMode: false,
    language: 'English'
  });

  // Dark mode effect
  useEffect(() => {
    if (appSettings.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [appSettings.darkMode]);

  const userName = profile?.full_name?.split(' ')[0] || 'there';
  const userPoints = profile?.loyalty_points || 0;
  const userInitials = profile?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';
  const userPhone = profile?.phone || '+254 7XX XXX XXX';
  const defaultCenter = [-1.2921, 36.8219];

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => setPickupLocation({ lat: position.coords.latitude, lng: position.coords.longitude }),
        () => setPickupLocation({ lat: -1.2921, lng: 36.8219 })
      );
    }
  }, []);

  // Fetch profile on mount if not loaded
  useEffect(() => {
    const fetchProfile = async () => {
      if (user && !profile) {
        console.log('Fetching profile for user:', user.id);
        
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (error) {
          console.error('Profile fetch error:', error.message);
          // Fallback: use user metadata if profile fetch fails
          if (user.user_metadata) {
            const fallbackProfile = {
              id: user.id,
              full_name: user.user_metadata.full_name || user.email?.split('@')[0] || 'User',
              phone: user.user_metadata.phone || '',
              role: user.user_metadata.role || 'passenger'
            };
            useAuthStore.setState({ profile: fallbackProfile });
            console.log('Using fallback profile from metadata:', fallbackProfile);
          }
        } else if (data) {
          useAuthStore.setState({ profile: data });
          console.log('Profile loaded from DB:', data);
        }
      }
    };
    fetchProfile();
  }, [user, profile]);

  useEffect(() => {
    if (activePanel === 'rides' && user) fetchRideHistory();
  }, [activePanel, user]);

  const fetchRideHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const { data } = await supabase.from('rides').select('*').eq('passenger_id', user.id).order('created_at', { ascending: false }).limit(10);
      if (data) setRideHistory(data);
    } catch (err) { console.error('Error fetching rides:', err); }
    finally { setIsLoadingHistory(false); }
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
  const getGreeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };
  
  // Fare calculation: KES 75 per km with minimum fare based on vehicle
  const RATE_PER_KM = 75;
  const MIN_FARES = { boda: 50, tuktuk: 100, taxi: 200 };
  
  // Calculate distance between two points using Haversine formula
  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in km
  };
  
  const getFare = (distanceKm, vehicleType = 'boda') => {
    const minFare = MIN_FARES[vehicleType] || 50;
    const calculatedFare = Math.round(distanceKm * RATE_PER_KM);
    return Math.max(calculatedFare, minFare);
  };

  const handleRequestRide = async () => {
    // Validate required fields
    if (!destination || !pickupLocation) {
      console.error('Missing required fields: destination or pickup location');
      return;
    }
    
    // For now, simulate dropoff as offset from pickup if not set
    // In production, this would come from geocoding the destination
    const dropoff = dropoffLocation || {
      lat: pickupLocation.lat + 0.02, // ~2km offset
      lng: pickupLocation.lng + 0.02
    };
    
    // Calculate distance and fare
    const distanceKm = calculateDistance(
      pickupLocation.lat, pickupLocation.lng,
      dropoff.lat, dropoff.lng
    );
    const calculatedFare = getFare(distanceKm, selectedVehicle);
    
    setIsRequestingRide(true);
    setBookingStep('searching');
    
    try {
      // 1. Create ride request in database
      const { data: ride, error } = await supabase.from('rides').insert({
        passenger_id: user.id,
        pickup_location: `POINT(${pickupLocation.lng} ${pickupLocation.lat})`,
        dropoff_location: `POINT(${dropoff.lng} ${dropoff.lat})`,
        fare: calculatedFare,
        status: 'pending'
      }).select().single();
      
      if (error) throw error;
      setCurrentRide(ride);
      
      // 2. Find nearby drivers using RPC
      const { data: nearbyDrivers, error: driversError } = await supabase.rpc('get_nearby_drivers', {
        user_lat: pickupLocation.lat,
        user_long: pickupLocation.lng,
        radius_meters: 5000
      });
      
      if (!driversError && nearbyDrivers?.length > 0) {
        console.log('Nearby drivers found:', nearbyDrivers);
      } else {
        console.log('No nearby drivers found, waiting for any driver...');
      }
      
      // 3. Subscribe to ride updates (when driver accepts)
      const channel = supabase
        .channel(`ride-${ride.id}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'rides',
          filter: `id=eq.${ride.id}`
        }, async (payload) => {
          console.log('Ride updated:', payload.new);
          const updatedRide = payload.new;
          setCurrentRide(updatedRide);
          
          // Check if driver accepted
          if (updatedRide.status === 'accepted' && updatedRide.driver_id) {
            // Clear the fallback timeout
            if (window.rideTimeout) clearTimeout(window.rideTimeout);
            
            // Fetch driver details
            const { data: driverProfile } = await supabase
              .from('profiles')
              .select('full_name, phone')
              .eq('id', updatedRide.driver_id)
              .single();
            
            const { data: driverInfo } = await supabase
              .from('drivers')
              .select('vehicle_type, plate_number')
              .eq('id', updatedRide.driver_id)
              .single();
            
            setCurrentRide({
              ...updatedRide,
              driverName: driverProfile?.full_name || 'Driver',
              driverPhone: driverProfile?.phone || '',
              vehicleType: driverInfo?.vehicle_type || 'boda',
              plateNumber: driverInfo?.plate_number || ''
            });
            
            setBookingStep('matched');
          } else if (updatedRide.status === 'cancelled') {
            if (window.rideTimeout) clearTimeout(window.rideTimeout);
            setBookingStep('idle');
            setCurrentRide(null);
          }
        })
        .subscribe();
      
      // Store channel for cleanup
      window.rideChannel = channel;
      
      // 4. Timeout: If no driver accepts in 30 seconds, show message
      window.rideTimeout = setTimeout(() => {
        // No real driver found - show message and return to selecting
        setCurrentRide(null);
        setBookingStep('selecting');
        alert('No drivers available right now. Please try again in a moment.');
      }, 30000); // 30 seconds timeout
      
    } catch (error) { 
      console.error('Error requesting ride:', error); 
      setBookingStep('selecting'); 
    } finally { 
      setIsRequestingRide(false); 
    }
  };

  const handleCancelRide = async () => {
    if (currentRide) {
      await supabase.from('rides').update({ status: 'cancelled' }).eq('id', currentRide.id);
      // Cleanup real-time subscription
      if (window.rideChannel) {
        supabase.removeChannel(window.rideChannel);
        window.rideChannel = null;
      }
    }
    setCurrentRide(null);
    setBookingStep('idle');
    setDestination('');
  };

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      const { error } = await supabase.from('profiles').update({ full_name: profileForm.full_name, phone: profileForm.phone }).eq('id', user.id);
      if (!error) { setActivePanel(null); window.location.reload(); }
    } catch (err) { console.error('Error saving profile:', err); }
    finally { setIsSavingProfile(false); }
  };

  const openPanel = (panel) => { setMenuOpen(false); setActivePanel(panel); if (panel === 'profile') setProfileForm({ full_name: profile?.full_name || '', phone: profile?.phone || '' }); };

  return (
    <div className="h-[100dvh] w-full bg-white font-sans text-slate-900 flex flex-col lg:flex-row overflow-hidden">
      
      {/* === MOBILE LAYOUT: Split Screen === */}
      <div className="lg:hidden flex flex-col h-full">
        
        {/* FIXED HEADER - Always visible on mobile */}
        <div 
          className="fixed top-0 left-0 right-0 z-50 px-5 py-4 lg:hidden bg-gradient-to-b from-white/90 via-white/70 to-transparent backdrop-blur-sm"
          style={{ paddingTop: 'max(20px, env(safe-area-inset-top))' }}
        >
          <div className="flex justify-between items-center">
            {/* User Greeting + Points */}
            <div onClick={() => openPanel('profile')} className="bg-white px-4 py-2.5 rounded-2xl shadow-lg flex items-center gap-3 border border-slate-200/50 cursor-pointer active:scale-95 transition">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-inner">
                {userInitials}
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-slate-500">Points</span>
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                  <span className="font-bold text-base text-slate-800">{userPoints}</span>
                </div>
              </div>
            </div>

            {/* Settings Button */}
            <button 
              onClick={() => openPanel('settings')}
              className="bg-white p-3 rounded-2xl shadow-lg hover:bg-slate-50 transition active:scale-95 border border-slate-200/50 text-slate-700"
            >
              <Settings className="w-6 h-6" />
            </button>
          </div>
        </div>
        
        {/* TOP HALF: Map (with padding for fixed header) */}
        <div className="relative h-[40vh] flex-shrink-0 mt-20">
          <Map 
            center={pickupLocation ? [pickupLocation.lat, pickupLocation.lng] : defaultCenter}
            zoom={15}
            className="h-full w-full"
            markers={pickupLocation ? [{ position: [pickupLocation.lat, pickupLocation.lng], popup: "You are here" }] : []}
          />
        </div>
        
        {/* BOTTOM HALF: Booking Content */}
        <div className="flex-1 bg-white overflow-y-auto">
          <div className="p-5">
            <BookingPanel 
              bookingStep={bookingStep} setBookingStep={setBookingStep}
              destination={destination} setDestination={setDestination}
              selectedVehicle={selectedVehicle} setSelectedVehicle={setSelectedVehicle}
              userName={userName} getGreeting={getGreeting} getFare={getFare}
              handleRequestRide={handleRequestRide} handleCancelRide={handleCancelRide}
              isRequestingRide={isRequestingRide}
              currentRide={currentRide}
              pickupLocation={pickupLocation}
              setDropoffLocation={setDropoffLocation}
              estimatedFare={estimatedFare} setEstimatedFare={setEstimatedFare}
              estimatedDistance={estimatedDistance} setEstimatedDistance={setEstimatedDistance}
              isCarpool={isCarpool} setIsCarpool={setIsCarpool}
            />
          </div>
          {/* Safe area for iOS */}
          <div className="h-[env(safe-area-inset-bottom)]" />
        </div>
      </div>

      {/* === DESKTOP LAYOUT: Side by Side === */}
      <div className="hidden lg:flex lg:flex-row w-full h-full">
        
        {/* LEFT: Map */}
        <div className="flex-1 relative">
          <Map 
            center={pickupLocation ? [pickupLocation.lat, pickupLocation.lng] : defaultCenter}
            zoom={15}
            className="h-full w-full"
            markers={pickupLocation ? [{ position: [pickupLocation.lat, pickupLocation.lng], popup: "You are here" }] : []}
          />
        </div>
        
        {/* RIGHT: Sidebar */}
        <div className="w-[420px] xl:w-[480px] h-full bg-white border-l border-slate-200 flex flex-col">
          
          {/* Header with User Info */}
          <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-lg font-bold">
                  {userInitials}
                </div>
                <div>
                  <h2 className="font-bold text-lg">{profile?.full_name || 'Guest'}</h2>
                  <p className="text-emerald-100 text-sm">{userPhone}</p>
                </div>
              </div>
              <div className="bg-white/20 px-3 py-1.5 rounded-full flex items-center gap-1.5">
                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                <span className="font-bold text-sm">{userPoints} Pts</span>
              </div>
            </div>
            
            {/* Quick Actions */}
            <div className="flex gap-2">
              <QuickAction icon={History} label="Rides" onClick={() => openPanel('rides')} />
              <QuickAction icon={CreditCard} label="Pay" onClick={() => openPanel('payment')} />
              <QuickAction icon={Gift} label="Rewards" onClick={() => openPanel('loyalty')} />
              <QuickAction icon={User} label="Profile" onClick={() => openPanel('profile')} />
              <QuickAction icon={Settings} label="Settings" onClick={() => openPanel('settings')} />
            </div>
          </div>

          {/* Booking Panel */}
          <div className="flex-1 overflow-y-auto p-6">
            {activePanel ? (
              <DesktopPanel activePanel={activePanel} setActivePanel={setActivePanel}
                isLoadingHistory={isLoadingHistory} rideHistory={rideHistory}
                userPhone={userPhone} userPoints={userPoints} userInitials={userInitials}
                user={user} profileForm={profileForm} setProfileForm={setProfileForm}
                handleSaveProfile={handleSaveProfile} isSavingProfile={isSavingProfile}
                appSettings={appSettings} setAppSettings={setAppSettings}
              />
            ) : (
              <BookingPanel 
                bookingStep={bookingStep} setBookingStep={setBookingStep}
                destination={destination} setDestination={setDestination}
                selectedVehicle={selectedVehicle} setSelectedVehicle={setSelectedVehicle}
                userName={userName} getGreeting={getGreeting} getFare={getFare}
                handleRequestRide={handleRequestRide} handleCancelRide={handleCancelRide}
                isRequestingRide={isRequestingRide}
                currentRide={currentRide}
                pickupLocation={pickupLocation}
                setDropoffLocation={setDropoffLocation}
                estimatedFare={estimatedFare} setEstimatedFare={setEstimatedFare}
                estimatedDistance={estimatedDistance} setEstimatedDistance={setEstimatedDistance}
              />
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-100 bg-slate-50">
            <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 p-3 text-red-600 hover:bg-red-50 rounded-xl transition font-medium">
              <LogOut className="w-4 h-4" />
              Log Out
            </button>
          </div>
        </div>
      </div>

      {/* === MOBILE SIDEBAR DRAWER === */}
      {menuOpen && <div className="lg:hidden fixed inset-0 bg-black/50 z-[55] backdrop-blur-sm" onClick={() => setMenuOpen(false)} />}
      
      <div className={`lg:hidden fixed top-0 left-0 h-full w-[80%] max-w-[280px] bg-white z-[60] shadow-2xl transform transition-transform duration-300 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 bg-emerald-600 text-white relative">
          <button onClick={() => setMenuOpen(false)} className="absolute top-3 right-3 p-1 text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mb-3 text-xl font-bold">{userInitials}</div>
          <h2 className="text-lg font-bold truncate">{profile?.full_name || 'Guest User'}</h2>
          <p className="text-emerald-100 text-xs">{userPhone}</p>
        </div>
        <nav className="p-3 space-y-1">
          <MenuItem icon={History} label="Your Rides" onClick={() => openPanel('rides')} />
          <MenuItem icon={CreditCard} label="Payment Methods" subtitle="M-Pesa Active" onClick={() => openPanel('payment')} />
          <MenuItem icon={Star} label="Loyalty Rewards" badge={userPoints > 100 ? "Redeem" : null} onClick={() => openPanel('loyalty')} />
          <MenuItem icon={User} label="Profile Settings" onClick={() => openPanel('profile')} />
          <div className="h-px bg-slate-100 my-3" />
          <button onClick={handleLogout} className="w-full flex items-center gap-3 p-2.5 rounded-xl text-red-600 hover:bg-red-50 transition">
            <LogOut className="w-4 h-4" /><span className="font-medium text-sm">Log Out</span>
          </button>
        </nav>
      </div>

      {/* === MOBILE PANEL OVERLAYS === */}
      {activePanel && (
        <div className="lg:hidden fixed inset-0 z-[2000] bg-white overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-slate-100 p-4 flex items-center gap-4">
            <button onClick={() => setActivePanel(null)} className="p-2 -ml-2 hover:bg-slate-100 rounded-full transition"><ArrowLeft className="w-5 h-5 text-slate-700" /></button>
            <h2 className="text-lg font-bold text-slate-900">{activePanel === 'rides' ? 'Your Rides' : activePanel === 'payment' ? 'Payment Methods' : activePanel === 'loyalty' ? 'Loyalty Rewards' : 'Profile Settings'}</h2>
          </div>
          <div className="p-4">
            <PanelContent activePanel={activePanel} isLoadingHistory={isLoadingHistory} rideHistory={rideHistory}
              userPhone={userPhone} userPoints={userPoints} userInitials={userInitials}
              user={user} profileForm={profileForm} setProfileForm={setProfileForm}
              handleSaveProfile={handleSaveProfile} isSavingProfile={isSavingProfile}
              appSettings={appSettings} setAppSettings={setAppSettings}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// === COMPONENTS ===

function QuickAction({ icon: Icon, label, onClick }) {
  return (
    <button onClick={onClick} className="flex-1 flex flex-col items-center gap-1 p-2 bg-white/10 rounded-xl hover:bg-white/20 transition">
      <Icon className="w-5 h-5" />
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}

function BookingPanel({ bookingStep, setBookingStep, destination, setDestination, selectedVehicle, setSelectedVehicle, userName, getGreeting, getFare, handleRequestRide, handleCancelRide, isRequestingRide, currentRide, pickupLocation, setDropoffLocation, estimatedFare, setEstimatedFare, estimatedDistance, setEstimatedDistance, isCarpool, setIsCarpool }) {
  if (bookingStep === 'idle') {
    return (
      <div>
        {/* Where to? Search Box */}
        <div 
          onClick={() => setBookingStep('selecting')} 
          className="bg-slate-100 p-4 rounded-xl flex items-center gap-4 mb-6 cursor-pointer hover:bg-slate-200 transition active:scale-[0.99]"
        >
          <div className="w-10 h-10 bg-slate-300 rounded-full flex items-center justify-center">
            <MapPin className="w-5 h-5 text-slate-600" />
          </div>
          <div className="flex-1">
            <div className="text-lg font-semibold text-slate-900">Where to?</div>
          </div>
          <div className="text-slate-400">
            <Navigation className="w-5 h-5" />
          </div>
        </div>
        
        {/* Quick Action Shortcuts - Uber Style */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <button className="bg-slate-50 p-4 rounded-2xl flex flex-col items-center gap-2 active:scale-95 transition">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <MapPin className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-slate-700">Home</span>
          </button>
          <button className="bg-slate-50 p-4 rounded-2xl flex flex-col items-center gap-2 active:scale-95 transition">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <MapPin className="w-6 h-6 text-purple-600" />
            </div>
            <span className="text-sm font-medium text-slate-700">Work</span>
          </button>
          <button className="bg-slate-50 p-4 rounded-2xl flex flex-col items-center gap-2 active:scale-95 transition">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
              <Star className="w-6 h-6 text-emerald-600" />
            </div>
            <span className="text-sm font-medium text-slate-700">Saved</span>
          </button>
        </div>
        
        {/* Recent Rides */}
        <h4 className="text-sm font-bold text-slate-500 mb-3 uppercase tracking-wide">Recent</h4>
        <div className="space-y-2">
          <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl cursor-pointer transition active:scale-[0.99]">
            <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center">
              <History className="w-5 h-5 text-slate-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-slate-900 truncate">Jkuat Main Gate</div>
              <div className="text-sm text-slate-500">Juja, Kiambu</div>
            </div>
            <Navigation className="w-4 h-4 text-slate-400 flex-shrink-0" />
          </div>
        </div>
      </div>
    );
  }

  if (bookingStep === 'selecting') {
    return <SelectingStep {...{ destination, setDestination, selectedVehicle, setSelectedVehicle, handleRequestRide, isRequestingRide, setBookingStep, pickupLocation, setDropoffLocation, estimatedFare, setEstimatedFare, estimatedDistance, setEstimatedDistance, isCarpool, setIsCarpool }} />;
  }

  if (bookingStep === 'searching') {
    return (
      <div className="text-center py-8">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-100 flex items-center justify-center"><Loader2 className="w-10 h-10 text-emerald-600 animate-spin" /></div>
        <h3 className="text-xl font-bold mb-2 text-slate-800">Finding your ride...</h3>
        <p className="text-sm text-slate-500 mb-6">Looking for nearby {selectedVehicle}s</p>
        <button onClick={handleCancelRide} className="text-red-600 font-medium hover:text-red-700">Cancel Request</button>
      </div>
    );
  }

  if (bookingStep === 'matched') {
    const driverName = currentRide?.driverName || 'Driver';
    const driverInitials = driverName.split(' ').map(n => n[0]).join('').toUpperCase() || 'D';
    const vehicleInfo = currentRide?.vehicleType || selectedVehicle;
    const plateNumber = currentRide?.plateNumber || 'Pending...';
    const driverPhone = currentRide?.driverPhone || '';
    
    return (
      <div>
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-full text-sm font-medium mb-3">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            Driver on the way
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-slate-800">Your ride is arriving!</h3>
        </div>
        <div className="bg-slate-50 p-5 rounded-2xl mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-emerald-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
              {driverInitials}
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-slate-900 text-lg">{driverName}</h4>
              <p className="text-sm text-slate-500 capitalize">{vehicleInfo} • {plateNumber}</p>
              <div className="flex items-center gap-1 mt-1.5">
                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                <span className="text-sm font-medium">4.8</span>
              </div>
            </div>
            {driverPhone && (
              <a href={`tel:${driverPhone}`} className="w-14 h-14 bg-emerald-600 rounded-full flex items-center justify-center text-white hover:bg-emerald-700 transition active:scale-95 shadow-lg">
                <Phone className="w-6 h-6" />
              </a>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between text-base mb-5 px-1">
          <span className="text-slate-500">Estimated fare</span>
          <span className="font-bold text-slate-900 text-lg">KES {currentRide?.fare || getFare(selectedVehicle)}</span>
        </div>
        <button onClick={handleCancelRide} className="w-full py-4 border-2 border-red-200 text-red-600 rounded-2xl font-bold hover:bg-red-50 transition active:scale-[0.98]">
          Cancel Ride
        </button>
      </div>
    );
  }
  return null;
}

function MobileBottomSheet(props) {
  return (
    <div className="bg-white rounded-t-3xl shadow-[0_-10px_50px_rgba(0,0,0,0.15)] max-h-[75vh] overflow-y-auto">
      {/* Enhanced grab handle */}
      <div className="sticky top-0 bg-white pt-3 pb-2 z-10">
        <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto" />
      </div>
      <div className="px-5 pb-8">
        <BookingPanel {...props} />
      </div>
      {/* Safe area for iOS home indicator */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </div>
  );
}

function SelectingStep({ destination, setDestination, selectedVehicle, setSelectedVehicle, handleRequestRide, isRequestingRide, setBookingStep, pickupLocation, setDropoffLocation, estimatedFare, setEstimatedFare, estimatedDistance, setEstimatedDistance, setPickupLocation, isCarpool, setIsCarpool }) {
  const [shareCode, setShareCode] = useState('');
  const [pickupText, setPickupText] = useState(pickupLocation ? '📍 Current Location' : '');
  const [localPickup, setLocalPickup] = useState(pickupLocation);
  const [dropoffCoords, setDropoffCoords] = useState(null);
  
  // Popular destinations with real GPS coordinates (Greater Nairobi area)
  const popularDestinations = [
    // Universities
    { name: 'Zetech Ruiru', lat: -1.1450, lng: 36.9610 },
    { name: 'JKUAT Main Gate', lat: -1.0922, lng: 37.0130 },
    { name: 'JKUAT Gate C', lat: -1.0950, lng: 37.0150 },
    { name: 'Kenyatta University', lat: -1.1800, lng: 36.9280 },
    { name: 'USIU Africa', lat: -1.2210, lng: 36.8880 },
    
    // Towns & Estates
    { name: 'Ruiru Town', lat: -1.1490, lng: 36.9600 },
    { name: 'Juja Town', lat: -1.0990, lng: 37.0100 },
    { name: 'Thika Town', lat: -1.0332, lng: 37.0693 },
    { name: 'Kahawa West', lat: -1.1850, lng: 36.9170 },
    { name: 'Kasarani', lat: -1.2200, lng: 36.8950 },
    
    // Malls & Shopping
    { name: 'Yaya Centre', lat: -1.2935, lng: 36.7840 },
    { name: 'Sarit Centre', lat: -1.2620, lng: 36.8030 },
    { name: 'Thika Road Mall', lat: -1.2190, lng: 36.8870 },
    { name: 'Garden City Mall', lat: -1.2280, lng: 36.8790 },
    { name: 'Two Rivers Mall', lat: -1.2150, lng: 36.8050 },
    { name: 'Juja City Mall', lat: -1.1010, lng: 37.0080 },
    { name: 'Gateway Mall Thika', lat: -1.0320, lng: 37.0690 },
    { name: 'The Hub Karen', lat: -1.3260, lng: 36.7120 },
    
    // Nairobi Central & Suburbs
    { name: 'Nairobi CBD', lat: -1.2864, lng: 36.8172 },
    { name: 'Westlands', lat: -1.2674, lng: 36.8115 },
    { name: 'Hurlingham', lat: -1.2930, lng: 36.7880 },
    { name: 'Kilimani', lat: -1.2890, lng: 36.7850 },
    { name: 'Lavington', lat: -1.2750, lng: 36.7680 },
    { name: 'Karen', lat: -1.3180, lng: 36.7060 },
    { name: 'Lang\'ata', lat: -1.3400, lng: 36.7350 },
    { name: 'JKIA Airport', lat: -1.3190, lng: 36.9280 },
  ];
  
  // Use centralized pricing utility with carpool support
  const getFare = (distance, vehicle) => calculateFare(distance, vehicle, isCarpool);
  const getSharedFare = () => Math.round((estimatedFare || 100) * (1 - CARPOOL_DISCOUNT));
  
  const handleSelectDestination = (dest) => {
    setDestination(dest.name);
    if (setDropoffLocation) setDropoffLocation({ lat: dest.lat, lng: dest.lng });
    
    if (pickupLocation) {
      const distance = calculateDistance(pickupLocation.lat, pickupLocation.lng, dest.lat, dest.lng);
      const fare = getFare(distance, selectedVehicle);
      if (setEstimatedDistance) setEstimatedDistance(distance);
      if (setEstimatedFare) setEstimatedFare(fare);
    }
  };
  
  const handleVehicleChange = (vehicle) => {
    setSelectedVehicle(vehicle);
    // Recalculate fare for new vehicle type
    if (estimatedDistance > 0) {
      const fare = getFare(estimatedDistance, vehicle);
      if (setEstimatedFare) setEstimatedFare(fare);
    }
  };
  
  const generateShareCode = () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setShareCode(code);
  };
  
  const canConfirm = destination && destination.length > 0 && estimatedFare > 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-slate-800">Book a Ride</h3>
        <button onClick={() => setBookingStep('idle')} className="text-slate-400 hover:text-slate-700 text-sm">Cancel</button>
      </div>
      
      {/* Pickup Location Input */}
      <div className="mb-3">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-2 h-2 bg-emerald-500 rounded-full" />
          <span className="text-sm text-slate-500">Pickup Point</span>
        </div>
        <div className="flex gap-2">
          <input 
            type="text" 
            value={pickupText}
            onChange={(e) => setPickupText(e.target.value)}
            placeholder="Where to pick you up? (e.g. Yaya Centre)" 
            className="flex-1 p-4 bg-slate-100 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500" 
          />
          <button
            onClick={() => {
              if (pickupText.trim()) {
                // Check if it's a known location
                const knownPickup = popularDestinations.find(d => 
                  d.name.toLowerCase().includes(pickupText.trim().toLowerCase())
                );
                
                if (knownPickup) {
                  // Use real coordinates from popular destinations
                  const newPickup = { lat: knownPickup.lat, lng: knownPickup.lng };
                  // Update parent state through setter if available
                  if (typeof setPickupLocation === 'function') {
                    setPickupLocation(newPickup);
                  }
                  setLocalPickup(newPickup);
                  setPickupText(knownPickup.name);
                  console.log(`Pickup set to ${knownPickup.name}: ${knownPickup.lat}, ${knownPickup.lng}`);
                  
                  // Recalculate distance if dropoff is already set
                  if (dropoffCoords) {
                    const distance = calculateDistance(newPickup.lat, newPickup.lng, dropoffCoords.lat, dropoffCoords.lng);
                    if (setEstimatedDistance) setEstimatedDistance(distance);
                    if (setEstimatedFare) setEstimatedFare(getFare(distance, selectedVehicle));
                    console.log(`Distance recalculated: ${distance.toFixed(2)}km`);
                  }
                } else {
                  alert(`"${pickupText}" not found. Try: Yaya Centre, Westlands, Nairobi CBD, etc.`);
                }
              } else {
                // Use GPS location
                if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      const gpsPickup = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                      setLocalPickup(gpsPickup);
                      setPickupText('📍 Current GPS Location');
                      console.log('GPS pickup:', gpsPickup);
                    },
                    () => {
                      setPickupText('📍 Default Location');
                      console.log('Using default pickup');
                    }
                  );
                }
              }
            }}
            className="px-6 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition flex items-center gap-2"
          >
            <MapPin className="w-5 h-5" />
            <span className="hidden sm:inline">Set</span>
          </button>
        </div>
      </div>
      
      {/* Destination Input with Confirm Button */}
      <div className="mb-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-2 h-2 bg-red-500 rounded-full" />
          <span className="text-sm text-slate-500">Drop-off Point</span>
        </div>
        <div className="flex gap-2">
          <input 
            type="text" 
            value={destination} 
            onChange={(e) => setDestination(e.target.value)} 
            placeholder="Where are you going? (e.g. Zetech Ruiru)" 
            className="flex-1 p-4 bg-slate-100 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500" 
          />
          <button
            onClick={() => {
              // Use localPickup if set, otherwise use pickupLocation from props
              const effectivePickup = localPickup || pickupLocation;
              
              if (destination.trim() && effectivePickup) {
                // Check if it's a popular destination with real coordinates (partial match)
                const popularDest = popularDestinations.find(d => 
                  d.name.toLowerCase().includes(destination.trim().toLowerCase()) ||
                  destination.trim().toLowerCase().includes(d.name.toLowerCase())
                );
                
                let dropoff;
                if (popularDest) {
                  // Use real GPS coordinates from popular destinations
                  dropoff = { lat: popularDest.lat, lng: popularDest.lng };
                  setDestination(popularDest.name); // Update to full name
                } else {
                  // For unknown destinations, create a reasonable dropoff point
                  const distanceKm = 3 + Math.random() * 4;
                  const angle = Math.random() * 2 * Math.PI;
                  dropoff = {
                    lat: effectivePickup.lat + (distanceKm / 111) * Math.cos(angle),
                    lng: effectivePickup.lng + (distanceKm / (111 * Math.cos(effectivePickup.lat * Math.PI / 180))) * Math.sin(angle)
                  };
                }
                
                // Save dropoff coordinates
                setDropoffCoords(dropoff);
                
                // Calculate REAL distance using Haversine formula
                const realDistance = calculateDistance(
                  effectivePickup.lat, effectivePickup.lng,
                  dropoff.lat, dropoff.lng
                );
                
                // Update state with real values
                if (setDropoffLocation) setDropoffLocation(dropoff);
                if (setEstimatedDistance) setEstimatedDistance(realDistance);
                if (setEstimatedFare) setEstimatedFare(getFare(realDistance, selectedVehicle));
                
                console.log(`Route: ${pickupText || 'Current Location'} → ${destination}`);
                console.log(`Distance: ${realDistance.toFixed(2)}km | Fare: KES ${getFare(realDistance, selectedVehicle)}`);
                console.log(`Distance calculated: ${realDistance.toFixed(2)}km from pickup to ${destination}`);
              }
            }}
            disabled={!destination.trim()}
            className="px-6 py-4 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Navigation className="w-5 h-5" />
            <span className="hidden sm:inline">Set</span>
          </button>
        </div>
      </div>
      
      {/* Popular Destinations */}
      <div className="mb-4">
        <h4 className="text-sm font-bold text-slate-500 mb-2 uppercase tracking-wide">Popular Destinations</h4>
        <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
          {popularDestinations.map((dest) => (
            <button
              key={dest.name}
              onClick={() => handleSelectDestination(dest)}
              className={`p-3 rounded-xl text-left transition text-sm ${
                destination === dest.name 
                  ? 'bg-emerald-100 border-2 border-emerald-500 text-emerald-800' 
                  : 'bg-slate-50 hover:bg-slate-100 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-slate-400" />
                <span className="font-medium truncate">{dest.name}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
      
      {/* Distance & Fare Preview */}
      {estimatedFare > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl mb-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-emerald-700 font-medium">Estimated Distance</div>
              <div className="text-lg font-bold text-emerald-900">{(estimatedDistance || 0).toFixed(1)} km</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-emerald-700 font-medium">Estimated Fare</div>
              <div className="text-2xl font-bold text-emerald-900">KES {estimatedFare}</div>
              <div className="text-xs text-emerald-600">@ KES 75/km</div>
            </div>
          </div>
        </div>
      )}
      
      {/* Vehicle Selection */}
      <div className="mb-4">
        <h4 className="text-sm font-bold text-slate-500 mb-2 uppercase tracking-wide">Select Vehicle</h4>
        <div className="grid grid-cols-3 gap-2">
          {[
            { type: 'boda', label: 'Boda', icon: Bike, min: 50 },
            { type: 'tuktuk', label: 'TukTuk', icon: Zap, min: 100 },
            { type: 'taxi', label: 'Taxi', icon: Car, min: 200 },
          ].map(({ type, label, icon: Icon, min }) => (
            <button
              key={type}
              onClick={() => handleVehicleChange(type)}
              className={`p-3 rounded-xl flex flex-col items-center gap-1 transition ${
                selectedVehicle === type 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-slate-50 hover:bg-slate-100'
              }`}
            >
              <Icon className={`w-6 h-6 ${selectedVehicle === type ? 'text-white' : 'text-slate-600'}`} />
              <span className="text-xs font-medium">{label}</span>
              <span className="text-[10px] opacity-70">min KES {min}</span>
            </button>
          ))}
        </div>
      </div>
      
      {/* Share Ride Toggle */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 p-4 rounded-xl mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-600" />
            <span className="font-medium text-slate-800">Share This Ride</span>
          </div>
          <button 
            onClick={() => { setIsCarpool(!isCarpool); if (!isCarpool && !shareCode) generateShareCode(); }}
            className={`w-12 h-6 rounded-full transition-colors ${isCarpool ? 'bg-purple-600' : 'bg-slate-300'}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${isCarpool ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </button>
        </div>
        
        {isCarpool && (
          <div className="mt-3 pt-3 border-t border-purple-200">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-purple-700">Save 40% by sharing!</span>
              <span className="font-bold text-purple-600">KES {getSharedFare(selectedVehicle)} each</span>
            </div>
            
            {/* Share Code */}
            <div className="bg-white p-3 rounded-lg mb-2">
              <div className="text-xs text-slate-500 mb-1">Your Share Code</div>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold tracking-wider text-purple-700">{shareCode}</span>
                <button 
                  onClick={() => navigator.clipboard?.writeText(shareCode)}
                  className="text-xs text-purple-600 font-medium px-3 py-1 bg-purple-50 rounded-full"
                >
                  Copy
                </button>
              </div>
            </div>
            
            {/* Join with Code */}
            {!showJoinInput ? (
              <button 
                onClick={() => setShowJoinInput(true)}
                className="text-xs text-purple-600 font-medium"
              >
                Or join someone else's ride →
              </button>
            ) : (
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Enter code..."
                  maxLength={6}
                  className="flex-1 p-2 bg-white border border-purple-200 rounded-lg text-sm uppercase tracking-wider"
                />
                <button className="px-3 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium">
                  Join
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Confirm Button */}
      <button 
        onClick={handleRequestRide} 
        disabled={!canConfirm || isRequestingRide} 
        className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isRequestingRide ? 'Requesting...' : (
          estimatedFare > 0 
            ? `Confirm Ride • KES ${isCarpool ? getSharedFare() : estimatedFare}`
            : 'Select a destination'
        )}
      </button>
    </div>
  );
}

function DesktopPanel(props) {
  return (
    <div>
      <button onClick={() => props.setActivePanel(null)} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 mb-4">
        <ArrowLeft className="w-4 h-4" /><span className="text-sm">Back to booking</span>
      </button>
      <PanelContent {...props} />
    </div>
  );
}

function PanelContent({ activePanel, isLoadingHistory, rideHistory, userPhone, userPoints, userInitials, user, profileForm, setProfileForm, handleSaveProfile, isSavingProfile, appSettings, setAppSettings }) {
  if (activePanel === 'rides') {
    return isLoadingHistory ? (
      <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 text-emerald-600 animate-spin" /></div>
    ) : rideHistory.length === 0 ? (
      <div className="text-center py-12 text-slate-500"><History className="w-12 h-12 mx-auto mb-3 text-slate-300" /><p>No rides yet</p></div>
    ) : (
      <div className="space-y-3">{rideHistory.map((ride) => (
        <div key={ride.id} className="bg-slate-50 p-4 rounded-xl">
          <div className="flex justify-between items-start mb-2">
            <span className={`text-xs font-medium px-2 py-0.5 rounded ${ride.status === 'completed' ? 'bg-green-100 text-green-700' : ride.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{ride.status}</span>
            <span className="font-bold">KES {ride.fare}</span>
          </div>
          <p className="text-xs text-slate-500">{new Date(ride.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
        </div>
      ))}</div>
    );
  }

  if (activePanel === 'payment') {
    return (
      <div className="space-y-4">
        <div className="bg-green-50 border-2 border-green-200 p-4 rounded-xl flex items-center gap-4">
          <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">M</div>
          <div className="flex-1"><h4 className="font-bold text-slate-900">M-Pesa</h4><p className="text-xs text-slate-500">{userPhone}</p></div>
          <CheckCircle className="w-6 h-6 text-green-600" />
        </div>
        <div className="bg-slate-50 p-4 rounded-xl flex items-center gap-4 opacity-50">
          <div className="w-12 h-12 bg-slate-200 rounded-xl flex items-center justify-center"><CreditCard className="w-6 h-6 text-slate-400" /></div>
          <div className="flex-1"><h4 className="font-medium text-slate-600">Card Payment</h4><p className="text-xs text-slate-400">Coming Soon</p></div>
        </div>
        <p className="text-xs text-slate-500 text-center mt-6">All payments are processed securely via Safaricom M-Pesa</p>
      </div>
    );
  }

  if (activePanel === 'loyalty') {
    return (
      <>
        <div className="text-center mb-6">
          <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4"><Star className="w-10 h-10 text-yellow-600 fill-yellow-600" /></div>
          <h3 className="text-3xl font-bold text-slate-900">{userPoints}</h3>
          <p className="text-slate-500">Loyalty Points</p>
        </div>
        <div className="bg-emerald-50 p-4 rounded-xl mb-6">
          <h4 className="font-bold text-emerald-800 mb-2">How to Earn Points</h4>
          <ul className="text-sm text-emerald-700 space-y-1"><li>• Complete a ride: +15 points</li><li>• Refer a friend: +50 points</li><li>• 5-star rating: +5 points</li></ul>
        </div>
        <h4 className="font-bold text-slate-800 mb-3">Redeem Rewards</h4>
        <div className="space-y-3">
          <RewardItem title="Free Boda Ride" points={100} available={userPoints >= 100} />
          <RewardItem title="50% Off TukTuk" points={75} available={userPoints >= 75} />
          <RewardItem title="KES 100 Credit" points={200} available={userPoints >= 200} />
        </div>
      </>
    );
  }

  if (activePanel === 'profile') {
    return (
      <div className="space-y-4">
        <div className="text-center mb-6">
          <div className="w-20 h-20 bg-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3 text-white text-2xl font-bold">{userInitials}</div>
          <p className="text-xs text-slate-500">{user?.email}</p>
        </div>
        <div><label className="text-sm font-medium text-slate-700 block mb-1">Full Name</label><input type="text" value={profileForm.full_name} onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })} className="w-full p-3 bg-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" /></div>
        <div><label className="text-sm font-medium text-slate-700 block mb-1">Phone Number</label><input type="tel" value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} className="w-full p-3 bg-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" /></div>
        <button onClick={handleSaveProfile} disabled={isSavingProfile} className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-700 transition disabled:opacity-50">
          {isSavingProfile ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}Save Changes
        </button>
      </div>
    );
  }

  if (activePanel === 'settings') {
    return (
      <div className="space-y-6">
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
          
          <button 
            onClick={() => window.open('#', '_blank')}
            className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-white rounded-full flex items-center justify-center text-emerald-600 shadow-sm"><Shield className="w-5 h-5" /></div>
              <span className="font-medium text-slate-700">Privacy & Security</span>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </button>
          
          <button 
            onClick={() => alert('Thank you for rating JiraniRide!')}
            className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition group mt-2"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-white rounded-full flex items-center justify-center text-orange-600 shadow-sm"><Star className="w-5 h-5" /></div>
              <span className="font-medium text-slate-700">Rate the App</span>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* App Info */}
        <div className="text-center pt-6 pb-2">
          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mx-auto mb-3 text-emerald-600 font-bold text-xl">JR</div>
          <h4 className="font-bold text-slate-900">JiraniRide</h4>
          <p className="text-xs text-slate-500">Version 2.0.1 (Build 452)</p>
        </div>
      </div>
    );
  }
  return null;
}

function MenuItem({ icon: Icon, label, subtitle, badge, onClick }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition group">
      <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 group-hover:bg-white group-hover:shadow-sm transition flex-shrink-0"><Icon className="w-4 h-4" /></div>
      <div className="flex-1 text-left min-w-0"><div className="font-semibold text-slate-800 text-sm truncate">{label}</div>{subtitle && <div className="text-xs text-slate-400 truncate">{subtitle}</div>}</div>
      {badge && <span className="text-[10px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full flex-shrink-0">{badge}</span>}
    </button>
  );
}

function VehicleOption({ name, price, time, icon: Icon, selected, onClick, shared }) {
  return (
    <div 
      onClick={onClick} 
      className={`flex items-center justify-between p-5 rounded-2xl border-2 cursor-pointer transition-all active:scale-[0.98] ${
        selected 
          ? 'border-emerald-600 bg-emerald-50/50 shadow-md shadow-emerald-100' 
          : 'border-transparent bg-slate-50 hover:bg-slate-100 active:bg-slate-200'
      }`}
    >
      <div className="flex items-center gap-4">
        <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center shadow-sm ${
          selected ? 'bg-white text-emerald-600' : 'bg-slate-200 text-slate-500'
        }`}>
          <Icon className="w-7 h-7 sm:w-8 sm:h-8" />
        </div>
        <div>
          <div className="font-bold text-slate-900 text-base sm:text-lg">{name}</div>
          <div className="text-sm text-slate-500">{time} away</div>
        </div>
      </div>
      <div className="text-right">
        <div className="font-bold text-xl text-slate-900">KES {price}</div>
        {shared && selected && <div className="text-xs text-purple-600 font-bold mt-1">40% OFF</div>}
        {!shared && selected && <div className="text-xs text-emerald-600 font-bold mt-1">BEST VALUE</div>}
      </div>
    </div>
  );
}

function RewardItem({ title, points, available }) {
  return (
    <div className={`flex items-center justify-between p-4 rounded-xl ${available ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50'}`}>
      <div className="flex items-center gap-3"><Gift className={`w-5 h-5 ${available ? 'text-emerald-600' : 'text-slate-400'}`} /><span className={`font-medium ${available ? 'text-slate-900' : 'text-slate-500'}`}>{title}</span></div>
      <div className="text-right"><span className={`text-sm font-bold ${available ? 'text-emerald-600' : 'text-slate-400'}`}>{points} pts</span>{available && <button className="block text-xs text-emerald-600 font-medium mt-0.5">Redeem →</button>}</div>
    </div>
  );
}
