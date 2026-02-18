-- Create user_activity_logs table for chart data
create table if not exists public.user_activity_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  activity_date date default current_date,
  xp_earned int default 0,
  questions_answered int default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.user_activity_logs enable row level security;

-- Policies
create policy "Users can view their own activity logs"
  on public.user_activity_logs for select
  using (auth.uid() = user_id);

create policy "Users can insert their own activity logs"
  on public.user_activity_logs for insert
  with check (auth.uid() = user_id);

-- Create index for performance
create index idx_user_activity_logs_user_date on public.user_activity_logs(user_id, activity_date);
