import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FlaskConical, ShieldCheck, CheckCircle2, ExternalLink, LogOut } from "lucide-react";
import { Link } from "react-router-dom";

interface ResearcherVerificationModalProps {
  isOpen: boolean;
  onVerify: () => void;
}

export const ResearcherVerificationModal: React.FC<ResearcherVerificationModalProps> = ({
  isOpen,
  onVerify,
}) => {
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [researcherConfirmed, setResearcherConfirmed] = useState(false);
  const [noHumanUseConfirmed, setNoHumanUseConfirmed] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const allChecked = ageConfirmed && researcherConfirmed && noHumanUseConfirmed && termsAgreed;

  const handleAcceptAll = () => {
    setAgeConfirmed(true);
    setResearcherConfirmed(true);
    setNoHumanUseConfirmed(true);
    setTermsAgreed(true);
  };

  const handleEnterSite = () => {
    if (allChecked) {
      sessionStorage.setItem("researcher_verified", "true");
      onVerify();
    }
  };

  const handleReject = () => {
    window.location.href = "https://www.google.com";
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-3 sm:p-5 animate-in fade-in duration-300 overflow-y-auto">
      <div 
        className="w-full max-w-lg bg-slate-900 text-slate-100 border border-teal-500/25 rounded-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] overflow-hidden my-auto relative"
        role="dialog"
        aria-modal="true"
        aria-labelledby="verification-modal-title"
      >
        {/* Glow Accent Effect */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-teal-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header Section */}
        <div className="p-5 sm:p-6 border-b border-slate-800 bg-slate-900/90 relative">
          <div className="flex items-center justify-between gap-4 mb-3">
            <span className="inline-flex items-center gap-1.5 bg-teal-500/10 text-teal-400 text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full border border-teal-500/20">
              <FlaskConical className="w-3 h-3 text-teal-400 animate-pulse" />
              Laboratory Compliance
            </span>
            <span className="text-[11px] text-slate-400 font-medium">Verification Required</span>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="p-2.5 bg-teal-500/10 rounded-xl border border-teal-500/20 text-teal-400 shrink-0 shadow-[0_0_15px_rgba(20,184,166,0.15)]">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 
                id="verification-modal-title" 
                className="text-xl sm:text-2xl font-extrabold text-white tracking-tight leading-tight"
              >
                Researcher Verification
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 leading-relaxed">
                Please review and confirm research terms to enter the catalog.
              </p>
            </div>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 sm:p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Summary Box */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 space-y-2 text-xs text-slate-300">
            <p className="font-semibold text-teal-300 text-xs flex items-center gap-1.5">
              <span>🧪</span> Research & Educational Use Statement
            </p>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              All items on this website are intended exclusively for <strong>in vitro laboratory research</strong>. Products have not been evaluated by the FDA and are strictly not for human or veterinary use.
            </p>
          </div>

          {/* Checkbox Options */}
          <div className="space-y-2.5 pt-1">
            {/* Checkbox 1: Age */}
            <label 
              htmlFor="age-check" 
              className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                ageConfirmed 
                  ? "border-teal-500/40 bg-teal-500/10 text-white shadow-sm" 
                  : "border-slate-800 bg-slate-950/40 hover:bg-slate-800/50 text-slate-300"
              }`}
            >
              <Checkbox
                id="age-check"
                checked={ageConfirmed}
                onCheckedChange={(checked) => setAgeConfirmed(Boolean(checked))}
                className="mt-0.5 h-4.5 w-4.5 rounded-md border-slate-600 data-[state=checked]:bg-teal-500 data-[state=checked]:border-teal-500 data-[state=checked]:text-slate-950"
              />
              <span className="text-xs font-medium leading-normal text-slate-200">
                I am at least <strong className="text-white">21 years of age</strong>.
              </span>
            </label>

            {/* Checkbox 2: Qualified Researcher */}
            <label 
              htmlFor="researcher-check" 
              className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                researcherConfirmed 
                  ? "border-teal-500/40 bg-teal-500/10 text-white shadow-sm" 
                  : "border-slate-800 bg-slate-950/40 hover:bg-slate-800/50 text-slate-300"
              }`}
            >
              <Checkbox
                id="researcher-check"
                checked={researcherConfirmed}
                onCheckedChange={(checked) => setResearcherConfirmed(Boolean(checked))}
                className="mt-0.5 h-4.5 w-4.5 rounded-md border-slate-600 data-[state=checked]:bg-teal-500 data-[state=checked]:border-teal-500 data-[state=checked]:text-slate-950"
              />
              <span className="text-xs font-medium leading-normal text-slate-200">
                I am a qualified researcher purchasing strictly for <strong className="text-white">in vitro laboratory research</strong>.
              </span>
            </label>

            {/* Checkbox 3: No Human Use */}
            <label 
              htmlFor="no-human-check" 
              className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                noHumanUseConfirmed 
                  ? "border-teal-500/40 bg-teal-500/10 text-white shadow-sm" 
                  : "border-slate-800 bg-slate-950/40 hover:bg-slate-800/50 text-slate-300"
              }`}
            >
              <Checkbox
                id="no-human-check"
                checked={noHumanUseConfirmed}
                onCheckedChange={(checked) => setNoHumanUseConfirmed(Boolean(checked))}
                className="mt-0.5 h-4.5 w-4.5 rounded-md border-slate-600 data-[state=checked]:bg-teal-500 data-[state=checked]:border-teal-500 data-[state=checked]:text-slate-950"
              />
              <span className="text-xs font-medium leading-normal text-slate-200">
                I understand products are <strong className="text-white">not for human or animal consumption</strong>, dosing, or therapeutic use.
              </span>
            </label>

            {/* Checkbox 4: Terms Consent */}
            <label 
              htmlFor="terms-check" 
              className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                termsAgreed 
                  ? "border-teal-500/40 bg-teal-500/10 text-white shadow-sm" 
                  : "border-slate-800 bg-slate-950/40 hover:bg-slate-800/50 text-slate-300"
              }`}
            >
              <Checkbox
                id="terms-check"
                checked={termsAgreed}
                onCheckedChange={(checked) => setTermsAgreed(Boolean(checked))}
                className="mt-0.5 h-4.5 w-4.5 rounded-md border-slate-600 data-[state=checked]:bg-teal-500 data-[state=checked]:border-teal-500 data-[state=checked]:text-slate-950"
              />
              <span className="text-xs font-medium leading-normal text-slate-200">
                I agree that accessing the site constitutes acceptance of these <strong className="text-white">Compliance Terms</strong>.
              </span>
            </label>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-slate-950/80 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAcceptAll}
              className="text-xs font-semibold gap-1.5 border-slate-700 bg-slate-900 text-slate-200 hover:bg-teal-500/10 hover:text-teal-400 hover:border-teal-500/40 transition-all"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
              Accept All
            </Button>

            <button
              onClick={handleReject}
              type="button"
              className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1 transition-colors px-2 py-1 font-medium"
            >
              <LogOut className="w-3.5 h-3.5" />
              Decline & Exit
            </button>
          </div>

          <Button
            onClick={handleEnterSite}
            disabled={!allChecked}
            className="w-full sm:w-auto text-xs font-bold px-6 py-2.5 rounded-xl shadow-lg transition-all gap-1.5 bg-teal-600 hover:bg-teal-500 disabled:bg-slate-800 disabled:text-slate-500 text-white shadow-[0_0_20px_rgba(20,184,166,0.25)]"
            size="sm"
          >
            <CheckCircle2 className="w-4 h-4" />
            Confirm & Enter Site
          </Button>
        </div>

        {/* Full Terms Link */}
        <div className="bg-slate-950 py-2.5 px-4 text-center border-t border-slate-800/60">
          <Link
            to="/terms"
            target="_blank"
            className="text-[11px] text-slate-400 hover:text-teal-400 inline-flex items-center gap-1 font-medium transition-colors"
          >
            View Full Terms & Conditions
            <ExternalLink className="w-3 h-3 ml-0.5" />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ResearcherVerificationModal;
