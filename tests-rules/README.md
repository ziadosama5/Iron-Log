# Security-rules tests

Tests for `../firestore.rules`, run in the Firebase Firestore emulator. Not part of the root `npm test`
(they need Java and extra dev packages); run them whenever the rules change, before deploying them.

```
cd tests-rules
npm install          # once (dev-only packages)
npm test             # starts the emulator, runs the tests, stops it
```

Needs Java 21 or newer (for example `winget install EclipseAdoptium.Temurin.21.JDK`).
The first run downloads the emulator.
