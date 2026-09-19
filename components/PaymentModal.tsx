import React, { useState } from 'react';
import { CreditCard, Lock, CheckCircle2, ShieldCheck, X, Calendar } from 'lucide-react';

interface PaymentModalProps {
  creatorName: string;
  price: number;
  onClose: () => void;
  onSuccess: () => void;
}

const PaymentModal: React.FC<PaymentModalProps> = ({ creatorName, price, onClose, onSuccess }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    if (parts.length) {
      return parts.join(' ');
    } else {
      return value;
    }
  };

  const handleCardChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setCardNumber(formatCardNumber(e.target.value));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    
    // Simulate API processing delay
    setTimeout(() => {
        setIsProcessing(false);
        setIsSuccess(true);
        setTimeout(() => {
            onSuccess();
        }, 1500);
    }, 2000);
  };

  if (isSuccess) {
      return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
            <div className="bg-[#111] border border-green-500/30 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl shadow-green-900/20 transform scale-100 transition-all">
                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
                    <CheckCircle2 className="w-10 h-10 text-green-500" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Payment Successful!</h3>
                <p className="text-zinc-400 mb-4">You now have full access to {creatorName}'s exclusive content.</p>
                <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-green-500 h-full w-full animate-[width_1.5s_ease-in-out]"></div>
                </div>
            </div>
        </div>
      );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
      <div className="bg-black border border-zinc-800 w-full max-w-md rounded-3xl shadow-2xl relative overflow-hidden flex flex-col max-h-[calc(100vh-2rem)]">
        
        {/* Header */}
        <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-[#111]/50">
            <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-yellow-500" />
                <span className="font-bold text-white tracking-wide">Secure Checkout</span>
            </div>
            <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
                <X className="w-6 h-6" />
            </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1 scrollbar-thin">
            {/* Order Summary */}
            <div className="bg-[#111] rounded-xl p-4 flex justify-between items-center border border-zinc-800">
                <div>
                    <p className="text-sm text-zinc-400">Monthly Subscription</p>
                    <p className="text-white font-bold">{creatorName}</p>
                </div>
                <div className="text-right">
                    <p className="text-xl font-bold text-white">R{price}</p>
                    <p className="text-xs text-zinc-500">Auto-renews</p>
                </div>
            </div>

            {/* Payment Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Card Number</label>
                    <div className="relative">
                        <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                        <input 
                            type="text" 
                            value={cardNumber}
                            onChange={handleCardChange}
                            placeholder="0000 0000 0000 0000"
                            maxLength={19}
                            className="w-full bg-black border border-zinc-800 rounded-xl pl-12 pr-4 py-3.5 text-white focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500 focus:outline-none transition-all font-mono"
                            required
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Expiry</label>
                        <div className="relative">
                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                            <input 
                                type="text" 
                                value={expiry}
                                onChange={(e) => setExpiry(e.target.value)}
                                placeholder="MM/YY"
                                maxLength={5}
                                className="w-full bg-black border border-zinc-800 rounded-xl pl-12 pr-4 py-3.5 text-white focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500 focus:outline-none transition-all font-mono"
                                required
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">CVC</label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                            <input 
                                type="text" 
                                value={cvc}
                                onChange={(e) => setCvc(e.target.value)}
                                placeholder="123"
                                maxLength={3}
                                className="w-full bg-black border border-zinc-800 rounded-xl pl-12 pr-4 py-3.5 text-white focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500 focus:outline-none transition-all font-mono"
                                required
                            />
                        </div>
                    </div>
                </div>

                <div className="pt-4">
                    <button 
                        type="submit" 
                        disabled={isProcessing}
                        className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-yellow-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                        {isProcessing ? (
                            <div className="flex items-center space-x-2">
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                <span>Processing...</span>
                            </div>
                        ) : (
                            <span>Subscribe & Pay R{price}</span>
                        )}
                    </button>
                    <div className="flex items-center justify-center mt-4 space-x-2 text-zinc-500">
                        <Lock className="w-3 h-3" />
                        <p className="text-[10px] uppercase tracking-widest">256-Bit SSL Encrypted</p>
                    </div>
                </div>
            </form>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;