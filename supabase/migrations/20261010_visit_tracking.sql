-- Visit tracking: where each visitor FIRST came from (anonymous — a random id kept in their browser).
create table if not exists site_visits (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null unique,
  source text not null,          -- instagram | tiktok | google | chatgpt | perplexity | gemini | claude | facebook | whatsapp | direct | other site
  medium text,                   -- utm_medium, if the link had one
  campaign text,                 -- utm_campaign, if the link had one
  referrer text,
  landing_path text,
  created_at timestamptz not null default now()
);
create index if not exists site_visits_source_idx on site_visits(source);
create index if not exists site_visits_created_idx on site_visits(created_at);
alter table site_visits enable row level security;  -- written and read only by the server

-- the same first-touch source, attached when a visitor joins the waitlist or signs up
alter table households
  add column if not exists first_touch_source text,
  add column if not exists first_touch_detail jsonb,
  add column if not exists visitor_id uuid;
alter table waitlist_signup
  add column if not exists first_touch_source text,
  add column if not exists first_touch_detail jsonb,
  add column if not exists visitor_id uuid;
