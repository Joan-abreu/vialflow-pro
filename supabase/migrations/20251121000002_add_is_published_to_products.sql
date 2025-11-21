-- Add is_published column to products table
alter table public.products
add column if not exists is_published boolean default false;

-- Add comment
comment on column public.products.is_published is 'Controls whether product is visible in e-commerce store (separate from is_active for manufacturing)';

-- Update existing products to be published by default (optional - adjust as needed)
update public.products
set is_published = true
where is_active = true;
