-- How many more books a child can add to their next delivery — the same rule the parent dashboard shows:
--   a child with their own allocation: allocation − books at home not marked Returning − books already chosen
--   children sharing the plan:          (plan books − other children's allocations) − shared books kept − shared books chosen
create or replace function public.next_delivery_space(p_child_id uuid) returns int
language plpgsql stable security definer set search_path = public as $$
declare
  v_household uuid; v_alloc int; v_plan int; v_alloc_total int; v_kept int; v_next int;
begin
  select household_id, nullif(book_slot_allocation, 0) into v_household, v_alloc from child_profiles where id = p_child_id;
  if v_household is null then return 0; end if;
  -- only the family itself (or the team) may ask
  if auth.role() <> 'service_role' and not public.is_team_admin()
     and not exists (select 1 from households h where h.id = v_household and h.user_id = auth.uid()) then
    return 0;
  end if;

  if v_alloc is not null then
    select count(*) into v_kept from loans where child_id = p_child_id and status = 'checked_out' and not coalesce(return_requested, false);
    select count(*) into v_next from swap_request_items i join swap_requests r on r.id = i.swap_request_id
      where i.child_id = p_child_id and r.status in ('draft', 'child_confirmed', 'submitted', 'confirmed');
    return greatest(0, v_alloc - v_kept - v_next);
  end if;

  select sp.book_count into v_plan from subscriptions s join subscription_plans sp on sp.id = s.plan_id
    where s.household_id = v_household and s.status = 'active' order by s.start_date desc nulls last limit 1;
  v_plan := coalesce(v_plan, 4);
  select coalesce(sum(nullif(book_slot_allocation, 0)), 0) into v_alloc_total from child_profiles where household_id = v_household;
  select count(*) into v_kept from loans l join child_profiles c on c.id = l.child_id
    where c.household_id = v_household and coalesce(c.book_slot_allocation, 0) = 0 and l.status = 'checked_out' and not coalesce(l.return_requested, false);
  select count(*) into v_next from swap_request_items i join swap_requests r on r.id = i.swap_request_id join child_profiles c on c.id = i.child_id
    where c.household_id = v_household and coalesce(c.book_slot_allocation, 0) = 0 and r.status in ('draft', 'child_confirmed', 'submitted', 'confirmed');
  return greatest(0, v_plan - v_alloc_total - v_kept - v_next);
end $$;

-- Safety net: a book can't be added to a full next delivery from any screen or phone (the team's own tools are exempt).
create or replace function public.enforce_next_delivery_space() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.role() = 'service_role' then return new; end if;
  -- the same book twice is left to the existing duplicate rule
  if exists (select 1 from swap_request_items where swap_request_id = new.swap_request_id and book_id = new.book_id) then return new; end if;
  if public.next_delivery_space(new.child_id) <= 0 then raise exception 'NEXT_DELIVERY_FULL'; end if;
  return new;
end $$;
drop trigger if exists enforce_next_delivery_space on swap_request_items;
create trigger enforce_next_delivery_space before insert on swap_request_items
  for each row execute function public.enforce_next_delivery_space();
