# Iron Holdfast — iOS & Android Store Release

Status: release-prep branch. Store publication remains account/signing/review gated.

## Product identity

- App name: **Iron Holdfast**
- Suggested subtitle: **Castle Siege Strategy**
- Suggested Google Play short description: **Build a holdfast, command your army, and fight inside the siege.**
- Category: Games / Strategy. Consider Action as the secondary App Store category.
- Version: `1.0.0`
- Initial build/version code: `1`
- Default provisional bundle/application id: `com.ironholdfast.game`
- Override bundle/application id at native-project generation with `CAP_APP_ID` before the permanent store record is created.
- Production game backend: `https://iron-empire.higgsfield.app`
- Privacy policy: `https://iron-empire.higgsfield.app/privacy.html`
- Support URL: `https://iron-empire.higgsfield.app/support.html`
- Marketing/game URL: `https://iron-empire.higgsfield.app/`

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

The native package uses Capacitor 8.4.2. The game HTML/JavaScript is bundled into the iOS/Android app package. `scripts/prepare-mobile.mjs` rewrites only the mobile build output so WebSocket traffic connects to the production authoritative server instead of the native WebView's local origin.

The web deployment remains unchanged.

Commands:

```bash
bun install
bun test
bun run mobile:prepare
npx cap add android
npx cap add ios
```

For an existing generated native project use:

```bash
bun run mobile:sync
```

## Current platform targets

- Android: Capacitor 8.4.2 baseline, Android 16 / API level 36 target.
- iOS/iPadOS: build with Xcode 26+ and iOS/iPadOS 26 SDK or later.
- GitHub mobile CI uses macOS 26 with Xcode 26.6 for the iOS validation build.

## Content-rating facts to enter truthfully

Do not preselect a rating without completing each store's current questionnaire. Current game content includes stylized medieval combat and siege warfare. The current release does **not** include graphic gore, gambling, chat, social profiles, advertising, or user-generated content.

## Privacy/Data Safety facts to verify in store forms

Current code creates a random local player identifier and transmits it with room/gameplay messages to the authoritative server. Gameplay state/commands are transmitted for app functionality. Hosting/security infrastructure may process IP addresses and diagnostic request/connection logs. The current release has no third-party advertising SDK, analytics SDK, account-profile system, or in-app purchase code.

Before final submission, reconcile these facts with the actual production hosting/log-retention configuration and answer Apple App Privacy / Google Play Data Safety forms accordingly. Do not claim "no data collected" merely because there is no account system.

## Apple release gate

Required before an App Store upload can be completed:

1. Active Apple Developer Program membership and App Store Connect access.
2. Final bundle ID registered to the developer team.
3. Distribution signing certificate/provisioning handled through Xcode or CI secrets.
4. App record, age rating, App Privacy answers, screenshots, 1024x1024 app icon, support/privacy URLs, pricing/availability and review contact completed.
5. Archive built with Xcode 26+ / iOS 26 SDK or later.
6. TestFlight smoke test on representative iPhone/iPad hardware.
7. Explicit founder approval immediately before production/store submission.
8. Submit for App Review; public availability occurs only after Apple approval and the selected release mode.

## Google Play release gate

Required before a Google Play production release can be completed:

1. Active Play Console developer account and app record.
2. Final application ID.
3. Play App Signing / upload key configured.
4. Store listing, screenshots, 512x512 icon, feature graphic, content rating, target audience, ads declaration, Data Safety, privacy policy and app-access declarations completed.
5. Signed release AAB targeting Android 16 / API 36.
6. Internal/closed test smoke test on representative Android devices.
7. Any testing requirement imposed by the specific Play developer account must be completed before production access.
8. Explicit founder approval immediately before production/store submission.
9. Submit production release; public availability occurs only after Google accepts/processes the release.

## Release safety

Do not commit certificates, provisioning profiles, keystores, passwords, App Store Connect private keys, Google service-account JSON, or Play upload keys. Use encrypted CI/store secret facilities. Production release remains separate from code preparation and test builds.
