import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Clock, Truck, ShieldCheck, Zap, Lock } from "lucide-react";
import { DEFAULT_SHIPPING_CONFIG, StoreShippingConfig } from "@/config/shippingConfig";

interface ProductShippingPerksProps {
    config?: Partial<StoreShippingConfig>;
    freeShippingThreshold?: number;
    className?: string;
}

export const ProductShippingPerks = ({ 
    config: customConfig,
    freeShippingThreshold,
    className = "" 
}: ProductShippingPerksProps) => {
    // Fetch live settings from app_settings
    const { data: dbSettings } = useQuery({
        queryKey: ['shipping_app_settings'],
        queryFn: async () => {
            const { data } = await supabase
                .from("app_settings" as any)
                .select("key, value")
                .in("key", [
                    "shipping_cutoff_hour",
                    "shipping_cutoff_minute",
                    "shipping_timezone",
                    "shipping_cutoff_label",
                    "shipping_free_threshold",
                    "shipping_delivery_min_days",
                    "shipping_delivery_max_days",
                    "shipping_ships_saturday"
                ]);
            return (data as Array<{ key: string; value: string }>) || [];
        },
        staleTime: 0, // Instant sync
    });

    const config: StoreShippingConfig = useMemo(() => {
        let dbConfig: Partial<StoreShippingConfig> = {};
        if (dbSettings && dbSettings.length > 0) {
            const hour = dbSettings.find(s => s.key === "shipping_cutoff_hour");
            const min = dbSettings.find(s => s.key === "shipping_cutoff_minute");
            const tz = dbSettings.find(s => s.key === "shipping_timezone");
            const label = dbSettings.find(s => s.key === "shipping_cutoff_label");
            const threshold = dbSettings.find(s => s.key === "shipping_free_threshold");
            const minDays = dbSettings.find(s => s.key === "shipping_delivery_min_days");
            const maxDays = dbSettings.find(s => s.key === "shipping_delivery_max_days");
            const sat = dbSettings.find(s => s.key === "shipping_ships_saturday");

            dbConfig = {
                ...(hour ? { cutoffHour: Number(hour.value) } : {}),
                ...(min ? { cutoffMinute: Number(min.value) } : {}),
                ...(tz ? { timeZone: tz.value } : {}),
                ...(label ? { cutoffDisplayLabel: label.value } : {}),
                ...(threshold ? { freeShippingThreshold: Number(threshold.value) } : {}),
                ...(minDays || maxDays ? {
                    estimatedDeliveryDays: {
                        min: minDays ? Number(minDays.value) : DEFAULT_SHIPPING_CONFIG.estimatedDeliveryDays.min,
                        max: maxDays ? Number(maxDays.value) : DEFAULT_SHIPPING_CONFIG.estimatedDeliveryDays.max,
                    }
                } : {}),
                ...(sat ? { shipsOnSaturday: sat.value === "true" } : {}),
            };
        }

        const h = dbConfig.cutoffHour ?? DEFAULT_SHIPPING_CONFIG.cutoffHour;
        const m = dbConfig.cutoffMinute ?? DEFAULT_SHIPPING_CONFIG.cutoffMinute;
        const tz = dbConfig.timeZone ?? DEFAULT_SHIPPING_CONFIG.timeZone;
        const isPM = h >= 12;
        const displayH = h % 12 === 0 ? 12 : h % 12;
        const displayM = m > 0 ? `:${String(m).padStart(2, '0')}` : ':00';
        const ampm = isPM ? 'PM' : 'AM';
        let tzCode = 'ET';
        if (tz.includes('Central')) tzCode = 'CT';
        else if (tz.includes('Mountain') || tz.includes('Phoenix')) tzCode = 'MT';
        else if (tz.includes('Los_Angeles')) tzCode = 'PT';

        const autoLabel = `${displayH}${displayM} ${ampm} ${tzCode}`;
        const finalLabel = (dbConfig.cutoffDisplayLabel && dbConfig.cutoffDisplayLabel !== "3:00 PM ET (12:00 PM PT)") 
            ? dbConfig.cutoffDisplayLabel 
            : autoLabel;

        return {
            ...DEFAULT_SHIPPING_CONFIG,
            ...dbConfig,
            cutoffDisplayLabel: finalLabel,
            ...(freeShippingThreshold !== undefined ? { freeShippingThreshold } : {}),
            ...customConfig,
        };
    }, [dbSettings, freeShippingThreshold, customConfig]);

    const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; isShipsToday: boolean; isWeekend: boolean }>({
        hours: 0,
        minutes: 0,
        isShipsToday: true,
        isWeekend: false
    });

    const [arrivalRange, setArrivalRange] = useState<{ from: string; to: string }>({
        from: "",
        to: ""
    });

    useEffect(() => {
        const calculateShippingTimes = () => {
            const now = new Date();
            
            // Convert to configured timezone
            const tzString = now.toLocaleString("en-US", { timeZone: config.timeZone });
            const tzDate = new Date(tzString);
            
            const dayOfWeek = tzDate.getDay(); // 0 = Sun, 6 = Sat
            const currentHour = tzDate.getHours();
            const currentMinute = tzDate.getMinutes();

            const isWeekend = config.shipsOnSaturday 
                ? dayOfWeek === 0 
                : (dayOfWeek === 0 || dayOfWeek === 6);

            const cutoffTotalMinutes = config.cutoffHour * 60 + config.cutoffMinute;
            const currentTotalMinutes = currentHour * 60 + currentMinute;
            
            let isShipsToday = false;
            let hoursRemaining = 0;
            let minutesRemaining = 0;

            if (!isWeekend && currentTotalMinutes < cutoffTotalMinutes) {
                isShipsToday = true;
                const diff = cutoffTotalMinutes - currentTotalMinutes;
                hoursRemaining = Math.floor(diff / 60);
                minutesRemaining = diff % 60;
            }

            setTimeLeft({
                hours: hoursRemaining,
                minutes: minutesRemaining,
                isShipsToday,
                isWeekend
            });

            // Calculate estimated delivery dates
            const addBusinessDays = (startDate: Date, days: number): Date => {
                const result = new Date(startDate);
                let added = 0;
                while (added < days) {
                    result.setDate(result.getDate() + 1);
                    const day = result.getDay();
                    if (day !== 0 && (!config.shipsOnSaturday ? day !== 6 : true)) {
                        added++;
                    }
                }
                return result;
            };

            // If past cutoff or weekend, ship date starts next business day
            let shipDate = new Date(tzDate);
            if (!isShipsToday) {
                shipDate = addBusinessDays(shipDate, 1);
            }

            const fromDate = addBusinessDays(shipDate, config.estimatedDeliveryDays.min);
            const toDate = addBusinessDays(shipDate, config.estimatedDeliveryDays.max);

            const formatOptions: Intl.DateTimeFormatOptions = { 
                weekday: 'short', 
                month: 'short', 
                day: 'numeric' 
            };

            setArrivalRange({
                from: fromDate.toLocaleDateString("en-US", formatOptions),
                to: toDate.toLocaleDateString("en-US", formatOptions)
            });
        };

        calculateShippingTimes();
        const interval = setInterval(calculateShippingTimes, 60000); // Update every minute
        return () => clearInterval(interval);
    }, [config.cutoffHour, config.cutoffMinute, config.timeZone, config.shipsOnSaturday, config.estimatedDeliveryDays.min, config.estimatedDeliveryDays.max]);

    return (
        <div className={`rounded-2xl border border-border/80 bg-card overflow-hidden shadow-xs divide-y divide-border/60 ${className}`}>
            {/* 1. Same-Day Shipping & Cutoff Countdown */}
            <div className="p-3.5 sm:p-4 bg-emerald-500/10 dark:bg-emerald-950/25 flex items-start gap-3 transition-colors">
                <div className="mt-0.5 rounded-full p-1 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0">
                    <Clock className="h-4 w-4" />
                </div>
                <div className="space-y-0.5 min-w-0">
                    <div className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-1.5 flex-wrap">
                        {timeLeft.isShipsToday ? (
                            <>
                                <span>Order within</span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                    {timeLeft.hours}h {timeLeft.minutes}m
                                </span>
                                <span>·</span>
                                <span className="font-bold text-emerald-700 dark:text-emerald-300">ships today</span>
                            </>
                        ) : timeLeft.isWeekend ? (
                            <>
                                <span className="font-bold text-foreground">Order this weekend</span>
                                <span>·</span>
                                <span className="font-semibold text-emerald-600 dark:text-emerald-400">ships Monday morning</span>
                            </>
                        ) : (
                            <>
                                <span className="font-bold text-foreground">Order now</span>
                                <span>·</span>
                                <span className="font-semibold text-emerald-600 dark:text-emerald-400">ships tomorrow morning</span>
                            </>
                        )}
                    </div>
                    <p className="text-[11px] sm:text-xs text-muted-foreground">
                        {timeLeft.isShipsToday ? `Cutoff ${config.cutoffDisplayLabel}` : `Daily order cutoff: ${config.cutoffDisplayLabel}`}
                    </p>
                </div>
            </div>

            {/* 2. Estimated Delivery Window */}
            <div className="p-3.5 sm:p-4 flex items-start gap-3">
                <div className="mt-0.5 rounded-full p-1 bg-primary/10 text-primary shrink-0">
                    <Truck className="h-4 w-4" />
                </div>
                <div className="space-y-0.5 min-w-0">
                    <div className="text-xs sm:text-sm font-semibold text-foreground">
                        Arrives {arrivalRange.from ? `${arrivalRange.from} – ${arrivalRange.to}` : `in ${config.estimatedDeliveryDays.min}–${config.estimatedDeliveryDays.max} business days`}
                    </div>
                    <p className="text-[11px] sm:text-xs text-muted-foreground">
                        Free standard shipping on orders over ${config.freeShippingThreshold}
                    </p>
                </div>
            </div>

            {/* 3. Free Shipment Protection */}
            <div className="p-3.5 sm:p-4 flex items-start gap-3">
                <div className="mt-0.5 rounded-full p-1 bg-primary/10 text-primary shrink-0">
                    <ShieldCheck className="h-4 w-4" />
                </div>
                <div className="space-y-0.5 min-w-0">
                    <div className="text-xs sm:text-sm font-semibold text-foreground">
                        Free shipment protection
                    </div>
                    <p className="text-[11px] sm:text-xs text-muted-foreground">
                        Lost, stolen, or damaged in transit? We replace it, on us.
                    </p>
                </div>
            </div>

            {/* 4. Express & 2-day Options */}
            <div className="p-3.5 sm:p-4 flex items-start gap-3">
                <div className="mt-0.5 rounded-full p-1 bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
                    <Zap className="h-4 w-4" />
                </div>
                <div className="space-y-0.5 min-w-0">
                    <div className="text-xs sm:text-sm font-semibold text-foreground">
                        Overnight and 2-day express options
                    </div>
                    <p className="text-[11px] sm:text-xs text-muted-foreground">
                        Select your preferred speed at checkout
                    </p>
                </div>
            </div>

            {/* 5. Secure Checkout & Payment Badges */}
            <div className="p-3.5 sm:p-4 bg-muted/20 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium text-muted-foreground">
                        We accept:
                    </span>
                    <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                        <Lock className="h-2.5 w-2.5" />
                        <span>Secure Checkout</span>
                    </div>
                </div>

                {/* Payment Brand Icons */}
                <div className="flex items-center flex-wrap gap-1.5 pt-0.5">
                    {/* Visa */}
                    <div className="h-6 px-2 bg-background border border-border rounded flex items-center justify-center shadow-2xs">
                        <svg className="h-3 w-auto fill-[#1A1F71] dark:fill-white" viewBox="0 0 36 12" xmlns="http://www.w3.org/2000/svg">
                            <path d="M14.453 0.234L9.467 11.758H6.208L3.785 2.734C3.637 2.164 3.504 1.945 3.066 1.707C2.348 1.32 1.102 0.957 0 0.719L0.078 0.234H5.406C6.094 0.234 6.711 0.691 6.863 1.48L8.188 8.496L11.453 0.234H14.453ZM27.07 7.965C27.086 4.938 22.883 4.773 22.914 3.414C22.926 3.004 23.316 2.559 24.215 2.441C24.66 2.383 25.895 2.332 27.242 2.953L27.785 0.441C27.043 0.172 26.074 0 24.871 0C21.848 0 19.723 1.609 19.703 3.902C19.676 5.602 21.238 6.551 22.402 7.117C23.598 7.699 24.004 8.074 23.996 8.598C23.984 9.398 23.031 9.754 22.148 9.77C20.602 9.789 19.703 9.352 18.988 9.016L18.426 11.648C19.18 11.992 20.578 12.285 22.023 12.305C25.234 12.305 27.051 10.719 27.07 7.965ZM35.086 11.758H37.711L35.418 0.234H33.004C32.449 0.234 31.984 0.559 31.781 1.055L27.148 11.758H30.344L30.984 10.012H34.887L35.086 11.758ZM31.867 7.617L33.211 3.902L33.988 7.617H31.867ZM19.246 0.234L16.711 11.758H13.676L16.211 0.234H19.246Z"/>
                        </svg>
                    </div>

                    {/* Mastercard */}
                    <div className="h-6 px-2 bg-background border border-border rounded flex items-center justify-center shadow-2xs">
                        <svg className="h-3.5 w-auto" viewBox="0 0 32 20" xmlns="http://www.w3.org/2000/svg">
                            <rect width="12" height="12" x="4" y="4" rx="6" fill="#EB001B"/>
                            <rect width="12" height="12" x="16" y="4" rx="6" fill="#F79E1B"/>
                            <path d="M16 5.86a6 6 0 0 0-2.14 4.14A6 6 0 0 0 16 14.14a6 6 0 0 0 2.14-4.14A6 6 0 0 0 16 5.86Z" fill="#FF5F00"/>
                        </svg>
                    </div>

                    {/* American Express */}
                    <div className="h-6 px-2 bg-background border border-border rounded flex items-center justify-center shadow-2xs">
                        <span className="text-[9px] font-black tracking-tighter text-[#006FCF] dark:text-[#3894E6]">AMEX</span>
                    </div>

                    {/* Discover */}
                    <div className="h-6 px-2 bg-background border border-border rounded flex items-center justify-center shadow-2xs">
                        <span className="text-[9px] font-black tracking-tight text-[#FF6000]">DISCOVER</span>
                    </div>

                    {/* Apple Pay */}
                    <div className="h-6 px-2 bg-background border border-border rounded flex items-center justify-center shadow-2xs">
                        <svg className="h-3 w-auto fill-foreground" viewBox="0 0 36 15" xmlns="http://www.w3.org/2000/svg">
                            <path d="M4.53 4.22c-.37.45-.96.79-1.57.74-.08-.6.18-1.22.52-1.63.37-.46.99-.78 1.54-.78.07.61-.13 1.22-.49 1.67zm1.54 2.27c-.85-.05-1.57.48-1.98.48-.41 0-1.02-.45-1.69-.44-.87.01-1.68.51-2.12 1.29-.91 1.56-.23 3.89.65 5.16.43.62.95 1.31 1.62 1.28.64-.02.89-.42 1.66-.42.77 0 .99.42 1.67.4.69-.01 1.13-.62 1.55-1.24.49-.71.69-1.4.7-1.44-.02-.01-1.34-.51-1.35-2.04-.01-1.28 1.05-1.89 1.1-1.92-.6-.88-1.53-.98-1.8-.99v-.16zm6.83-2.16h-3.41v10.42h1.66v-3.79h1.75c2.4 0 3.79-1.37 3.79-3.32 0-1.93-1.39-3.31-3.79-3.31zm-.17 5.18h-1.58v-3.73h1.58c1.37 0 2.14.73 2.14 1.87s-.77 1.86-2.14 1.86zm7.74 1.48c-1.49 0-2.55 1.09-2.55 2.57 0 1.49 1.07 2.58 2.58 2.58.82 0 1.53-.37 1.94-.96v.84h1.54v-5.91c0-1.74-1.29-2.73-3.19-2.73-1.62 0-2.88.94-2.98 2.28h1.49c.14-.59.73-.97 1.49-.97 1.01 0 1.65.51 1.65 1.44v.66l-2.02.2zm.29 3.84c-.79 0-1.39-.47-1.39-1.18 0-.71.61-1.16 1.42-1.16h1.7v.75c-.24.95-.98 1.59-1.73 1.59zm9.05-5.32l-1.86 5.13-1.87-5.13h-1.78l2.84 7.02-1.62 3.65h1.72l4.88-10.67h-2.31z"/>
                        </svg>
                    </div>

                    {/* Google Pay */}
                    <div className="h-6 px-2 bg-background border border-border rounded flex items-center justify-center shadow-2xs">
                        <svg className="h-3 w-auto" viewBox="0 0 40 16" xmlns="http://www.w3.org/2000/svg">
                            <path d="M19.5 8.1v4.8h-1.6V1.3h4.3c1.2 0 2.2.4 3 1.2.8.8 1.2 1.8 1.2 3 0 1.2-.4 2.2-1.2 3-.8.8-1.8 1.2-3 1.2h-2.7v-1.6zm0-5.2v3.6h2.8c.8 0 1.4-.3 1.9-.8.5-.5.8-1.1.8-1.8s-.3-1.3-.8-1.8c-.5-.5-1.1-.8-1.9-.8h-2.8v1.6zm10.7 7.7c-1.3 0-2.3-.4-3-1.3-.7-.9-1.1-2-1.1-3.3s.4-2.4 1.1-3.3c.7-.9 1.7-1.3 3-1.3 1.3 0 2.3.4 3 1.3.7.9 1.1 2 1.1 3.3s-.4 2.4-1.1 3.3c-.7.9-1.7 1.3-3 1.3zm0-1.4c.8 0 1.5-.3 2-1 .5-.6.8-1.4.8-2.3s-.3-1.7-.8-2.3c-.5-.6-1.2-1-2-1s-1.5.3-2 1c-.5.6-.8 1.4-.8 2.3s.3 1.7.8 2.3c.5.6 1.2 1 2 1zm10.6-6.1l-5.4 12.4h-1.7l2-4.4-3.6-8h1.8l2.6 6.1 2.5-6.1h1.8z" fill="currentColor"/>
                            <path d="M7.4 6.8v2.4h5.8c-.2 1.3-.8 2.4-1.9 3.2-1 1-2.4 1.5-3.9 1.5-3.2 0-5.8-2.6-5.8-5.8s2.6-5.8 5.8-5.8c1.6 0 3.1.6 4.2 1.7l1.7-1.7C11.8.8 9.7 0 7.4 0 3.3 0 0 3.3 0 7.4s3.3 7.4 7.4 7.4c2.2 0 4.1-.7 5.6-2.2 1.5-1.5 2.3-3.6 2.3-6.2 0-.6-.1-1.2-.2-1.6H7.4z" fill="#4285F4"/>
                        </svg>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProductShippingPerks;
