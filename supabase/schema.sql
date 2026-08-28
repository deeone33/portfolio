-- ============================================================
-- Fieldnote — Full schema (content + accounts + orders + payments)
-- Run this in the Supabase SQL editor on a fresh project, top to bottom.
-- ============================================================

-- ------------------------------------------------------------
-- SITES & CONTENT (same shape as the Tier 1 CMS prototype —
-- ready for when the multi-page CMS gets wired to the database
-- instead of local storage; not required for orders/payments to work)
-- ------------------------------------------------------------
create table sites (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  created_at timestamptz default now()
);

create table page_content (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references sites(id) on delete cascade,
  page_slug text not null,           -- 'home' | 'work' | 'services' | 'pricing' | 'quote' | 'start-project'
  content jsonb not null,
  updated_at timestamptz default now(),
  updated_by uuid references auth.users(id),
  unique(site_id, page_slug)
);

-- ------------------------------------------------------------
-- PEOPLE
-- ------------------------------------------------------------
-- Supabase Auth already gives us auth.users (email, password hash,
-- Google identity, etc). This table extends it with app-specific fields.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz default now()
);

-- Who can access the admin backoffice
create table admin_users (
  user_id uuid references auth.users(id) primary key,
  role text not null default 'staff'  -- 'staff' | 'owner'
);

-- Auto-create a profile row whenever someone signs up
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ------------------------------------------------------------
-- QUOTE REQUESTS (from the "Get a quote" page — no login required)
-- ------------------------------------------------------------
create table quote_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  company text,
  budget text,
  message text,
  status text not null default 'new',  -- 'new' | 'contacted' | 'closed'
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- ORDERS
-- ------------------------------------------------------------
create table orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  plan_key text not null,             -- 'starter' | 'standard' | 'fullbuild'
  plan_label text not null,
  price_cents integer not null,
  currency text not null default 'eur',
  status text not null default 'pending_payment',
  -- 'pending_payment' | 'paid' | 'in_progress' | 'delivered' | 'cancelled'
  notes text,                         -- customer's project notes at checkout
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Second FK on the same column, pointing at profiles instead of auth.users.
-- Both are valid (profiles.id always equals the matching auth.users.id via
-- the handle_new_user trigger) — this one exists purely so PostgREST has a
-- direct relationship to join through when the admin backoffice asks for
-- "this order's customer name and email" in one query.
alter table orders add constraint orders_profile_fk foreign key (user_id) references profiles(id);

-- Files delivered to the customer for an order (uploaded by staff)
create table order_files (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  file_path text not null,            -- path inside the 'deliverables' storage bucket
  file_name text not null,
  uploaded_by uuid references auth.users(id),
  uploaded_by_role text not null default 'staff', -- 'staff' | 'customer' — lets the UI show "delivered by us" vs "your upload" separately
  created_at timestamptz default now()
);

-- Comment thread per order (both staff and the customer can post)
create table order_comments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  author_id uuid references auth.users(id),
  author_role text not null,          -- 'staff' | 'customer'
  body text not null,
  created_at timestamptz default now()
);

-- Storage bucket for delivered files — private, not public, since these
-- are paid deliverables tied to a specific customer's order.
insert into storage.buckets (id, name, public) values ('deliverables', 'deliverables', false)
on conflict do nothing;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table sites enable row level security;
alter table page_content enable row level security;
alter table profiles enable row level security;
alter table admin_users enable row level security;
alter table quote_requests enable row level security;
alter table orders enable row level security;
alter table order_files enable row level security;
alter table order_comments enable row level security;

-- Helper: is the current user a staff/admin?
create function public.is_admin()
returns boolean as $$
  select exists(select 1 from admin_users where user_id = auth.uid());
$$ language sql security definer stable;

-- ---- sites: public read (just a slug list), admin-only write ----
create policy "Anyone can read sites" on sites for select using (true);
create policy "Admins manage sites" on sites for insert with check (public.is_admin());
create policy "Admins update sites" on sites for update using (public.is_admin());

-- ---- page_content: public read, admin write ----
create policy "Anyone can read page content" on page_content for select using (true);
create policy "Admins can write page content" on page_content for all
  using (public.is_admin()) with check (public.is_admin());

-- ---- profiles: user sees their own, admins see all ----
create policy "Users read own profile" on profiles for select using (auth.uid() = id or public.is_admin());
create policy "Users update own profile" on profiles for update using (auth.uid() = id);

-- ---- admin_users: only readable by admins themselves ----
create policy "Admins see admin list" on admin_users for select using (public.is_admin());

-- ---- quote_requests: anyone can submit, only admins can read ----
create policy "Anyone can submit a quote request" on quote_requests for insert with check (true);
create policy "Admins can read quote requests" on quote_requests for select using (public.is_admin());
create policy "Admins can update quote requests" on quote_requests for update using (public.is_admin());

-- ---- orders: customers see their own; admins see everything ----
create policy "Customers read own orders" on orders for select using (auth.uid() = user_id or public.is_admin());
create policy "Customers create their own orders" on orders for insert with check (auth.uid() = user_id);
create policy "Admins update orders" on orders for update using (public.is_admin());

-- ---- order_files: visible to the order's owner + admins; admins upload deliverables, the owner can also upload their own files ----
create policy "Order owner and admins read files" on order_files for select using (
  exists(select 1 from orders where orders.id = order_files.order_id and (orders.user_id = auth.uid() or public.is_admin()))
);
create policy "Admins insert files" on order_files for insert with check (public.is_admin());
create policy "Order owner can insert their own upload record" on order_files for insert with check (
  uploaded_by_role = 'customer'
  and exists(select 1 from orders where orders.id = order_files.order_id and orders.user_id = auth.uid())
);
create policy "Admins delete files" on order_files for delete using (public.is_admin());

-- ---- order_comments: visible to the order's owner + admins; both can post ----
create policy "Order owner and admins read comments" on order_comments for select using (
  exists(select 1 from orders where orders.id = order_comments.order_id and (orders.user_id = auth.uid() or public.is_admin()))
);
create policy "Order owner and admins post comments" on order_comments for insert with check (
  exists(select 1 from orders where orders.id = order_comments.order_id and (orders.user_id = auth.uid() or public.is_admin()))
);

-- ---- storage: order owner + admins can read; admins upload deliverables, the owner can upload into their own order's folder ----
create policy "Order owner and admins read deliverables"
  on storage.objects for select
  using (
    bucket_id = 'deliverables'
    and exists(
      select 1 from order_files
      join orders on orders.id = order_files.order_id
      where order_files.file_path = storage.objects.name
      and (orders.user_id = auth.uid() or public.is_admin())
    )
  );
create policy "Admins upload deliverables"
  on storage.objects for insert
  with check (bucket_id = 'deliverables' and public.is_admin());
create policy "Order owner can upload into their own order folder"
  on storage.objects for insert
  with check (
    bucket_id = 'deliverables'
    and exists(
      select 1 from orders
      where orders.id::text = split_part(storage.objects.name, '/', 1)
      and orders.user_id = auth.uid()
    )
  );

-- ============================================================
-- ANALYTICS
-- Lightweight event log: pageviews, scroll-depth milestones, and login
-- events. Anyone (including anonymous visitors) can write an event — that's
-- necessary for tracking to work at all before someone's logged in — but
-- only admins can ever read this table back.
-- ============================================================
create table analytics_events (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,           -- random id stored in the visitor's sessionStorage, not tied to identity
  user_id uuid references auth.users(id), -- set only if they happen to be logged in
  event_type text not null,           -- 'pageview' | 'scroll_depth' | 'login'
  page_path text,
  scroll_percent integer,             -- only set for 'scroll_depth' events: 25 / 50 / 75 / 100
  referrer text,
  created_at timestamptz default now()
);
alter table analytics_events enable row level security;
create policy "Anyone can log an analytics event" on analytics_events for insert with check (true);
create policy "Only admins can read analytics" on analytics_events for select using (public.is_admin());

-- ============================================================
-- CHAT
-- Every visitor — logged in or fully anonymous — needs a real auth.uid()
-- for this to be secure: without one, RLS can't tell one visitor's private
-- messages apart from another's. Anonymous visitors get one via Supabase's
-- built-in Anonymous Sign-In (see setup step below); logged-in customers
-- just use their real account id.
-- ============================================================
create table chat_sessions (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid references auth.users(id) not null,
  visitor_name text,
  visitor_email text, -- optional; mainly for anonymous visitors who left a message while no admin was online, so there's a way to follow up
  status text not null default 'open', -- 'open' | 'closed'
  created_at timestamptz default now(),
  last_message_at timestamptz default now()
);
alter table chat_sessions enable row level security;
create policy "Visitor and admins read own session" on chat_sessions for select using (visitor_id = auth.uid() or public.is_admin());
create policy "Visitor creates own session" on chat_sessions for insert with check (visitor_id = auth.uid());
create policy "Visitor and admins update own session" on chat_sessions for update using (visitor_id = auth.uid() or public.is_admin());

create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references chat_sessions(id) on delete cascade not null,
  sender_role text not null, -- 'visitor' | 'admin'
  body text not null,
  created_at timestamptz default now()
);
alter table chat_messages enable row level security;
create policy "Visitor and admins read session messages" on chat_messages for select using (
  exists(select 1 from chat_sessions where chat_sessions.id = chat_messages.session_id and (chat_sessions.visitor_id = auth.uid() or public.is_admin()))
);
create policy "Visitor and admins send session messages" on chat_messages for insert with check (
  exists(select 1 from chat_sessions where chat_sessions.id = chat_messages.session_id and (chat_sessions.visitor_id = auth.uid() or public.is_admin()))
);

-- ============================================================
-- SETUP STEPS (do these after running this file)
-- ============================================================
-- 0. Enable Anonymous Sign-Ins: Supabase Dashboard > Authentication >
--    Sign In / Providers > toggle on "Anonymous Sign-Ins". Required for
--    chat to work for visitors who aren't logged in.
--
-- 1. insert into sites (slug) values ('fieldnote');
--
-- 2. Enable Google as an auth provider:
--    Supabase Dashboard > Authentication > Providers > Google
--    You'll need a Google Cloud OAuth Client ID + Secret — see README.md.
--
-- 3. Make yourself an admin:
--    Sign up normally on the site first (creates your auth.users row),
--    then in the SQL editor:
--    insert into admin_users (user_id, role)
--    values ('<your-auth-user-uuid>', 'owner');
--
-- 4. Set up Stripe (see README.md for the full walkthrough):
--    - Create a Stripe account, get your secret key
--    - Deploy the two Edge Functions in supabase/functions/
--    - Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET as function secrets
--    - Point a Stripe webhook at your deployed stripe-webhook function URL,
--      listening for the checkout.session.completed event
