
-- Create urgent_alerts table
CREATE TABLE public.urgent_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  event_titre TEXT NOT NULL,
  requester_id UUID NOT NULL,
  requester_name TEXT NOT NULL,
  pole TEXT,
  alert_type TEXT NOT NULL DEFAULT 'absence_non_couverte',
  message TEXT NOT NULL,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.urgent_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view urgent alerts" ON public.urgent_alerts FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create alerts" ON public.urgent_alerts FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can update alerts" ON public.urgent_alerts FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
