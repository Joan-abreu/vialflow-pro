-- Fix RLS policies to use auth.jwt() ->> 'email' instead of querying auth.users table

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Promoter read own affiliate profile" ON public.affiliates;
    CREATE POLICY "Promoter read own affiliate profile" ON public.affiliates
        FOR SELECT USING (
            user_id = auth.uid() 
            OR email = (auth.jwt() ->> 'email')
        );

    DROP POLICY IF EXISTS "Promoter update own payout details" ON public.affiliates;
    CREATE POLICY "Promoter update own payout details" ON public.affiliates
        FOR UPDATE USING (
            user_id = auth.uid() 
            OR email = (auth.jwt() ->> 'email')
        ) WITH CHECK (
            user_id = auth.uid() 
            OR email = (auth.jwt() ->> 'email')
        );

    DROP POLICY IF EXISTS "Promoter read own commissions" ON public.affiliate_commissions;
    CREATE POLICY "Promoter read own commissions" ON public.affiliate_commissions
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM public.affiliates a
                WHERE a.id = affiliate_commissions.affiliate_id 
                AND (a.user_id = auth.uid() OR a.email = (auth.jwt() ->> 'email'))
            )
        );

    DROP POLICY IF EXISTS "Promoter read own payouts" ON public.affiliate_payouts;
    CREATE POLICY "Promoter read own payouts" ON public.affiliate_payouts
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM public.affiliates a
                WHERE a.id = affiliate_payouts.affiliate_id 
                AND (a.user_id = auth.uid() OR a.email = (auth.jwt() ->> 'email'))
            )
        );
END $$;
