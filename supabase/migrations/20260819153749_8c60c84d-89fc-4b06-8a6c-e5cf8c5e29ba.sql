INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users
WHERE email IN ('ssommer0510@gmail.com','sommersascha68@gmail.com')
ON CONFLICT (user_id, role) DO NOTHING;