-- MojaPOS payment integration fields for public.orders.
-- This migration has already been applied to the connected Supabase project.

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS payment_provider text,
    ADD COLUMN IF NOT EXISTS payment_currency text,
    ADD COLUMN IF NOT EXISTS payment_amount numeric(10,2),
    ADD COLUMN IF NOT EXISTS payment_reference text,
    ADD COLUMN IF NOT EXISTS payment_transaction_id text,
    ADD COLUMN IF NOT EXISTS payment_checkout_url text,
    ADD COLUMN IF NOT EXISTS payment_environment text,
    ADD COLUMN IF NOT EXISTS payment_provider_fee numeric(10,2),
    ADD COLUMN IF NOT EXISTS payment_gateway_fee numeric(10,2),
    ADD COLUMN IF NOT EXISTS payment_net_amount numeric(10,2),
    ADD COLUMN IF NOT EXISTS payment_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS paid_at timestamptz;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE public.orders
    ADD CONSTRAINT orders_payment_method_check
    CHECK (payment_method = ANY (ARRAY['bank_transfer'::text, 'paypal'::text, 'mojapos'::text]));

CREATE INDEX IF NOT EXISTS idx_orders_payment_provider ON public.orders(payment_provider);
CREATE INDEX IF NOT EXISTS idx_orders_payment_transaction_id ON public.orders(payment_transaction_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_reference ON public.orders(payment_reference);
