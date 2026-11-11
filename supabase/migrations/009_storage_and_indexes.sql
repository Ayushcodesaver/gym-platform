-- 009: Supabase Storage buckets + supplementary indexes
-- Private buckets; access is granted only through the backend (service role) after
-- authorization checks, per docs/database.md §54–55. Tenant-aware object paths:
--   gym-assets/{gym_id}/logo.png
--   receipts/{gym_id}/{payment_id}.pdf
--   member-documents/{gym_id}/{member_id}/document.pdf
--   addon-images/{gym_id}/{add_on_id}.png

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('gym-assets', 'gym-assets', false, 5242880, array['image/png','image/jpeg','image/webp']),
  ('receipts', 'receipts', false, 10485760, array['application/pdf']),
  ('member-documents', 'member-documents', false, 10485760, array['application/pdf','image/png','image/jpeg']),
  ('addon-images', 'addon-images', false, 5242880, array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

-- Supplementary indexes for report/notification query patterns
create index if not exists idx_notifications_gym_type on notifications (gym_id, type);
create index if not exists idx_notifications_member_status on notifications (member_id, status);
create index if not exists idx_renewal_orders_member on renewal_orders (member_id);
create index if not exists idx_renewal_orders_status on renewal_orders (status);
create index if not exists idx_audit_logs_action on audit_logs (action);
create index if not exists idx_qr_sessions_gym_status on qr_sessions (gym_id, status);
