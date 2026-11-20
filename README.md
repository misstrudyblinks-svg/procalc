# ProCalc — Smart Calculator (Firebase Edition)

A responsive calculator assignment with a landing page, Firebase email/password authentication, a calculator workspace, and Firestore-backed personal calculation history.


## Firebase setup before running
1. Open the Firebase Console for project **prohcul**.
2. In **Authentication → Sign-in method**, enable **Email/Password**.
3. Create/enable **Firestore Database** (choose a location; this cannot be changed later).
4. Open Firestore **Rules**, replace the rules with the contents of `firestore.rules`, and publish.
5. For local testing, run this folder from a local web server (ES modules/CDN imports do not work reliably from `file://`). In VS Code, use Live Server and open its localhost URL. You can also deploy the static files to Firebase Hosting.


## Run it
- Extract the project folder.
- Serve `index.html` using VS Code Live Server or Firebase Hosting.
- Click **Get started** to register a new account, or **Sign in** for an existing account.
- Users can create accounts with email and password; passwords are managed only by Firebase Authentication, not stored in Firestore.


## Firebase services used
- Firebase Authentication: account creation, sign in, session persistence, sign out.
- Cloud Firestore: user profile document `users/{uid}` and personal calculation history `users/{uid}/calculations/{calculationId}`.


## Features
- Animated landing/login/dashboard interface
- Email/password signup and sign-in, display name on signup
- Firebase session state restores the user's signed-in workspace
- Personal calculation history saved to Firestore and restored after sign-in
- Clear history removes that user's stored calculation documents
- Arithmetic parser (no `eval`), decimals, parentheses, unary sign, percent, keyboard support
- Responsive design and copy-result action


## Security notes
- Firebase Web API configuration is client-side by design. Protect the database with the included Firestore Security Rules.
- The rules allow a signed-in user to read/write only their own profile and calculation subcollection. Passwords are never written to Firestore.
- This is a student/demo app, not a production-reviewed security product. Add rate limits, validation, and abuse controls before public use.
