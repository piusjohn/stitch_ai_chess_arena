alter table public.chess_rooms
  add column if not exists fen text not null default 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  add column if not exists moves jsonb not null default '[]'::jsonb,
  add column if not exists turn text not null default 'w' check (turn in ('w', 'b')),
  add column if not exists version integer not null default 0,
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.join_chess_room(room_code text)
returns public.chess_rooms
language plpgsql security definer set search_path = public
as $$
declare room public.chess_rooms;
begin
  update public.chess_rooms
    set guest_id = auth.uid(), status = 'active', updated_at = now()
    where code = upper(room_code) and guest_id is null and host_id <> auth.uid() and status = 'waiting'
    returning * into room;
  if room.id is null then raise exception 'Room unavailable'; end if;
  return room;
end;
$$;

create or replace function public.submit_room_move(room_id uuid, expected_version integer, move_data jsonb, next_fen text)
returns public.chess_rooms
language plpgsql security definer set search_path = public
as $$
declare room public.chess_rooms;
begin
  update public.chess_rooms
    set fen = next_fen,
        moves = moves || jsonb_build_array(move_data),
        turn = case when turn = 'w' then 'b' else 'w' end,
        version = version + 1,
        updated_at = now()
    where id = room_id
      and status = 'active'
      and version = expected_version
      and ((turn = 'w' and host_id = auth.uid()) or (turn = 'b' and guest_id = auth.uid()))
    returning * into room;
  if room.id is null then raise exception 'Move rejected'; end if;
  return room;
end;
$$;

grant execute on function public.join_chess_room(text) to authenticated;
grant execute on function public.submit_room_move(uuid, integer, jsonb, text) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.chess_rooms;
exception when duplicate_object then null;
end $$;
