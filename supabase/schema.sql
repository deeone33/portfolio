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

-- ---- order_files: visible to the order's owner + admins; only admins upload ----
create policy "Order owner and admins read files" on order_files for select using (
  exists(select 1 from orders where orders.id = order_files.order_id and (orders.user_id = auth.uid() or public.is_admin()))
);
create policy "Admins insert files" on order_files for insert with check (public.is_admin());
create policy "Admins delete files" on order_files for delete using (public.is_admin());

-- ---- order_comments: visible to the order's owner + admins; both can post ----
create policy "Order owner and admins read comments" on order_comments for select using (
  exists(select 1 from orders where orders.id = order_comments.order_id and (orders.user_id = auth.uid() or public.is_admin()))
);
create policy "Order owner and admins post comments" on order_comments for insert with check (
  exists(select 1 from orders where orders.id = order_comments.order_id and (orders.user_id = auth.uid() or public.is_admin()))
);

-- ---- storage: order owner + admins can read their deliverable files ----
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

-- ============================================================
-- SETUP STEPS (do these after running this file)
-- ============================================================
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
