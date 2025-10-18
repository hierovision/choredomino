-- ============================================
-- Chore Domino - Initial Database Schema
-- ============================================
-- Phase 1: Core tables for households and users
-- Safe to deploy to both DEV and PROD
-- 
-- SECURITY MODEL:
-- - All tables have RLS enabled (required for public schema)
-- - All policies specify "TO authenticated" role for clarity
-- - All auth.uid() calls wrapped in SELECT for performance caching
-- - user_profiles extends auth.users with ON DELETE CASCADE
-- - Auto-profile creation via trigger on auth.users INSERT
-- - Household isolation enforced via household_members junction table
-- - Multi-tenancy: users can belong to multiple households
-- - Role-based access: admin, member, child roles per household
-- 
-- REFERENCES:
-- - Auth integration: https://supabase.com/docs/guides/auth/managing-user-data
-- - RLS patterns: https://supabase.com/docs/guides/database/postgres/row-level-security
-- - Performance: Indexes on all policy columns, SELECT wrapper for auth.uid()
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- HOUSEHOLDS TABLE
-- ============================================
-- Primary isolation boundary for multi-tenancy
-- Each household is independent

CREATE TABLE IF NOT EXISTS public.households (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Settings stored as JSONB for flexibility
  settings JSONB NOT NULL DEFAULT '{
    "timezone": "UTC",
    "currency": "USD",
    "pointsPerChore": 10
  }'::jsonb,
  
  -- Sync fields for RxDB replication
  _modified BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
  _deleted BOOLEAN DEFAULT FALSE,
  
  -- Indexes for common queries
  CONSTRAINT valid_name CHECK (LENGTH(TRIM(name)) > 0)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_households_created_by ON public.households(created_by);
CREATE INDEX IF NOT EXISTS idx_households_updated_at ON public.households(updated_at);
CREATE INDEX IF NOT EXISTS idx_households_modified ON public.households(_modified);
CREATE INDEX IF NOT EXISTS idx_households_not_deleted ON public.households(_deleted) WHERE _deleted = FALSE;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW._modified = EXTRACT(EPOCH FROM NOW())::BIGINT * 1000;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS households_updated_at ON public.households;
CREATE TRIGGER households_updated_at
  BEFORE UPDATE ON public.households
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- HOUSEHOLD MEMBERS TABLE
-- ============================================
-- Junction table linking auth.users to households
-- Users can belong to multiple households

CREATE TABLE IF NOT EXISTS public.household_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- User profile within this household
  display_name VARCHAR(100) NOT NULL,
  avatar_url TEXT,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'member', 'child')),
  points INTEGER NOT NULL DEFAULT 0,
  
  -- Timestamps
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Sync fields
  _modified BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
  _deleted BOOLEAN DEFAULT FALSE,
  
  -- Constraints
  UNIQUE(household_id, user_id),
  CONSTRAINT valid_points CHECK (points >= 0),
  CONSTRAINT valid_display_name CHECK (LENGTH(TRIM(display_name)) > 0)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_household_members_household ON public.household_members(household_id);
CREATE INDEX IF NOT EXISTS idx_household_members_user ON public.household_members(user_id);
CREATE INDEX IF NOT EXISTS idx_household_members_modified ON public.household_members(_modified);
CREATE INDEX IF NOT EXISTS idx_household_members_not_deleted ON public.household_members(_deleted) WHERE _deleted = FALSE;

-- Updated_at trigger
DROP TRIGGER IF EXISTS household_members_updated_at ON public.household_members;
CREATE TRIGGER household_members_updated_at
  BEFORE UPDATE ON public.household_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- USER PROFILES TABLE
-- ============================================
-- Extends auth.users with app-specific data
-- One-to-one with auth.users

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Profile data
  full_name VARCHAR(100),
  avatar_url TEXT,
  preferences JSONB DEFAULT '{}'::jsonb,
  
  -- Current/default household
  current_household_id UUID REFERENCES public.households(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Sync fields
  _modified BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
  _deleted BOOLEAN DEFAULT FALSE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_current_household ON public.user_profiles(current_household_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_modified ON public.user_profiles(_modified);

-- Updated_at trigger
DROP TRIGGER IF EXISTS user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES - HOUSEHOLDS
-- ============================================

-- Users can see households they are members of
DROP POLICY IF EXISTS "Users can view their households" ON public.households;
CREATE POLICY "Users can view their households" ON public.households
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT household_id 
      FROM public.household_members 
      WHERE user_id = (SELECT auth.uid())
        AND _deleted = FALSE
    )
  );

-- Users can create new households (automatically become admin)
DROP POLICY IF EXISTS "Users can create households" ON public.households;
CREATE POLICY "Users can create households" ON public.households
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = (SELECT auth.uid()));

-- Only household admins can update households
DROP POLICY IF EXISTS "Household admins can update households" ON public.households;
CREATE POLICY "Household admins can update households" ON public.households
  FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT household_id 
      FROM public.household_members 
      WHERE user_id = (SELECT auth.uid())
        AND role = 'admin'
        AND _deleted = FALSE
    )
  );

-- Only household admins can soft delete households
DROP POLICY IF EXISTS "Household admins can delete households" ON public.households;
CREATE POLICY "Household admins can delete households" ON public.households
  FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT household_id 
      FROM public.household_members 
      WHERE user_id = (SELECT auth.uid())
        AND role = 'admin'
        AND _deleted = FALSE
    )
  );

-- ============================================
-- RLS POLICIES - HOUSEHOLD MEMBERS
-- ============================================

-- Members can see other members in their households
DROP POLICY IF EXISTS "Users can view household members" ON public.household_members;
CREATE POLICY "Users can view household members" ON public.household_members
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

-- Admins can add members to their households
DROP POLICY IF EXISTS "Admins can add household members" ON public.household_members;
CREATE POLICY "Admins can add household members" ON public.household_members
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

-- Users can update their own profile in a household
DROP POLICY IF EXISTS "Users can update their own household profile" ON public.household_members;
CREATE POLICY "Users can update their own household profile" ON public.household_members
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Admins can update any member in their households
DROP POLICY IF EXISTS "Admins can update household members" ON public.household_members;
CREATE POLICY "Admins can update household members" ON public.household_members
  FOR UPDATE
  TO authenticated
  USING (
    household_id IN (
      SELECT household_id 
      FROM public.household_members 
      WHERE user_id = (SELECT auth.uid())
        AND role = 'admin'
        AND _deleted = FALSE
    )
  );

-- ============================================
-- RLS POLICIES - USER PROFILES
-- ============================================

-- Users can view their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
CREATE POLICY "Users can view own profile" ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (id = (SELECT auth.uid()));

-- Users can update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Users can update own profile" ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()));

-- Users can insert their own profile
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
CREATE POLICY "Users can insert own profile" ON public.user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = (SELECT auth.uid()));

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function to ensure first household member is admin
CREATE OR REPLACE FUNCTION public.ensure_household_creator_is_admin()
RETURNS TRIGGER AS $$
BEGIN
  -- If this is the first member (creator), ensure they are admin
  IF NEW.user_id = (SELECT created_by FROM public.households WHERE id = NEW.household_id) THEN
    NEW.role = 'admin';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS household_members_ensure_creator_admin ON public.household_members;
CREATE TRIGGER household_members_ensure_creator_admin
  BEFORE INSERT ON public.household_members
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_household_creator_is_admin();

-- ============================================
-- REALTIME PUBLICATION
-- ============================================
-- Enable realtime updates for these tables

ALTER PUBLICATION supabase_realtime ADD TABLE public.households;
ALTER PUBLICATION supabase_realtime ADD TABLE public.household_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_profiles;

-- ============================================
-- COMMENTS (for documentation)
-- ============================================

COMMENT ON TABLE public.households IS 'Household/living space groups';
COMMENT ON TABLE public.household_members IS 'Users membership in households with role and points';
COMMENT ON TABLE public.user_profiles IS 'Extended user profiles linked to auth.users';

COMMENT ON COLUMN public.households._modified IS 'Timestamp in milliseconds for RxDB sync checkpoint';
COMMENT ON COLUMN public.households._deleted IS 'Soft delete flag for sync (true = deleted)';
COMMENT ON COLUMN public.household_members._modified IS 'Timestamp in milliseconds for RxDB sync checkpoint';
COMMENT ON COLUMN public.household_members._deleted IS 'Soft delete flag for sync (true = deleted)';
