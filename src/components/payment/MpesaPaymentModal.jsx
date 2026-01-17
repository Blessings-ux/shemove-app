// M-Pesa Payment Modal Component
import { useState, useEffect } from 'react';
import { Phone, CheckCircle, XCircle, Loader2, Smartphone } from 'lucide-react';
import { initiateMpesaPayment, pollPaymentStatus } from '../../services/mpesa';

export default function MpesaPaymentModal({ 
  isOpen, 
  onClose, 
  amount, 
  rideId, 
  phoneNumber: initialPhone,
  onPaymentSuccess,
  onPaymentFailed 
}) {
  const [phone, setPhone] = useState(initialPhone || '');
  const [step, setStep] = useState('input'); // input, processing, waiting, success, failed
  const [message, setMessage] = useState('');
  const [receipt, setReceipt] = useState('');

  useEffect(() => {
    if (initialPhone) {
      setPhone(initialPhone);
    }
  }, [initialPhone]);

  useEffect(() => {
    if (!isOpen) {
      // Reset state when modal closes
      setStep('input');
      setMessage('');
      setReceipt('');
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!phone || phone.length < 9) {
      setMessage('Please enter a valid phone number');
      return;
    }

    setStep('processing');
    setMessage('Initiating payment...');

    const result = await initiateMpesaPayment(phone, amount, rideId);

    if (!result.success) {
      setStep('failed');
      setMessage(result.message || 'Failed to initiate payment');
      return;
    }

    setStep('waiting');
    setMessage('Check your phone and enter M-Pesa PIN to complete payment');

    // Poll for payment status
    const pollResult = await pollPaymentStatus(result.checkoutRequestId, 30, 2000);

    if (pollResult.success) {
      setStep('success');
      setReceipt(pollResult.receipt);
      setMessage('Payment successful!');
      if (onPaymentSuccess) {
        onPaymentSuccess(pollResult.receipt);
      }
    } else {
      setStep('failed');
      setMessage(pollResult.status === 'timeout' 
        ? 'Payment timed out. Please try again.'
        : 'Payment was not completed');
      if (onPaymentFailed) {
        onPaymentFailed(pollResult.status);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={step === 'input' || step === 'success' || step === 'failed' ? onClose : undefined} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        
        {/* Header */}
        <div className="bg-emerald-600 p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg">M-Pesa Payment</h3>
              <p className="text-emerald-100 text-sm">Lipa na M-Pesa</p>
            </div>
          </div>
          <div className="mt-4 text-center">
            <div className="text-emerald-100 text-sm">Amount to Pay</div>
            <div className="text-3xl font-bold">KES {amount?.toLocaleString()}</div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'input' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  M-Pesa Phone Number
                </label>
                <div className="relative">
                  <Phone className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0712345678"
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-lg"
                    autoFocus
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Enter the phone number registered with M-Pesa
                </p>
              </div>

              {message && (
                <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm">
                  {message}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold text-lg hover:bg-emerald-700 transition-colors"
              >
                Pay KES {amount?.toLocaleString()}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 border border-slate-200 text-slate-600 rounded-xl font-medium hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </form>
          )}

          {step === 'processing' && (
            <div className="text-center py-8">
              <Loader2 className="w-16 h-16 text-emerald-600 animate-spin mx-auto mb-4" />
              <p className="text-slate-600">{message}</p>
            </div>
          )}

          {step === 'waiting' && (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Smartphone className="w-10 h-10 text-emerald-600 animate-pulse" />
              </div>
              <h4 className="font-bold text-lg text-slate-800 mb-2">Check Your Phone</h4>
              <p className="text-slate-600 mb-4">{message}</p>
              <div className="flex items-center justify-center gap-2 text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Waiting for confirmation...</span>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-12 h-12 text-emerald-600" />
              </div>
              <h4 className="font-bold text-xl text-slate-800 mb-2">Payment Successful!</h4>
              <p className="text-slate-600 mb-2">{message}</p>
              {receipt && (
                <p className="text-sm text-slate-500">
                  Receipt: <span className="font-mono font-bold">{receipt}</span>
                </p>
              )}
              <button
                onClick={onClose}
                className="mt-6 w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors"
              >
                Done
              </button>
            </div>
          )}

          {step === 'failed' && (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-12 h-12 text-red-600" />
              </div>
              <h4 className="font-bold text-xl text-slate-800 mb-2">Payment Failed</h4>
              <p className="text-slate-600 mb-4">{message}</p>
              <div className="space-y-3">
                <button
                  onClick={() => { setStep('input'); setMessage(''); }}
                  className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors"
                >
                  Try Again
                </button>
                <button
                  onClick={onClose}
                  className="w-full py-3 border border-slate-200 text-slate-600 rounded-xl font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
