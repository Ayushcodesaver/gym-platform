-- Seed data (development only — never production credentials)
begin;

insert into gyms (id, clerk_organization_id, name, phone, address, no_show_threshold_days)
values ('11111111-1111-1111-1111-111111111111', 'org_2demoGymA0001', 'FitZone Delhi',
        '+919810011001', 'Connaught Place, New Delhi', 10)
on conflict do nothing;

insert into user_profiles (id, clerk_user_id, gym_id, role)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'user_owner_demo',  '11111111-1111-1111-1111-111111111111', 'owner'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'user_manager_demo','11111111-1111-1111-1111-111111111111', 'manager'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'user_desk_demo',   '11111111-1111-1111-1111-111111111111', 'front_desk')
on conflict do nothing;

insert into staff (id, gym_id, user_profile_id, first_name, last_name, phone, role)
values
  ('bbbbbbbb-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000002', 'Rahul', 'Manager', '+919810011002', 'manager'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000003', 'Aman',  'Desk',    '+919810011003', 'front_desk')
on conflict do nothing;

update user_profiles set staff_id = 'bbbbbbbb-0000-0000-0000-000000000001'
 where id = 'aaaaaaaa-0000-0000-0000-000000000002';
update user_profiles set staff_id = 'bbbbbbbb-0000-0000-0000-000000000002'
 where id = 'aaaaaaaa-0000-0000-0000-000000000003';

insert into plans (id, gym_id, name, duration_days, price, discount, description)
values
  ('cccccccc-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Basic',   30,  999.00, 0,   'Gym floor access'),
  ('cccccccc-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Premium', 30,  1499.00, 100, 'Floor + group classes'),
  ('cccccccc-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Quarterly', 90, 3999.00, 200, 'Floor + classes + 1 PT session')
on conflict do nothing;

-- 20 members with codes GYM1001..GYM1020
insert into members (gym_id, member_code, first_name, last_name, phone, join_date, status)
select
  '11111111-1111-1111-1111-111111111111',
  'GYM' || (1000 + n),
  'Member' || n,
  'Demo',
  '+9198' || lpad((10000000 + n)::text, 8, '0'),
  current_date - interval '90 days' + (n || ' days')::interval,
  'active'
from generate_series(1, 20) as n
on conflict do nothing;

-- Memberships: alternate plans, expiry spread across -5..+20 days
insert into memberships (gym_id, member_id, plan_id, start_date, expiry_date, status)
select
  m.gym_id,
  m.id,
  (array['cccccccc-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000002',
         'cccccccc-0000-0000-0000-000000000003'])[1 + (row_number() over (order by m.id))::int % 3],
  current_date - interval '25 days',
  current_date + ((row_number() over (order by m.id))::int % 26 - 5),
  'active'
from members m
where m.gym_id = '11111111-1111-1111-1111-111111111111'
on conflict do nothing;

-- Attendance: for each member, a check-in 0..12 days ago (drives no-show demo data)
insert into attendance (gym_id, member_id, checked_in_at, source)
select
  m.gym_id, m.id,
  now() - ((row_number() over (order by m.id))::int % 13 || ' days')::interval,
  'qr'
from members m
where m.gym_id = '11111111-1111-1111-1111-111111111111'
on conflict do nothing;

insert into add_ons (id, gym_id, name, type, description, price, session_count, stock)
values
  ('dddddddd-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Personal Training', 'pt',        '10 sessions with a certified trainer', 3999.00, 10, null),
  ('dddddddd-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Diet Plan',         'diet',      'Custom monthly diet plan',            999.00,  null, null),
  ('dddddddd-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Whey Protein 1kg',  'supplement','Standard whey, chocolate',            2499.00, null, 25)
on conflict do nothing;

insert into settings (gym_id, attendance_settings, renewal_settings)
values ('11111111-1111-1111-1111-111111111111',
        '{"duplicate_checkin_minutes": 120}',
        '{"reminders_enabled": true}')
on conflict do nothing;

commit;
