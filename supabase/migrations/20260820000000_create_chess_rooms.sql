create table if not exists public.chess_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  host_id uuid not null references auth.users(id) on delete cascade,
  guest_id uuid references auth.users(id) on delete cascade,
  status text not null default 'waiting' check (status in ('waiting', 'active', 'complete')),
  created_at timestamptz not null default now()
);
alter table public.chess_rooms enable row level security;
create policy "Room participants can read rooms" on public.chess_rooms for select using (auth.uid() = host_id or auth.uid() = guest_id);
create policy "Users can create rooms" on public.chess_rooms for insert with check (auth.uid() = host_id);
create policy "Users can join rooms" on public.chess_rooms for update using (auth.uid() = guest_id or (guest_id is null and auth.uid() <> host_id)) with check (auth.uid() = host_id or auth.uid() = guest_id);
