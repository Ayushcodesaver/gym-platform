-- 001: extensions, gyms (tenants), user_profiles (Clerk identity mapping)
create extension if not exists "pgcrypto";

create table if not exists gyms (
  id uuid primary key default gen_random_uuid(),
  clerk_organization_id text not null unique,
  name text not null,
  logo_url text,
  phone text,
  email text,
  address text,
  timezone text not null default 'Asia/Kolkata',
  no_show_threshold_days integer not null default 10 check (no_show_threshold_days between 1 and 365),
  operating_hours jsonb,
  status text not null default 'active' check (status in ('active','suspended','deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists user_profiles (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null unique,
  gym_id uuid references gyms(id) on delete set null,
  role text not null check (role in ('owner','manager','front_desk','member')),
  member_id uuid,
  staff_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- circular refs resolved after members/staff exist (002)
