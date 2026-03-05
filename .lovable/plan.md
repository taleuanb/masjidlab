

## Diagnostic

The error `"Not authenticated"` (code P0001) comes from the `handle_onboarding` RPC function which calls `auth.uid()`. After signup, Supabase requires email confirmation by default --- meaning the user has **no active session** when navigating through the wizard (`/welcome` -> `/setup/identity` -> `/setup/plan`).

The signup code in `Login.tsx` calls `supabase.auth.signUp()` then immediately navigates to `/welcome` without verifying a session was created. With email confirmation enabled, `auth.uid()` returns NULL on the RPC call.

## Plan

### 1. Guard the wizard pages with session check

In `SetupPlan.tsx` and `SetupIdentity.tsx`, add an early check: if `useAuth().user` is null, redirect back to `/login` with a toast explaining they need to confirm their email first.

### 2. Fix the signup flow in `Login.tsx`

After `signUp`, check the returned `session`:
- If `session` exists (email auto-confirmed or confirmation disabled): navigate to `/welcome` as today.
- If `session` is null (confirmation required): show a toast "Vérifiez votre email pour confirmer votre compte" and stay on the login page. Do NOT navigate to `/welcome`.

### 3. Ensure returning users land correctly

When a user clicks the confirmation link in their email and lands back on the app, they'll have an active session. The login page should detect this (via `useAuth().user`) and redirect appropriately:
- If user has no org -> redirect to `/welcome`
- If user has org -> redirect to `/dashboard`

### Files to modify

- **`src/pages/Login.tsx`**: Check `data.session` after signup. If null, show confirmation message instead of navigating.
- **`src/pages/SetupPlan.tsx`**: Add auth guard --- if no `user`, redirect to `/login`.
- **`src/pages/SetupIdentity.tsx`**: Same auth guard.
- **`src/pages/Welcome.tsx`**: Same auth guard.

This is a minimal, surgical fix. No SQL or RLS changes needed --- `handle_onboarding` is correct, it just needs an authenticated caller.

