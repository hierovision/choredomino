-- ============================================
-- Chore Domino - Chores & Completions Schema
-- ============================================
-- Phase 2: Chore management tables
-- Deploy after Phase 1 is stable
-- ============================================

-- ============================================
-- CHORES TABLE
-- ============================================

CREATE TABLE public.chores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  
  -- Chore details
  title VARCHAR(200) NOT NULL,
  description TEXT,
  points INTEGER NOT NULL DEFAULT 10,
  
  -- Assignment
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Scheduling
  frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('once', 'daily', 'weekly', 'monthly')),
  due_date TIMESTAMPTZ,
  reminder_enabled BOOLEAN DEFAULT FALSE,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Sync fields
  _modified BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
  _deleted BOOLEAN DEFAULT FALSE,
  
  -- Constraints
  CONSTRAINT valid_title CHECK (LENGTH(TRIM(title)) > 0),
  CONSTRAINT valid_points CHECK (points >= 0)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chores_household ON public.chores(household_id);
CREATE INDEX IF NOT EXISTS idx_chores_assigned_to ON public.chores(assigned_to);
CREATE INDEX IF NOT EXISTS idx_chores_due_date ON public.chores(due_date) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_chores_modified ON public.chores(_modified);
CREATE INDEX IF NOT EXISTS idx_chores_not_deleted ON public.chores(_deleted) WHERE _deleted = FALSE;

-- Updated_at trigger
DROP TRIGGER IF EXISTS chores_updated_at ON public.chores;
CREATE TRIGGER chores_updated_at
  BEFORE UPDATE ON public.chores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- CHORE COMPLETIONS TABLE
-- ============================================

CREATE TABLE public.chore_completions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chore_id UUID NOT NULL REFERENCES public.chores(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  
  -- Who completed it
  completed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Optional proof
  photo_url TEXT,
  notes TEXT,
  
  -- Approval workflow
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  
  -- Points awarded (can differ from chore.points)
  points_awarded INTEGER,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Sync fields
  _modified BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
  _deleted BOOLEAN DEFAULT FALSE,
  
  -- Constraints
  CONSTRAINT valid_points_awarded CHECK (points_awarded IS NULL OR points_awarded >= 0)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_completions_chore ON public.chore_completions(chore_id);
CREATE INDEX IF NOT EXISTS idx_completions_household ON public.chore_completions(household_id);
CREATE INDEX IF NOT EXISTS idx_completions_completed_by ON public.chore_completions(completed_by);
CREATE INDEX IF NOT EXISTS idx_completions_status ON public.chore_completions(status);
CREATE INDEX IF NOT EXISTS idx_completions_completed_at ON public.chore_completions(completed_at);
CREATE INDEX IF NOT EXISTS idx_completions_modified ON public.chore_completions(_modified);
CREATE INDEX IF NOT EXISTS idx_completions_not_deleted ON public.chore_completions(_deleted) WHERE _deleted = FALSE;

-- Updated_at trigger
DROP TRIGGER IF EXISTS completions_updated_at ON public.chore_completions;
CREATE TRIGGER completions_updated_at
  BEFORE UPDATE ON public.chore_completions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.chores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chore_completions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES - CHORES
-- ============================================

-- Members can view chores in their households
DROP POLICY IF EXISTS "Members can view household chores" ON public.chores;
CREATE POLICY "Members can view household chores" ON public.chores
  FOR SELECT
  USING (
    household_id IN (
      SELECT household_id 
      FROM public.household_members 
      WHERE user_id = auth.uid()
        AND _deleted = FALSE
    )
  );

-- Members can create chores in their households
DROP POLICY IF EXISTS "Members can create chores" ON public.chores;
CREATE POLICY "Members can create chores" ON public.chores
  FOR INSERT
  WITH CHECK (
    household_id IN (
      SELECT household_id 
      FROM public.household_members 
      WHERE user_id = auth.uid()
        AND _deleted = FALSE
    )
    AND created_by = auth.uid()
  );

-- Members can update chores in their households
DROP POLICY IF EXISTS "Members can update chores" ON public.chores;
CREATE POLICY "Members can update chores" ON public.chores
  FOR UPDATE
  USING (
    household_id IN (
      SELECT household_id 
      FROM public.household_members 
      WHERE user_id = auth.uid()
        AND _deleted = FALSE
    )
  );

-- ============================================
-- RLS POLICIES - CHORE COMPLETIONS
-- ============================================

-- Members can view completions in their households
DROP POLICY IF EXISTS "Members can view completions" ON public.chore_completions;
CREATE POLICY "Members can view completions" ON public.chore_completions
  FOR SELECT
  USING (
    household_id IN (
      SELECT household_id 
      FROM public.household_members 
      WHERE user_id = auth.uid()
        AND _deleted = FALSE
    )
  );

-- Members can create completions for chores in their households
DROP POLICY IF EXISTS "Members can create completions" ON public.chore_completions;
CREATE POLICY "Members can create completions" ON public.chore_completions
  FOR INSERT
  WITH CHECK (
    household_id IN (
      SELECT household_id 
      FROM public.household_members 
      WHERE user_id = auth.uid()
        AND _deleted = FALSE
    )
    AND completed_by = auth.uid()
  );

-- Members can update their own completions if pending
-- Admins can update any completion (for approval)
DROP POLICY IF EXISTS "Members can update completions" ON public.chore_completions;
CREATE POLICY "Members can update completions" ON public.chore_completions
  FOR UPDATE
  USING (
    household_id IN (
      SELECT household_id 
      FROM public.household_members 
      WHERE user_id = auth.uid()
        AND _deleted = FALSE
    )
    AND (
      -- Own pending completion
      (completed_by = auth.uid() AND status = 'pending')
      -- Or household admin
      OR EXISTS (
        SELECT 1 
        FROM public.household_members 
        WHERE household_id = chore_completions.household_id
          AND user_id = auth.uid()
          AND role = 'admin'
          AND _deleted = FALSE
      )
    )
  );

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to update member points when completion is approved
CREATE OR REPLACE FUNCTION public.update_member_points_on_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process when status changes to 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    -- Get points from chore if not explicitly set
    IF NEW.points_awarded IS NULL THEN
      NEW.points_awarded = (SELECT points FROM public.chores WHERE id = NEW.chore_id);
    END IF;
    
    -- Add points to the member's account
    UPDATE public.household_members
    SET points = points + NEW.points_awarded
    WHERE household_id = NEW.household_id
      AND user_id = NEW.completed_by;
      
    -- Set review timestamp and reviewer
    NEW.reviewed_at = NOW();
    NEW.reviewed_by = auth.uid();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS completion_approval_update_points ON public.chore_completions;
CREATE TRIGGER completion_approval_update_points
  BEFORE UPDATE ON public.chore_completions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_member_points_on_approval();

-- ============================================
-- REALTIME PUBLICATION
-- ============================================

DO $$
BEGIN
  -- Try to remove the table from publication if it exists
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.chores;
  EXCEPTION
    WHEN undefined_table THEN NULL;
    WHEN undefined_object THEN NULL;
  END;
  -- Add the table to publication
  ALTER PUBLICATION supabase_realtime ADD TABLE public.chores;
END $$;
DO $$
BEGIN
  -- Try to remove the table from publication if it exists
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.chore_completions;
  EXCEPTION
    WHEN undefined_table THEN NULL;
    WHEN undefined_object THEN NULL;
  END;
  -- Add the table to publication
  ALTER PUBLICATION supabase_realtime ADD TABLE public.chore_completions;
END $$;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE public.chores IS 'Tasks to be completed within households';
COMMENT ON TABLE public.chore_completions IS 'Records of completed chores with approval workflow';

COMMENT ON COLUMN public.chores.frequency IS 'How often the chore should be done: once, daily, weekly, monthly';
COMMENT ON COLUMN public.chore_completions.status IS 'Approval status: pending, approved, rejected';
COMMENT ON COLUMN public.chore_completions.points_awarded IS 'Points given (may differ from chore.points)';
