-- ============================================
-- Chore Domino - Rewards Schema
-- ============================================
-- Phase 3: Rewards & redemptions
-- Deploy after Phase 2 is stable
-- ============================================

-- ============================================
-- REWARDS TABLE
-- ============================================

CREATE TABLE public.rewards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  
  -- Reward details
  title VARCHAR(200) NOT NULL,
  description TEXT,
  points_cost INTEGER NOT NULL,
  
  -- Availability
  is_active BOOLEAN DEFAULT TRUE,
  quantity_available INTEGER, -- NULL = unlimited
  
  -- Optional image
  image_url TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Sync fields
  _modified BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
  _deleted BOOLEAN DEFAULT FALSE,
  
  -- Constraints
  CONSTRAINT valid_title CHECK (LENGTH(TRIM(title)) > 0),
  CONSTRAINT valid_points_cost CHECK (points_cost > 0),
  CONSTRAINT valid_quantity CHECK (quantity_available IS NULL OR quantity_available >= 0)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rewards_household ON public.rewards(household_id);
CREATE INDEX IF NOT EXISTS idx_rewards_active ON public.rewards(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_rewards_modified ON public.rewards(_modified);
CREATE INDEX IF NOT EXISTS idx_rewards_not_deleted ON public.rewards(_deleted) WHERE _deleted = FALSE;

-- Updated_at trigger
DROP TRIGGER IF EXISTS rewards_updated_at ON public.rewards;
CREATE TRIGGER rewards_updated_at
  BEFORE UPDATE ON public.rewards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- REWARD REDEMPTIONS TABLE
-- ============================================

CREATE TABLE public.reward_redemptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reward_id UUID NOT NULL REFERENCES public.rewards(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  
  -- Who redeemed
  redeemed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Points spent (captured at redemption time in case reward cost changes)
  points_spent INTEGER NOT NULL,
  
  -- Fulfillment workflow
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'fulfilled', 'cancelled')),
  fulfilled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  fulfilled_at TIMESTAMPTZ,
  fulfillment_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Sync fields
  _modified BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
  _deleted BOOLEAN DEFAULT FALSE,
  
  -- Constraints
  CONSTRAINT valid_points_spent CHECK (points_spent > 0)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_redemptions_reward ON public.reward_redemptions(reward_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_household ON public.reward_redemptions(household_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_redeemed_by ON public.reward_redemptions(redeemed_by);
CREATE INDEX IF NOT EXISTS idx_redemptions_status ON public.reward_redemptions(status);
CREATE INDEX IF NOT EXISTS idx_redemptions_redeemed_at ON public.reward_redemptions(redeemed_at);
CREATE INDEX IF NOT EXISTS idx_redemptions_modified ON public.reward_redemptions(_modified);
CREATE INDEX IF NOT EXISTS idx_redemptions_not_deleted ON public.reward_redemptions(_deleted) WHERE _deleted = FALSE;

-- Updated_at trigger
DROP TRIGGER IF EXISTS redemptions_updated_at ON public.reward_redemptions;
CREATE TRIGGER redemptions_updated_at
  BEFORE UPDATE ON public.reward_redemptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_redemptions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES - REWARDS
-- ============================================

-- Members can view rewards in their households
DROP POLICY IF EXISTS "" ON ;
CREATE POLICY "Members can view household rewards"
  ON public.rewards
  FOR SELECT
  USING (
    household_id IN (
      SELECT household_id 
      FROM public.household_members 
      WHERE user_id = auth.uid()
        AND _deleted = FALSE
    )
  );

-- Admins can create rewards
DROP POLICY IF EXISTS "" ON ;
CREATE POLICY "Admins can create rewards"
  ON public.rewards
  FOR INSERT
  WITH CHECK (
    household_id IN (
      SELECT household_id 
      FROM public.household_members 
      WHERE user_id = auth.uid()
        AND role = 'admin'
        AND _deleted = FALSE
    )
    AND created_by = auth.uid()
  );

-- Admins can update rewards
DROP POLICY IF EXISTS "" ON ;
CREATE POLICY "Admins can update rewards"
  ON public.rewards
  FOR UPDATE
  USING (
    household_id IN (
      SELECT household_id 
      FROM public.household_members 
      WHERE user_id = auth.uid()
        AND role = 'admin'
        AND _deleted = FALSE
    )
  );

-- ============================================
-- RLS POLICIES - REWARD REDEMPTIONS
-- ============================================

-- Members can view redemptions in their households
DROP POLICY IF EXISTS "" ON ;
CREATE POLICY "Members can view redemptions"
  ON public.reward_redemptions
  FOR SELECT
  USING (
    household_id IN (
      SELECT household_id 
      FROM public.household_members 
      WHERE user_id = auth.uid()
        AND _deleted = FALSE
    )
  );

-- Members can redeem rewards
DROP POLICY IF EXISTS "" ON ;
CREATE POLICY "Members can redeem rewards"
  ON public.reward_redemptions
  FOR INSERT
  WITH CHECK (
    household_id IN (
      SELECT household_id 
      FROM public.household_members 
      WHERE user_id = auth.uid()
        AND _deleted = FALSE
    )
    AND redeemed_by = auth.uid()
  );

-- Admins can update redemptions (for fulfillment)
-- Users can cancel their own pending redemptions
DROP POLICY IF EXISTS "" ON ;
CREATE POLICY "Members can update redemptions"
  ON public.reward_redemptions
  FOR UPDATE
  USING (
    household_id IN (
      SELECT household_id 
      FROM public.household_members 
      WHERE user_id = auth.uid()
        AND _deleted = FALSE
    )
    AND (
      -- Own pending redemption (can cancel)
      (redeemed_by = auth.uid() AND status = 'pending')
      -- Or household admin (can fulfill)
      OR EXISTS (
        SELECT 1 
        FROM public.household_members 
        WHERE household_id = reward_redemptions.household_id
          AND user_id = auth.uid()
          AND role = 'admin'
          AND _deleted = FALSE
      )
    )
  );

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to validate and deduct points when redeeming
CREATE OR REPLACE FUNCTION public.validate_reward_redemption()
RETURNS TRIGGER AS $$
DECLARE
  member_points INTEGER;
  reward_cost INTEGER;
  reward_quantity INTEGER;
BEGIN
  -- Get member's current points
  SELECT points INTO member_points
  FROM public.household_members
  WHERE household_id = NEW.household_id
    AND user_id = NEW.redeemed_by;
  
  -- Get reward details
  SELECT points_cost, quantity_available INTO reward_cost, reward_quantity
  FROM public.rewards
  WHERE id = NEW.reward_id
    AND is_active = TRUE
    AND _deleted = FALSE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reward not found or inactive';
  END IF;
  
  -- Check if member has enough points
  IF member_points < reward_cost THEN
    RAISE EXCEPTION 'Insufficient points. Have: %, Need: %', member_points, reward_cost;
  END IF;
  
  -- Check if reward is available
  IF reward_quantity IS NOT NULL AND reward_quantity <= 0 THEN
    RAISE EXCEPTION 'Reward is out of stock';
  END IF;
  
  -- Set points_spent from current reward cost
  NEW.points_spent = reward_cost;
  
  -- Deduct points from member
  UPDATE public.household_members
  SET points = points - reward_cost
  WHERE household_id = NEW.household_id
    AND user_id = NEW.redeemed_by;
  
  -- Decrement quantity if limited
  IF reward_quantity IS NOT NULL THEN
    UPDATE public.rewards
    SET quantity_available = quantity_available - 1
    WHERE id = NEW.reward_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS validate_redemption ON public.reward_redemptions;
CREATE TRIGGER validate_redemption
  BEFORE INSERT ON public.reward_redemptions
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_reward_redemption();

-- Function to refund points when redemption is cancelled
CREATE OR REPLACE FUNCTION public.refund_points_on_cancellation()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process when status changes to 'cancelled'
  IF NEW.status = 'cancelled' AND OLD.status = 'pending' THEN
    -- Refund points to member
    UPDATE public.household_members
    SET points = points + OLD.points_spent
    WHERE household_id = OLD.household_id
      AND user_id = OLD.redeemed_by;
    
    -- Restore quantity if limited
    UPDATE public.rewards
    SET quantity_available = quantity_available + 1
    WHERE id = OLD.reward_id
      AND quantity_available IS NOT NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS refund_on_cancellation ON public.reward_redemptions;
CREATE TRIGGER refund_on_cancellation
  BEFORE UPDATE ON public.reward_redemptions
  FOR EACH ROW
  EXECUTE FUNCTION public.refund_points_on_cancellation();

-- Function to mark fulfillment details
CREATE OR REPLACE FUNCTION public.mark_redemption_fulfilled()
RETURNS TRIGGER AS $$
BEGIN
  -- When status changes to 'fulfilled'
  IF NEW.status = 'fulfilled' AND (OLD.status IS NULL OR OLD.status != 'fulfilled') THEN
    NEW.fulfilled_at = NOW();
    NEW.fulfilled_by = auth.uid();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS mark_fulfilled ON public.reward_redemptions;
CREATE TRIGGER mark_fulfilled
  BEFORE UPDATE ON public.reward_redemptions
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_redemption_fulfilled();

-- ============================================
-- REALTIME PUBLICATION
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.rewards;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reward_redemptions;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE public.rewards IS 'Items/perks that can be redeemed with points';
COMMENT ON TABLE public.reward_redemptions IS 'History of redeemed rewards with fulfillment workflow';

COMMENT ON COLUMN public.rewards.quantity_available IS 'NULL means unlimited, 0 means out of stock';
COMMENT ON COLUMN public.reward_redemptions.points_spent IS 'Points deducted (captured at redemption time)';
COMMENT ON COLUMN public.reward_redemptions.status IS 'Redemption status: pending, fulfilled, cancelled';
