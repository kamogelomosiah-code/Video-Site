import React from 'react';
import { ShieldCheck, Scale, FileText, Globe } from 'lucide-react';

interface FooterProps {
  onOpenPrivacy?: () => void;
  onOpenTerms?: () => void;
}

const Footer: React.FC<FooterProps> = ({ onOpenPrivacy, onOpenTerms }) => {
  return (
    <footer id="elysian-site-footer" className="mt-16 pt-12 pb-8 border-t border-zinc-900 bg-[#09090b]">
      <div className="max-w-7xl mx-auto px-4 md:px-6 space-y-10">
        
        {/* Compliance badges grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2 pb-8 border-b border-zinc-900">
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-yellow-500/10 rounded-lg text-yellow-500 flex-shrink-0 mt-0.5 border border-yellow-500/20">
              <span className="text-xs font-bold font-poppins">18+</span>
            </div>
            <div>
              <h4 className="text-sm font-bold text-white mb-1">Age Verification</h4>
              <p className="text-xs text-zinc-500 leading-relaxed">
                This platform contains adult material. All visitors and contributors must be of legal age (18+) to access, upload, or interact with any media on this site.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <div className="p-2 bg-yellow-500/10 rounded-lg text-yellow-500 flex-shrink-0 mt-0.5 border border-yellow-500/20">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white mb-1">DMCA & Copyright</h4>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Elysian respects intellectual property. We act swiftly upon received notices of alleged copyright infringement in accordance with the DMCA guidelines.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <div className="p-2 bg-yellow-500/10 rounded-lg text-yellow-500 flex-shrink-0 mt-0.5 border border-yellow-500/20">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white mb-1">Record Keeping Compliance</h4>
              <p className="text-xs text-zinc-500 leading-relaxed">
                All records required under 18 U.S.C. § 2257 are maintained by the respective content creators and original publishers.
              </p>
            </div>
          </div>
        </div>

        {/* Legal Disclaimers & Copyright statement */}
        <div className="space-y-4 text-center md:text-left">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
            <div className="flex items-center space-x-1.5">
              <Globe className="w-3.5 h-3.5 text-zinc-600" />
              <span>&copy; {new Date().getFullYear()} Elysian. All rights reserved.</span>
            </div>
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
              <span onClick={onOpenTerms} className="hover:text-yellow-400 transition-colors cursor-pointer flex items-center">
                <FileText className="w-3 h-3 mr-1" /> Terms of Service
              </span>
              <span onClick={onOpenPrivacy} className="hover:text-yellow-400 transition-colors cursor-pointer flex items-center">
                <FileText className="w-3 h-3 mr-1" /> Privacy Policy
              </span>
              <span className="hover:text-yellow-400 transition-colors cursor-pointer flex items-center">
                <Scale className="w-3 h-3 mr-1" /> 2257 Statement
              </span>
              <span className="hover:text-yellow-400 transition-colors cursor-pointer flex items-center">
                <ShieldCheck className="w-3 h-3 mr-1" /> DMCA Notice
              </span>
            </div>
          </div>

          <p className="text-[10px] text-zinc-600 leading-relaxed text-justify md:text-left">
            Disclaimer: Elysian operates as an adult indexing service and tube video aggregator. The embedded or redirected content is provided and hosted by third-party adult tube platforms. Elysian does not hold copyright over nor host third-party video content directly except for authorized and verified original talent profiles. For removal requests of any indexed video, please submit a formal takedown request directly targeting the source website or contact our legal team for index deletion.
          </p>
        </div>

      </div>
    </footer>
  );
};

export default Footer;
