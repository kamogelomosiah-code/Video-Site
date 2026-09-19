import React, { useState } from 'react';
import { X, Upload, ShieldCheck, Lock, AlertCircle } from 'lucide-react';

interface VerificationModalProps {
  onClose: () => void;
}

const VerificationModal: React.FC<VerificationModalProps> = ({ onClose }) => {
  const [step, setStep] = useState(1);
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = () => {
    setIsUploading(true);
    setTimeout(() => {
        setIsUploading(false);
        setStep(2);
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#111] border border-zinc-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-fade-in-up flex flex-col max-h-[calc(100vh-2rem)]">
        <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-black/50">
          <h3 className="text-xl font-bold text-white flex items-center">
            <ShieldCheck className="w-6 h-6 mr-2 text-yellow-500" />
            Identity Verification
          </h3>
          <button type="button" aria-label="Close modal" onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-8 overflow-y-auto flex-1 scrollbar-thin">
            {step === 1 ? (
                <>
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 mb-6 flex items-start">
                        <Lock className="w-5 h-5 text-yellow-400 mt-0.5 mr-3 flex-shrink-0" />
                        <p className="text-sm text-red-200">
                            We use bank-grade encryption to process your ID. Your documents are never stored permanently on our public servers and are only used for initial verification compliance.
                        </p>
                    </div>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-zinc-300 mb-2">Government Issued ID</label>
                            <div className="border-2 border-dashed border-zinc-700 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:border-yellow-500/50 hover:bg-yellow-500/5 transition-all cursor-pointer group" onClick={handleUpload}>
                                <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mb-3 group-hover:bg-yellow-500 group-hover:text-white transition-colors">
                                    <Upload className="w-6 h-6 text-zinc-400 group-hover:text-white" />
                                </div>
                                <p className="text-zinc-300 font-medium">Click to upload Passport or Driver's License</p>
                                <p className="text-zinc-500 text-xs mt-1">PNG, JPG or PDF up to 10MB</p>
                            </div>
                        </div>

                        {isUploading && (
                            <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                                <div className="bg-yellow-500 h-full w-2/3 animate-pulse"></div>
                            </div>
                        )}
                    </div>

                    <div className="mt-8 flex justify-end">
                        <button type="button" onClick={onClose} className="mr-3 px-4 py-2 text-zinc-400 hover:text-white transition-colors">Cancel</button>
                    </div>
                </>
            ) : (
                <div className="text-center py-8">
                    <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <ShieldCheck className="w-10 h-10 text-green-500" />
                    </div>
                    <h4 className="text-2xl font-bold text-white mb-2">Verification Pending</h4>
                    <p className="text-zinc-400 mb-8">
                        Thank you for submitting your documents. Our compliance team will review your application within 24 hours.
                    </p>
                    <button type="button" onClick={onClose} className="bg-yellow-500 hover:bg-yellow-600 text-white px-8 py-3 rounded-xl font-bold w-full transition-colors">
                        Return to Dashboard
                    </button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default VerificationModal;