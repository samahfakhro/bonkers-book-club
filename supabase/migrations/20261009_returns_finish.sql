-- Returns part B: "Finished inspecting", back-on-the-shelf alerts, over-allowance grace period.

-- which check-ins have already been through "Finished inspecting"
alter table return_inspections add column if not exists batch_finished_at timestamptz;

-- one-tap "stop alerts for this book" link (no login)
alter table book_availability_notifications add column if not exists stop_token uuid not null default gen_random_uuid();
create unique index if not exists book_availability_notifications_stop_token_key on book_availability_notifications(stop_token);

-- more books at home than the plan allows
alter table households
  add column if not exists over_allowance_since date,            -- set when found at "Finished inspecting"
  add column if not exists over_allowance_grace_until date,      -- after this date, new books are on hold
  add column if not exists over_allowance_response text,         -- the family's answer: returning | lost
  add column if not exists over_allowance_responded_at timestamptz;

insert into system_settings (key, value, description)
values ('over_allowance_grace_bonkers_days', '2', 'Bonkers Days a family has to return extra books before new books go on hold')
on conflict (key) do nothing;

-- After the grace period, new books are on hold: a swap can't be submitted or sent to the parent.
create or replace function block_swaps_on_hold() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('submitted', 'child_confirmed') and new.status is distinct from old.status
     and exists (select 1 from households h where h.id = new.household_id
                 and h.over_allowance_grace_until is not null
                 and h.over_allowance_grace_until < (now() at time zone 'Asia/Dubai')::date) then
    raise exception 'NEW_BOOKS_ON_HOLD';
  end if;
  return new;
end $$;

drop trigger if exists block_swaps_on_hold on swap_requests;
create trigger block_swaps_on_hold before update on swap_requests
  for each row execute function block_swaps_on_hold();
