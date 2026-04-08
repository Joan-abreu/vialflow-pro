-- Remove the redundant trigger that creates incorrect placeholder logs
-- This trigger was causing confusion by creating "Welcome to VialFlow Pro" logs
-- that do not represent actual emails sent.

-- 1. Drop the trigger
DROP TRIGGER IF EXISTS on_profile_created_log_email ON public.profiles;

-- 2. Drop the function
DROP FUNCTION IF EXISTS public.log_registration_email();

-- 3. Clean up existing incorrect logs
DELETE FROM public.email_logs 
WHERE subject = 'Welcome to VialFlow Pro';
