import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Shield, Coins, Wallet, Clock, ChevronRight, Phone, Mail, Instagram, Twitter, Facebook, Menu, X } from 'lucide-react';

const LandingPage = () => {
  const [activeTab, setActiveTab] = useState('passenger');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900 overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed w-full bg-white/90 backdrop-blur-sm z-50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <span className="text-2xl font-bold text-purple-600">SheMove</span>
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-gray-600 hover:text-purple-600 font-medium">Features</a>
              <a href="#sacco" className="text-gray-600 hover:text-purple-600 font-medium">Rewards</a>
              <Link to="/login" className="text-gray-600 hover:text-purple-600 font-medium">Log in</Link>
              <Link to="/signup" className="bg-purple-600 text-white px-5 py-2 rounded-full font-medium hover:bg-purple-700 transition-colors">
                Sign up
              </Link>
            </div>

            {/* Mobile Hamburger Button */}
            <button 
              className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 shadow-lg">
            <div className="px-4 py-4 space-y-3">
              <a 
                href="#features" 
                className="block text-gray-600 hover:text-purple-600 font-medium py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Features
              </a>
              <a 
                href="#sacco" 
                className="block text-gray-600 hover:text-purple-600 font-medium py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Rewards
              </a>
              <hr className="my-2 border-gray-100" />
              <Link 
                to="/login" 
                className="block text-gray-600 hover:text-purple-600 font-medium py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Log in
              </Link>
              <Link 
                to="/signup" 
                className="block bg-purple-600 text-white px-5 py-3 rounded-full font-medium hover:bg-purple-700 transition-colors text-center"
                onClick={() => setMobileMenuOpen(false)}
              >
                Sign up
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-24 pb-12 sm:pt-32 sm:pb-20 lg:pt-40 lg:pb-28 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5 pointer-events-none" 
             style={{ backgroundImage: 'radial-gradient(#7c3aed 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Left Content */}
            <div className="text-center lg:text-left order-2 lg:order-1">
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-gray-900 leading-tight mb-4 sm:mb-6">
                Safe Rides by Women, for <span className="text-purple-600">Women.</span>
              </h1>
              <p className="text-base sm:text-lg md:text-xl text-gray-600 mb-6 sm:mb-8 max-w-2xl mx-auto lg:mx-0">
                The women-focused transport app that rewards you for every trip. Safe, reliable, and built for Kenya.
              </p>
              
              <div className="flex flex-col sm:flex-row justify-center lg:justify-start gap-4 mb-6 sm:mb-10">
                <button className="transition-transform hover:scale-105">
                 <img src="/assets/app-store-badges.png" alt="Download App" className="h-10 sm:h-12 object-contain mx-auto lg:mx-0" />
                </button>
              </div>
            </div>

            {/* Right Mockup */}
            <div className="relative mx-auto lg:mr-0 max-w-[240px] sm:max-w-[280px] lg:max-w-[380px] order-1 lg:order-2">
              <div className="absolute -inset-4 bg-purple-100 rounded-full blur-3xl opacity-30 animate-pulse"></div>
              <img 
                src="/assets/iphone-mockup.png" 
                alt="SheMove App Interface" 
                className="relative z-10 w-full drop-shadow-2xl transform rotate-[-5deg] hover:rotate-0 transition-transform duration-500"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Toggle Section */}
      <section id="features" className="py-12 sm:py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">Designed for Everyone</h2>
            <div className="inline-flex bg-gray-200 p-1 rounded-full">
              <button
                onClick={() => setActiveTab('passenger')}
                className={`px-4 sm:px-6 py-2 rounded-full font-medium transition-all text-sm sm:text-base ${
                  activeTab === 'passenger' 
                    ? 'bg-white text-purple-600 shadow-md' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                For Passengers
              </button>
              <button
                onClick={() => setActiveTab('driver')}
                className={`px-4 sm:px-6 py-2 rounded-full font-medium transition-all text-sm sm:text-base ${
                  activeTab === 'driver' 
                    ? 'bg-white text-purple-600 shadow-md' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                For Drivers
              </button>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            {activeTab === 'passenger' ? (
              <>
                <FeatureCard 
                  icon={<MobileMoneyIcon />} 
                  title="M-Pesa Integration" 
                  desc="Pay seamlessly with M-Pesa. No need to carry cash or look for change."
                />
                <FeatureCard 
                  icon={<MapPin className="w-6 h-6 sm:w-8 sm:h-8 text-purple-600" />} 
                  title="Real-time Tracking" 
                  desc="Share your ride details with friends and family for added safety."
                />
                <FeatureCard 
                  icon={<Coins className="w-6 h-6 sm:w-8 sm:h-8 text-purple-600" />} 
                  title="Earn Loyalty Points" 
                  desc="Get rewarded for every trip. Redeem points for discounts and free rides."
                />
              </>
            ) : (
              <>
                <FeatureCard 
                  icon={<Wallet className="w-6 h-6 sm:w-8 sm:h-8 text-purple-600" />} 
                  title="Low Commission" 
                  desc="Keep more of what you earn. We charge the lowest rates in the market."
                />
                <FeatureCard 
                  icon={<Clock className="w-6 h-6 sm:w-8 sm:h-8 text-purple-600" />} 
                  title="Instant Payouts" 
                  desc="Withdraw your earnings to M-Pesa instantly, any time of the day."
                />
                <FeatureCard 
                  icon={<Shield className="w-6 h-6 sm:w-8 sm:h-8 text-purple-600" />} 
                  title="Safety First" 
                  desc="Verified passengers and strict safety protocols to keep you secure."
                />
              </>
            )}
          </div>
        </div>
      </section>

      {/* Loyalty & Rewards Programme */}
      <section id="sacco" className="py-16 sm:py-24 bg-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Section Header */}
          <div className="text-center mb-10 sm:mb-16">
            <div className="inline-flex items-center gap-2 bg-purple-50 px-4 py-2 rounded-full mb-4 border border-purple-100">
              <Coins className="w-4 h-4 text-purple-600" />
              <span className="text-purple-700 font-semibold text-sm">SheMove Rewards Programme</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Every Ride Builds Your Future
            </h2>
            <p className="text-gray-500 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
              Kenya's first SACCO-inspired rewards system built into a ride-hailing platform. 
              Earn loyalty points on every trip and unlock real financial benefits.
            </p>
          </div>

          {/* Benefits Grid */}
          <div className="grid sm:grid-cols-3 gap-6 sm:gap-8 mb-10 sm:mb-14">
            <div className="text-center p-6 rounded-2xl bg-purple-50/60 border border-purple-100/50">
              <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Coins className="w-7 h-7 text-purple-600" />
              </div>
              <h3 className="font-bold text-gray-900 text-lg mb-2">Earn Per Kilometre</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                Accumulate loyalty points automatically for every kilometre you ride or drive with SheMove.
              </p>
            </div>
            <div className="text-center p-6 rounded-2xl bg-purple-50/60 border border-purple-100/50">
              <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Wallet className="w-7 h-7 text-purple-600" />
              </div>
              <h3 className="font-bold text-gray-900 text-lg mb-2">Redeem Anytime</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                Convert your points into free rides, fare discounts, or withdraw directly to M-Pesa.
              </p>
            </div>
            <div className="text-center p-6 rounded-2xl bg-purple-50/60 border border-purple-100/50">
              <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Shield className="w-7 h-7 text-purple-600" />
              </div>
              <h3 className="font-bold text-gray-900 text-lg mb-2">Community Driven</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                Built on SACCO principles — the more our community grows, the greater the rewards for everyone.
              </p>
            </div>
          </div>

          {/* CTA Card */}
          <div className="bg-gradient-to-br from-purple-700 to-purple-900 rounded-2xl sm:rounded-3xl p-8 sm:p-12 text-white relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 rounded-full bg-purple-600 opacity-30 blur-3xl"></div>
            <div className="absolute bottom-0 left-0 -ml-12 -mb-12 w-36 h-36 rounded-full bg-purple-400 opacity-15 blur-3xl"></div>
            
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="text-center md:text-left">
                <h3 className="text-2xl sm:text-3xl font-bold mb-3">Ready to start earning?</h3>
                <p className="text-purple-200 text-base sm:text-lg max-w-lg">
                  Sign up today and earn loyalty points from your very first ride. It's free to join.
                </p>
              </div>
              <Link to="/signup" className="inline-flex items-center bg-white text-purple-700 px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-bold hover:bg-purple-50 transition-colors text-sm sm:text-base shadow-lg whitespace-nowrap">
                Join SheMove <ChevronRight className="ml-2 w-5 h-5" />
              </Link>
            </div>
          </div>

        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 pt-12 sm:pt-16 pb-6 sm:pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 sm:gap-12 mb-8 sm:mb-12">
            <div className="col-span-2 md:col-span-1">
              <span className="text-xl sm:text-2xl font-bold text-purple-600 block mb-3 sm:mb-4">SheMove</span>
              <p className="text-gray-500 text-sm">
                Moving Kenya forward, one safe ride at a time.
              </p>
            </div>
            
            <div>
              <h3 className="font-bold text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base">Company</h3>
              <ul className="space-y-2 sm:space-y-3 text-sm text-gray-500">
                <li><a href="#" className="hover:text-purple-600">About Us</a></li>
                <li><a href="#" className="hover:text-purple-600">Careers</a></li>
                <li><a href="#" className="hover:text-purple-600">Press</a></li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base">Community</h3>
              <ul className="space-y-2 sm:space-y-3 text-sm text-gray-500">
                <li><a href="#" className="hover:text-purple-600">Safety</a></li>
                <li><a href="#" className="hover:text-purple-600">Driver Requirements</a></li>
                <li><a href="#" className="hover:text-purple-600">Blog</a></li>
              </ul>
            </div>

            <div className="col-span-2 md:col-span-1">
              <h3 className="font-bold text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base">Contact</h3>
              <ul className="space-y-2 sm:space-y-3 text-sm text-gray-500">
                <li className="flex items-center"><Mail className="w-4 h-4 mr-2 flex-shrink-0" /> help@shemove.co.ke</li>
                <li className="flex items-center"><Phone className="w-4 h-4 mr-2 flex-shrink-0" /> +254 700 000 000</li>
                <li className="flex space-x-4 mt-4">
                  <a href="#" className="text-gray-400 hover:text-purple-600"><Twitter className="w-5 h-5"/></a>
                  <a href="#" className="text-gray-400 hover:text-purple-600"><Facebook className="w-5 h-5"/></a>
                  <a href="#" className="text-gray-400 hover:text-purple-600"><Instagram className="w-5 h-5"/></a>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-100 pt-6 sm:pt-8 flex flex-col md:flex-row justify-between items-center text-xs sm:text-sm text-gray-400 gap-4">
            <p>&copy; {new Date().getFullYear()} SheMove Technologies. All rights reserved.</p>
            <div className="flex space-x-4 sm:space-x-6">
              <a href="#" className="hover:text-gray-600">Privacy Policy</a>
              <a href="#" className="hover:text-gray-600">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

// Sub-components
const FeatureCard = ({ icon, title, desc }) => (
  <div className="bg-white p-5 sm:p-6 lg:p-8 rounded-xl sm:rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-gray-100">
    <div className="bg-purple-50 w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-lg sm:rounded-xl flex items-center justify-center mb-4 sm:mb-6">
      {icon}
    </div>
    <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2 sm:mb-3">{title}</h3>
    <p className="text-gray-600 leading-relaxed text-sm sm:text-base">{desc}</p>
  </div>
);

const MobileMoneyIcon = () => (
    <svg className="w-6 h-6 sm:w-8 sm:h-8 text-purple-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
)

export default LandingPage;
