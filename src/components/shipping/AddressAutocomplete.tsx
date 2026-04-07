
import { useState, useEffect, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, Search, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

interface AddressAutocompleteProps {
    value?: string;
    onSelectAddress: (address: {
        line1: string;
        city: string;
        state: string;
        zip: string;
        country: string;
    }) => void;
    placeholder?: string;
    className?: string;
    onChange?: (value: string) => void;
}

interface NominatimResult {
    display_name: string;
    address: {
        road?: string;
        house_number?: string;
        city?: string;
        town?: string;
        village?: string;
        state?: string;
        postcode?: string;
        country_code?: string;
    };
}

export const AddressAutocomplete = ({
    value = "",
    onSelectAddress,
    placeholder = "",
    className,
    onChange
}: AddressAutocompleteProps) => {
    const [open, setOpen] = useState(false);
    const [inputValue, setInputValue] = useState(value);
    const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
    const [loading, setLoading] = useState(false);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        setInputValue(value);
    }, [value]);

    const fetchSuggestions = async (query: string) => {
        if (!query || query.length < 1) {
            setSuggestions([]);
            return;
        }

        setLoading(true);
        try {
            // Use Nominatim search API - Restricted to US as per user request
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5&countrycodes=us`,
                {
                    headers: {
                        "Accept-Language": "en-US,en;q=0.5",
                        "User-Agent": "VialFlow-Pro-Shipping-App" // Respecting Nominatim User-Agent requirement
                    }
                }
            );

            if (!response.ok) throw new Error("Search failed");

            const data = await response.json();
            setSuggestions(data);
        } catch (error) {
            console.error("Address search error:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (val: string) => {
        setInputValue(val);
        setOpen(true);
        if (onChange) onChange(val);

        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
            fetchSuggestions(val);
        }, 500); // 500ms debounce
    };

    const handleSelect = (suggestion: NominatimResult) => {
        const addr = suggestion.address;
        
        // Map Nominatim fields to our internal format
        const line1 = [addr.house_number, addr.road].filter(Boolean).join(" ");
        const city = addr.city || addr.town || addr.village || "";
        const state = addr.state || "";
        const zip = addr.postcode || "";
        const country = "US"; // Force US since results are restricted to US anyway

        onSelectAddress({
            line1,
            city,
            state,
            zip,
            country
        });

        setInputValue(line1);
        setOpen(false);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <div className={cn("relative group", className)}>
                    <Input
                        value={inputValue}
                        onChange={(e) => handleInputChange(e.target.value)}
                        placeholder={placeholder}
                        onFocus={() => setOpen(true)}
                        className="w-full text-sm placeholder:opacity-0"
                    />
                    {loading && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                    )}
                </div>
            </PopoverTrigger>
            <PopoverContent 
                className="p-0 w-[var(--radix-popover-trigger-width)]" 
                align="start"
                onOpenAutoFocus={(e) => e.preventDefault()} // Prevent stealing focus
            >
                <Command shouldFilter={false}>
                    <CommandList className="max-h-[300px]">
                        {!loading && suggestions.length === 0 && inputValue.length >= 1 && (
                            <CommandEmpty>No addresses found.</CommandEmpty>
                        )}

                        <CommandGroup>
                            {suggestions.map((suggestion, index) => {
                                const addr = suggestion.address;
                                const main = [addr.house_number, addr.road].filter(Boolean).join(" ") || 
                                             suggestion.display_name.split(',')[0];
                                const details = suggestion.display_name
                                    .replace(main, "")
                                    .replace(/^,\s*/, "")
                                    .split(",")
                                    .filter(s => {
                                        const val = s.trim();
                                        // Skip duplicates of main or redundant county info if possible, but keep it clean
                                        return val && val !== main;
                                    })
                                    .join(", ");

                                return (
                                    <CommandItem
                                        key={index}
                                        onSelect={() => handleSelect(suggestion)}
                                        className="cursor-pointer flex items-start gap-2 py-3 px-4 hover:bg-accent"
                                    >
                                        <MapPin className="h-4 w-4 mt-1 shrink-0 text-primary/60" />
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-sm font-semibold text-foreground">
                                                {main}
                                            </span>
                                            <span className="text-xs text-muted-foreground line-clamp-1">
                                                {details}
                                            </span>
                                        </div>
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
};
