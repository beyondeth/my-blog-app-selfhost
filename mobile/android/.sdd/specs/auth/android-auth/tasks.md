# Tasks: android-auth

- [P1] [x] Define auth API contract mapping for login/refresh/me/logout from `mobile/contracts`.
- [P1] [x] Define TokenStore interface and secure storage implementation strategy.
- [P1] [x] Define RefreshCoordinator policy (single in-flight refresh, queued retries).
- [P2] [x] Define auth state model (`LoggedOut`, `Restoring`, `LoggedIn`, `Expired`).
- [P2] [→T] [x] Add test matrix for login success/failure, refresh success/failure, logout.
- [P2] [→T] [x] Add concurrent 401 handling scenario test.
- [P3] [US] [ ] Decide biometric unlock integration phase (post-MVP or MVP+1).
