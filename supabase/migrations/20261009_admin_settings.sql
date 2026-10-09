-- Admin Settings page: everything that used to be fixed in the code.

-- plans (signup and plan size read from here)
insert into subscription_plans (name, book_count, price_monthly, is_active)
select 'A Little Bonkers', 4, 149, true where not exists (select 1 from subscription_plans where name = 'A Little Bonkers');
insert into subscription_plans (name, book_count, price_monthly, is_active)
select 'Quite Bonkers', 6, 199, true where not exists (select 1 from subscription_plans where name = 'Quite Bonkers');

-- families who signed up before plans existed in the database
update subscriptions s set plan_id = p.id from subscription_plans p
where s.plan_id is null and p.name = 'A Little Bonkers';

insert into system_settings (key, value, description) values
  ('cutoff_days_before', '2', 'Books must be chosen this many days before the Bonkers Day (time is set per zone)'),
  ('contact_whatsapp', '', 'WhatsApp number shown to parents on the Support page'),
  ('contact_email', 'hello@bonkers.ae', 'Email shown to parents on the Support page'),
  ('how_heard_options', '[{"value":"friend","label":"Family/Friends","followUp":null},{"value":"instagram","label":"Instagram/TikTok","followUp":null},{"value":"school","label":"My child''s school","followUp":"Which school?"},{"value":"influencer","label":"Influencer/Blogger","followUp":null},{"value":"flyer","label":"Flyer","followUp":null},{"value":"google","label":"Internet Search","followUp":null},{"value":"ai","label":"AI Search","followUp":null},{"value":"other","label":"Other","followUp":"Tell us more"}]', '"How did you hear about us?" options at signup'),
  ('default_notify_whatsapp', 'true', 'New families start with WhatsApp messages on'),
  ('default_notify_email', 'true', 'New families start with email messages on')
on conflict (key) do nothing;
