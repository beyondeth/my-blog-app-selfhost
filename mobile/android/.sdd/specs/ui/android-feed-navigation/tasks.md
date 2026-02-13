# Tasks: android-feed-navigation

- [P1] [x] Define bottom-tab route map aligned with iOS information architecture.
- [P1] [x] Define feed state machine (`Loading`, `Ready`, `Empty`, `Error`, `Offline`).
- [P1] [x] Define cursor pagination behavior and end-of-list handling.
- [P2] [x] Define action handlers (like/comment/share) with clear event boundaries.
- [P2] [→T] [x] Add UI scenario checklist for refresh, pagination, and offline recovery.
- [P2] [→T] [x] Add accessibility checklist (TalkBack labels, large text, contrast).
- [P2] [→T] [x] Add relative-time boundary tests (59s/60s/61s) to prevent minute drift regressions.
- [P2] [x] Add deterministic relative-time formatter contract (`ClockProvider` + formatter).
- [P3] [US] [ ] Decide animation parity depth versus Android-native adaptation level.
