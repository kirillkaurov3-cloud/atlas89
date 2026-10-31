-- =====================================================================
--  Атлас 89 — таблица лидеров (Supabase / PostgreSQL)
--  Вставь весь файл в Supabase → SQL Editor → New query → Run.
--  Скрипт можно запускать повторно: он ничего не сломает.
-- =====================================================================

-- ---------- Таблица результатов ----------
create table if not exists public.scores (
  id          bigint generated always as identity primary key,
  nickname    text        not null,
  mode        text        not null default 'speedrun',
  time_ms     integer     not null,
  accuracy    numeric(4,1) not null,
  created_at  timestamptz not null default now(),

  -- ник 2–20 символов, без угловых скобок
  constraint scores_nickname_len   check (char_length(btrim(nickname)) between 2 and 20),
  constraint scores_nickname_chars check (nickname !~ '[<>]'),
  constraint scores_mode_valid     check (mode in ('speedrun', 'board')),
  -- разумные границы времени: спидран 89 регионов не быстрее 40 секунд и не дольше часа
  constraint scores_time_valid check (
    (mode = 'speedrun' and time_ms between 40000 and 3600000)
    or (mode = 'board' and time_ms between 300 and 600000)
  ),
  constraint scores_accuracy_valid check (accuracy between 0 and 100)
);

create index if not exists scores_mode_time_idx on public.scores (mode, time_ms);
create index if not exists scores_created_idx   on public.scores (created_at desc);
create index if not exists scores_nick_idx      on public.scores (lower(nickname), created_at desc);

-- ---------- Row Level Security ----------
alter table public.scores enable row level security;

drop policy if exists scores_read_all on public.scores;
-- читать могут все
create policy scores_read_all
  on public.scores for select
  to anon, authenticated
  using (true);

drop policy if exists scores_insert_anon on public.scores;
-- анонимно можно только добавлять
create policy scores_insert_anon
  on public.scores for insert
  to anon, authenticated
  with check (true);

-- Политик на update/delete нет — значит, менять и удалять нельзя никому, кроме владельца проекта.
revoke update, delete, truncate on public.scores from anon, authenticated;
-- Вставлять можно только эти колонки (id и created_at сервер ставит сам)
revoke insert on public.scores from anon, authenticated;
grant  insert (nickname, mode, time_ms, accuracy) on public.scores to anon, authenticated;
grant  select on public.scores to anon, authenticated;

-- ---------- Защита от спама ----------
-- Служебная таблица для ограничения частоты по IP (хранится только хэш).
create table if not exists public.score_ips (
  ip_hash    text        not null,
  created_at timestamptz not null default now()
);
create index if not exists score_ips_idx on public.score_ips (ip_hash, created_at desc);
alter table public.score_ips enable row level security;   -- без политик: снаружи недоступна
revoke all on public.score_ips from anon, authenticated;

create or replace function public.scores_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  headers json := nullif(current_setting('request.headers', true), '')::json;
  ip      text := coalesce(split_part(headers ->> 'x-forwarded-for', ',', 1), headers ->> 'cf-connecting-ip', '');
  recent  int;
begin
  new.nickname   := btrim(new.nickname);
  new.created_at := now();

  -- один ник — не чаще раза в 20 секунд
  if exists (
    select 1 from public.scores
    where lower(nickname) = lower(new.nickname)
      and created_at > now() - interval '20 seconds'
  ) then
    raise exception 'too_many_requests: подожди немного' using errcode = 'P0001';
  end if;

  -- всего — не больше 60 записей в минуту
  select count(*) into recent from public.scores where created_at > now() - interval '1 minute';
  if recent >= 60 then
    raise exception 'too_many_requests: сервер перегружен' using errcode = 'P0001';
  end if;

  -- с одного IP — не больше 10 записей за 10 минут
  if btrim(ip) <> '' then
    select count(*) into recent
    from public.score_ips
    where ip_hash = md5(btrim(ip)) and created_at > now() - interval '10 minutes';
    if recent >= 10 then
      raise exception 'too_many_requests: слишком часто' using errcode = 'P0001';
    end if;
    insert into public.score_ips (ip_hash) values (md5(btrim(ip)));
    delete from public.score_ips where created_at < now() - interval '1 day';
  end if;

  return new;
end;
$$;

drop trigger if exists scores_before_insert on public.scores;
create trigger scores_before_insert
  before insert on public.scores
  for each row execute function public.scores_before_insert();

-- Готово. Проверка (по желанию):
--   insert into public.scores (nickname, mode, time_ms, accuracy) values ('Тест', 'speedrun', 150000, 95);
--   select * from public.scores order by time_ms limit 10;
--   delete from public.scores where nickname = 'Тест';   -- удалять может только владелец в SQL Editor
