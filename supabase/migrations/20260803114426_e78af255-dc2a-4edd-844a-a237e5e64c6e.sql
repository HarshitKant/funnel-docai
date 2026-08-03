CREATE TABLE public.testimonials (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message text NOT NULL,
  rating integer,
  source text NOT NULL DEFAULT 'funneldoc',
  page_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT INSERT ON public.testimonials TO anon;
GRANT INSERT ON public.testimonials TO authenticated;
GRANT ALL ON public.testimonials TO service_role;

ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a testimonial" ON public.testimonials
  FOR INSERT TO anon, authenticated
  WITH CHECK (length(message) > 0 AND length(message) <= 1000);

CREATE POLICY "Service role can read all testimonials" ON public.testimonials
  FOR SELECT TO service_role
  USING (true);