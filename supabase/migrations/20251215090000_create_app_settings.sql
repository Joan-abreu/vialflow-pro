create table if not exists app_settings (
    key text primary key,
    value text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table app_settings enable row level security;

-- Policies
create policy "Public read access"
    on app_settings for select
    to public
    using (true);

create policy "Admin access"
    on app_settings for all
    using (
        exists (
            select 1 from public.user_roles
            where user_roles.user_id = auth.uid()
            and user_roles.role = 'admin'
        )
    );

-- Insert default maintenance mode setting
insert into app_settings (key, value)
values ('maintenance_mode', 'false')
on conflict (key) do nothing;
