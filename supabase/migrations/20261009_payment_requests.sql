-- Damage history + payment requests (lost or damaged books). Never charged automatically:
-- admin requests, can edit or waive; marked Paid by hand until Stripe is connected.
alter table damage_charges
  add column if not exists kind text not null default 'damaged',   -- 'lost' | 'damaged'
  add column if not exists loan_id uuid references loans(id) on delete set null,
  add column if not exists inspection_id uuid references return_inspections(id) on delete set null,
  add column if not exists notes text,
  add column if not exists resolved_at timestamptz;
-- status: 'requested' | 'paid' | 'waived' | 'disputed'

insert into system_settings (key, value, description) values
  ('default_replacement_aed', '60', 'Replacement price used when a copy has no price of its own'),
  ('lost_charge_percent', '100', 'Lost book: % of the replacement price suggested'),
  ('damage_charge_percent', '50', 'Damaged book: % of the replacement price suggested'),
  ('damage_warning_level', '3', 'Damaged books before a family gets a ⚠ flag'),
  ('on_hold_needs_action_weeks', '4', 'Weeks on hold before a family moves to Needs action')
on conflict (key) do nothing;

-- parents can see their own payment requests
alter table damage_charges enable row level security;
drop policy if exists parent_read_own_damage_charges on damage_charges;
create policy parent_read_own_damage_charges on damage_charges for select
  using (household_id in (select id from households where user_id = auth.uid()));
drop policy if exists admin_read_all_damage_charges on damage_charges;
create policy admin_read_all_damage_charges on damage_charges for select using (auth.email() = 'samahfakhro@gmail.com');
