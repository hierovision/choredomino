-- ============================================
-- Chore Domino - Enhanced Schema for Requirements
-- ============================================
-- Phase 1.5: Align existing schema with domain requirements
-- This migration enhances tables created in initial_schema
-- to support the full feature set defined in REQUIREMENTS.md
-- 
-- CHANGES:
-- 1. Add household configuration fields (management modes, defaults)
-- 2. Enhance chores table (recurrence, lifecycle, direct rewards, nullable points)
-- 3. Enhance rewards table (expiration, approval, per-member limits, nullable cost)
-- 4. Update completion/redemption statuses for workflow support
-- 5. Create point_adjustments table for audit trail
-- 6. Create notification_preferences table
-- 7. Update constraints and indexes
-- ============================================

-- ============================================
-- STEP 1: CREATE CUSTOM TYPES (ENUMS)
-- ============================================

-- Management mode for chores and rewards
CREATE TYPE management_mode AS ENUM (
  'admin_control',      -- Only admins manage
  'collaborative',      -- Members can create, admins can edit all
  'full_access'         -- All members can manage any item
);

-- Chore lifecycle workflow types
CREATE TYPE chore_lifecycle AS ENUM (
  'simple',             -- Pending → Completed
  'approval_required',  -- Pending → Completed → Approved
  'full_workflow'       -- Created → Assigned → InProgress → Completed → Approved/Rejected
);

-- Expanded completion status for full workflow
CREATE TYPE completion_status AS ENUM (
  'pending',
  'in_progress',
  'completed',
  'approved',
  'rejected'
);

-- Expanded redemption status for approval workflow
CREATE TYPE redemption_status AS ENUM (
  'requested',          -- Member requested redemption (approval-required only)
  'approved',           -- Admin approved request
  'denied',             -- Admin denied request
  'redeemed',           -- Self-service redemption or auto-redemption
  'fulfilled',          -- Admin marked as fulfilled
  'cancelled'           -- Redemption cancelled
);

-- ============================================
-- STEP 2: ENHANCE HOUSEHOLDS TABLE
-- ============================================

-- Add household configuration columns
ALTER TABLE public.households
  ADD COLUMN IF NOT EXISTS chore_management_mode management_mode NOT NULL DEFAULT 'admin_control',
  ADD COLUMN IF NOT EXISTS reward_management_mode management_mode NOT NULL DEFAULT 'admin_control',
  ADD COLUMN IF NOT EXISTS default_chore_lifecycle chore_lifecycle NOT NULL DEFAULT 'simple',
  ADD COLUMN IF NOT EXISTS allow_assignment_acceptance BOOLEAN NOT NULL DEFAULT FALSE;

-- Add helpful comment
COMMENT ON COLUMN public.households.chore_management_mode IS 'Who can create/edit chores: admin_control, collaborative, or full_access';
COMMENT ON COLUMN public.households.default_chore_lifecycle IS 'Default workflow for chores: simple, approval_required, or full_workflow';
COMMENT ON COLUMN public.households.allow_assignment_acceptance IS 'Whether members can accept/reject chore assignments';

-- ============================================
-- STEP 3: ENHANCE HOUSEHOLD_MEMBERS TABLE
-- ============================================

-- Update role constraint to only allow admin/member (remove 'child')
ALTER TABLE public.household_members
  DROP CONSTRAINT IF EXISTS household_members_role_check,
  ADD CONSTRAINT household_members_role_check CHECK (role IN ('admin', 'member'));

-- Add comment explaining role simplification
COMMENT ON COLUMN public.household_members.role IS 'Member role: admin (full control) or member (limited permissions)';

-- ============================================
-- STEP 4: ENHANCE CHORES TABLE
-- ============================================

-- Make points nullable (for unpaid chores)
ALTER TABLE public.chores
  ALTER COLUMN points DROP NOT NULL,
  ALTER COLUMN points DROP DEFAULT;

-- Add new columns for advanced features
ALTER TABLE public.chores
  ADD COLUMN IF NOT EXISTS recurrence_rule TEXT,
  ADD COLUMN IF NOT EXISTS lifecycle_override chore_lifecycle,
  ADD COLUMN IF NOT EXISTS direct_reward_id UUID REFERENCES public.rewards(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS overdue_config JSONB DEFAULT '{
    "notify_assignee": true,
    "notify_admins_after_days": null,
    "consequence": "none"
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS assignment_status VARCHAR(20) DEFAULT 'assigned' CHECK (assignment_status IN ('assigned', 'pending_acceptance', 'accepted', 'rejected'));

-- Update constraint for nullable points
ALTER TABLE public.chores
  DROP CONSTRAINT IF EXISTS valid_points,
  ADD CONSTRAINT valid_points CHECK (points IS NULL OR points >= 0);

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_chores_direct_reward ON public.chores(direct_reward_id) WHERE direct_reward_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chores_recurrence ON public.chores(recurrence_rule) WHERE recurrence_rule IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chores_assignment_status ON public.chores(assignment_status) WHERE assigned_to IS NOT NULL;

-- Add comments
COMMENT ON COLUMN public.chores.points IS 'Points awarded on completion (nullable for unpaid chores)';
COMMENT ON COLUMN public.chores.recurrence_rule IS 'iCalendar RRULE format for recurring chores';
COMMENT ON COLUMN public.chores.lifecycle_override IS 'Override household default lifecycle for this chore';
COMMENT ON COLUMN public.chores.direct_reward_id IS 'Reward automatically granted on completion (bypasses points)';
COMMENT ON COLUMN public.chores.overdue_config IS 'Notification and consequence settings for overdue chores';
COMMENT ON COLUMN public.chores.assignment_status IS 'Tracks acceptance status when allow_assignment_acceptance is enabled';

-- ============================================
-- STEP 5: ENHANCE CHORE_COMPLETIONS TABLE
-- ============================================

-- Drop old status check constraint and column
ALTER TABLE public.chore_completions
  DROP CONSTRAINT IF EXISTS chore_completions_status_check;

-- Add new status column with expanded enum
ALTER TABLE public.chore_completions
  ADD COLUMN IF NOT EXISTS new_status completion_status NOT NULL DEFAULT 'pending';

-- Migrate existing data
UPDATE public.chore_completions
SET new_status = status::completion_status
WHERE new_status = 'pending'; -- Only update if not already migrated

-- Drop old column and rename new one
ALTER TABLE public.chore_completions
  DROP COLUMN IF EXISTS status CASCADE;

ALTER TABLE public.chore_completions
  RENAME COLUMN new_status TO status;

-- Add index
CREATE INDEX IF NOT EXISTS idx_completions_status ON public.chore_completions(status);

COMMENT ON COLUMN public.chore_completions.status IS 'Completion workflow status: pending, in_progress, completed, approved, rejected';

-- ============================================
-- STEP 6: ENHANCE REWARDS TABLE
-- ============================================

-- Make points_cost nullable (for direct rewards and free rewards)
ALTER TABLE public.rewards
  ALTER COLUMN points_cost DROP NOT NULL;

-- Add new columns
ALTER TABLE public.rewards
  ADD COLUMN IF NOT EXISTS quantity_per_member INTEGER,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN NOT NULL DEFAULT FALSE;

-- Update constraint for nullable points_cost
ALTER TABLE public.rewards
  DROP CONSTRAINT IF EXISTS valid_points_cost,
  ADD CONSTRAINT valid_points_cost CHECK (points_cost IS NULL OR points_cost >= 0);

-- Add constraint for quantity_per_member
ALTER TABLE public.rewards
  ADD CONSTRAINT valid_quantity_per_member CHECK (quantity_per_member IS NULL OR quantity_per_member > 0);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_rewards_expires_at ON public.rewards(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rewards_requires_approval ON public.rewards(requires_approval) WHERE requires_approval = TRUE;

-- Add comments
COMMENT ON COLUMN public.rewards.points_cost IS 'Points required to redeem (nullable for direct rewards or free rewards)';
COMMENT ON COLUMN public.rewards.quantity_per_member IS 'Max redemptions per member (null = no individual limit)';
COMMENT ON COLUMN public.rewards.expires_at IS 'Reward becomes unavailable after this date (null = never expires)';
COMMENT ON COLUMN public.rewards.requires_approval IS 'Whether redemption requires admin approval';

-- ============================================
-- STEP 7: ENHANCE REWARD_REDEMPTIONS TABLE
-- ============================================

-- Make points_spent nullable (for direct rewards)
ALTER TABLE public.reward_redemptions
  ALTER COLUMN points_spent DROP NOT NULL;

-- Drop old status check constraint and column
ALTER TABLE public.reward_redemptions
  DROP CONSTRAINT IF EXISTS reward_redemptions_status_check;

-- Add new status column with expanded enum
ALTER TABLE public.reward_redemptions
  ADD COLUMN IF NOT EXISTS new_status redemption_status NOT NULL DEFAULT 'redeemed';

-- Migrate existing data (map old to new)
UPDATE public.reward_redemptions
SET new_status = CASE 
  WHEN status = 'pending' THEN 'redeemed'::redemption_status
  WHEN status = 'fulfilled' THEN 'fulfilled'::redemption_status
  WHEN status = 'cancelled' THEN 'cancelled'::redemption_status
  ELSE 'redeemed'::redemption_status
END
WHERE new_status = 'redeemed'; -- Only update if not already migrated

-- Drop old column and rename new one
ALTER TABLE public.reward_redemptions
  DROP COLUMN IF EXISTS status CASCADE;

ALTER TABLE public.reward_redemptions
  RENAME COLUMN new_status TO status;

-- Add approved_by and approved_at for approval workflow
ALTER TABLE public.reward_redemptions
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- Update constraint for nullable points_spent
ALTER TABLE public.reward_redemptions
  DROP CONSTRAINT IF EXISTS valid_points_spent,
  ADD CONSTRAINT valid_points_spent CHECK (points_spent IS NULL OR points_spent >= 0);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_redemptions_approved_by ON public.reward_redemptions(approved_by) WHERE approved_by IS NOT NULL;

COMMENT ON COLUMN public.reward_redemptions.points_spent IS 'Points deducted (nullable for direct rewards)';
COMMENT ON COLUMN public.reward_redemptions.status IS 'Redemption workflow status: requested, approved, denied, redeemed, fulfilled, cancelled';
COMMENT ON COLUMN public.reward_redemptions.approved_by IS 'Admin who approved/denied the redemption request';

-- ============================================
-- STEP 8: CREATE POINT_ADJUSTMENTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.point_adjustments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Adjustment details
  amount INTEGER NOT NULL, -- Can be positive or negative
  reason TEXT NOT NULL,
  
  -- Tracking
  adjusted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Source tracking (what triggered this adjustment)
  source_type VARCHAR(50), -- 'manual', 'chore_completion', 'reward_redemption', 'correction', etc.
  source_id UUID, -- ID of related entity if applicable
  
  -- Sync fields
  _modified BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
  _deleted BOOLEAN DEFAULT FALSE,
  
  -- Constraints
  CONSTRAINT valid_reason CHECK (LENGTH(TRIM(reason)) > 0)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_point_adjustments_household ON public.point_adjustments(household_id);
CREATE INDEX IF NOT EXISTS idx_point_adjustments_user ON public.point_adjustments(user_id);
CREATE INDEX IF NOT EXISTS idx_point_adjustments_adjusted_by ON public.point_adjustments(adjusted_by);
CREATE INDEX IF NOT EXISTS idx_point_adjustments_created_at ON public.point_adjustments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_point_adjustments_modified ON public.point_adjustments(_modified);
CREATE INDEX IF NOT EXISTS idx_point_adjustments_not_deleted ON public.point_adjustments(_deleted) WHERE _deleted = FALSE;

-- Updated_at trigger (updates _modified)
DROP TRIGGER IF EXISTS point_adjustments_modified ON public.point_adjustments;
CREATE TRIGGER point_adjustments_modified
  BEFORE UPDATE ON public.point_adjustments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Comments
COMMENT ON TABLE public.point_adjustments IS 'Audit trail for all point changes (manual adjustments, completions, redemptions)';
COMMENT ON COLUMN public.point_adjustments.amount IS 'Points added (positive) or subtracted (negative)';
COMMENT ON COLUMN public.point_adjustments.source_type IS 'What triggered the adjustment: manual, chore_completion, reward_redemption, etc.';

-- ============================================
-- STEP 9: CREATE NOTIFICATION_PREFERENCES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  household_id UUID REFERENCES public.households(id) ON DELETE CASCADE, -- NULL = global preference
  
  -- Channel preferences
  push_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Event type preferences (JSONB for flexibility)
  event_preferences JSONB NOT NULL DEFAULT '{
    "chore_assigned": true,
    "chore_completed": true,
    "chore_approved": true,
    "chore_rejected": true,
    "chore_overdue": true,
    "reward_redeemed": true,
    "reward_requested": true,
    "reward_approved": true,
    "reward_denied": true,
    "reward_fulfilled": true
  }'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Sync fields
  _modified BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
  _deleted BOOLEAN DEFAULT FALSE,
  
  -- Unique constraint: one preference set per user per household (or global)
  UNIQUE(user_id, household_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notification_prefs_user ON public.notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_prefs_household ON public.notification_preferences(household_id);
CREATE INDEX IF NOT EXISTS idx_notification_prefs_modified ON public.notification_preferences(_modified);
CREATE INDEX IF NOT EXISTS idx_notification_prefs_not_deleted ON public.notification_preferences(_deleted) WHERE _deleted = FALSE;

-- Updated_at trigger
DROP TRIGGER IF EXISTS notification_prefs_updated_at ON public.notification_preferences;
CREATE TRIGGER notification_prefs_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Comments
COMMENT ON TABLE public.notification_preferences IS 'User notification settings per channel and event type, with household-specific overrides';
COMMENT ON COLUMN public.notification_preferences.household_id IS 'NULL for global preferences, specific household_id for overrides';
COMMENT ON COLUMN public.notification_preferences.event_preferences IS 'Per-event-type notification toggles';

-- ============================================
-- STEP 10: ADD RLS POLICIES FOR NEW TABLES
-- ============================================

-- Enable RLS
ALTER TABLE public.point_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- POINT_ADJUSTMENTS POLICIES
-- Members can view adjustments for their households
DROP POLICY IF EXISTS "Members can view point adjustments" ON public.point_adjustments;
CREATE POLICY "Members can view point adjustments" ON public.point_adjustments
  FOR SELECT
  TO authenticated
  USING (
    household_id IN (
      SELECT household_id 
      FROM public.household_members 
      WHERE user_id = (SELECT auth.uid())
        AND _deleted = FALSE
    )
  );

-- Only admins can create point adjustments
DROP POLICY IF EXISTS "Admins can create point adjustments" ON public.point_adjustments;
CREATE POLICY "Admins can create point adjustments" ON public.point_adjustments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    household_id IN (
      SELECT household_id 
      FROM public.household_members 
      WHERE user_id = (SELECT auth.uid())
        AND role = 'admin'
        AND _deleted = FALSE
    )
  );

-- Admins can update their own adjustments (e.g., fix typos in reason)
DROP POLICY IF EXISTS "Admins can update their adjustments" ON public.point_adjustments;
CREATE POLICY "Admins can update their adjustments" ON public.point_adjustments
  FOR UPDATE
  TO authenticated
  USING (adjusted_by = (SELECT auth.uid()));

-- NOTIFICATION_PREFERENCES POLICIES
-- Users can view their own preferences
DROP POLICY IF EXISTS "Users can view their preferences" ON public.notification_preferences;
CREATE POLICY "Users can view their preferences" ON public.notification_preferences
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Users can manage their own preferences
DROP POLICY IF EXISTS "Users can manage their preferences" ON public.notification_preferences;
CREATE POLICY "Users can manage their preferences" ON public.notification_preferences
  FOR ALL
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ============================================
-- STEP 11: ADD TO REALTIME PUBLICATION
-- ============================================

-- Add new tables to realtime publication
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.point_adjustments;
  EXCEPTION
    WHEN undefined_table THEN NULL;
    WHEN undefined_object THEN NULL;
  END;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.point_adjustments;
END $$;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.notification_preferences;
  EXCEPTION
    WHEN undefined_table THEN NULL;
    WHEN undefined_object THEN NULL;
  END;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_preferences;
END $$;

-- ============================================
-- STEP 12: CREATE HELPER FUNCTIONS
-- ============================================

-- Function to calculate user's current point balance
CREATE OR REPLACE FUNCTION public.calculate_user_points(
  p_user_id UUID,
  p_household_id UUID
)
RETURNS INTEGER AS $$
DECLARE
  v_points INTEGER;
BEGIN
  -- Get base points from household_members
  SELECT points INTO v_points
  FROM public.household_members
  WHERE user_id = p_user_id
    AND household_id = p_household_id
    AND _deleted = FALSE;
  
  -- If no record found, return 0
  IF v_points IS NULL THEN
    RETURN 0;
  END IF;
  
  RETURN v_points;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to apply point adjustment and update household_members
CREATE OR REPLACE FUNCTION public.apply_point_adjustment()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the household_members points
  UPDATE public.household_members
  SET points = points + NEW.amount,
      updated_at = NOW(),
      _modified = EXTRACT(EPOCH FROM NOW())::BIGINT * 1000
  WHERE user_id = NEW.user_id
    AND household_id = NEW.household_id
    AND _deleted = FALSE;
  
  -- Ensure points don't go negative
  UPDATE public.household_members
  SET points = 0
  WHERE user_id = NEW.user_id
    AND household_id = NEW.household_id
    AND points < 0
    AND _deleted = FALSE;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically update points when adjustment is inserted
DROP TRIGGER IF EXISTS apply_point_adjustment_trigger ON public.point_adjustments;
CREATE TRIGGER apply_point_adjustment_trigger
  AFTER INSERT ON public.point_adjustments
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_point_adjustment();

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

-- Add migration tracking comment
COMMENT ON SCHEMA public IS 'Enhanced schema aligned with REQUIREMENTS.md - supports configurable workflows, audit trails, and notification preferences';
