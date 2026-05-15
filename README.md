# Appointment Request System with Supabase

A complete appointment request website with admin panel built with plain HTML, CSS, and JavaScript.

## Features

### Public Page
- Submit appointment requests with name and mobile number
- Success message after submission
- Privacy note

### Admin Panel
- Secure login with Supabase Auth
- View all appointment requests
- Update status (New, Called, Confirmed, Cancelled)
- Add notes to requests
- Delete fake/wrong requests
- Real-time updates
- Statistics dashboard

## Setup Instructions

### Step 1: Create Supabase Project

1. Go to [Supabase](https://supabase.com) and sign up/login
2. Click "New project"
3. Enter project details:
   - Name: `appointment-system`
   - Database Password: Create a strong password
   - Region: Choose closest to your location
4. Click "Create new project" (wait 2-3 minutes)

### Step 2: Run SQL Setup

1. In your Supabase project, click "SQL Editor" in left sidebar
2. Click "New query"
3. Copy and paste the SQL script from below
4. Change admin email and password if desired:
   - Current admin: hyperlinkact@gmail.com
   - Current password: akr912243
5. Click "Run" to execute
6. Wait for success message

### Step 3: Get API Keys

1. In Supabase, go to Project Settings (gear icon)
2. Click "API" in left sidebar
3. Copy:
   - Project URL
   - Project API Keys → anon public key
4. These are already in config.js, verify they match

### Step 4: Deploy to GitHub

1. Create new GitHub repository
2. Create each file by clicking "Add file" → "Create new file"
3. Name each file exactly as shown
4. Paste the corresponding code
5. Commit each file

Files to create:
- index.html
- admin.html
- style.css
- app.js
- config.js
- README.md

### Step 5: Enable GitHub Pages

1. Go to repository Settings
2. Click "Pages" in left sidebar
3. Under "Source", select "Deploy from a branch"
4. Select branch: `main`
5. Select folder: `/ (root)`
6. Click "Save"
7. Wait 1-3 minutes for deployment

Your site will be live at:
- Public site: `https://YOUR_USERNAME.github.io/REPO_NAME/`
- Admin panel: `https://YOUR_USERNAME.github.io/REPO_NAME/admin.html`

## Login Credentials

- **Email**: hyperlinkact@gmail.com
- **Password**: akr912243

## SQL Setup Script

```sql
-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- Create appointment_requests table
create table if not exists public.appointment_requests (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    mobile text not null,
    status text not null default 'New',
    notes text,
    created_at timestamptz default now(),
    constraint valid_status check (status in ('New', 'Called', 'Confirmed', 'Cancelled')),
    constraint valid_mobile check (mobile ~ '^[0-9]{10}$')
);

-- Create admins table
create table if not exists public.admins (
    user_id uuid primary key references auth.users(id) on delete cascade,
    created_at timestamptz default now()
);

-- Enable Row Level Security
alter table public.appointment_requests enable row level security;
alter table public.admins enable row level security;

-- Public INSERT policy (users can only submit)
create policy "Public can insert appointment requests" 
on public.appointment_requests for insert 
to public, anon, authenticated
with check (true);

-- Admin policies for appointment_requests
create policy "Admins can view all requests" 
on public.appointment_requests for select 
using (auth.uid() in (select user_id from public.admins));

create policy "Admins can update requests" 
on public.appointment_requests for update 
using (auth.uid() in (select user_id from public.admins));

create policy "Admins can delete requests" 
on public.appointment_requests for delete 
using (auth.uid() in (select user_id from public.admins));

-- Admin policy for admins table
create policy "Admins can view admin list" 
on public.admins for select 
using (auth.uid() in (select user_id from public.admins));

-- Create admin user
do $$
declare
    admin_email text := lower('hyperlinkact@gmail.com');
    admin_password text := 'akr912243';
    new_user_id uuid;
begin
    -- Check if user already exists
    select id into new_user_id
    from auth.users
    where email = admin_email;

    -- If not exists, create new user
    if new_user_id is null then
        new_user_id := gen_random_uuid();

        insert into auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at,
            confirmation_token,
            email_change,
            email_change_token_new,
            recovery_token
        )
        values (
            '00000000-0000-0000-0000-000000000000',
            new_user_id,
            'authenticated',
            'authenticated',
            admin_email,
            crypt(admin_password, gen_salt('bf')),
            now(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            '{}'::jsonb,
            now(),
            now(),
            '',
            '',
            '',
            ''
        );

        insert into auth.identities (
            id,
            user_id,
            provider_id,
            identity_data,
            provider,
            last_sign_in_at,
            created_at,
            updated_at
        )
        values (
            gen_random_uuid(),
            new_user_id,
            new_user_id::text,
            jsonb_build_object(
                'sub', new_user_id::text,
                'email', admin_email,
                'email_verified', true,
                'phone_verified', false
            ),
            'email',
            now(),
            now(),
            now()
        );
    end if;

    -- Add to admins table
    insert into public.admins (user_id)
    values (new_user_id)
    on conflict (user_id) do nothing;
end $$;

-- Grant necessary permissions
grant usage on schema public to anon, authenticated;
grant all on public.appointment_requests to authenticated;
grant insert on public.appointment_requests to anon;
grant all on public.admins to authenticated;
