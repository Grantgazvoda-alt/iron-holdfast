# Iron Holdfast — App Store Connect Release Runbook

Status: iOS source and CI preparation only. No production deployment, signing, App Store Connect upload, TestFlight release, or App Review submission is performed by this branch.

Prepared: August 18, 2026

## App identity

Provisional values until the permanent Apple publisher identity is confirmed:

- App name: `Iron Holdfast`
- Bundle ID: `com.ironholdfast.game`
- Version: `1.0.0`
- Build: `1`
- Primary category: Games — Strategy
- Secondary category: Games — Action
- Subtitle: `Castle Siege Strategy`
- Planned support URL: `https://iron-empire.higgsfield.app/support.html`
- Planned marketing URL: `https://iron-empire.higgsfield.app/`
- Planned privacy URL: `https://iron-empire.higgsfield.app/privacy.html`

The support/privacy pages exist on this branch but are not considered publicly live until a separately approved production deployment makes those exact URLs reachable.

Do not create a permanent App Store record until the publisher identity and bundle ID are confirmed.

## Product-page copy

### Description

Build a working medieval holdfast while enemy armies close in. Grow the economy, gather wood, stone, iron, gold and food, raise walls and towers, train a garrison, unlock technology, and survive escalating siege pressure.

Command troops from the strategic view, then enter Battle Mode and take direct control of a soldier inside the same live siege. Move through the battlefield, attack, brace with a shield, sprint, and return to command while the authoritative simulation continues.

Iron Holdfast is built around one continuous war: build the fortress, command the army, and fight for it yourself.

An internet connection is required because the authoritative battle simulation runs on the Iron Holdfast game server.

### Keywords

`castle,siege,strategy,medieval,RTS,battle,fortress,tactics,army,survival,war`

### Promotional text

`Build the fortress, command the garrison, then enter the siege and fight beside your soldiers.`

## App Review notes

Iron Holdfast is a real-time medieval strategy and combat game. The iOS app packages the playable HTML/JavaScript client inside the application bundle and serves those packaged assets locally through a WKWebView custom scheme; it is not a remote website bookmark.

The authoritative battle simulation is hosted on the Iron Holdfast server. The client sends player intents and receives authoritative state; it does not decide trusted damage, resources, ownership, victory, or other authoritative simulation outcomes.

No login or demo account is required by the current source. The release contains stylized medieval combat and weapons. Current source does not include advertising SDKs, chat/social profiles, gambling, or in-app purchase code.

## Privacy posture

Repository evidence establishes that the client creates a random local player identifier and sends it with room/gameplay traffic to the authoritative server. The server persists per-room state in Durable Object storage; that state includes player identifiers/seat ownership data and game simulation state. The reviewed server source does not define a fixed retention period for that persisted room state.

Hosting/security infrastructure may additionally process request and diagnostic information, but a concrete infrastructure-log retention period has not been verified. Do not invent one in App Store Connect or the public policy.

For App Store Connect, do not claim `No Data Collected`. Treat the random player identifier as an identifier used for app functionality and conservatively treat persisted gameplay/room state as linked to that identifier unless production processing is separately verified to de-identify it. Current source shows no advertising or cross-app tracking integration.

The native shell exposes the packaged privacy policy from inside the app.

## Apple privacy-manifest / required-reason API discipline

The native release shell deliberately does not use `UserDefaults` merely for CI/runtime probing. CI stores its readiness marker in the app sandbox instead. If future iOS code introduces a required-reason API, add the appropriate `PrivacyInfo.xcprivacy` declaration and approved reason before submission rather than allowing the API to appear silently.

## Runtime QA

A process-level simulator launch is not sufficient. CI must verify that the packaged `#app` DOM actually loaded, record a successful runtime marker, and capture a screenshot after readiness. A blank/background-only simulator screenshot is a release failure even if the process is running.

## Age rating

Complete Apple's then-current questionnaire against the exact submitted build. Relevant content includes medieval human combat, swords, bows and other weapons, and stylized battle/death presentation. Do not guess the resulting numeric age rating.

## Screenshots and artwork

CI generates a 1024x1024 App Store icon candidate from the existing game icon and captures an iPhone Simulator smoke screenshot. These prove dimensions/runtime behavior; they do not replace final store-quality visual review.

Prepare real gameplay screenshots for required iPhone and iPad display sets, prioritizing:

1. fortress/economy overview;
2. wall and tower defense under siege;
3. troop training/tactical command;
4. direct Battle Mode; and
5. a large battle or victory/defeat state.

Do not fabricate gameplay screens or show features not present in the submitted build.

## Signing and upload gates

Before App Store submission:

1. Verify App Store Connect access and publisher/team identity.
2. Confirm the permanent bundle ID.
3. Ensure production support/privacy URLs are publicly reachable.
4. Configure Apple distribution signing/provisioning using Apple/Xcode-managed signing or an approved secret store.
5. Produce a signed Release archive using the Apple-required current Xcode/iOS SDK generation.
6. Upload to App Store Connect and complete processing.
7. Complete App Privacy, age rating, content-rights, pricing/availability, review contact and any regional compliance fields.
8. Run TestFlight on representative physical iPhone/iPad hardware.
9. Obtain explicit founder approval immediately before production submission to App Review.

Never commit or paste Apple passwords, 2FA codes, certificates, provisioning profiles, App Store Connect private keys, API private keys, or signing secrets into source control, issues, logs, or chat.
