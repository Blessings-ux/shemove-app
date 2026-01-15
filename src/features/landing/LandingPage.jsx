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
              <span className="text-2xl font-bold text-emerald-600">JiraniRide</span>
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-gray-600 hover:text-emerald-600 font-medium">Features</a>
              <a href="#sacco" className="text-gray-600 hover:text-emerald-600 font-medium">SACCO Rewards</a>
              <a href="#fleet" className="text-gray-600 hover:text-emerald-600 font-medium">Fleet</a>
              <Link to="/login" className="text-gray-600 hover:text-emerald-600 font-medium">Log in</Link>
              <Link to="/signup" className="bg-emerald-600 text-white px-5 py-2 rounded-full font-medium hover:bg-emerald-700 transition-colors">
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
                className="block text-gray-600 hover:text-emerald-600 font-medium py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Features
              </a>
              <a 
                href="#sacco" 
                className="block text-gray-600 hover:text-emerald-600 font-medium py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                SACCO Rewards
              </a>
              <a 
                href="#fleet" 
                className="block text-gray-600 hover:text-emerald-600 font-medium py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Fleet
              </a>
              <hr className="my-2 border-gray-100" />
              <Link 
                to="/login" 
                className="block text-gray-600 hover:text-emerald-600 font-medium py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Log in
              </Link>
              <Link 
                to="/signup" 
                className="block bg-emerald-600 text-white px-5 py-3 rounded-full font-medium hover:bg-emerald-700 transition-colors text-center"
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
             style={{ backgroundImage: 'radial-gradient(#10b981 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Left Content */}
            <div className="text-center lg:text-left order-2 lg:order-1">
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-gray-900 leading-tight mb-4 sm:mb-6">
                Safe, Affordable Rides for Your <span className="text-emerald-600">Community.</span>
              </h1>
              <p className="text-base sm:text-lg md:text-xl text-gray-600 mb-6 sm:mb-8 max-w-2xl mx-auto lg:mx-0">
                The student-friendly transport app that rewards you for every trip. Fast, reliable, and built for Kenya.
              </p>
              
              <div className="flex flex-col sm:flex-row justify-center lg:justify-start gap-4 mb-6 sm:mb-10">
                <button className="transition-transform hover:scale-105">
                 <img src="/assets/app-store-badges.png" alt="Download App" className="h-10 sm:h-12 object-contain mx-auto lg:mx-0" />
                </button>
              </div>
            </div>

            {/* Right Mockup */}
            <div className="relative mx-auto lg:mr-0 max-w-[240px] sm:max-w-[280px] lg:max-w-[380px] order-1 lg:order-2">
              <div className="absolute -inset-4 bg-emerald-100 rounded-full blur-3xl opacity-30 animate-pulse"></div>
              <img 
                src="/assets/iphone-mockup.png" 
                alt="JiraniRide App Interface" 
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
                    ? 'bg-white text-emerald-600 shadow-md' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                For Passengers
              </button>
              <button
                onClick={() => setActiveTab('driver')}
                className={`px-4 sm:px-6 py-2 rounded-full font-medium transition-all text-sm sm:text-base ${
                  activeTab === 'driver' 
                    ? 'bg-white text-emerald-600 shadow-md' 
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
                  icon={<MapPin className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-600" />} 
                  title="Real-time Tracking" 
                  desc="Share your ride details with friends and family for added safety."
                />
                <FeatureCard 
                  icon={<Coins className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-600" />} 
                  title="Earn Loyalty Points" 
                  desc="Get rewarded for every trip. Redeem points for discounts and free rides."
                />
              </>
            ) : (
              <>
                <FeatureCard 
                  icon={<Wallet className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-600" />} 
                  title="Low Commission" 
                  desc="Keep more of what you earn. We charge the lowest rates in the market."
                />
                <FeatureCard 
                  icon={<Clock className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-600" />} 
                  title="Instant Payouts" 
                  desc="Withdraw your earnings to M-Pesa instantly, any time of the day."
                />
                <FeatureCard 
                  icon={<Shield className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-600" />} 
                  title="Safety First" 
                  desc="Verified passengers and strict safety protocols to keep you secure."
                />
              </>
            )}
          </div>
        </div>
      </section>

      {/* SACCO Rewards */}
      <section id="sacco" className="py-12 sm:py-20 bg-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-emerald-900 rounded-2xl sm:rounded-3xl p-6 sm:p-8 md:p-12 lg:p-16 text-white relative overflow-hidden shadow-2xl">
            {/* Decorative circles */}
            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-60 sm:w-80 h-60 sm:h-80 rounded-full bg-emerald-800 opacity-50 blur-3xl"></div>
            <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-40 sm:w-60 h-40 sm:h-60 rounded-full bg-emerald-500 opacity-20 blur-3xl"></div>

            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8 sm:gap-12">
              <div className="md:w-1/2 text-center md:text-left">
                <div className="inline-flex items-center gap-2 bg-emerald-800/50 px-3 sm:px-4 py-2 rounded-full mb-4 sm:mb-6 border border-emerald-700">
                  <Coins className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />
                  <span className="text-emerald-100 font-medium text-sm sm:text-base">JiraniRide SACCO Rewards</span>
                </div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6">Ride more, Earn more.</h2>
                <p className="text-emerald-100 text-base sm:text-lg mb-6 sm:mb-8 leading-relaxed">
                  Join the first ride-hailing community that functions like a SACCO. 
                  Accumulate points for every kilometer and redeem them for free trips or cash back.
                </p>
                <Link to="/signup" className="inline-flex items-center bg-yellow-400 text-emerald-900 px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl font-bold hover:bg-yellow-300 transition-colors text-sm sm:text-base">
                  Start Earning Today <ChevronRight className="ml-2 w-4 h-4 sm:w-5 sm:h-5" />
                </Link>
              </div>
              <div className="md:w-1/2 flex justify-center">
                <div className="relative">
                   <div className="absolute inset-0 bg-yellow-400 blur-[60px] opacity-20 rounded-full"></div>
                   <Coins className="w-32 h-32 sm:w-40 sm:h-40 lg:w-48 lg:h-48 text-yellow-400 drop-shadow-lg" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Fleet Owner Section */}
      <section id="fleet" className="py-12 sm:py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">For Fleet Owners</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Own multiple vehicles? Manage your entire fleet from one powerful dashboard.
            </p>
          </div>
          
          <div className="grid lg:grid-cols-2 gap-8 sm:gap-12 lg:gap-16 items-center">
            <div className="order-2 lg:order-1">
              <div className="bg-white rounded-xl sm:rounded-2xl p-6 shadow-lg border border-gray-200">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                  <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                  <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                  <span className="text-gray-500 text-sm ml-2">Fleet Dashboard</span>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                    <div className="text-gray-500 text-xs mb-1">Weekly Revenue</div>
                    <div className="text-2xl font-bold text-emerald-600">KES 127,500</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <div className="text-gray-500 text-xs mb-1">Active Drivers</div>
                    <div className="text-2xl font-bold text-gray-900">8 <span className="text-sm text-gray-400">/ 12</span></div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-sm font-bold text-white">J</div>
                      <div>
                        <div className="font-medium text-sm text-gray-900">John Kamau</div>
                        <div className="text-xs text-gray-500">KBC 234E • Bodaboda</div>
                      </div>
                    </div>
                    <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-1 rounded-full font-medium">Online</span>
                  </div>
                  <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-sm font-bold text-white">M</div>
                      <div>
                        <div className="font-medium text-sm text-gray-900">Mary Wanjiku</div>
                        <div className="text-xs text-gray-500">KBD 567F • Car</div>
                      </div>
                    </div>
                    <span className="bg-gray-200 text-gray-600 text-xs px-2 py-1 rounded-full font-medium">Offline</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2 text-center lg:text-left">
              <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-4 sm:mb-6">Manage your fleet effortlessly.</h3>
              <p className="text-gray-600 text-base sm:text-lg mb-6 sm:mb-8">
                Track your drivers in real-time, monitor daily earnings, and grow your transport business with powerful analytics.
              </p>
              <ul className="space-y-3 sm:space-y-4 mb-6 sm:mb-8 inline-block text-left">
                <li className="flex items-center text-gray-700 text-sm sm:text-base">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full mr-3"></div>
                  Real-time vehicle tracking & status
                </li>
                <li className="flex items-center text-gray-700 text-sm sm:text-base">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full mr-3"></div>
                  Automated weekly revenue reports
                </li>
                <li className="flex items-center text-gray-700 text-sm sm:text-base">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full mr-3"></div>
                  Add or suspend drivers instantly
                </li>
                <li className="flex items-center text-gray-700 text-sm sm:text-base">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full mr-3"></div>
                  No monthly fees - just results
                </li>
              </ul>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link to="/signup" className="inline-flex items-center justify-center bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors">
                  Register as Fleet Owner <ChevronRight className="w-4 h-4 ml-1" />
                </Link>
                <Link to="/login" className="inline-flex items-center justify-center border border-gray-300 text-gray-700 px-6 py-3 rounded-xl font-medium hover:bg-gray-100 transition-colors">
                  Fleet Owner Login
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 pt-12 sm:pt-16 pb-6 sm:pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 sm:gap-12 mb-8 sm:mb-12">
            <div className="col-span-2 md:col-span-1">
              <span className="text-xl sm:text-2xl font-bold text-emerald-600 block mb-3 sm:mb-4">JiraniRide</span>
              <p className="text-gray-500 text-sm">
                Moving Kenya forward, one safe ride at a time.
              </p>
            </div>
            
            <div>
              <h3 className="font-bold text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base">Company</h3>
              <ul className="space-y-2 sm:space-y-3 text-sm text-gray-500">
                <li><a href="#" className="hover:text-emerald-600">About Us</a></li>
                <li><a href="#" className="hover:text-emerald-600">Careers</a></li>
                <li><a href="#" className="hover:text-emerald-600">Press</a></li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base">Community</h3>
              <ul className="space-y-2 sm:space-y-3 text-sm text-gray-500">
                <li><a href="#" className="hover:text-emerald-600">Safety</a></li>
                <li><a href="#" className="hover:text-emerald-600">Driver Requirements</a></li>
                <li><a href="#" className="hover:text-emerald-600">Blog</a></li>
              </ul>
            </div>

            <div className="col-span-2 md:col-span-1">
              <h3 className="font-bold text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base">Contact</h3>
              <ul className="space-y-2 sm:space-y-3 text-sm text-gray-500">
                <li className="flex items-center"><Mail className="w-4 h-4 mr-2 flex-shrink-0" /> help@jiraniride.co.ke</li>
                <li className="flex items-center"><Phone className="w-4 h-4 mr-2 flex-shrink-0" /> +254 700 000 000</li>
                <li className="flex space-x-4 mt-4">
                  <a href="#" className="text-gray-400 hover:text-emerald-600"><Twitter className="w-5 h-5"/></a>
                  <a href="#" className="text-gray-400 hover:text-emerald-600"><Facebook className="w-5 h-5"/></a>
                  <a href="#" className="text-gray-400 hover:text-emerald-600"><Instagram className="w-5 h-5"/></a>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-100 pt-6 sm:pt-8 flex flex-col md:flex-row justify-between items-center text-xs sm:text-sm text-gray-400 gap-4">
            <p>&copy; {new Date().getFullYear()} JiraniRide Technologies. All rights reserved.</p>
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
    <div className="bg-emerald-50 w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-lg sm:rounded-xl flex items-center justify-center mb-4 sm:mb-6">
      {icon}
    </div>
    <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2 sm:mb-3">{title}</h3>
    <p className="text-gray-600 leading-relaxed text-sm sm:text-base">{desc}</p>
  </div>
);

const MobileMoneyIcon = () => (
    <svg className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
)

export default LandingPage;
