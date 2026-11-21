-- v2: admins (coaches) can also ADD entries on a client's behalf (edit/delete were already allowed).
drop policy if exists meal_write on public.meal_logs;
create policy meal_write on public.meal_logs for insert to authenticated
  with check (public.is_admin() or (user_id = auth.uid() and public.has_feature(auth.uid(),'meals')));
drop policy if exists w_write on public.weight_logs;
create policy w_write on public.weight_logs for insert to authenticated
  with check (public.is_admin() or (user_id = auth.uid() and public.has_feature(auth.uid(),'weight')));
drop policy if exists h_write on public.habit_logs;
create policy h_write on public.habit_logs for insert to authenticated
  with check (public.is_admin() or (user_id = auth.uid() and (public.has_feature(auth.uid(),'habits') or public.has_feature(auth.uid(),'supplements'))));
drop policy if exists wo_write on public.workouts;
create policy wo_write on public.workouts for insert to authenticated
  with check (public.is_admin() or (user_id = auth.uid() and public.has_feature(auth.uid(),'gym')));
drop policy if exists ws_write on public.workout_sets;
create policy ws_write on public.workout_sets for insert to authenticated
  with check (public.is_admin() or (user_id = auth.uid() and public.has_feature(auth.uid(),'gym')));
