-- Create user_stats table for gamification
create table if not exists public.user_stats (
  user_id uuid references auth.users not null primary key,
  streak_current int default 0,
  streak_max int default 0,
  total_xp int default 0,
  level int default 1,
  last_activity_date date,
  daily_goal_target int default 20, -- questions per day
  daily_goal_current int default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.user_stats enable row level security;

-- Policies
create policy "Users can view their own stats"
  on public.user_stats for select
  using (auth.uid() = user_id);

create policy "Users can update their own stats"
  on public.user_stats for update
  using (auth.uid() = user_id);

create policy "Users can insert their own stats"
  on public.user_stats for insert
  with check (auth.uid() = user_id);

-- Function to handle new user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_stats (user_id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for new user
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
