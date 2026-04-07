import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, ChevronRight, Info } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  full_name?: string;
}

interface AddressValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalAddress: Address;
  recommendedAddress?: Address;
  validationResult: {
    valid: boolean;
    validation_value: string; // valid, partially_valid, invalid
    reasons: Array<{ code: string; description: string }>;
    changed_attributes: string[];
    note: string;
  };
  onConfirm: (address: Address) => void;
}

export const AddressValidationModal = ({
  isOpen,
  onClose,
  originalAddress,
  recommendedAddress,
  validationResult,
  onConfirm,
}: AddressValidationModalProps) => {
  const isInvalid = validationResult.validation_value === "invalid";
  const isPartiallyValid = validationResult.validation_value === "partially_valid";
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md md:max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isInvalid ? (
              <AlertCircle className="h-5 w-5 text-destructive" />
            ) : (
              <Info className="h-5 w-5 text-amber-500" />
            )}
            Address Verification
          </DialogTitle>
          <DialogDescription>
            {isInvalid 
              ? "We couldn't verify this address. Please review and correct it."
              : "We found some suggestions to improve your shipping address accuracy."}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 py-4">
            {/* Reasons Section */}
            {(validationResult?.reasons || []).length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                   Validation Details
                </h4>
                <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                  {(validationResult?.reasons || []).map((reason, idx) => (
                    <div key={idx} className="flex gap-2 text-sm text-foreground/90">
                      <div className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                      <span>{reason.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Original Address */}
              <div className="space-y-3 p-4 rounded-xl border bg-muted/20">
                <Badge variant="outline" className="mb-1">You entered</Badge>
                <div className="text-sm space-y-1">
                  <p className="font-medium">{originalAddress.full_name}</p>
                  <p>{originalAddress.line1}</p>
                  {originalAddress.line2 && <p>{originalAddress.line2}</p>}
                  <p>{originalAddress.city}, {originalAddress.state} {originalAddress.postal_code}</p>
                  <p className="text-xs text-muted-foreground uppercase">{originalAddress.country}</p>
                </div>
              </div>

              {/* Recommended Address */}
              {recommendedAddress && (
                <div className={`space-y-3 p-4 rounded-xl border ${!isInvalid ? 'bg-primary/5 border-primary/20 ring-1 ring-primary/20' : 'bg-muted/20'}`}>
                  <Badge variant={isInvalid ? "outline" : "default"} className="mb-1">Suggested</Badge>
                  <div className="text-sm space-y-1">
                    <p className="font-medium">{originalAddress.full_name}</p>
                    <p className={(validationResult?.changed_attributes || []).includes('address_line_1') ? 'text-primary font-semibold' : ''}>
                      {recommendedAddress.line1}
                    </p>
                    {(recommendedAddress.line2 || originalAddress.line2) && (
                      <p className={(validationResult?.changed_attributes || []).includes('address_line_2') ? 'text-primary font-semibold' : ''}>
                        {recommendedAddress.line2 || originalAddress.line2}
                      </p>
                    )}
                    <p>
                      <span className={(validationResult?.changed_attributes || []).includes('city_locality') ? 'text-primary font-semibold' : ''}>{recommendedAddress.city}</span>, 
                      <span className={(validationResult?.changed_attributes || []).includes('state_province') ? 'text-primary font-semibold' : ''}> {recommendedAddress.state}</span>
                      <span className={(validationResult?.changed_attributes || []).includes('postal_code') ? 'text-primary font-semibold' : ''}> {recommendedAddress.postal_code}</span>
                    </p>
                    <p className="text-xs text-muted-foreground uppercase">{recommendedAddress.country}</p>
                  </div>
                </div>
              )}
            </div>

            {isInvalid && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex gap-3 text-sm text-destructive items-start">
                    <AlertCircle className="h-4 w-4 mt-0.5" />
                    <p>This address was marked as <strong>invalid</strong>. Please double check the street number, apartment, and zip code.</p>
                </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-4 border-t">
          <Button variant="outline" className="sm:flex-1" onClick={onClose}>
            Edit Manually
          </Button>
          {!isInvalid && recommendedAddress && (
            <Button className="sm:flex-1 gap-2" onClick={() => onConfirm(recommendedAddress)}>
              <CheckCircle2 className="h-4 w-4" />
              Use Suggested Address
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
