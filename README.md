# ProCalc — Firebase Edition (Phase 2)

A polished calculator web app built with HTML, CSS, and JavaScript modules using Firebase Authentication and Cloud Firestore.

## New in Phase 2
- Personal profile modal with editable display name
- Password-reset email using Firebase Authentication
- Scientific calculator mode: sin, cos, tan, square root, log, ln, powers, pi and e
- Toggle radians/degrees for trigonometric functions
- Statistics cards for total saved calculations and operator activity
- Scientific buttons are hidden until Scientific mode is enabled
- Responsive styling and modal/key animations

## Setup
1. Open the Firebase project `prohcul` in the Firebase Console.
2. Ensure Email/Password is enabled in Authentication → Sign-in method.
3. Create Cloud Firestore if it is not already enabled.
4. Publish the included `firestore.rules`.
5. Open this folder in VS Code and launch `index.html` with Live Server. Do not open the file directly with `file://`, because Firebase ES modules need a local HTTP server.

## Scientific mode quick tests
- `2+3*4` → `14`
- `sqrt(81)` → `9`
- `sin(pi/2)` in RAD → `1`
- `sin(30)` in DEG → `0.5`
- `log(100)` → `2`
- `2^3^2` → `512` (power is right-associative)
- `2pi` → `6.28318530718`

## Firebase data layout
- `users/{uid}`: profile fields and timestamps
- `users/{uid}/calculations/{calculationId}`: expression, result, createdAt

Passwords are handled by Firebase Authentication and are not written to Firestore.
