create policy "service_role_only_anbuu_lesson_history"
on public.anbuu_lesson_history
for all
to service_role
using (true)
with check (true);
