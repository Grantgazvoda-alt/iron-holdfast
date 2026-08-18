# Iron Holdfast — iOS & Android Store Release

Status: release-prep branch. Store publication remains account/signing/review gated.

## Product identity

- App name: **Iron Holdfast**
- Suggested subtitle: **Castle Siege Strategy**
- Suggested Google Play short description: **Build a holdfast, command your army, and fight inside the siege.**
- Category: Games / Strategy. Consider Action as the secondary App Store category.
- Version: `1.0.0`
- Initial build/version code: `1`
- Current provisional bundle/application id: `com.ironholdfast.game`
- If the permanent store id changes, update both `mobile/android/app/build.gradle` and `mobile/ios/project.yml` before creating the permanent store records.
- Production game backend: `https://iron-empire.higgsfield.app`
- Planned privacy policy: `https://iron-empire.higgsfield.app/privacy.html`
- Planned support URL: `https://iron-empire.higgsfield.app/support.html`
- Marketing/game URL: `https://iron-empire.higgsfield.app/`

The privacy and support pages exist on the release branch but are not considered live until a separately approved production deployment makes them available at those URLs.

## Store description draft

Build a working medieval holdfast while enemy armies close in. Grow the economy, gather wood, stone, iron, gold and food, raise walls and towers, train a garrison, unlock technology, and survive escalating siege pressure.

Command troops from the strategic view, then enter Battle Mode and take direct control of a soldier inside the same live siege. Move through the battlefield, attack, brace with a shield, sprint, and return to command while the authoritative simulation continues.

Iron Holdfast is built around one continuous war: build the fortress, command the army, and fight for it yourself.

Current highlights:

- Real-time castle economy and construction
- Walls, towers, barracks and technology
- Server-authoritative siege simulation
- Tactical troop control, morale and routing
- First-person Battle Mode
- Desktop, iPhone/iPad and Android control paths
- Enemy pressure, victory/defeat and replay loop

Internet access is required because the authoritative battle simulation is hosted by the Iron Holdfast game server.

## Mobile packaging architecture

The store release intentionally does **not** depend on Capacitor or other new npm packages.

`scripts/prepare-mobile.mjs` uses Node built-ins only. It copies the current game client from `public/` into generated `mobile/www/`, then rewrites only that generated native copy so WebSocket traffic uses the production HTTPS/WSS backend. Existing web source and server-authoritative simulation logic are not moved into the client.

### Android

- Native Java `Activity` + platform `WebView`.
- Packaged game files are served from the APK/AAB through the private local origin `https://ironholdfast.local`.
- The native host intercepts that private origin and serves only packaged assets.
- External links leave the app; the game backend remains HTTPS/WSS only.
- Android Gradle Plugin `8.13.2`, Gradle `8.13`, Java `17`.
- `compileSdk 36` and `targetSdk 36`.
- App source: `mobile/android/`.

### iOS / iPadOS

- SwiftUI + platform `WKWebView`.
- Packaged game files are served through the private custom scheme `ironholdfast://app` by `WKURLSchemeHandler`.
- No App Transport Security exception is added for the production backend.
- Xcode project is generated reproducibly from `mobile/ios/project.yml` with XcodeGen.
- CI selects Xcode `26.6` and builds against the installed iOS 26 SDK family.
- App source: `mobile/ios/`.

### Asset preparation

```bash
node --check scripts/prepare-mobile.mjs
node scripts/prepare-mobile.mjs
```

Generated native copies and build output are intentionally ignored by Git. Store signing credentials must never be committed.

## Current validation state

### Android — PASS

On commit `2cff2bdda0eaed877efb52009d1ae3093c28dac4`, GitHub Mobile CI successfully completed:

1. packaged-game asset preparation;
2. Android 16 / API 36 SDK setup;
3. pinned Gradle 8.13 download plus SHA-256 integrity verification;
4. native Android App Bundle compilation;
5. AAB existence verification; and
6. artifact upload.

The produced `app-debug.aab` is a **debug/test artifact**, not a Play-release-signed production bundle.

### iOS — source ready, CI pending

The dependency-light SwiftUI/WKWebView source is committed. The newest macOS validation job is currently queued behind obsolete earlier macOS workflow jobs created before the native-shell pivot. Do not claim iOS compile success until the current native job actually completes successfully.

### Secure npm registry finding

GitHub-hosted runners timed out connecting to `socket-firewall.higgsfield.xyz:443`. The release work did **not** bypass or repoint that repository security control. Instead, the mobile shell was redesigned so native validation requires no npm package installation.

## Current platform targets

- Android: Android 16 / API level 36 target.
- iOS/iPadOS: Xcode 26+ with iOS/iPadOS 26 SDK or later for App Store submission.
- GitHub mobile CI selects Xcode 26.6 for iOS validation.

## Content-rating facts to enter truthfully

Do not preselect a rating without completing each store's current questionnaire. Current game content includes stylized medieval combat and siege warfare. The current release does **not** include graphic gore, gambling, chat, social profiles, advertising, or user-generated content.

## Privacy/Data Safety facts to verify in store forms

Current code creates a random local player identifier and transmits it with room/gameplay messages to the authoritative server. Gameplay state/commands are transmitted for app functionality. Hosting/security infrastructure may process IP addresses and diagnostic request/connection logs. The current release has no third-party advertising SDK, analytics SDK, account-profile system, or in-app purchase code.

Before final submission, reconcile these facts with the actual production hosting/log-retention configuration and answer Apple App Privacy / Google Play Data Safety forms accordingly. Do not claim "no data collected" merely because there is no account system.

## Apple release gate

Required before an App Store upload can be completed:

1. Active Apple Developer Program membership and App Store Connect access.
2. Final bundle ID registered to the developer team.
3. Distribution signing certificate/provisioning handled through Xcode or encrypted CI/store secrets.
4. App record, age rating, App Privacy answers, screenshots, production-quality 1024x1024 app icon, support/privacy URLs, pricing/availability and review contact completed.
5. Signed archive built with Xcode 26+ / iOS 26 SDK or later.
6. TestFlight smoke test on representative iPhone/iPad hardware.
7. Explicit founder approval immediately before production/store submission.
8. Submit for App Review; public availability occurs only after Apple approval and the selected release mode.

## Google Play release gate

Required before a Google Play production release can be completed:

1. Active Play Console developer account and app record.
2. Final application ID.
3. Play App Signing / upload key configured in a secure secret store.
4. Store listing, screenshots, production-quality 512x512 icon, feature graphic, content rating, target audience, ads declaration, Data Safety, privacy policy and app-access declarations completed.
5. Signed **release** AAB targeting Android 16 / API 36.
6. Internal/closed test smoke test on representative Android devices.
7. If the Play Console account is a personal developer account created after November 13, 2023, Google currently requires a closed test with at least 12 opted-in testers for 14 continuous days before the account can apply for production access. Other account types/history may have different production access.
8. Explicit founder approval immediately before production/store submission.
9. Submit production release; public availability occurs only after Google accepts/processes the release.

## Release safety

Do not commit certificates, provisioning profiles, keystores, passwords, App Store Connect private keys, Google service-account JSON, Play upload keys, or other signing secrets. Use encrypted CI/store secret facilities. Production deployment, branch merge that promotes a release, signing-key creation, and store submission remain separate founder-approval-gated actions.
