-- Create product_coas table
create table if not exists public.product_coas (
    id uuid primary key default gen_random_uuid(),
    product_id uuid references public.products(id) on delete cascade,
    batch_number text not null,
    test_date date not null,
    pdf_url text not null,
    purity_pct numeric(5,2),
    ph_level numeric(4,2),
    benzyl_alcohol_pct numeric(4,2),
    sterility_status text default 'Pass',
    is_active boolean default true,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table public.product_coas enable row level security;

-- Drop existing policies if any
drop policy if exists "COAs are viewable by everyone" on public.product_coas;
drop policy if exists "Admins can manage COAs" on public.product_coas;

-- Create policies for product_coas
create policy "COAs are viewable by everyone"
on public.product_coas for select
using (true);

create policy "Admins can manage COAs"
on public.product_coas for all
using (
    exists (
        select 1 from public.user_roles
        where user_roles.user_id = auth.uid()
        and user_roles.role = 'admin'
    )
);

-- Create storage bucket for COAs (if not exists)
insert into storage.buckets (id, name, public)
values ('coas', 'coas', true)
on conflict (id) do nothing;

-- Drop existing storage policies if any
drop policy if exists "Public can view COA documents" on storage.objects;
drop policy if exists "Admins can manage COA documents" on storage.objects;

-- Create storage policies for COA documents
create policy "Public can view COA documents"
on storage.objects for select
using (bucket_id = 'coas');

create policy "Admins can manage COA documents"
on storage.objects for all
using (
    bucket_id = 'coas'
    and (
        exists (
            select 1 from public.user_roles
            where user_roles.user_id = auth.uid()
            and user_roles.role = 'admin'
        )
    )
);
