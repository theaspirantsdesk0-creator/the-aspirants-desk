create or replace function private.is_valid_course_quiz(p_quiz jsonb)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  question jsonb;
  answer_option jsonb;
  option_list jsonb;
  correct_index integer;
begin
  if p_quiz is null or jsonb_typeof(p_quiz) is distinct from 'array' then
    return false;
  end if;
  if jsonb_array_length(p_quiz) > 20 then
    return false;
  end if;

  for question in select value from jsonb_array_elements(p_quiz) loop
    if jsonb_typeof(question) is distinct from 'object' then return false; end if;
    if jsonb_typeof(question->'q') is distinct from 'string'
       or char_length(trim(question->>'q')) not between 8 and 500 then return false; end if;

    option_list := question->'options';
    if jsonb_typeof(option_list) is distinct from 'array'
       or jsonb_array_length(option_list) not between 2 and 5 then return false; end if;

    if jsonb_typeof(question->'answer') is distinct from 'number'
       or (question->>'answer') !~ '^(0|1|2|3|4)$' then return false; end if;
    correct_index := (question->>'answer')::integer;
    if correct_index >= jsonb_array_length(option_list) then return false; end if;

    for answer_option in select value from jsonb_array_elements(option_list) loop
      if jsonb_typeof(answer_option) is distinct from 'string'
         or char_length(trim(answer_option #>> '{}')) not between 1 and 240 then return false; end if;
    end loop;

    if jsonb_typeof(question->'why') is distinct from 'string'
       or char_length(trim(question->>'why')) not between 5 and 1200 then return false; end if;
  end loop;
  return true;
exception when others then
  return false;
end;
$$;

revoke all on function private.is_valid_course_quiz(jsonb) from public, anon;
grant execute on function private.is_valid_course_quiz(jsonb) to authenticated, service_role;

alter table public.courses
  add column if not exists quiz jsonb not null default '[]'::jsonb;

alter table public.courses
  drop constraint if exists courses_quiz_valid;

alter table public.courses
  add constraint courses_quiz_valid check (private.is_valid_course_quiz(quiz));

grant insert (created_by, title, summary, category, level, duration_minutes, outcomes, lessons, quiz)
  on public.courses to authenticated;
grant update (title, summary, category, level, duration_minutes, outcomes, lessons, quiz, status, review_note, reviewed_by, reviewed_at, updated_at)
  on public.courses to authenticated;
