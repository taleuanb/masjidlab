
-- 1. Attendance
CREATE TABLE public.madrasa_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid REFERENCES public.madrasa_enrollments(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'present',
  notes text,
  org_id uuid REFERENCES public.organizations(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (enrollment_id, date)
);

ALTER TABLE public.madrasa_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Multi-tenant access" ON public.madrasa_attendance FOR ALL
  USING (org_id = (SELECT profiles.org_id FROM profiles WHERE profiles.user_id = auth.uid()));

-- 2. Evaluations
CREATE TABLE public.madrasa_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid REFERENCES public.madrasa_classes(id) ON DELETE CASCADE NOT NULL,
  subject_id uuid REFERENCES public.madrasa_subjects(id),
  title text NOT NULL,
  date date NOT NULL,
  max_points numeric DEFAULT 20,
  org_id uuid REFERENCES public.organizations(id) NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.madrasa_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Multi-tenant access" ON public.madrasa_evaluations FOR ALL
  USING (org_id = (SELECT profiles.org_id FROM profiles WHERE profiles.user_id = auth.uid()));

-- 3. Grades
CREATE TABLE public.madrasa_grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id uuid REFERENCES public.madrasa_evaluations(id) ON DELETE CASCADE NOT NULL,
  student_id uuid REFERENCES public.madrasa_students(id) ON DELETE CASCADE NOT NULL,
  score numeric,
  comment text,
  org_id uuid REFERENCES public.organizations(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (evaluation_id, student_id)
);

ALTER TABLE public.madrasa_grades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Multi-tenant access" ON public.madrasa_grades FOR ALL
  USING (org_id = (SELECT profiles.org_id FROM profiles WHERE profiles.user_id = auth.uid()));

-- 4. Fees
CREATE TABLE public.madrasa_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES public.madrasa_students(id) NOT NULL,
  amount numeric NOT NULL,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  transaction_id uuid REFERENCES public.finance_transactions(id),
  org_id uuid REFERENCES public.organizations(id) NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.madrasa_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Multi-tenant access" ON public.madrasa_fees FOR ALL
  USING (org_id = (SELECT profiles.org_id FROM profiles WHERE profiles.user_id = auth.uid()));

-- 5. Validation triggers
CREATE OR REPLACE FUNCTION public.validate_attendance_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('present', 'absent', 'late', 'excused') THEN
    RAISE EXCEPTION 'Invalid attendance status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_attendance_status
  BEFORE INSERT OR UPDATE ON public.madrasa_attendance
  FOR EACH ROW EXECUTE FUNCTION public.validate_attendance_status();

CREATE OR REPLACE FUNCTION public.validate_fee_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'paid', 'overdue', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid fee status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_fee_status
  BEFORE INSERT OR UPDATE ON public.madrasa_fees
  FOR EACH ROW EXECUTE FUNCTION public.validate_fee_status();
