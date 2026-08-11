import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ShieldAlert } from "lucide-react";

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

  const canEnter = ageConfirmed && researcherConfirmed;

  const handleEnterSite = () => {
    if (canEnter) {
      sessionStorage.setItem("researcher_verified", "true");
      onVerify();
    }
  };

  const handleReject = () => {
    window.location.href = "https://www.google.com";
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-300">
      <div 
        className="w-full max-w-lg bg-card text-card-foreground border border-border/60 rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6 relative overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="verification-modal-title"
      >
        {/* Subtle accent header bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary/60 via-primary to-primary/60" />

        {/* Title Header */}
        <div className="text-center space-y-2 pt-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-3">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 
            id="verification-modal-title" 
            className="text-2xl sm:text-3xl font-black tracking-tight text-foreground uppercase"
          >
            RESEARCHER VERIFICATION
          </h2>
          <p className="text-sm text-muted-foreground font-medium">
            Please confirm both statements to enter the site.
          </p>
        </div>

        {/* Checkbox Options */}
        <div className="space-y-3">
          {/* Checkbox 1 */}
          <label 
            htmlFor="age-check" 
            className={`flex items-start gap-3.5 p-4 rounded-xl border transition-all cursor-pointer select-none ${
              ageConfirmed 
                ? "border-primary/50 bg-primary/5 shadow-sm" 
                : "border-border/80 bg-muted/30 hover:bg-muted/60"
            }`}
          >
            <Checkbox
              id="age-check"
              checked={ageConfirmed}
              onCheckedChange={(checked) => setAgeConfirmed(Boolean(checked))}
              className="mt-0.5 h-5 w-5 rounded-md border-muted-foreground/40 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            />
            <span className="text-sm font-medium leading-tight text-foreground/90">
              I am at least <strong>21 years of age</strong>.
            </span>
          </label>

          {/* Checkbox 2 */}
          <label 
            htmlFor="researcher-check" 
            className={`flex items-start gap-3.5 p-4 rounded-xl border transition-all cursor-pointer select-none ${
              researcherConfirmed 
                ? "border-primary/50 bg-primary/5 shadow-sm" 
                : "border-border/80 bg-muted/30 hover:bg-muted/60"
            }`}
          >
            <Checkbox
              id="researcher-check"
              checked={researcherConfirmed}
              onCheckedChange={(checked) => setResearcherConfirmed(Boolean(checked))}
              className="mt-0.5 h-5 w-5 rounded-md border-muted-foreground/40 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            />
            <span className="text-sm font-medium leading-tight text-foreground/90">
              I am a qualified researcher and any purchase is strictly for <strong>in vitro laboratory research</strong>. Products are not for human or veterinary use of any kind.
            </span>
          </label>
        </div>

        {/* Actions */}
        <div className="space-y-3 pt-2">
          <Button
            onClick={handleEnterSite}
            disabled={!canEnter}
            className="w-full py-6 text-base font-bold rounded-xl shadow-lg transition-all duration-200"
            size="lg"
          >
            Enter Site
          </Button>

          <div className="text-center">
            <button
              onClick={handleReject}
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors font-medium"
            >
              I don't meet these requirements
            </button>
          </div>
        </div>

        {/* Footer FDA Disclaimer */}
        <div className="pt-4 border-t border-border/40 text-center">
          <p className="text-[11px] text-muted-foreground/80 leading-normal font-normal">
            Products on this site have not been evaluated by the FDA and are not intended to diagnose, treat, cure, or prevent any disease.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResearcherVerificationModal;
