-- MaxxPixels OTT - 100% Database Schema Parity Migration
-- Ensures all columns expected by Rust, NestJS, Admin Portal, and Mobile Apps exist.

-- 1. Subscriptions table
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS payment_id VARCHAR(500);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS payment_gateway_sub_id VARCHAR(500);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT FALSE;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS autopay_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS razorpay_customer_id VARCHAR(500);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS razorpay_subscription_id VARCHAR(500);

-- 2. Producer profiles table
ALTER TABLE producer_profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE producer_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE producer_profiles ADD COLUMN IF NOT EXISTS kyc_status VARCHAR(500) DEFAULT 'PENDING';
ALTER TABLE producer_profiles ADD COLUMN IF NOT EXISTS email VARCHAR(500);
ALTER TABLE producer_profiles ADD COLUMN IF NOT EXISTS phone VARCHAR(500);
ALTER TABLE producer_profiles ADD COLUMN IF NOT EXISTS revenue_share_percent NUMERIC(5,2) DEFAULT 60.0;
ALTER TABLE producer_profiles ADD COLUMN IF NOT EXISTS bank_ifsc VARCHAR(500);
ALTER TABLE producer_profiles ADD COLUMN IF NOT EXISTS agreement_url VARCHAR(1000);
ALTER TABLE producer_profiles ADD COLUMN IF NOT EXISTS contact_person VARCHAR(500);

-- 3. Payment Orders table
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) DEFAULT 0.0;
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS original_amount NUMERIC(10,2) DEFAULT 0.0;
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS final_amount NUMERIC(10,2) DEFAULT 0.0;
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(255);
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS receipt_number VARCHAR(255);

-- 4. Payments table
ALTER TABLE payments ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(10,2) DEFAULT 0.0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_payment_id VARCHAR(500);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_signature TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_method VARCHAR(255);

-- 5. Indexes for fast subscription lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status_end_date ON subscriptions(user_id, status, end_date DESC);
CREATE INDEX IF NOT EXISTS idx_payment_orders_user_status ON payment_orders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_coupons_code_active ON coupons(code, is_active);
