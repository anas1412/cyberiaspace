-- Migration: Protect sensitive user columns
-- Prevents users from updating their own plan, is_admin, and other sensitive fields
-- These columns can only be updated by the service_role (server-side)

BEGIN;

-- 1. Create a function to protect columns
CREATE OR REPLACE FUNCTION protect_user_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- If the caller is NOT using the service_role (admin), revert sensitive columns
  IF current_setting('role') != 'service_role' THEN
    -- On INSERT, force defaults for sensitive columns
    IF TG_OP = 'INSERT' THEN
      NEW.plan := 'free';
      NEW.subscription_status := 'none';
      NEW.expiry_date := NULL;
      NEW.is_admin := FALSE;
      NEW.polar_customer_id := NULL;
      NEW.polar_subscription_id := NULL;
      NEW.payment_provider := NULL;
      NEW.created_at := NOW();
    -- On UPDATE, prevent changes to sensitive columns
    ELSIF TG_OP = 'UPDATE' THEN
      NEW.plan := OLD.plan;
      NEW.subscription_status := OLD.subscription_status;
      NEW.expiry_date := OLD.expiry_date;
      NEW.is_admin := OLD.is_admin;
      NEW.polar_customer_id := OLD.polar_customer_id;
      NEW.polar_subscription_id := OLD.polar_subscription_id;
      NEW.payment_provider := OLD.payment_provider;
      NEW.created_at := OLD.created_at;
      NEW.email := OLD.email;
      NEW.id := OLD.id; -- Prevent ID changes
    END IF;
  END IF;
  
  -- Always update updated_at on any change
  NEW.updated_at := NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the trigger
DROP TRIGGER IF EXISTS tr_protect_user_columns ON users;
CREATE TRIGGER tr_protect_user_columns
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION protect_user_columns();

COMMIT;
