# Guest trial evaluation

Phase 1 funnel analytics now tracks:

- `welcome_intro_complete`
- `auth_signup_complete` / `auth_login_success`
- `onboarding_step` / `onboarding_complete`
- `first_item_added`
- `first_shop_run_complete`

**Decision rule:** If signup completion rate is low relative to welcome intro completion, prioritize a guest try-before-signup flow in a follow-up release. Until those metrics exist in production, the repositioning release ships with Sign in with Apple + clearer list-first messaging instead of a guest mode.
