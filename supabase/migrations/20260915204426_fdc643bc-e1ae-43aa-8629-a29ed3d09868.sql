CREATE TABLE public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  paddle_transaction_id text NOT NULL UNIQUE,
  paddle_customer_id text,
  product_id text NOT NULL,
  price_id text NOT NULL,
  status text NOT NULL DEFAULT 'completed',
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_purchases_user_env ON public.purchases(user_id, environment);
GRANT SELECT ON public.purchases TO authenticated;
GRANT ALL ON public.purchases TO service_role;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own purchases" ON public.purchases FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.investigation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_investigation_runs_user ON public.investigation_runs(user_id);
GRANT SELECT, INSERT ON public.investigation_runs TO authenticated;
GRANT ALL ON public.investigation_runs TO service_role;
ALTER TABLE public.investigation_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own runs" ON public.investigation_runs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can add own runs" ON public.investigation_runs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_unlock(user_uuid uuid, check_env text DEFAULT 'live')
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.purchases
    WHERE user_id = user_uuid
      AND environment = check_env
      AND status = 'completed'
  );
$$;