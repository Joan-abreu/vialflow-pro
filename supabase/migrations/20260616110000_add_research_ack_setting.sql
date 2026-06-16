-- Add default setting for research use only (RUO) acknowledgment
insert into app_settings (key, value)
values ('require_research_acknowledgment', 'false')
on conflict (key) do nothing;
