-- Fix RLS policy for units_of_measurement to allow authenticated users to manage units
DROP POLICY IF EXISTS "Admins can manage units" ON public.units_of_measurement;

CREATE POLICY "Authenticated users can manage units" 
ON public.units_of_measurement 
FOR ALL 
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid())
);