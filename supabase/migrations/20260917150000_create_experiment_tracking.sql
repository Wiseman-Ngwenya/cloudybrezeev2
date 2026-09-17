-- Interest-test experiment tracking schema.
-- Applied to the connected Supabase project separately; this file keeps
-- the schema reproducible for the branch.

create table if not exists public.experiment_sessions (
  session_id text primary key,
  first_seen_at timestamptz not null default now(),
  landing_page text,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  device_type text,
  browser text,
  os text,
  user_agent text,
  screen_width integer,
  screen_height integer,
  timezone text,
  language text,
  created_at timestamptz not null default now(),
  constraint experiment_sessions_session_id_len check (char_length(session_id) between 16 and 128),
  constraint experiment_sessions_screen_width_check check (screen_width is null or screen_width between 1 and 10000),
  constraint experiment_sessions_screen_height_check check (screen_height is null or screen_height between 1 and 10000)
);

create table if not exists public.experiment_events (
  id uuid primary key default gen_random_uuid(),
  session_id text not null references public.experiment_sessions(session_id) on delete cascade,
  event_type text not null,
  product_id uuid references public.products(id) on delete set null,
  page_path text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint experiment_events_type_check check (event_type in (
    'page_view', 'product_view', 'product_image_view', 'add_to_cart',
    'remove_from_cart', 'cart_view', 'buy_now_click', 'checkout_started',
    'checkout_form_started', 'checkout_form_completed', 'payment_attempt',
    'payment_unavailable', 'newsletter_signup', 'contact_submit'
  )),
  constraint experiment_events_metadata_object_check check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.experiment_leads (
  id uuid primary key default gen_random_uuid(),
  session_id text references public.experiment_sessions(session_id) on delete set null,
  full_name text not null,
  email text not null,
  phone text,
  country_code text,
  country_name text,
  city text,
  address text,
  postal_code text,
  product_summary jsonb not null default '[]'::jsonb,
  checkout_subtotal numeric(12,2),
  checkout_shipping numeric(12,2),
  checkout_total numeric(12,2),
  currency text,
  created_at timestamptz not null default now(),
  constraint experiment_leads_name_len check (char_length(trim(full_name)) between 2 and 120),
  constraint experiment_leads_email_len check (char_length(trim(email)) between 3 and 320),
  constraint experiment_leads_product_summary_check check (jsonb_typeof(product_summary) = 'array'),
  constraint experiment_leads_amounts_check check (
    (checkout_subtotal is null or checkout_subtotal >= 0) and
    (checkout_shipping is null or checkout_shipping >= 0) and
    (checkout_total is null or checkout_total >= 0)
  )
);

create index if not exists idx_experiment_events_session_created
  on public.experiment_events(session_id, created_at desc);
create index if not exists idx_experiment_events_type_created
  on public.experiment_events(event_type, created_at desc);
create index if not exists idx_experiment_events_product_created
  on public.experiment_events(product_id, created_at desc)
  where product_id is not null;
create index if not exists idx_experiment_leads_session_created
  on public.experiment_leads(session_id, created_at desc);
create index if not exists idx_experiment_leads_created
  on public.experiment_leads(created_at desc);

alter table public.experiment_sessions enable row level security;
alter table public.experiment_events enable row level security;
alter table public.experiment_leads enable row level security;

revoke all on table public.experiment_sessions, public.experiment_events, public.experiment_leads from anon, authenticated;
grant insert on table public.experiment_sessions, public.experiment_events, public.experiment_leads to anon, authenticated;
grant select, insert, update, delete on table public.experiment_sessions, public.experiment_events, public.experiment_leads to service_role;

create policy "experiment_sessions_public_insert"
  on public.experiment_sessions
  for insert
  to anon, authenticated
  with check (char_length(session_id) between 16 and 128);

create policy "experiment_events_public_insert"
  on public.experiment_events
  for insert
  to anon, authenticated
  with check (char_length(session_id) between 16 and 128);

create policy "experiment_leads_public_insert"
  on public.experiment_leads
  for insert
  to anon, authenticated
  with check (
    char_length(trim(full_name)) between 2 and 120 and
    char_length(trim(email)) between 3 and 320 and
    jsonb_typeof(product_summary) = 'array'
  );