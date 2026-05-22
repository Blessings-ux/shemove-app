// src/features/driver/DriverDashboard.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Power, MapPin, Navigation, DollarSign, Bell, Shield, Menu, X, Phone, Star, Settings, Moon, Globe, ChevronRight, ArrowLeft, LogOut, RefreshCw, CheckCircle } from 'lucide-react';
import { supabase, isAbortError } from '../../services/supabase';
import { useWakeLock } from '../../hooks/useWakeLock';
import { useAuthStore } from '../../store/authStore';
import { reverseGeocode } from '../../services/geocoding';
import PickupFlowStepper from '../../components/pickup/PickupFlowStepper';
import {
  canDriverMarkArrived,
  canDriverStartRide,
  getDriverStatusMessage,
} from '../../utils/pickupFlow';

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
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Verification State
  const [verificationGender, setVerificationGender] = useState('');
  const [idPhotoFile, setIdPhotoFile] = useState(null);
  const [selfieFile, setSelfieFile] = useState(null);
  const [isSubmittingVerification, setIsSubmittingVerification] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState('unverified');

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

  // Consolidated data fetching
  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const loadDashboardData = async () => {
      setIsLoading(true);
      console.log('⚡ Loading dashboard data...');
      
      try {
        // 1. Fetch Profile (if needed) & Driver Data & Rides in PARALLEL
        const promises = [
          !profile ? supabase.from('profiles').select('*').eq('id', user.id).single() : Promise.resolve({ data: profile }),
          supabase.from('drivers').select('*').eq('id', user.id).single(),
          supabase.from('rides').select('*').or(`driver_id.eq.${user.id},and(status.eq.pending)`).order('created_at', { ascending: false }).limit(20),
          supabase.from('rides').select('fare').eq('driver_id', user.id).eq('status', 'completed').gte('created_at', new Date(new Date().setHours(0,0,0,0)).toISOString()) // Today's earnings
        ];

        const [profileRes, driverRes, ridesRes, earningsRes] = await Promise.all(promises);

        // Update Profile Store if fetched
        if (!profile && profileRes.data) {
          useAuthStore.setState({ profile: profileRes.data });
        }

        // Handle Driver Data
        if (driverRes.data) {
          setDriverData(driverRes.data);
          setIsOnline(driverRes.data.is_online);
          // Initialize verification state
          if (driverRes.data.verification_status) {
            setVerificationStatus(driverRes.data.verification_status);
          }
          if (driverRes.data.gender) {
            setVerificationGender(driverRes.data.gender);
          }
        } else if (driverRes.error?.code === 'PGRST116') {
          // Auto-create driver record if missing
          const { data: newDriver } = await supabase
            .from('drivers')
            .insert({ id: user.id, vehicle_type: 'boda', is_online: false })
            .select()
            .single();
          if (newDriver) setDriverData(newDriver);
        }

        // Handle Rides
        if (ridesRes.data) {
          // Filter active rides (accepted/in_progress)
          const active = ridesRes.data.filter(r => 
            r.driver_id === user.id && ['accepted', 'arrived', 'passenger_arrived', 'in_progress'].includes(r.status)
          );
          setActiveRides(active);
        }

        // Handle Earnings (This is a quick approximation, better to use RPC for exacts)
        if (earningsRes.data) {
          const total = earningsRes.data.reduce((sum, r) => sum + (r.fare || 0), 0);
          setTodayEarnings(total);
        }

      } catch (err) {
        if (!isAbortError(err)) {
          console.error('Data load error:', err);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboardData();
  }, [user]); // Only run on user change (mount)

  // Subscribe to ride requests when online
  // Allow subscription even with active rides IF they are shared
  const canAcceptMore = activeRides.length === 0 || activeRides.every(r => r.ride_type === 'shared');

  // Polling fallback - fetch pending rides every 5 seconds
  useEffect(() => {
    let pollInterval;
    
    const fetchPendingRides = async () => {
      if (!isOnline || !user || !canAcceptMore || incomingRequest) return;
      
      try {
        // Fetch pending rides that don't have a driver yet
        const { data: pendingRides, error } = await supabase
          .from('rides')
          .select('*')
          .eq('status', 'pending')
          .is('driver_id', null)
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (error) {
          console.log('Polling error:', error.message);
          return;
        }
        
        if (pendingRides && pendingRides.length > 0 && !incomingRequest) {
          const ride = pendingRides[0];
          console.log('🔔 PENDING RIDE FOUND (via polling):', ride);
          
          // Fetch passenger details
          const { data: passenger } = await supabase
            .from('profiles')
            .select('full_name, phone')
            .eq('id', ride.passenger_id)
            .single();
          
          setIncomingRequest({
            ...ride,
            passengerName: passenger?.full_name || 'Passenger',
            passengerPhone: passenger?.phone || '',
            rating: 4.8,
            pickup: 'Pickup Location',
            dropoff: 'Dropoff Location',
            distance: `${((ride.fare || 150) / 75).toFixed(1)} km`,
            paymentMethod: 'M-Pesa'
          });
        }
      } catch (err) {
        console.log('Polling error:', err);
      }
    };

    if (isOnline && user && canAcceptMore) {
      console.log('🔄 Starting ride polling (every 5 seconds)...');
      // Initial fetch
      fetchPendingRides();
      // Poll every 5 seconds
      pollInterval = setInterval(fetchPendingRides, 5000);
    }

    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [isOnline, user, canAcceptMore, incomingRequest]);

  // Subscribe to updates on active rides (e.g. passenger confirms arrival)
  useEffect(() => {
    if (!user || activeRides.length === 0) return;

    const rideIds = activeRides.map((r) => r.id);
    const channel = supabase
      .channel(`driver-active-rides-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rides',
        },
        (payload) => {
          if (!rideIds.includes(payload.new.id)) return;
          setActiveRides((prev) =>
            prev.map((ride) =>
              ride.id === payload.new.id ? { ...ride, ...payload.new } : ride,
            ),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, activeRides.map((r) => r.id).join(',')]);

  // Real-time subscription (backup - works if Supabase realtime is enabled)
  useEffect(() => {
    let channel;
    if (isOnline && user && canAcceptMore) {
      console.log('🚗 Driver is ONLINE - subscribing to pending rides...');
      
      channel = supabase
        .channel(`driver-${user.id}-rides-${Date.now()}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'rides'
        }, async (payload) => {
          // Only process pending rides without a driver
          if (payload.new.status !== 'pending' || payload.new.driver_id) {
            return;
          }
          
          console.log('🔔 NEW RIDE REQUEST RECEIVED (realtime):', payload.new);
          
          // If driver already has solo ride, ignore new requests
          if (activeRides.some(r => r.ride_type === 'solo')) {
            console.log('Ignoring request - driver has active solo ride');
            return;
          }
          
          // Skip if we already have an incoming request
          if (incomingRequest) {
            console.log('Ignoring - already have incoming request');
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
            distance: `${((payload.new.fare || 150) / 75).toFixed(1)} km`,
            paymentMethod: 'M-Pesa'
          });
        })
        .subscribe((status) => {
          console.log('📡 Subscription status:', status);
          if (status === 'SUBSCRIBED') {
            console.log('✅ Successfully listening for ride requests!');
          } else if (status === 'CHANNEL_ERROR') {
            console.error('❌ Subscription error - polling will handle requests');
          }
        });
    }
    
    return () => {
      if (channel) {
        console.log('🔌 Cleaning up ride subscription');
        supabase.removeChannel(channel);
      }
    };
  }, [isOnline, user, canAcceptMore, activeRides, incomingRequest]);

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
        if (!isAbortError(upsertError)) {
          console.error('Error creating/updating driver:', upsertError);
          alert(`Could not go online: ${upsertError.message}`);
        }
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
        
        // Notify passenger their ride was accepted
        if (incomingRequest.passenger_id) {
          try {
            await supabase.from('notifications').insert({
              user_id: incomingRequest.passenger_id,
              type: 'ride_accepted',
              title: 'Driver Found! 🚗',
              message: `${profile?.full_name || 'A driver'} has accepted your ride request. They're on the way!`,
              data: { ride_id: incomingRequest.id }
            });
          } catch (notifErr) {
            console.log('Notification skipped:', notifErr);
          }
        }
      }
    } catch (error) {
      console.error('Error accepting ride:', error);
    }
  };

  const declineRide = () => {
    setIncomingRequest(null);
  };

  // Mark driver as arrived at pickup location
  const markArrived = async (rideId) => {
    try {
      const { error } = await supabase
        .from('rides')
        .update({ 
          status: 'arrived',
          driver_arrived_at: new Date().toISOString()
        })
        .eq('id', rideId);
      
      if (!error) {
        setActiveRides(prev => prev.map(r => 
          r.id === rideId ? { ...r, status: 'arrived' } : r
        ));
        
        // Notify passenger
        const ride = activeRides.find(r => r.id === rideId);
        if (ride?.passenger_id) {
          await supabase.from('notifications').insert({
            user_id: ride.passenger_id,
            type: 'driver_arrived',
            title: 'Driver Arrived! 📍',
            message: `${profile?.full_name || 'Your driver'} has arrived at the pickup location.`,
            data: { ride_id: rideId }
          });
        }
      }
    } catch (error) {
      console.error('Error marking arrived:', error);
    }
  };

  // Start the ride (passenger confirmed at pickup)
  const startRide = async (rideId) => {
    const ride = activeRides.find((r) => r.id === rideId);
    if (!ride || !canDriverStartRide(ride.status)) return;

    try {
      const { error } = await supabase
        .from('rides')
        .update({ 
          status: 'in_progress',
          ride_started_at: new Date().toISOString()
        })
        .eq('id', rideId);
      
      if (!error) {
        setActiveRides(prev => prev.map(r => 
          r.id === rideId ? { ...r, status: 'in_progress' } : r
        ));
        
        // Notify passenger
        const ride = activeRides.find(r => r.id === rideId);
        if (ride?.passenger_id) {
          await supabase.from('notifications').insert({
            user_id: ride.passenger_id,
            type: 'ride_started',
            title: 'Ride Started! 🚗',
            message: 'Your trip has begun. Enjoy the ride!',
            data: { ride_id: rideId }
          });
        }
      }
    } catch (error) {
      console.error('Error starting ride:', error);
    }
  };

  const completeRide = async (rideId) => {
    const rideToComplete = activeRides.find(r => r.id === rideId);
    if (!rideToComplete) return;
    
    try {
      const { error } = await supabase
        .from('rides')
        .update({ 
          status: 'completed', 
          payment_status: 'paid',
          ride_completed_at: new Date().toISOString()
        })
        .eq('id', rideId);
      
      if (!error) {
        setTodayEarnings(prev => prev + (rideToComplete.fare || 0));
        setActiveRides(prev => prev.filter(r => r.id !== rideId));
        
        // Award loyalty points to passenger (10 points per 100 KES)
        const pointsEarned = Math.floor((rideToComplete.fare || 0) / 10);
        if (pointsEarned > 0 && rideToComplete.passenger_id) {
          try {
            await supabase.rpc('increment_loyalty_points', { 
              user_id: rideToComplete.passenger_id, 
              points: pointsEarned 
            });
            console.log(`Awarded ${pointsEarned} loyalty points to passenger`);
          } catch (rpcErr) {
            // Fallback: RPC doesn't exist, skip loyalty points
            console.log('Loyalty points RPC not available:', rpcErr);
          }
        }
        
        // Notify passenger their ride is complete
        if (rideToComplete.passenger_id) {
          try {
            await supabase.from('notifications').insert({
              user_id: rideToComplete.passenger_id,
              type: 'ride_completed',
              title: 'Ride Completed! ✅',
              message: `Thanks for riding! You earned ${pointsEarned} loyalty points. Total fare: KES ${rideToComplete.fare}`,
              data: { ride_id: rideId, points: pointsEarned }
            });
          } catch (notifErr) {
            console.log('Notification skipped:', notifErr);
          }
        }
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

  // Handle verification submission
  const handleSubmitVerification = async () => {
    if (!verificationGender) {
      alert('Please select your gender.');
      return;
    }
    if (!idPhotoFile && !driverData?.id_photo_url) {
      alert('Please upload your ID / Passport photo.');
      return;
    }
    if (!selfieFile && !driverData?.selfie_url) {
      alert('Please upload a selfie with your ID.');
      return;
    }

    setIsSubmittingVerification(true);
    try {
      let idPhotoUrl = driverData?.id_photo_url || null;
      let selfieUrl = driverData?.selfie_url || null;

      // Upload ID photo if new file selected
      if (idPhotoFile) {
        const idExt = idPhotoFile.name.split('.').pop();
        const idPath = `${user.id}/id_photo.${idExt}`;
        const { error: idUploadError } = await supabase.storage
          .from('driver-verifications')
          .upload(idPath, idPhotoFile, { upsert: true });
        if (idUploadError) throw idUploadError;

        const { data: idUrlData } = supabase.storage
          .from('driver-verifications')
          .getPublicUrl(idPath);
        idPhotoUrl = idUrlData?.publicUrl || idPath;
      }

      // Upload selfie if new file selected
      if (selfieFile) {
        const selfieExt = selfieFile.name.split('.').pop();
        const selfiePath = `${user.id}/selfie.${selfieExt}`;
        const { error: selfieUploadError } = await supabase.storage
          .from('driver-verifications')
          .upload(selfiePath, selfieFile, { upsert: true });
        if (selfieUploadError) throw selfieUploadError;

        const { data: selfieUrlData } = supabase.storage
          .from('driver-verifications')
          .getPublicUrl(selfiePath);
        selfieUrl = selfieUrlData?.publicUrl || selfiePath;
      }

      // Update driver record
      const { error: updateError } = await supabase
        .from('drivers')
        .update({
          gender: verificationGender,
          id_photo_url: idPhotoUrl,
          selfie_url: selfieUrl,
          verification_status: 'pending'
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setVerificationStatus('pending');
      setDriverData(prev => ({
        ...prev,
        gender: verificationGender,
        id_photo_url: idPhotoUrl,
        selfie_url: selfieUrl,
        verification_status: 'pending'
      }));
      alert('Verification submitted! Our team will review your documents shortly.');
    } catch (error) {
      console.error('Verification submission error:', error);
      alert(`Verification failed: ${error.message || 'Please try again.'}`);
    } finally {
      setIsSubmittingVerification(false);
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
    console.log('Creating carpool offer...', carpoolOffer);
    
    try {
      // Use Supabase RPC or direct insert - geography columns need proper format
      const offerData = {
        driver_id: user.id,
        pickup_name: carpoolOffer.pickup_name,
        dropoff_name: carpoolOffer.dropoff_name,
        departure_time: new Date(carpoolOffer.departure_time).toISOString(),
        total_seats: parseInt(carpoolOffer.total_seats),
        available_seats: parseInt(carpoolOffer.total_seats),
        fare_per_seat: parseFloat(carpoolOffer.fare_per_seat),
        vehicle_type: driverData?.vehicle_type || 'taxi',
        status: 'open'
      };

      console.log('Offer data to insert:', offerData);

      // Insert without geography columns first (they're optional in the schema)
      const { data, error } = await supabase
        .from('carpool_offers')
        .insert(offerData)
        .select()
        .single();

      if (error) {
        if (!isAbortError(error)) {
          console.error('Supabase error:', error);
          alert(`Failed to create offer: ${error.message}`);
        }
        return;
      }

      console.log('Carpool offer created successfully:', data);
      setActiveOffers(prev => [...prev, data]);
      setShowCarpoolForm(false);
      setCarpoolOffer({
        pickup_name: '',
        dropoff_name: '',
        departure_time: '',
        total_seats: 4,
        fare_per_seat: 100
      });
      alert('Carpool offer created successfully!');
    } catch (error) {
      console.error('Error creating offer:', error);
      alert(`Failed to create offer: ${error.message || 'Unknown error'}`);
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

  // Fetch and subscribe to notifications
  useEffect(() => {
    if (!user) return;

    const fetchNotifications = async () => {
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10);
        
        if (error) {
          if (!isAbortError(error)) {
            console.error('Error fetching notifications:', error);
          }
          return;
        }
        if (data) setNotifications(data);
      } catch (err) {
        console.error('Notifications fetch failed:', err);
      }
    };

    fetchNotifications();

    const channel = supabase
      .channel(`driver-notifications-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        console.log('New notification:', payload.new);
        setNotifications(prev => [payload.new, ...prev]);
        // Show notification alert
        setShowNotifications(true);
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
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
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-700 rounded-xl flex items-center justify-center text-white shadow-inner">
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
                onClick={() => setShowNotifications(!showNotifications)}
                className="bg-white p-3 rounded-2xl shadow-lg hover:bg-slate-50 transition active:scale-95 border border-slate-200/50 text-slate-700 relative"
              >
                <Bell className="w-5 h-5" />
                {notifications.filter(n => !n.read).length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                    {notifications.filter(n => !n.read).length}
                  </span>
                )}
              </button>
              <button 
                onClick={openSettings}
                className="bg-white p-3 rounded-2xl shadow-lg hover:bg-slate-50 transition active:scale-95 border border-slate-200/50 text-slate-700"
              >
                <Settings className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Notification Dropdown */}
          {showNotifications && (
            <div className="mt-3 bg-white rounded-2xl shadow-xl border border-slate-200 max-h-80 overflow-y-auto">
              <div className="p-3 border-b border-slate-100 flex items-center justify-between">
                <h4 className="font-bold text-slate-800">Notifications</h4>
                <div className="flex gap-2">
                  {notifications.filter(n => !n.read).length > 0 && (
                    <button 
                      onClick={async () => {
                        const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
                        if (unreadIds.length > 0) {
                          await supabase
                            .from('notifications')
                            .update({ read: true })
                            .in('id', unreadIds);
                          setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                        }
                      }}
                      className="text-xs text-purple-600 font-bold hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                  <button onClick={() => setShowNotifications(false)} className="p-1 hover:bg-slate-100 rounded-full">
                    <X className="w-4 h-4 text-slate-500" />
                  </button>
                </div>
              </div>
              {notifications.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {notifications.map(n => (
                    <div 
                      key={n.id} 
                      className={`p-3 cursor-pointer hover:bg-slate-50 ${!n.read ? 'bg-purple-50' : ''}`}
                      onClick={async () => {
                        if (!n.read) {
                          await supabase.from('notifications').update({ read: true }).eq('id', n.id);
                          setNotifications(prev => prev.map(notif => 
                            notif.id === n.id ? { ...notif, read: true } : notif
                          ));
                        }
                      }}
                    >
                      <div className="font-medium text-slate-800 text-sm">{n.title}</div>
                      <div className="text-xs text-slate-500 mt-1">{n.message}</div>
                      <div className="text-xs text-slate-400 mt-1">
                        {new Date(n.created_at).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-slate-500 text-sm">
                  No notifications yet
                </div>
              )}
            </div>
          )}
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
              markArrived={markArrived}
              startRide={startRide}
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
            <div className="bg-gradient-to-br from-purple-600 to-purple-800 rounded-2xl p-5 text-white shadow-lg shadow-purple-200/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-xs font-bold ring-2 ring-white/10">
                  KES
                </div>
                <div>
                  <div className="text-purple-100 text-sm font-medium">Total Earnings Today</div>
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
              markArrived={markArrived}
              startRide={startRide}
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
            <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 bg-purple-600 text-white rounded-full flex items-center justify-center text-xl font-bold">
                    {profile?.full_name?.charAt(0) || 'D'}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">{profile?.full_name || 'Driver'}</div>
                    <div className="text-xs text-purple-600 font-medium capitalize">
                      {driverData?.vehicle_type || 'Boda'} Driver
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setIsEditingProfile(!isEditingProfile)}
                  className="text-purple-600 text-sm font-bold hover:underline"
                >
                  {isEditingProfile ? 'Cancel' : 'Edit'}
                </button>
              </div>
              
              {/* Editable Form */}
              {isEditingProfile && (
                <div className="space-y-3 pt-3 border-t border-purple-200">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Full Name</label>
                    <input 
                      type="text"
                      value={profileForm.full_name}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, full_name: e.target.value }))}
                      className="w-full mt-1 p-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Phone Number</label>
                    <input 
                      type="tel"
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="+254 7XX XXX XXX"
                      className="w-full mt-1 p-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Vehicle Type</label>
                    <select 
                      value={profileForm.vehicle_type}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, vehicle_type: e.target.value }))}
                      className="w-full mt-1 p-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                      className="w-full mt-1 p-3 bg-white border border-slate-200 rounded-xl text-slate-800 uppercase focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <button 
                    onClick={handleSaveProfile}
                    disabled={isSavingProfile}
                    className="w-full mt-2 py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition disabled:opacity-50"
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

            {/* Driver Verification Section */}
            <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-purple-600" />
                  <h3 className="font-bold text-slate-900">Driver Verification</h3>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  verificationStatus === 'verified' ? 'bg-green-100 text-green-700' :
                  verificationStatus === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                  verificationStatus === 'rejected' ? 'bg-red-100 text-red-700' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  {verificationStatus === 'verified' ? '✅ Verified' :
                   verificationStatus === 'pending' ? '⏳ Pending Review' :
                   verificationStatus === 'rejected' ? '❌ Rejected' :
                   'Not Submitted'}
                </span>
              </div>

              {verificationStatus === 'verified' ? (
                <p className="text-sm text-green-700 font-medium">Your identity has been verified. You are approved to drive on SheMove.</p>
              ) : (
                <>
                  <p className="text-xs text-slate-500 mb-4">
                    SheMove requires all drivers to be verified female drivers. Please confirm your gender and upload a valid ID for verification.
                  </p>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase">Gender</label>
                      <select
                        value={verificationGender}
                        onChange={(e) => setVerificationGender(e.target.value)}
                        className="w-full mt-1 p-3 bg-white border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        disabled={verificationStatus === 'pending'}
                      >
                        <option value="">Select gender</option>
                        <option value="female">Female</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase">ID / Passport Photo</label>
                      <div className="mt-1 border-2 border-dashed border-purple-200 rounded-xl p-4 text-center bg-white hover:border-purple-400 transition cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          id="id-upload"
                          disabled={verificationStatus === 'pending'}
                          onChange={(e) => setIdPhotoFile(e.target.files?.[0] || null)}
                        />
                        <label htmlFor="id-upload" className="cursor-pointer">
                          {idPhotoFile ? (
                            <div className="text-purple-700 font-bold text-sm">✅ {idPhotoFile.name}</div>
                          ) : driverData?.id_photo_url ? (
                            <div className="text-purple-700 font-bold text-sm">✅ ID Photo uploaded</div>
                          ) : (
                            <>
                              <div className="text-purple-600 font-bold text-sm">Click to upload</div>
                              <div className="text-xs text-slate-400 mt-1">JPG, PNG up to 5MB</div>
                            </>
                          )}
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase">Selfie with ID</label>
                      <div className="mt-1 border-2 border-dashed border-purple-200 rounded-xl p-4 text-center bg-white hover:border-purple-400 transition cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          id="selfie-upload"
                          disabled={verificationStatus === 'pending'}
                          onChange={(e) => setSelfieFile(e.target.files?.[0] || null)}
                        />
                        <label htmlFor="selfie-upload" className="cursor-pointer">
                          {selfieFile ? (
                            <div className="text-purple-700 font-bold text-sm">✅ {selfieFile.name}</div>
                          ) : driverData?.selfie_url ? (
                            <div className="text-purple-700 font-bold text-sm">✅ Selfie uploaded</div>
                          ) : (
                            <>
                              <div className="text-purple-600 font-bold text-sm">Click to upload selfie</div>
                              <div className="text-xs text-slate-400 mt-1">Hold your ID next to your face</div>
                            </>
                          )}
                        </label>
                      </div>
                    </div>
                    {verificationStatus !== 'pending' && (
                      <button
                        onClick={handleSubmitVerification}
                        disabled={isSubmittingVerification || !verificationGender}
                        className="w-full py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition disabled:opacity-50"
                      >
                        {isSubmittingVerification ? 'Uploading...' : 'Submit for Verification'}
                      </button>
                    )}
                    {verificationStatus === 'rejected' && (
                      <p className="text-xs text-red-500 font-medium text-center">
                        Your previous submission was rejected. Please re-upload valid documents.
                      </p>
                    )}
                  </div>
                </>
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
                    <div className="flex gap-2 mt-1">
                      <input 
                        type="text"
                        value={carpoolOffer.pickup_name}
                        onChange={(e) => setCarpoolOffer(prev => ({ ...prev, pickup_name: e.target.value }))}
                        placeholder="e.g. Westlands"
                        className="flex-1 p-3 bg-white border border-slate-200 rounded-xl"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          if (navigator.geolocation) {
                            navigator.geolocation.getCurrentPosition(
                              async (position) => {
                                const { latitude, longitude } = position.coords;
                                try {
                                  const address = await reverseGeocode(latitude, longitude);
                                  setCarpoolOffer(prev => ({ ...prev, pickup_name: address || 'Current Location' }));
                                } catch (err) {
                                  setCarpoolOffer(prev => ({ ...prev, pickup_name: 'Current Location' }));
                                }
                              },
                              (err) => {
                                console.error('Geolocation error:', err);
                                // Fallback to default Nairobi location
                                setCarpoolOffer(prev => ({ ...prev, pickup_name: 'Nairobi CBD (Default)' }));
                              },
                              { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 }
                            );
                          } else {
                            // Fallback for browsers without geolocation
                            setCarpoolOffer(prev => ({ ...prev, pickup_name: 'Nairobi CBD (Default)' }));
                          }
                        }}
                        className="px-3 py-2 bg-purple-100 text-purple-700 rounded-xl text-xs font-bold hover:bg-purple-200 transition whitespace-nowrap"
                      >
                        📍 Use My Location
                      </button>
                    </div>
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
                          <span className="font-bold text-purple-600">KES {offer.fare_per_seat}</span>
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
                <div className={`w-10 h-6 rounded-full relative transition-colors ${appSettings.notifications ? 'bg-purple-500' : 'bg-slate-300'}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${appSettings.notifications ? 'right-1' : 'left-1'}`} />
                </div>
              </button>
            </div>

            {/* Support & Legal */}
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Support & Legal</h3>
              
              <a href="#" target="_blank" className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition group">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-white rounded-full flex items-center justify-center text-purple-600 shadow-sm"><Shield className="w-5 h-5" /></div>
                  <span className="font-medium text-slate-700">Privacy & Security</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-purple-500 transition" />
              </a>

              <button onClick={() => alert('Rating feature coming soon!')} className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition group mt-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-white rounded-full flex items-center justify-center text-yellow-500 shadow-sm"><Star className="w-5 h-5" /></div>
                  <span className="font-medium text-slate-700">Rate the App</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-purple-500 transition" />
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
              <h4 className="font-bold text-slate-900">SheMove Driver</h4>
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
        <div className="absolute top-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-purple-700 text-white p-4 shadow-xl z-20 rounded-none md:rounded-lg">
            <div className="flex items-start gap-4">
              <Navigation className="w-10 h-10 mt-1 opacity-90" />
              <div>
                <div className="text-purple-100 font-medium text-sm">
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

function DashboardContent({ isOnline, handleGoOnline, handleGoOffline, incomingRequest, setIncomingRequest, acceptRide, activeRides, markArrived, startRide, completeRide, isLoading }) {
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
                 <div className="flex-1">
                   <div className="text-lg font-bold text-slate-900 leading-none mb-1">{incomingRequest.passengerName}</div>
                   <div className="text-slate-500 text-sm">{incomingRequest.passengerPhone || 'Phone not available'}</div>
                   <div className="text-slate-400 text-xs uppercase font-bold mt-1">Passenger</div>
                 </div>
                 {incomingRequest.passengerPhone && (
                   <a 
                     href={`tel:${incomingRequest.passengerPhone}`}
                     className="flex items-center gap-1 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg font-bold text-xs hover:bg-purple-200 transition"
                   >
                     <Phone className="w-3.5 h-3.5" />
                     Call
                   </a>
                 )}
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
          {activeRides.map((ride) => {
            const statusMessage = getDriverStatusMessage(ride);
            const trackingStatus = ['accepted', 'arrived', 'passenger_arrived', 'in_progress'].includes(ride.status)
              ? ride.status
              : 'accepted';

            return (
            <div key={ride.id} className="bg-slate-50 border border-slate-100 rounded-xl p-4">
              <div className="mb-4 rounded-xl bg-slate-900 px-4 py-3 text-white">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-300">
                  Pickup coordination
                </div>
                <div className="mt-1 font-bold">{statusMessage.title}</div>
                <div className="mt-1 text-sm text-slate-300">{statusMessage.subtitle}</div>
              </div>

              <div className="mb-4">
                <PickupFlowStepper status={trackingStatus} perspective="driver" />
              </div>

              {/* Status Badge */}
              <div className="flex items-center justify-between mb-3">
                <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                  ride.status === 'accepted' ? 'bg-blue-100 text-blue-700' :
                  ride.status === 'arrived' ? 'bg-amber-100 text-amber-700' :
                  ride.status === 'passenger_arrived' ? 'bg-green-100 text-green-700' :
                  ride.status === 'in_progress' ? 'bg-purple-100 text-purple-700' :
                  'bg-slate-100 text-slate-700'
                }`}>
                  {ride.status === 'accepted' ? 'En Route to Pickup' :
                   ride.status === 'arrived' ? 'Waiting for Passenger' :
                   ride.status === 'passenger_arrived' ? 'Passenger Is Here' :
                   ride.status === 'in_progress' ? 'Ride in Progress' :
                   ride.status}
                </div>
                {ride.ride_type === 'shared' && (
                  <div className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-xs font-bold">
                    SHARED
                  </div>
                )}
              </div>

              {/* Passenger Strip */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
                    {ride.passengerName?.charAt(0) || 'P'}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">{ride.passengerName}</div>
                    <div className="text-sm text-slate-600">
                      {ride.passengerPhone || 'No phone available'}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {ride.dropoff}
                    </div>
                  </div>
                </div>
                {ride.passengerPhone && (
                  <a 
                    href={`tel:${ride.passengerPhone}`} 
                    className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-xl font-bold text-sm hover:bg-purple-200 transition"
                  >
                    <Phone className="w-4 h-4" />
                    Call
                  </a>
                )}
              </div>

              {/* Fare & Action Buttons */}
              <div className="flex items-center justify-between">
                <div className="font-black text-xl text-purple-700">KES {ride.fare}</div>
                
                {/* Status-based action buttons */}
                {canDriverMarkArrived(ride.status) && (
                  <button 
                    onClick={() => markArrived(ride.id)}
                    className="px-4 py-2 bg-amber-500 text-white rounded-lg font-bold text-sm hover:bg-amber-600 transition flex items-center gap-2"
                  >
                    <MapPin className="w-4 h-4" />
                    Arrived at Pickup
                  </button>
                )}
                
                {ride.status === 'arrived' && (
                  <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                    Waiting for passenger to tap I'm Here
                  </div>
                )}

                {canDriverStartRide(ride.status) && (
                  <button 
                    onClick={() => startRide(ride.id)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 transition flex items-center gap-2"
                  >
                    <Navigation className="w-4 h-4" />
                    Start Ride
                  </button>
                )}
                
                {ride.status === 'in_progress' && (
                  <button 
                    onClick={() => completeRide(ride.id)}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg font-bold text-sm hover:bg-purple-700 transition flex items-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    End Ride
                  </button>
                )}
              </div>
            </div>
          );})}

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
