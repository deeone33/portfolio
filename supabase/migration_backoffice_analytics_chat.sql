-- ============================================================
-- CONSOLIDATED MIGRATION — everything needed for:
--   - Customer backoffice (customer file uploads)
--   - Admin backoffice + analytics
--   - Chat
-- Run this once, in this order, in the Supabase SQL Editor.
-- Purely additive — doesn't touch any existing table's data.
-- ============================================================

-- ---------- 1. Customer file uploads ----------
alter table order_files add column uploaded_by_role text not null default 'staff';

create policy "Order owner can insert their own upload record" on order_files for insert with check (
  uploaded_by_role = 'customer'
  and exists(select 1 from orders where orders.id = order_files.order_id and orders.user_id = auth.uid())
);

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

-- ---------- 2/3. Analytics ----------
create table analytics_events (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  user_id uuid references auth.users(id),
  event_type text not null,           -- 'pageview' | 'scroll_depth' | 'login'
  page_path text,
  scroll_percent integer,             -- only set for 'scroll_depth' events: 25 / 50 / 75 / 100
  referrer text,
  created_at timestamptz default now()
);
alter table analytics_events enable row level security;
create policy "Anyone can log an analytics event" on analytics_events for insert with check (true);
create policy "Only admins can read analytics" on analytics_events for select using (public.is_admin());

-- ---------- 4. Chat ----------
create table chat_sessions (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid references auth.users(id) not null,
  visitor_name text,
  visitor_email text,
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
-- After running this, one more thing — not SQL, a dashboard toggle:
-- Supabase Dashboard > Authentication > Sign In / Providers >
-- enable "Anonymous Sign-Ins". Without it, chat won't work for any
-- visitor who isn't logged in, which is most visitors.
-- ============================================================
