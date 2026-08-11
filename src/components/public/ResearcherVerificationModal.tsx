import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FlaskConical, ShieldAlert, CheckCircle2, ExternalLink, LogOut } from "lucide-react";
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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-5 animate-in fade-in duration-300 overflow-y-auto">
      <div 
        className="w-full max-w-lg bg-white text-slate-900 border border-slate-200 rounded-2xl shadow-2xl overflow-hidden my-auto relative"
        role="dialog"
        aria-modal="true"
        aria-labelledby="verification-modal-title"
      >
        {/* Top Accent Line */}
        <div className="h-1.5 bg-gradient-to-r from-primary via-teal-500 to-cyan-500" />

        {/* Header Section */}
        <div className="p-5 sm:p-6 border-b border-slate-100 bg-white">
          <div className="flex items-center justify-between gap-4 mb-3">
            <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full border border-primary/20">
              <FlaskConical className="w-3 h-3 text-primary" />
              Laboratory Compliance
            </span>
            <span className="text-[11px] text-slate-500 font-medium">Verification Required</span>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="p-2.5 bg-primary/10 rounded-xl border border-primary/20 text-primary shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h2 
                id="verification-modal-title" 
                className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight"
              >
                Researcher Verification
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                Please review and confirm research terms to access the site.
              </p>
            </div>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 sm:p-6 space-y-4 max-h-[60vh] overflow-y-auto bg-white">
          {/* Statement Callout Box */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3.5 space-y-1.5 text-xs text-slate-700">
            <p className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
              <span>🧪</span> Research & Educational Use Statement
            </p>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              All items on this website are intended exclusively for <strong>in vitro laboratory research</strong>. Products have not been evaluated by the FDA and are strictly not for human or veterinary use.
            </p>
          </div>

          {/* Checkbox Cards */}
          <div className="space-y-2.5 pt-1">
            {/* Checkbox 1: Age */}
            <label 
              htmlFor="age-check" 
              className={`flex items-start gap-3.5 p-3.5 rounded-xl border-2 transition-all cursor-pointer select-none ${
                ageConfirmed 
                  ? "border-primary bg-primary/5 text-slate-900 shadow-sm" 
                  : "border-slate-300 bg-slate-50/80 hover:bg-slate-100 hover:border-slate-400 text-slate-700"
              }`}
            >
              <Checkbox
                id="age-check"
                checked={ageConfirmed}
                onCheckedChange={(checked) => setAgeConfirmed(Boolean(checked))}
                className="mt-0.5 h-5 w-5 rounded border-2 border-slate-400 bg-white data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-primary-foreground shadow-sm"
              />
              <span className="text-xs font-medium leading-normal text-slate-800">
                I am at least <strong className="text-slate-950 font-bold">21 years of age</strong>.
              </span>
            </label>

            {/* Checkbox 2: Qualified Researcher */}
            <label 
              htmlFor="researcher-check" 
              className={`flex items-start gap-3.5 p-3.5 rounded-xl border-2 transition-all cursor-pointer select-none ${
                researcherConfirmed 
                  ? "border-primary bg-primary/5 text-slate-900 shadow-sm" 
                  : "border-slate-300 bg-slate-50/80 hover:bg-slate-100 hover:border-slate-400 text-slate-700"
              }`}
            >
              <Checkbox
                id="researcher-check"
                checked={researcherConfirmed}
                onCheckedChange={(checked) => setResearcherConfirmed(Boolean(checked))}
                className="mt-0.5 h-5 w-5 rounded border-2 border-slate-400 bg-white data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-primary-foreground shadow-sm"
              />
              <span className="text-xs font-medium leading-normal text-slate-800">
                I am a qualified researcher purchasing strictly for <strong className="text-slate-950 font-bold">in vitro laboratory research</strong>.
              </span>
            </label>

            {/* Checkbox 3: No Human Use */}
            <label 
              htmlFor="no-human-check" 
              className={`flex items-start gap-3.5 p-3.5 rounded-xl border-2 transition-all cursor-pointer select-none ${
                noHumanUseConfirmed 
                  ? "border-primary bg-primary/5 text-slate-900 shadow-sm" 
                  : "border-slate-300 bg-slate-50/80 hover:bg-slate-100 hover:border-slate-400 text-slate-700"
              }`}
            >
              <Checkbox
                id="no-human-check"
                checked={noHumanUseConfirmed}
                onCheckedChange={(checked) => setNoHumanUseConfirmed(Boolean(checked))}
                className="mt-0.5 h-5 w-5 rounded border-2 border-slate-400 bg-white data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-primary-foreground shadow-sm"
              />
              <span className="text-xs font-medium leading-normal text-slate-800">
                I understand products are <strong className="text-slate-950 font-bold">not for human or animal consumption</strong>, dosing, or therapeutic use.
              </span>
            </label>

            {/* Checkbox 4: Terms Consent */}
            <label 
              htmlFor="terms-check" 
              className={`flex items-start gap-3.5 p-3.5 rounded-xl border-2 transition-all cursor-pointer select-none ${
                termsAgreed 
                  ? "border-primary bg-primary/5 text-slate-900 shadow-sm" 
                  : "border-slate-300 bg-slate-50/80 hover:bg-slate-100 hover:border-slate-400 text-slate-700"
              }`}
            >
              <Checkbox
                id="terms-check"
                checked={termsAgreed}
                onCheckedChange={(checked) => setTermsAgreed(Boolean(checked))}
                className="mt-0.5 h-5 w-5 rounded border-2 border-slate-400 bg-white data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-primary-foreground shadow-sm"
              />
              <span className="text-xs font-medium leading-normal text-slate-800">
                I agree that accessing the site constitutes acceptance of these <strong className="text-slate-950 font-bold">Compliance Terms</strong>.
              </span>
            </label>
          </div>
        </div>

        {/* Footer Action Bar */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAcceptAll}
              className="text-xs font-bold gap-1.5 border-2 border-slate-300 bg-white text-slate-800 hover:bg-slate-100 hover:border-slate-400 transition-all shadow-sm"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
              Accept All
            </Button>

            <button
              onClick={handleReject}
              type="button"
              className="text-xs text-slate-500 hover:text-red-600 flex items-center gap-1 transition-colors px-2 py-1 font-semibold"
            >
              <LogOut className="w-3.5 h-3.5" />
              Decline & Exit
            </button>
          </div>

          <Button
            onClick={handleEnterSite}
            disabled={!allChecked}
            className="w-full sm:w-auto text-xs font-extrabold px-6 py-2.5 rounded-xl shadow-md transition-all gap-1.5 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground"
            size="sm"
          >
            <CheckCircle2 className="w-4 h-4" />
            Confirm & Enter Site
          </Button>
        </div>

        {/* Full Terms Link */}
        <div className="bg-slate-100/80 py-2.5 px-4 text-center border-t border-slate-200/60">
          <Link
            to="/terms"
            target="_blank"
            className="text-[11px] text-slate-600 hover:text-primary inline-flex items-center gap-1 font-semibold transition-colors"
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
