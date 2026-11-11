-- 005: payments, renewal_orders, refunds, add_ons, add_on_orders
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references gyms(id) on delete restrict,
  member_id uuid not null references members(id) on delete restrict,
  membership_id uuid references memberships(id) on delete set null,
  provider text,
  provider_reference text unique,            -- idempotency anchor (TRD §47)
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'INR' check (currency = 'INR'),
  status text not null default 'pending'
    check (status in ('created','pending','paid','failed','refunded','reversed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists renewal_orders (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references gyms(id) on delete restrict,
  member_id uuid not null,
  membership_id uuid not null,
  plan_id uuid not null,
  payment_id uuid references payments(id) on delete set null,
  amount numeric(12,2) not null check (amount >= 0),
  status text not null default 'pending'
    check (status in ('pending','paid','failed','cancelled','refunded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint renewal_orders_member_fk foreign key (gym_id, member_id)
    references members (gym_id, id) on delete restrict,
  constraint renewal_orders_membership_fk foreign key (gym_id, membership_id)
    references memberships (gym_id, id) on delete restrict,
  constraint renewal_orders_plan_fk foreign key (gym_id, plan_id)
    references plans (gym_id, id) on delete restrict
);

create table if not exists refunds (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references gyms(id) on delete restrict,
  payment_id uuid not null references payments(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  provider_reference text,
  reason text,
  status text not null default 'pending'
    check (status in ('pending','processed','failed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists add_ons (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references gyms(id) on delete restrict,
  name text not null,
  type text not null check (type in ('pt','diet','product','supplement','service')),
  description text,
  price numeric(12,2) not null check (price >= 0),
  duration integer,
  session_count integer,
  stock integer check (stock is null or stock >= 0),
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists add_ons_gym_id_id_key on add_ons (gym_id, id);

create table if not exists add_on_orders (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references gyms(id) on delete restrict,
  member_id uuid not null,
  add_on_id uuid not null,
  payment_id uuid references payments(id) on delete set null,
  trainer_id uuid references staff(id) on delete set null,
  quantity integer not null default 1 check (quantity > 0),
  status text not null default 'pending'
    check (status in ('pending','paid','failed','cancelled','fulfilled')),
  sessions_remaining integer check (sessions_remaining is null or sessions_remaining >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint add_on_orders_member_fk foreign key (gym_id, member_id)
    references members (gym_id, id) on delete restrict,
  constraint add_on_orders_addon_fk foreign key (gym_id, add_on_id)
    references add_ons (gym_id, id) on delete restrict
);

do $$
begin
  execute 'drop trigger if exists trg_payments_updated on payments';
  execute 'create trigger trg_payments_updated before update on payments
           for each row execute function set_updated_at()';
  execute 'drop trigger if exists trg_renewal_orders_updated on renewal_orders';
  execute 'create trigger trg_renewal_orders_updated before update on renewal_orders
           for each row execute function set_updated_at()';
  execute 'drop trigger if exists trg_refunds_updated on refunds';
  execute 'create trigger trg_refunds_updated before update on refunds
           for each row execute function set_updated_at()';
  execute 'drop trigger if exists trg_add_ons_updated on add_ons';
  execute 'create trigger trg_add_ons_updated before update on add_ons
           for each row execute function set_updated_at()';
  execute 'drop trigger if exists trg_add_on_orders_updated on add_on_orders';
  execute 'create trigger trg_add_on_orders_updated before update on add_on_orders
           for each row execute function set_updated_at()';
end $$;
