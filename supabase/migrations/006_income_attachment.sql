-- Migration 006: Support attachments & receipts on incomes and payments
-- Allows attaching and viewing dekont / invoices / receipts for both incomes and dues payments

ALTER TABLE public.incomes ADD COLUMN IF NOT EXISTS attachment_url text;
COMMENT ON COLUMN public.incomes.attachment_url IS 'Gelire ait dekont, fatura veya makbuz belgesi bağlantısı';

ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS receipt_url text;
COMMENT ON COLUMN public.payments.receipt_url IS 'Ödemeye ait dekont veya banka makbuzu görseli/belgesi';
