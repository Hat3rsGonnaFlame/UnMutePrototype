CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT 'Anonym',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1), 'Anonym'))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  topic TEXT,
  invite_code TEXT NOT NULL UNIQUE DEFAULT upper(substr(replace(gen_random_uuid()::text,'-',''), 1, 6)),
  created_by UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.groups TO authenticated;
GRANT ALL ON public.groups TO service_role;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.group_members TO authenticated;
GRANT ALL ON public.group_members TO service_role;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_group_member(_group_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = _group_id AND user_id = _user_id);
$$;

CREATE POLICY "groups_select_member" ON public.groups FOR SELECT TO authenticated
  USING (public.is_group_member(id, auth.uid()) OR created_by = auth.uid());
CREATE POLICY "groups_insert" ON public.groups FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "groups_update_owner" ON public.groups FOR UPDATE TO authenticated
  USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

CREATE POLICY "members_select" ON public.group_members FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "members_insert_self" ON public.group_members FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "members_delete_self" ON public.group_members FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.join_group_by_code(_code TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _gid UUID;
BEGIN
  SELECT id INTO _gid FROM public.groups WHERE invite_code = upper(trim(_code));
  IF _gid IS NULL THEN RAISE EXCEPTION 'Kein Gruppen-Code gefunden'; END IF;
  INSERT INTO public.group_members (group_id, user_id) VALUES (_gid, auth.uid())
  ON CONFLICT (group_id, user_id) DO NOTHING;
  RETURN _gid;
END; $$;
GRANT EXECUTE ON FUNCTION public.join_group_by_code(TEXT) TO authenticated;

CREATE TABLE public.prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.prompts TO authenticated;
GRANT ALL ON public.prompts TO service_role;
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prompts_select" ON public.prompts FOR SELECT TO authenticated USING (true);

INSERT INTO public.prompts (question) VALUES
('Was war heute dein schönster Moment?'),
('Worüber hast du zuletzt richtig gelacht?'),
('Was beschäftigt dich diese Woche am meisten?'),
('Wofür bist du gerade dankbar?'),
('Was würdest du gern mal gemeinsam mit uns machen?'),
('Welches Lied läuft bei dir gerade in Dauerschleife?'),
('Wann hast du dich zuletzt richtig gesehen gefühlt?'),
('Was hast du diese Woche Neues gelernt?'),
('Worauf freust du dich am meisten?'),
('Was würdest du deinem Ich von vor einem Jahr sagen?'),
('Was fehlt dir gerade am meisten?'),
('Welche Kleinigkeit hat dir heute gutgetan?');

CREATE TABLE public.voice_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  prompt_id UUID REFERENCES public.prompts ON DELETE SET NULL,
  prompt_text TEXT,
  audio_path TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.voice_notes TO authenticated;
GRANT ALL ON public.voice_notes TO service_role;
ALTER TABLE public.voice_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notes_select_member" ON public.voice_notes FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "notes_insert_member" ON public.voice_notes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_group_member(group_id, auth.uid()));
CREATE POLICY "notes_delete_own" ON public.voice_notes FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  partner TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  required_notes INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.rewards TO authenticated;
GRANT ALL ON public.rewards TO service_role;
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rewards_select" ON public.rewards FOR SELECT TO authenticated USING (true);

INSERT INTO public.rewards (title, partner, category, description, required_notes) VALUES
('2 Kaffee aufs Haus', 'Café Kollektiv', 'Café', 'Trefft euch auf einen Kaffee – zwei Getränke gehen aufs Haus.', 5),
('Kuchen für die Gruppe', 'Backhaus Nord', 'Café', 'Ein Stück Kuchen pro Gruppenmitglied.', 15),
('2-für-1 Kinotickets', 'Kino Kurbel', 'Kino', 'Zwei Tickets zum Preis von einem für eine Vorstellung eurer Wahl.', 25),
('Freier Eintritt ins Museum', 'Stadtmuseum', 'Museum', 'Freier Eintritt für bis zu 4 Personen.', 40),
('Gemeinsames Gym-Workout', 'MoveUp Studio', 'Gym', 'Ein Tagespass pro Person für ein Workout zusammen.', 60),
('Dinner für die Gruppe', 'Trattoria Sole', 'Essen', '20 % Rabatt auf euer gemeinsames Abendessen.', 100);

CREATE TABLE public.group_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES public.rewards ON DELETE CASCADE,
  voucher_code TEXT NOT NULL DEFAULT upper(substr(replace(gen_random_uuid()::text,'-',''), 1, 8)),
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, reward_id)
);
GRANT SELECT ON public.group_rewards TO authenticated;
GRANT ALL ON public.group_rewards TO service_role;
ALTER TABLE public.group_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "group_rewards_select_member" ON public.group_rewards FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.unlock_group_rewards()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _count INTEGER;
BEGIN
  SELECT count(*) INTO _count FROM public.voice_notes WHERE group_id = NEW.group_id;
  INSERT INTO public.group_rewards (group_id, reward_id)
  SELECT NEW.group_id, r.id FROM public.rewards r WHERE r.required_notes <= _count
  ON CONFLICT (group_id, reward_id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER voice_notes_unlock_rewards AFTER INSERT ON public.voice_notes
FOR EACH ROW EXECUTE FUNCTION public.unlock_group_rewards();

CREATE POLICY "voice_notes_read_member" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'voice-notes' AND public.is_group_member(((storage.foldername(name))[1])::uuid, auth.uid()));
CREATE POLICY "voice_notes_insert_member" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'voice-notes' AND public.is_group_member(((storage.foldername(name))[1])::uuid, auth.uid()));
CREATE POLICY "voice_notes_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'voice-notes' AND owner = auth.uid());