# Pre-release soak test checklist

Run on a **physical iPhone** before App Store submission. Check each path; note failures in TestFlight feedback.

## Critical paths

- [ ] Cold start → Welcome intro → Sign up → Onboarding (all 4 steps) → Bootstrap → List tab
- [ ] Add item by typing → auto-categorized into zone
- [ ] Switch to Shop mode → check items off → complete shop run → mascot celebration
- [ ] Sign out → Sign in with existing account → data persists
- [ ] Forgot password email → deep link `listio://auth/reset-password` → set new password
- [ ] Profile → Plan → contextual paywall at free limit
- [ ] Restore purchases (Settings → Restore purchases)
- [ ] Profile → Share list → send invite → accept on second account
- [ ] Home screen widget shows unchecked count (dev/EAS build with native widget module)
- [ ] Sign in with Apple (iOS device)
- [ ] Multi-list: create second list → switch active list → items isolated per list
- [ ] Siri Shortcut: "Add milk to Listio" via `listio://add?item=milk`

## Network & lifecycle

- [ ] Background app during shop trip → foreground → list state intact
- [ ] Airplane mode off → add item on flaky Wi‑Fi → sync when back online
- [ ] Kill app mid-shop → relaunch → checked state preserved

## Appearance & accessibility

- [ ] Light mode all main tabs
- [ ] Dark mode all main tabs
- [ ] Reduce Motion enabled → animations respect setting
- [ ] VoiceOver on List item row and Shop mode check

## Automated verification

```bash
npm run ci
```
