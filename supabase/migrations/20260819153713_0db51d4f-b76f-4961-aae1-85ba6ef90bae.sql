-- ROLES
CREATE TYPE public.app_role AS ENUM ('admin','moderator','user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_roles_select_own ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- PROMPT SETS
CREATE TABLE public.prompt_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  emoji text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.prompt_sets TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.prompt_sets TO authenticated;
GRANT ALL ON public.prompt_sets TO service_role;
ALTER TABLE public.prompt_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY prompt_sets_select ON public.prompt_sets FOR SELECT TO authenticated USING (true);
CREATE POLICY prompt_sets_admin_write ON public.prompt_sets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC;

CREATE TRIGGER prompt_sets_updated_at BEFORE UPDATE ON public.prompt_sets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PROMPTS extension
ALTER TABLE public.prompts
  ADD COLUMN set_id uuid REFERENCES public.prompt_sets(id) ON DELETE CASCADE,
  ADD COLUMN position integer NOT NULL DEFAULT 0,
  ADD COLUMN is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

CREATE TRIGGER prompts_updated_at BEFORE UPDATE ON public.prompts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT INSERT, UPDATE, DELETE ON public.prompts TO authenticated;
CREATE POLICY prompts_admin_write ON public.prompts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- default set + migrate existing prompts
INSERT INTO public.prompt_sets (slug, name, description, emoji, sort_order) VALUES
  ('kennenlernen','Kennenlernen','Leichte Einstiegsfragen für neue Gruppen.','👋',1),
  ('tiefgang','Tiefgang','Fragen, die unter die Oberfläche gehen.','🌊',2),
  ('leicht-lustig','Leicht & Lustig','Fragen zum Schmunzeln und Lockerwerden.','🎉',3);

UPDATE public.prompts p
SET set_id = (SELECT id FROM public.prompt_sets WHERE slug='kennenlernen')
WHERE p.set_id IS NULL;

WITH numbered AS (
  SELECT id, row_number() OVER (ORDER BY created_at) AS rn FROM public.prompts
)
UPDATE public.prompts p SET position = n.rn FROM numbered n WHERE n.id = p.id;

INSERT INTO public.prompts (question, set_id, position)
SELECT q.question, s.id, q.pos FROM public.prompt_sets s,
 (VALUES
  ('Wovor hattest du zuletzt richtig Angst – und was hat geholfen?',1),
  ('Welche Entscheidung würdest du heute anders treffen?',2),
  ('Wann hast du dich zuletzt einsam gefühlt?',3),
  ('Was hast du noch nie jemandem in dieser Gruppe erzählt?',4),
  ('Woran merkst du, dass es dir gut geht?',5)
 ) AS q(question,pos)
WHERE s.slug='tiefgang';

INSERT INTO public.prompts (question, set_id, position)
SELECT q.question, s.id, q.pos FROM public.prompt_sets s,
 (VALUES
  ('Was ist die peinlichste Musik auf deiner Playlist?',1),
  ('Welchen unnötigen Kauf bereust du am meisten?',2),
  ('Was war dein schlechtester Haarschnitt?',3),
  ('Welche Superkraft hättest du gern für einen Tag?',4),
  ('Was ist dein seltsamstes Talent?',5)
 ) AS q(question,pos)
WHERE s.slug='leicht-lustig';

-- groups choose a set
ALTER TABLE public.groups
  ADD COLUMN prompt_set_id uuid REFERENCES public.prompt_sets(id) ON DELETE SET NULL;

UPDATE public.groups SET prompt_set_id = (SELECT id FROM public.prompt_sets WHERE slug='kennenlernen') WHERE prompt_set_id IS NULL;

CREATE INDEX prompts_set_idx ON public.prompts (set_id, position);