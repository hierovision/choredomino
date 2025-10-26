# Choredomino - Domain Requirements

> **Last Updated:** October 21, 2025
>
> This document captures the business rules and domain logic for Choredomino, a household chore management and rewards system.

---

## 🏠 Household Context

### Discovery Questions

1. **Who can create a household?**
   - [x] **Answer:** Any authenticated user with a verified email can create a household
   - **Rationale:** Email verification provides bot protection, ensures data quality, and enables password recovery
   - **Implementation:** Leverage Supabase Auth's built-in email verification

2. **What roles exist within a household?**
   - [x] **Answer:** Two roles - Admin and Member
   - **Admin:** Full control over household (manage chores, rewards, members, settings)
   - **Member:** Can complete chores, view/redeem rewards, limited editing permissions
   - **Rationale:** Simple role model provides maximum flexibility across use cases (parent-child, roommates, elderly care, employer/employee, etc.)
   - **Note:** The user who creates the household automatically becomes an Admin

3. **Can someone be in multiple households?**
   - [x] **Answer:** Yes, users can be members of multiple households
   - **Rationale:** Supports real-world scenarios (divorced parents, caregivers managing multiple homes, roommates with personal spaces)
   - **UX Consideration:** Need household switcher in UI
   - **Note:** User can have different roles in different households (Admin in one, Member in another)

4. **Who can invite/remove members?**
   - [x] **Answer:** Admins can invite and remove members; Members can only remove themselves (leave household)
   - **Admin permissions:** Invite new members, remove any member, change member roles
   - **Member permissions:** Leave household voluntarily
   - **Rationale:** Prevents abuse while giving members autonomy; maintains clear authority structure
   - **Edge case:** What if last Admin leaves? → Promote oldest remaining Member to Admin, or delete household if empty

---

## 🧹 Chore Context

### Discovery Questions - Chores

1. **Who can create/edit/delete chores?**
   - [x] **Answer:** Configurable per household - chosen during household setup
   - **Option A - Admin Control:** Only Admins manage chores; Members complete them (parent-child dynamic)
   - **Option B - Collaborative:** Admins manage all chores; Members can create/edit their own (roommates, independent teens)
   - **Option C - Full Access:** All members can manage any chore (partners, high-trust relationships)
   - **Rationale:** Different household types have different trust/authority models; one size doesn't fit all
   - **Implementation:** Add `chore_management_mode` field to households table
   - **UX Note:** Present as simple choice during household creation (e.g., "Who manages chores?")

2. **Can chores be assigned to specific people or "anyone"?**
   - [x] **Answer:** Yes - chores can be assigned to a specific household member OR left unassigned (anyone can claim it)
   - **Specific assignment:** Chore has an `assigned_to` user_id
   - **Unassigned/Anyone:** Chore has `assigned_to` as null - any member can complete it
   - **Rationale:** Covers most common use cases; keeps data model simple
   - **Future consideration:** Multi-person assignments, rotation schedules

3. **What's the lifecycle of a chore?**
   - [x] **Answer:** Configurable per household with per-chore override option
   - **Option A - Simple:** Pending → Completed (high trust, adults, roommates)
   - **Option B - Approval Required:** Pending → Completed → Approved (parent-child, quality control needed)
   - **Option C - Full Workflow:** Created → Assigned → In Progress → Completed → Approved/Rejected (complex households, strict accountability)
   - **Rationale:** Different relationships need different levels of oversight; flexibility prevents app from being too rigid
   - **Implementation:**
     - Add `default_chore_lifecycle` to households table (household-wide setting)
     - Add `lifecycle_override` to chores table (optional per-chore override)
   - **Business Rules:**
     - Points awarded only when chore reaches final state (Completed for Simple, Approved for others)
     - Rejected chores return to Pending state for re-doing
     - Only Admins can approve/reject in approval-required modes
   - **UX Note:** Present lifecycle choice during household setup; show override option when creating individual chores

4. **Can chores repeat? (Daily, weekly, custom?)**
   - [x] **Answer:** Yes - comprehensive recurrence system from simple to advanced
   - **One-time:** No recurrence (default)
   - **Simple recurrence:** Daily, Weekly, Monthly presets
   - **Advanced recurrence:** Custom intervals inspired by Google Calendar
     - Every X days/weeks/months
     - Specific days of week (e.g., Mon/Wed/Fri)
     - Specific day of month (e.g., 1st and 15th)
     - Ends: Never, After X occurrences, or On specific date
   - **Rationale:** Recurring chores are fundamental to household management; rigid options force workarounds
   - **Implementation:**
     - Store recurrence pattern in `recurrence_rule` field (iCalendar RRULE format for flexibility)
     - Generate chore instances based on rule (create new chore_completion opportunities)
   - **UX Strategy:**
     - Quick buttons for common patterns (Daily, Weekly, Monthly)
     - "Custom" option opens advanced editor with Google Calendar-style interface
     - Progressive disclosure: simple by default, powerful when needed
   - **Future consideration:** Templates that auto-assign based on rotation

5. **What happens if a chore isn't done?**
   - [x] **Answer:** Configurable per chore with household defaults for overdue handling
   - **Overdue Tracking:**
     - Visual indicators (overdue badge, color coding)
     - Automatically mark as overdue after due date/time passes
     - Track overdue duration for reporting
   - **Notification System (multi-channel):**
     - **Push Notifications:** Web Push API for PWA (mobile/desktop) - primary method
     - **Email Fallback:** Abstracted email provider integration
       - Support multiple providers (Resend, SendGrid, Mailgun, SMTP, etc.)
       - Admin configures provider credentials per household or system-wide
       - Graceful degradation if no provider configured
     - **Notification Triggers:**
       - Before due: Reminder X hours/days before
       - At due: "Chore is due now"
       - After due: "Chore is overdue" escalation
   - **Configurable Consequences (per chore, with household defaults):**
     - None (just visual overdue status)
     - Notify assignee only
     - Notify Admins after X days overdue
     - Negative points/penalties (optional)
     - Break streak tracking (optional)
   - **Implementation Notes:**
     - Email abstraction layer: Create `IEmailProvider` interface
     - Provider implementations: `ResendProvider`, `SendGridProvider`, `SMTPProvider`, etc.
     - Web Push: Use Service Worker + Push API for PWA notifications
     - Store notification preferences per user (which channels they want)
   - **Future considerations:**
     - SMS notifications (Twilio integration)
     - In-app notification center
     - Digest emails (daily/weekly summary)

### Notification Details

**Control & Preferences:**

- Members can disable their own notifications (per-channel, per-event-type)
- Admins cannot force notifications on Members (respect user autonomy)
- Hierarchy: Per-user preferences override household defaults
- Preference levels: Global (all notifications), Per-channel (email vs push), Per-event-type (assignments, completions, etc.)

**Assignment Notifications:**

- When chore assigned to specific Member → Notify that Member
- When unassigned chore created → Chore creator can optionally select which Members to notify (no auto-broadcast)

**Status Change Notifications:**

- Member completes chore → Notify Admin ONLY if lifecycle requires approval
- Admin approves/rejects chore → Notify Member (unless they've disabled notifications)
- Respect user notification preferences at all levels

---

## 🎁 Rewards Context

### Discovery Questions - Rewards

1. **Who can create rewards?**
   - [x] **Answer:** Configurable per household (follows chore_management_mode pattern)
   - **Admin Control:** Only Admins create/edit/delete rewards
   - **Collaborative:** Members can create rewards; Admins can edit/delete any reward
   - **Full Access:** All members can manage any reward
   - **Rationale:** Same flexibility principle as chores - different households need different control levels

2. **How do rewards work with chores?**
   - [x] **Answer:** Flexible reward system with multiple models
   - **No reward:** Chore is unpaid - expected contribution to household (e.g., weekly dishes)
   - **Points-based:** Chore awards X points upon completion → Members redeem points for rewards later
   - **Direct reward:** Chore completion directly grants a specific reward (bypasses points) - "Clean garage → Movie night"
   - **Hybrid:** Some chores give points, others give direct rewards, some give nothing
   - **Rationale:** Different motivational models for different relationships and chores; flexibility prevents forcing one approach

3. **Do rewards have costs/structure?**
   - [x] **Answer:** Yes - rewards can have point costs, quantities, and constraints
   - **Point cost:** Reward requires X points to redeem (e.g., "Extra screen time: 50 points")
   - **Free rewards:** Point cost = 0 or null (could be direct-grant only, or just available to all)
   - **Quantity limits:**
     - Unlimited (can redeem multiple times)
     - Limited (only X available total, or X per Member)
     - One-time (can only be redeemed once per Member)
   - **Reward menu:** Collection of available rewards with varying point costs for Members to choose from
   - **Implementation:**
     - `point_cost` field (nullable - null means no cost/not points-based)
     - `quantity_limit` field (null = unlimited)
     - `quantity_per_member` field (null = no individual limit)
     - Track redemptions to enforce limits

4. **Who can redeem rewards?**
   - [x] **Answer:** Configurable per reward - self-service or approval-required
   - **Self-service redemption:** Member has enough points → Instantly redeems → Admin notified to fulfill
   - **Approval-required:** Member requests redemption → Admin approves/denies → Points deducted on approval
   - **Auto-redemption:** When chore has direct reward attached → Reward automatically redeemed upon chore completion/approval
   - **Rationale:** Some rewards are low-stakes (pick movie tonight), others need oversight (skip a chore)
   - **Implementation:**
     - Add `requires_approval` boolean to rewards table
     - Redemption states: Requested → Approved/Denied (for approval-required)
     - Redemption states: Redeemed → Fulfilled (for self-service, tracking offline fulfillment)
   - **Notifications:**
     - Admin notified when reward is redeemed (self-service) or requested (approval-required)
     - Member notified when approval-required redemption is approved/denied
     - Optional: Admin can mark as "Fulfilled" to close the loop

5. **Can rewards expire?**
   - [x] **Answer:** Yes - configurable per reward by the reward creator
   - **Reward availability expiration:** Reward becomes unavailable after specified date/time (e.g., "Summer ice cream trip - expires Sept 1")
   - **No expiration:** Reward available indefinitely (default)
   - **Points do NOT expire:** Earned points remain indefinitely
   - **Admin point adjustment:** Admins can manually add/subtract points from Members (with audit trail)
     - Use cases: Corrections, bonuses, penalties, special occasions
     - Tracked as point adjustment transactions (not tied to chores)
   - **Implementation:**
     - Add `expires_at` timestamp to rewards table (nullable)
     - Add `point_adjustments` table: household_id, user_id, amount, reason, adjusted_by, created_at
     - UI: Reward creator sees optional "Expires on" date picker
     - Expired rewards hidden from redemption menu (but redemption history preserved)

6. **What prevents someone from just giving themselves infinite points?**
   - [x] **Answer:** Role-based permissions + comprehensive audit trail
   - **Point Sources (tracked):**
     - Chore completion/approval (automatic, linked to chore_completion_id)
     - Admin manual adjustment (logged with reason and adjusted_by user_id)
     - Direct reward from chore (tracked to chore_id)
   - **Member Restrictions:**
     - Cannot edit their own point balance directly
     - Cannot approve their own chores (unless they're an Admin - see below)
     - Cannot mark chores as complete for someone else
     - Cannot modify point values on chores (unless household rules allow collaborative chore management)
   - **Admin Capabilities:**
     - Can adjust points manually (logged with audit trail)
     - Can edit chore point values
     - **CAN approve chores they completed themselves** if lifecycle requires approval
       - Example: Admin completes chore, another Admin approves it
       - Example: Solo Admin household - Admin can self-approve (trust model)
     - Cannot circumvent system - all actions logged
   - **Chore Assignment Rules (configurable per household):**
     - Assignee acceptance: Members can accept/reject chore assignments (optional household setting)
     - If enabled, assigned chore enters "Pending Acceptance" state
     - Assignee can accept → moves to normal workflow, or reject → returns to unassigned
     - Rationale: Respects member autonomy, prevents arbitrary task dumping
   - **Security Implementation:**
     - All point changes logged in audit table with source_type and source_id
     - RLS policies enforce permissions at database level (not just UI)
     - Admin actions visible to all household members (transparency)
   - **Trust Model:** System assumes Admins are trusted; focuses on preventing Member abuse and maintaining transparency

---

## 📝 Ubiquitous Language (Domain Terms)

### Core Entities

**Household:** A group of people collaborating on chores and rewards. Can represent family, roommates, caregivers, etc.

**Member:** A user who belongs to a household. Has a role (Admin or Member) within that household.

**Admin:** Household role with full management capabilities (manage members, configure rules, adjust points).

**Member (role):** Household role with limited permissions (complete chores, redeem rewards, possibly create chores based on household settings).

**Chore:** A task to be completed by household member(s). May award points, grant direct rewards, or neither.

**Chore Lifecycle:** The workflow states a chore goes through (Simple: Pending→Completed, Approval: Pending→Completed→Approved, Full: Created→Assigned→InProgress→Completed→Approved/Rejected).

**Assignment:** Linking a chore to a specific member, or leaving it unassigned (anyone can claim).

**Completion:** Recording that a chore has been finished by a member.

**Approval:** Admin verification that a completed chore meets standards (awards points upon approval).

**Rejection:** Admin determination that a completed chore must be re-done (returns to Pending state).

**Points:** Virtual currency earned by completing chores, used to redeem rewards.

**Point Adjustment:** Manual addition/subtraction of points by Admin (logged with reason).

**Reward:** Something a member can redeem, either with points or automatically granted upon chore completion.

**Redemption:** The act of claiming/using a reward, may require approval.

**Recurrence Rule:** Pattern defining how/when a chore repeats (based on iCalendar RRULE format).

**Management Mode:** Household setting defining who can create/edit chores and rewards (Admin Control, Collaborative, Full Access).

### Key Concepts

**Chore Management Mode:** Household-level configuration determining permissions for chore creation/editing.

**Default Chore Lifecycle:** Household-level setting for typical chore workflow (can be overridden per-chore).

**Point-Based Reward:** Reward that costs points to redeem from the reward menu.

**Direct Reward:** Reward automatically granted upon completing specific chore (bypasses points).

**Self-Service Redemption:** Member can instantly redeem reward if they have sufficient points.

**Approval-Required Redemption:** Member must request redemption; Admin approves/denies.

**Audit Trail:** Complete history of all point changes with source tracking.

**Assignment Acceptance:** Optional household feature allowing members to accept/reject chore assignments.

---

## 🎯 Use Cases / User Stories

### Household Management

#### UC-1: Create Household

- Actor: Authenticated user with verified email
- Flow: User creates household → Automatically becomes Admin → Configures household settings
- Settings: Management mode, default chore lifecycle, assignment acceptance rules

#### UC-2: Invite Member

- Actor: Admin
- Flow: Admin sends invite (email/link) → Invitee accepts → Becomes Member with configured role

#### UC-3: Remove Member

- Actor: Admin or Member (self-removal only)
- Flow: Admin removes member → Member loses access to household
- Flow: Member leaves → If last Admin, promote member or delete household

#### UC-4: Switch Household

- Actor: Any user in multiple households
- Flow: User selects household from switcher → Context changes to selected household

### Chore Management

#### UC-5: Create Chore

- Actor: Based on household management mode
- Flow: User creates chore → Sets title, description, points/reward, assignment, recurrence, lifecycle override
- Variations: Assigned vs unassigned, one-time vs recurring, point-based vs direct reward vs unpaid

#### UC-6: Assign Chore

- Actor: Chore creator
- Flow: User assigns chore to specific member
- Optional: Member receives assignment notification
- Optional: Member accepts/rejects assignment (if household allows)

#### UC-7: Complete Chore

- Actor: Assigned member or any member (if unassigned)
- Flow: Member marks chore complete
- Lifecycle determines next step: Done (simple), awaiting approval (approval-required), or in-progress→complete (full workflow)

#### UC-8: Approve/Reject Chore

- Actor: Admin (or Admin who completed it, if allowed)
- Flow: Admin reviews completion → Approves (awards points/reward) or Rejects (returns to Pending)
- Notification: Member notified of approval/rejection

#### UC-9: Track Overdue Chores

- System: Automatically marks chores overdue after due date
- Notifications: Based on chore configuration (none, assignee, admins, escalation)

### Reward & Point Management

#### UC-10: Create Reward

- Actor: Based on household management mode
- Flow: User creates reward → Sets name, description, point cost, quantity limits, expiration, approval requirement

#### UC-11: Earn Points

- Actor: Member (via chore completion)
- Flow: Complete chore → (Optional approval) → Points automatically credited
- Tracked: All point changes logged with source

#### UC-12: Redeem Reward (Self-Service)

- Actor: Member with sufficient points
- Flow: Member selects reward → Points deducted → Admin notified to fulfill
- Optional: Admin marks as fulfilled

#### UC-13: Request Reward (Approval-Required)

- Actor: Member with sufficient points
- Flow: Member requests redemption → Admin approves/denies → Points deducted on approval
- Notifications: Admin notified of request, Member notified of decision

#### UC-14: Adjust Points

- Actor: Admin
- Flow: Admin manually adds/subtracts points → Enters reason → Change logged in audit trail
- Transparency: All members can view point adjustment history

#### UC-15: Auto-Redeem Direct Reward

- System: When chore with direct reward is completed/approved → Reward automatically redeemed
- Flow: Same as UC-12 but triggered by chore completion

### Notification Management

#### UC-16: Configure Notifications

- Actor: Any user
- Flow: User sets preferences per channel (push, email) and per event type (assignments, completions, approvals, etc.)
- Hierarchy: User preferences override household defaults

#### UC-17: Receive Notifications

- System: Triggers based on events and user preferences
- Channels: Web Push (primary), Email (fallback/configurable)
- Respects: User opt-outs at all preference levels

---

## 🔐 Business Rules

### Household Rules

**BR-1:** Only authenticated users with verified email addresses can create households.

**BR-2:** User who creates household automatically becomes Admin.

**BR-3:** Users can be members of multiple households with different roles in each.

**BR-4:** Only Admins can invite/remove members; Members can only remove themselves (leave).

**BR-5:** If last Admin leaves, promote oldest Member to Admin, or delete household if no Members remain.

**BR-6:** Household configuration (management mode, lifecycle, etc.) can only be changed by Admins.

### Chore Rules

**BR-7:** Chore creation/editing permissions determined by household's management mode.

**BR-8:** Chores can be assigned to specific member or left unassigned (anyone can claim).

**BR-9:** If household enables assignment acceptance, assigned member can accept/reject assignment.

**BR-10:** Chore follows lifecycle defined at household level unless overridden at chore level.

**BR-11:** Only chore completions that reach final state award points/rewards (Completed for Simple, Approved for Approval/Full workflows).

**BR-12:** Rejected chores return to Pending state and must be re-completed.

**BR-13:** Recurring chores generate new instances based on recurrence rule (iCalendar RRULE format).

**BR-14:** Overdue tracking and consequences configurable per chore with household defaults.

### Point & Reward Rules

**BR-15:** Points never expire; only Admins can manually adjust point balances (with audit trail).

**BR-16:** Every point change must be logged with source (chore completion, adjustment, etc.).

**BR-17:** Members cannot directly edit their own point balances or approve their own chores (unless they're Admins).

**BR-18:** Admins can approve chores they completed if lifecycle requires approval (trust model).

**BR-19:** Chores can award points, grant direct reward, or neither (unpaid contribution).

**BR-20:** Rewards can be self-service redeemable or require approval, configured per reward.

**BR-21:** Reward availability can expire based on configured date; expired rewards hidden from menu.

**BR-22:** Direct rewards (attached to chores) automatically redeem upon chore completion/approval.

**BR-23:** Point-based rewards deduct points immediately (self-service) or upon approval (approval-required).

**BR-24:** Reward quantity limits enforced at household and per-member levels.

### Notification Rules

**BR-25:** Members can disable their own notifications; Admins cannot force notifications.

**BR-26:** Notification preferences hierarchy: User-specific overrides household defaults.

**BR-27:** Assignment notifications sent to assignee; optional selective notification for unassigned chores.

**BR-28:** Admins notified when approval-required chores completed or approval-required rewards requested.

**BR-29:** Members notified when their chores approved/rejected or reward requests approved/denied.

**BR-30:** All notifications respect user opt-out preferences at channel and event-type levels.

### Security Rules

**BR-31:** All permission checks enforced at database level via RLS policies, not just UI.

**BR-32:** Admin actions visible to all household members (transparency principle).

**BR-33:** Audit trail immutable; all point changes permanently logged.

**BR-34:** System assumes Admins are trusted; focuses on preventing Member abuse while maintaining transparency.

---

## 📊 Data Model Implications

### Key Tables & Fields

#### households

- `chore_management_mode`: enum (admin_control, collaborative, full_access)
- `default_chore_lifecycle`: enum (simple, approval_required, full_workflow)
- `allow_assignment_acceptance`: boolean
- Other settings TBD during implementation

#### household_members

- `role`: enum (admin, member)
- `user_id`, `household_id`

#### chores

- `assigned_to`: user_id (nullable - null means unassigned)
- `recurrence_rule`: text (iCalendar RRULE format, nullable)
- `lifecycle_override`: enum (nullable - null uses household default)
- `point_value`: integer (nullable - null means no points)
- `direct_reward_id`: uuid (nullable - links to rewards table)
- `due_at`: timestamp (nullable)
- `overdue_config`: jsonb (notification triggers, consequences)

#### chore_completions

- `status`: enum (pending, in_progress, completed, approved, rejected)
- Links to chore, completed_by user, approved_by user

#### rewards

- `point_cost`: integer (nullable - null means not point-based)
- `requires_approval`: boolean
- `quantity_limit`: integer (nullable - null means unlimited)
- `quantity_per_member`: integer (nullable)
- `expires_at`: timestamp (nullable)

#### reward_redemptions

- `status`: enum (requested, approved, denied, redeemed, fulfilled)
- `points_spent`: integer
- Links to reward, redeemed_by user, approved_by user

#### point_adjustments

- `user_id`, `household_id`, `amount`, `reason`, `adjusted_by`, `created_at`
- Source tracking: `source_type`, `source_id`

#### notification_preferences

- Per-user, per-household
- Channel preferences (push, email)
- Event type preferences (assignments, completions, approvals, overdues, etc.)

---

## 🚀 Implementation Phases

### Phase 1: Foundation (Current)

- ✅ Database migrations (households, members, chores, rewards)
- ✅ IndexedDB + Supabase sync
- Authentication with email verification

### Phase 2: Core Household Management

- User profile management
- Household creation with configuration
- Member invitation system
- Household switcher UI
- Role management

### Phase 3: Basic Chore System

- Chore CRUD (Admin Control mode only initially)
- Simple lifecycle (Pending→Completed)
- Assignment (specific or unassigned)
- Point awards on completion
- Chore list views (by assignee, status, household)

### Phase 4: Reward System

- Reward CRUD
- Point balance tracking
- Self-service redemption
- Point-based rewards only initially
- Reward menu/catalog UI

### Phase 5: Advanced Chore Features

- Approval workflow (Approval Required lifecycle)
- Chore rejection/re-do
- Overdue tracking
- Basic recurrence (daily, weekly, monthly)
- Collaborative and Full Access management modes

### Phase 6: Advanced Reward Features

- Approval-required redemptions
- Direct rewards (chore→reward linkage)
- Reward expiration
- Quantity limits
- Manual point adjustments with audit trail

### Phase 7: Notification System

- Email provider abstraction layer
- Resend integration (default)
- Web Push API for PWA
- Notification preferences UI
- Event-triggered notifications

### Phase 8: Advanced Scheduling

- Custom recurrence (iCalendar RRULE)
- Assignment acceptance/rejection
- Full workflow lifecycle
- Chore templates

### Phase 9: Reporting & Analytics

- Point history
- Chore completion rates
- Member leaderboards
- Household insights
- Export capabilities

### Phase 10: Polish & Enhancement

- In-app notification center
- Digest emails
- Advanced notification triggers
- Additional email providers
- SMS notifications (future)

---

---

---

## 🎓 Domain-Driven Design Reflection

### Bounded Contexts Identified

1. **Household Management Context**
   - Aggregates: Household, HouseholdMember
   - Responsibilities: Membership, roles, household configuration
   - Ubiquitous Language: Admin, Member, Management Mode, Assignment Acceptance

2. **Chore Management Context**
   - Aggregates: Chore, ChoreCompletion
   - Responsibilities: Task definition, assignment, completion, approval workflows
   - Ubiquitous Language: Assignment, Completion, Approval, Rejection, Lifecycle, Recurrence

3. **Reward & Points Context**
   - Aggregates: Reward, Redemption, PointBalance, PointAdjustment
   - Responsibilities: Point tracking, reward definition, redemption workflows
   - Ubiquitous Language: Points, Redemption, Direct Reward, Point-Based Reward, Audit Trail

4. **Notification Context**
   - Aggregates: NotificationPreference, NotificationEvent
   - Responsibilities: Multi-channel notification delivery respecting user preferences
   - Ubiquitous Language: Channel, Event Type, Preference Hierarchy

### Key Domain Patterns Used

**Strategy Pattern:** Management modes, lifecycles (configurable behavior)

**State Machine:** Chore lifecycle states, redemption workflow states

**Event Sourcing (lightweight):** Audit trail for point changes

**Policy Pattern:** Notification rules, permission rules, overdue consequences

**Value Objects:** Recurrence rules (iCalendar RRULE), point amounts

### Business Invariants

- Points never negative (enforced at DB level)
- Can't redeem more points than available
- Assignment acceptance only applies if household allows
- Approval required states only exist in approval-required lifecycles
- Expired rewards not redeemable
- Quantity limits enforced atomically

---

*This requirements document will evolve as we implement and discover edge cases. Treat it as living documentation.*
