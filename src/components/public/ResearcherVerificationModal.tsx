import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, CheckCircle2, FileText, LogOut } from "lucide-react";
import { Link } from "react-router-dom";

interface ResearcherVerificationModalProps {
  isOpen: boolean;
  onVerify: () => void;
}

export const ResearcherVerificationModal: React.FC<ResearcherVerificationModalProps> = ({
  isOpen,
  onVerify,
}) => {
  const [readDisclaimer, setReadDisclaimer] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [researcherConfirmed, setResearcherConfirmed] = useState(false);
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

  const allChecked = readDisclaimer && ageConfirmed && researcherConfirmed && termsAgreed;

  const handleAcceptAll = () => {
    setReadDisclaimer(true);
    setAgeConfirmed(true);
    setResearcherConfirmed(true);
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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-5 animate-in fade-in duration-300 overflow-y-auto">
      <div 
        className="w-full max-w-xl bg-card text-card-foreground border border-border/70 rounded-2xl shadow-2xl overflow-hidden my-auto relative"
        role="dialog"
        aria-modal="true"
        aria-labelledby="verification-modal-title"
      >
        {/* Header Banner with Warning Gradient */}
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 p-5 sm:p-6 text-white relative">
          <div className="flex items-start gap-4">
            <div className="p-2.5 bg-white/15 rounded-xl backdrop-blur-sm shrink-0">
              <AlertTriangle className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 
                id="verification-modal-title" 
                className="text-xl sm:text-2xl font-black tracking-tight leading-snug"
              >
                Research Use & Compliance Disclaimer
              </h2>
              <p className="text-xs sm:text-sm text-white/90 font-medium mt-0.5">
                Please review and acknowledge the terms below to access the website.
              </p>
            </div>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 sm:p-6 space-y-5 max-h-[65vh] overflow-y-auto">
          {/* Terms Overview Box */}
          <div className="bg-muted/40 border border-border/60 rounded-xl p-4 space-y-2.5 text-xs text-muted-foreground leading-relaxed">
            <p className="font-semibold text-foreground text-xs">
              Before accessing or using the Website, all users must review and agree to the following conditions:
            </p>
            <ol className="list-decimal pl-4 space-y-1.5 font-normal">
              <li>
                Products listed are strictly for <strong>laboratory research purposes only</strong> and are not for human, veterinary, or clinical use.
              </li>
              <li>
                Products have not been evaluated by the FDA and are not intended to diagnose, treat, cure, or prevent any disease.
              </li>
              <li>
                Products should not be used as food, drugs, cosmetics, or household items.
              </li>
              <li>
                You acknowledge full responsibility for complying with all applicable laws and regulations in your jurisdiction.
              </li>
            </ol>
          </div>

          <p className="text-xs font-semibold text-foreground uppercase tracking-wider text-center pt-1">
            By continuing to access the Website, you confirm that:
          </p>

          {/* Checkboxes Group */}
          <div className="space-y-2.5">
            {/* Checkbox 1: Disclaimer */}
            <label 
              htmlFor="disclaimer-check" 
              className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                readDisclaimer 
                  ? "border-primary/50 bg-primary/5 shadow-sm text-foreground" 
                  : "border-border/70 bg-muted/20 hover:bg-muted/50 text-muted-foreground"
              }`}
            >
              <Checkbox
                id="disclaimer-check"
                checked={readDisclaimer}
                onCheckedChange={(checked) => setReadDisclaimer(Boolean(checked))}
                className="mt-0.5 h-4.5 w-4.5 rounded-md data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
              <span className="text-xs font-medium leading-tight text-foreground/90">
                I have read and understood the <strong>Research Use and Compliance Disclaimer</strong> above.
              </span>
            </label>

            {/* Checkbox 2: Age */}
            <label 
              htmlFor="age-check" 
              className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                ageConfirmed 
                  ? "border-primary/50 bg-primary/5 shadow-sm text-foreground" 
                  : "border-border/70 bg-muted/20 hover:bg-muted/50 text-muted-foreground"
              }`}
            >
              <Checkbox
                id="age-check"
                checked={ageConfirmed}
                onCheckedChange={(checked) => setAgeConfirmed(Boolean(checked))}
                className="mt-0.5 h-4.5 w-4.5 rounded-md data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
              <span className="text-xs font-medium leading-tight text-foreground/90">
                I am at least <strong>21 years of age</strong>.
              </span>
            </label>

            {/* Checkbox 3: Researcher */}
            <label 
              htmlFor="researcher-check" 
              className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                researcherConfirmed 
                  ? "border-primary/50 bg-primary/5 shadow-sm text-foreground" 
                  : "border-border/70 bg-muted/20 hover:bg-muted/50 text-muted-foreground"
              }`}
            >
              <Checkbox
                id="researcher-check"
                checked={researcherConfirmed}
                onCheckedChange={(checked) => setResearcherConfirmed(Boolean(checked))}
                className="mt-0.5 h-4.5 w-4.5 rounded-md data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
              <span className="text-xs font-medium leading-tight text-foreground/90">
                I am a qualified researcher purchasing strictly for <strong>in vitro laboratory research</strong>.
              </span>
            </label>

            {/* Checkbox 4: Terms */}
            <label 
              htmlFor="terms-check" 
              className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                termsAgreed 
                  ? "border-primary/50 bg-primary/5 shadow-sm text-foreground" 
                  : "border-border/70 bg-muted/20 hover:bg-muted/50 text-muted-foreground"
              }`}
            >
              <Checkbox
                id="terms-check"
                checked={termsAgreed}
                onCheckedChange={(checked) => setTermsAgreed(Boolean(checked))}
                className="mt-0.5 h-4.5 w-4.5 rounded-md data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
              <span className="text-xs font-medium leading-tight text-foreground/90">
                I agree that my access to the Website constitutes acceptance of and consent to these <strong>Terms</strong>.
              </span>
            </label>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-muted/30 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAcceptAll}
              className="text-xs font-semibold gap-1.5 hover:bg-primary/10 hover:text-primary hover:border-primary/40"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Accept All
            </Button>

            <button
              onClick={handleReject}
              type="button"
              className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors px-2 py-1 font-medium"
            >
              <LogOut className="w-3.5 h-3.5" />
              Decline & Exit
            </button>
          </div>

          <Button
            onClick={handleEnterSite}
            disabled={!allChecked}
            className="w-full sm:w-auto text-xs font-bold px-6 py-2.5 rounded-xl shadow-md transition-all gap-1.5"
            size="sm"
          >
            <CheckCircle2 className="w-4 h-4" />
            Submit & Enter
          </Button>
        </div>

        {/* Full Terms Link */}
        <div className="bg-muted/50 py-2 px-4 text-center border-t border-border/30">
          <Link
            to="/terms"
            target="_blank"
            className="text-[11px] text-muted-foreground hover:text-primary inline-flex items-center gap-1 font-medium underline underline-offset-2"
          >
            <FileText className="w-3 h-3" />
            View full disclaimers & terms of service
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ResearcherVerificationModal;
