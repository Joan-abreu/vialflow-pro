create table if not exists public.orders (
    id uuid not null default gen_random_uuid(),
    user_id uuid references auth.users on delete set null,
    total_amount numeric not null default 0,
    status text not null default 'pending',
    shipping_address jsonb,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    constraint orders_pkey primary key (id)
);

create table if not exists public.order_items (
    id uuid not null default gen_random_uuid(),
    order_id uuid references public.orders on delete cascade,
    product_id uuid references public.products on delete set null,
    quantity integer not null default 1,
    price_at_time numeric not null default 0,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    constraint order_items_pkey primary key (id)
);

-- Add RLS policies
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Allow admins (authenticated users for now in this context) to view all orders
create policy "Enable read access for authenticated users"
on public.orders for select
to authenticated
using (true);

create policy "Enable insert for authenticated users"
on public.orders for insert
to authenticated
with check (true);

create policy "Enable update for authenticated users"
on public.orders for update
to authenticated
using (true);

-- Allow admins to view all order items
create policy "Enable read access for authenticated users"
on public.order_items for select
to authenticated
using (true);

create policy "Enable insert for authenticated users"
on public.order_items for insert
to authenticated
with check (true);
