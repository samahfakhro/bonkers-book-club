-- Returning books after the cutoff:
--  • families can mark MORE books as returning, or swap which ones go back,
--  • but once a delivery is locked they can't drop below the number of books that must come back for it to fit their plan.
--  • a driver's stop always knows how many books to collect (its collection list follows the family's changes).

-- how many books must be marked returning for the locked (on its way) delivery to fit the plan
create or replace function public.returns_needed(p_household uuid) returns int
language plpgsql stable security definer set search_path = public as $$
declare v_locked int; v_home int; v_plan int;
begin
  select count(*) into v_locked from swap_request_items i join swap_requests r on r.id = i.swap_request_id
    where r.household_id = p_household and r.status = 'locked';
  if v_locked = 0 then return 0; end if;   -- before the cutoff (nothing locked) they can change freely
  select count(*) into v_home from loans where household_id = p_household and status = 'checked_out';
  select sp.book_count into v_plan from subscriptions s join subscription_plans sp on sp.id = s.plan_id
    where s.household_id = p_household and s.status in ('active', 'cancelling') order by s.start_date desc nulls last limit 1;
  return greatest(0, v_home + v_locked - coalesce(v_plan, 4));
end $$;

create or replace function public.loans_returning_rules() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_needed int; v_left int; v_stop uuid;
begin
  if new.return_requested is not distinct from old.return_requested then return new; end if;

  if old.return_requested and not new.return_requested then
    -- unticking: not below what the locked delivery needs (the team's own tools are exempt)
    if auth.role() <> 'service_role' and new.status = 'checked_out' then
      v_needed := public.returns_needed(new.household_id);
      select count(*) into v_left from loans
        where household_id = new.household_id and status = 'checked_out' and return_requested and id <> new.id;
      if v_left < v_needed then raise exception 'RETURNS_NEEDED:%', v_needed; end if;
    end if;
    new.collection_stop_id := null;
  elsif new.return_requested and new.collection_stop_id is null then
    -- ticking after the route was made: add it to the family's upcoming stop, if there is one
    select rs.id into v_stop from route_stops rs join routes r on r.id = rs.route_id
      where rs.household_id = new.household_id and rs.status <> 'done' and rs.cancelled_at is null and r.status <> 'completed'
      order by r.route_date limit 1;
    new.collection_stop_id := v_stop;
  end if;
  return new;
end $$;
drop trigger if exists loans_returning_rules on loans;
create trigger loans_returning_rules before update of return_requested on loans
  for each row execute function public.loans_returning_rules();

-- keep each stop's "books to collect" count right after a change
create or replace function public.refresh_stop_collections() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  foreach v_id in array array_remove(array[old.collection_stop_id, new.collection_stop_id], null) loop
    update route_stops rs set expected_collections_count = (select count(*) from loans where collection_stop_id = v_id),
      stop_type = case when rs.expected_deliveries_count > 0 and (select count(*) from loans where collection_stop_id = v_id) > 0 then 'both'
                       when (select count(*) from loans where collection_stop_id = v_id) > 0 then 'collection' else 'delivery' end
      where rs.id = v_id and rs.status <> 'done';
  end loop;
  return null;
end $$;
drop trigger if exists refresh_stop_collections on loans;
create trigger refresh_stop_collections after update of collection_stop_id on loans
  for each row when (old.collection_stop_id is distinct from new.collection_stop_id)
  execute function public.refresh_stop_collections();
