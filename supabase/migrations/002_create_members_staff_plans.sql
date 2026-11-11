-- 002: members, staff, plans
create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references gyms(id) on delete restrict,
  user_profile_id uuid references user_profiles(id) on delete set null,
  member_code text not null,
  first_name text not null,
  last_name text,
  phone text,
  email text,
  date_of_birth date,
  join_date date not null default current_date,
  status text not null default 'active' check (status in ('active','inactive','suspended','deleted')),
  assigned_trainer_id uuid,
  communication_consent boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (gym_id, member_code)
);
create unique index if not exists members_gym_id_id_key on members (gym_id, id); -- enables composite FKs

create table if not exists staff (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references gyms(id) on delete restrict,
  user_profile_id uuid references user_profiles(id) on delete set null,
  first_name text not null,
  last_name text,
  phone text,
  role text not null check (role in ('manager','front_desk','trainer','other')),
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists staff_gym_id_id_key on staff (gym_id, id);

alter table user_profiles
  add constraint user_profiles_member_fk foreign key (member_id) references members(id) on delete set null,
  add constraint user_profiles_staff_fk foreign key (staff_id) references staff(id) on delete set null;

alter table members
  add constraint members_trainer_fk foreign key (assigned_trainer_id) references staff(id) on delete set null;

create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references gyms(id) on delete restrict,
  name text not null,
  duration_days integer not null check (duration_days > 0),
  price numeric(12,2) not null check (price >= 0),
  discount numeric(12,2) not null default 0 check (discount >= 0),
  description text,
  benefits jsonb,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists plans_gym_id_id_key on plans (gym_id, id);
