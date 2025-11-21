-- Add phone column to profiles table
alter table public.profiles
add column if not exists phone text;

-- Add comment
comment on column public.profiles.phone is 'User phone number for contact purposes';