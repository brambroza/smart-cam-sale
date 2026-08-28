-- Lite/quick-sale: shop's PromptPay target (phone / citizen id / e-wallet id)
-- used to render a payment QR at sale close. Nullable = QR hidden.
ALTER TABLE "Organization" ADD COLUMN "promptpayId" TEXT;
