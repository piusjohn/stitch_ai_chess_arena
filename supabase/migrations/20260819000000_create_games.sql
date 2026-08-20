create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  opponent_id text not null,
  opponent_name text not null,
  opponent_difficulty text not null,
  result text not null,
  status text not null,
  move_count integer not null check (move_count >= 0),
  moves jsonb not null default '[]'::jsonb,
  starting_fen text not null,
  final_fen text not null,
  player_accuracy numeric,
  blunders integer not null default 0 check (blunders >= 0),
  mistakes integer not null default 0 check (mistakes >= 0),
  great_moves integer not null default 0 check (great_moves >= 0),
  started_at timestamptz not null default now(),
  completed_at timestamptz not null default now()
);

alter table public.games enable row level security;

create policy "Users can read their own games" on public.games
  for select using (auth.uid() = user_id);
create policy "Users can insert their own games" on public.games
  for insert with check (auth.uid() = user_id);
create policy "Users can update their own games" on public.games
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete their own games" on public.games
  for delete using (auth.uid() = user_id);

create index if not exists games_user_completed_idx on public.games (user_id, completed_at desc);
