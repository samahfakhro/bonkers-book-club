-- Settings → Plan: upgrade, downgrade (on the billing date, once the family fits), pause / resume, cancel.
-- Subscription statuses: active | paused | cancelling (ends at cancel_at) | cancelled. No refunds, ever.
alter table subscriptions add column if not exists paused_days_remaining int;          -- paid days frozen while paused
alter table subscriptions add column if not exists scheduled_plan_id uuid;  -- a booked downgrade (deliberately no FK: a second link would make the app's subscription_plans lookups ambiguous)
alter table subscriptions add column if not exists cancel_at date;                      -- last day of a cancelling membership
alter table subscriptions add column if not exists downgrade_reminded_for date;        -- billing date we last sent the downgrade reminder for
alter table subscriptions add column if not exists downgrade_checked_for date;         -- billing date we last tried the downgrade for
alter table subscription_plans add column if not exists stripe_price_id text;           -- Stripe price for each plan (set when Stripe is connected)

-- every membership needs a next billing date: the next monthly date after it started
update subscriptions s set next_billing_date = (
  select (s.start_date + make_interval(months => n))::date from generate_series(1, 600) n
  where (s.start_date + make_interval(months => n))::date > current_date order by n limit 1
) where next_billing_date is null and start_date is not null;

-- a family whose membership isn't active (paused / cancelling / cancelled) has no space for new books
create or replace function public.membership_inactive(p_household uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from subscriptions where household_id = p_household and status = 'active')
     and exists (select 1 from subscriptions where household_id = p_household and status in ('paused', 'cancelling', 'cancelled'))
$$;

create or replace function public.next_delivery_space(p_child_id uuid) returns int
language plpgsql stable security definer set search_path = public as $$
declare
  v_household uuid; v_alloc int; v_plan int; v_alloc_total int; v_kept int; v_next int;
begin
  select household_id, nullif(book_slot_allocation, 0) into v_household, v_alloc from child_profiles where id = p_child_id;
  if v_household is null then return 0; end if;
  if auth.role() <> 'service_role' and not public.is_team_admin()
     and not exists (select 1 from households h where h.id = v_household and h.user_id = auth.uid()) then
    return 0;
  end if;
  if public.membership_inactive(v_household) then return 0; end if;

  -- books already chosen (including a locked delivery that's on its way) take a space
  if v_alloc is not null then
    select count(*) into v_kept from loans where child_id = p_child_id and status = 'checked_out' and not coalesce(return_requested, false);
    select count(*) into v_next from swap_request_items i join swap_requests r on r.id = i.swap_request_id
      where i.child_id = p_child_id and r.status in ('draft', 'child_confirmed', 'submitted', 'confirmed', 'locked');
    return greatest(0, v_alloc - v_kept - v_next);
  end if;

  select sp.book_count into v_plan from subscriptions s join subscription_plans sp on sp.id = s.plan_id
    where s.household_id = v_household and s.status = 'active' order by s.start_date desc nulls last limit 1;
  v_plan := coalesce(v_plan, 4);
  select coalesce(sum(nullif(book_slot_allocation, 0)), 0) into v_alloc_total from child_profiles where household_id = v_household;
  select count(*) into v_kept from loans l join child_profiles c on c.id = l.child_id
    where c.household_id = v_household and coalesce(c.book_slot_allocation, 0) = 0 and l.status = 'checked_out' and not coalesce(l.return_requested, false);
  select count(*) into v_next from swap_request_items i join swap_requests r on r.id = i.swap_request_id join child_profiles c on c.id = i.child_id
    where c.household_id = v_household and coalesce(c.book_slot_allocation, 0) = 0 and r.status in ('draft', 'child_confirmed', 'submitted', 'confirmed', 'locked');
  return greatest(0, v_plan - v_alloc_total - v_kept - v_next);
end $$;

create or replace function public.enforce_next_delivery_space() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_household uuid;
begin
  if auth.role() = 'service_role' then return new; end if;
  if exists (select 1 from swap_request_items where swap_request_id = new.swap_request_id and book_id = new.book_id) then return new; end if;
  select household_id into v_household from child_profiles where id = new.child_id;
  if public.membership_inactive(v_household) then raise exception 'MEMBERSHIP_INACTIVE'; end if;
  if public.next_delivery_space(new.child_id) <= 0 then raise exception 'NEXT_DELIVERY_FULL'; end if;
  return new;
end $$;
