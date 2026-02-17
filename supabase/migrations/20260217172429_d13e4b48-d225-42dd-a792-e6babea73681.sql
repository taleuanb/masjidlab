
-- 1. Profiles table with competences
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  email TEXT,
  competences TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 2. Events table with required_skill
CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titre TEXT NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  salle_id TEXT,
  budget NUMERIC DEFAULT 0,
  budget_depense NUMERIC DEFAULT 0,
  pole TEXT,
  required_skill TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Events are viewable by everyone" ON public.events FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create events" ON public.events FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Creator can update events" ON public.events FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Creator can delete events" ON public.events FOR DELETE USING (auth.uid() = created_by);

-- 3. User availability table
CREATE TABLE public.user_availability (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Indisponibilité', 'Congé', 'Rotation')),
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all availability" ON public.user_availability FOR SELECT USING (true);
CREATE POLICY "Users can manage their own availability" ON public.user_availability FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own availability" ON public.user_availability FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own availability" ON public.user_availability FOR DELETE USING (auth.uid() = user_id);

-- 4. Replacement requests table
CREATE TABLE public.replacement_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL,
  replacement_id UUID,
  status TEXT NOT NULL DEFAULT 'En attente' CHECK (status IN ('En attente', 'Validé', 'Rejeté')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.replacement_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all replacement requests" ON public.replacement_requests FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create requests" ON public.replacement_requests FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Requester can update their request" ON public.replacement_requests FOR UPDATE USING (auth.uid() = requester_id);
CREATE POLICY "Requester can delete their request" ON public.replacement_requests FOR DELETE USING (auth.uid() = requester_id);

-- 5. Timestamp update function + triggers
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_replacement_requests_updated_at BEFORE UPDATE ON public.replacement_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
