-- Admin → Messages: edited wording for automatic messages (originals live in lib/message-templates.ts).
create table if not exists message_templates (
  key text primary key,
  title text,
  body text not null,
  updated_at timestamptz not null default now(),
  updated_by text
);
alter table message_templates enable row level security;   -- only the server reads/writes it
