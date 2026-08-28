-- ============================================================
-- Admin delete permissions — none of these tables had a DELETE
-- policy for admins before now. Purely additive.
-- ============================================================
create policy "Admins delete orders" on orders for delete using (public.is_admin());
create policy "Only admins can delete analytics" on analytics_events for delete using (public.is_admin());
create policy "Only admins can delete chat sessions" on chat_sessions for delete using (public.is_admin());
