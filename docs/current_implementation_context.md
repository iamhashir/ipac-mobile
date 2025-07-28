CREATE TABLE public.attendance_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  packer_id uuid NOT NULL,
  log_date date NOT NULL DEFAULT CURRENT_DATE,
  shift_period text NOT NULL CHECK (shift_period = ANY (ARRAY['morning'::text, 'afternoon'::text, 'full_day'::text])),
  status text NOT NULL DEFAULT 'present'::text CHECK (status = ANY (ARRAY['present'::text, 'absent'::text])),
  start_time timestamp with time zone,
  end_time timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  toolbox_briefing_completed boolean DEFAULT false,
  is_project_start boolean DEFAULT false,
  CONSTRAINT attendance_logs_pkey PRIMARY KEY (id),
  CONSTRAINT attendance_logs_packer_id_fkey FOREIGN KEY (packer_id) REFERENCES public.profiles(id),
  CONSTRAINT attendance_logs_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id)
);