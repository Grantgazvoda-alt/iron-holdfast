# Iron Holdfast — App Store Connect Submission Package

Status: prepared for App Store Connect setup; signing, upload, TestFlight, and App Review submission remain external/account-gated.

Prepared: August 18, 2026

## 1. App record

Use these values unless the founder changes the commercial identity before the permanent App Store record is created.

- App name: `Iron Holdfast`
- Primary language: English (U.S.)
- Bundle ID: `com.ironholdfast.game`
- SKU suggestion: `iron-holdfast-ios-001`
- Version: `1.0.0`
- Build: `1`
- Primary category: Games — Strategy
- Secondary category: Games — Action
- Subtitle: `Castle Siege Strategy`
- Support URL: `https://iron-empire.higgsfield.app/support.html`
- Marketing URL: `https://iron-empire.higgsfield.app/`
- Privacy Policy URL: `https://iron-empire.higgsfield.app/privacy.html`

Do not create the permanent App Store record until the bundle ID and publisher/account identity are confirmed. Apple does not let the Bundle ID be changed after a build has been uploaded for the app record.

## 2. Product-page copy

### Description

Build a working medieval holdfast while enemy armies close in. Grow the economy, gather wood, stone, iron, gold and food, raise walls and towers, train a garrison, unlock technology, and survive escalating siege pressure.

Command troops from the strategic view, then enter Battle Mode and take direct control of a soldier inside the same live siege. Move through the battlefield, attack, brace with a shield, sprint, and return to command while the authoritative simulation continues.

Iron Holdfast is built around one continuous war: build the fortress, command the army, and fight for it yourself.

Features in the release branch include:

- real-time castle economy and construction;
- walls, towers, barracks and technology;
- server-authoritative siege simulation;
- tactical troop control, morale and routing;
- first-person Battle Mode;
- iPhone and iPad control paths; and
- enemy pressure, victory/defeat and replay loop.

An internet connection is required because the authoritative battle simulation runs on the Iron Holdfast game server.

### Keywords

`castle,siege,strategy,medieval,RTS,battle,fortress,tactics,army,survival,war`

### Promotional text suggestion

`Build the fortress, command the garrison, then enter the siege and fight beside your soldiers.`

## 3. App Review information

### Contact

- Name: Grant Gazvoda
- Email: Grantgazvoda@gmail.com
- Phone: **REQUIRED — enter the current review-contact phone number in App Store Connect. Do not place it in source control.**
- Sign-in required: No, based on the current release branch.

### Review Notes

Iron Holdfast is a real-time medieval strategy and combat game. The iOS app packages the playable HTML/JavaScript game client inside the application bundle and serves those packaged assets locally through a WKWebView custom scheme. It is not a remote website bookmark or web clipping.

The authoritative battle simulation is hosted on the Iron Holdfast server, so an internet connection is required during play. The client sends player intents and receives authoritative game state; it does not determine trusted damage, resources, victory, or other authoritative simulation outcomes.

No login or demo account is required in the current release. On first launch, choose "Begin the hold". The tutorial can be skipped. Build/train controls are in the lower tool belt. During a live siege, use "Enter Battle" to switch from command mode to direct battle control, and return to command mode from the battle interface.

The release contains stylized medieval combat and weapons. It does not contain graphic gore, gambling, advertising, chat, social profiles, or in-app purchases in the current build.

## 4. App Privacy — conservative provisional answers

These answers must be reconciled with the actual production server and hosting log-retention configuration immediately before they are entered or published in App Store Connect.

### Data currently evidenced by the game code

The client creates a random local player identifier and transmits it to the server when joining a room. Game commands and gameplay state are transmitted to/from the authoritative server for app functionality.

For a conservative App Store privacy posture, expect to disclose:

- **Identifiers → User ID** — used for App Functionality; not used for tracking.
- **User Content → Gameplay Content** — used for App Functionality; not used for tracking.
- **Usage Data → Product Interaction** — disclose if gameplay interactions/commands are retained beyond servicing the live request; used for App Functionality; not used for tracking.
- **Diagnostics / other technical data** — disclose only to the extent production infrastructure retains diagnostic/request data in a way that meets Apple's definition of collection.

Do not declare "no data collected" unless production behavior is verified to meet Apple's definition for data that is not retained beyond servicing the request.

### Linked to the user

The random player identifier is associated with the user's room/gameplay state. Unless production processing deliberately de-identifies the data before collection and prevents re-linking, answer Apple's linked-data questions conservatively rather than claiming the data is unlinked.

### Tracking

Current repository evidence shows no advertising SDK or cross-app advertising/tracking implementation. Do not mark data as used for tracking unless the production service actually links app data with third-party data for advertising/measurement or shares it with a data broker.

## 5. Age rating

Do not guess a numeric age rating. Complete Apple's current age-rating questionnaire against the exact submitted build.

Known content facts to disclose truthfully:

- medieval combat between human characters;
- swords, bows and other weapons;
- stylized battle/death presentation;
- no verified graphic gore in the current release;
- no gambling or simulated gambling in the current release;
- no loot boxes in the current release;
- no chat or user-generated social content in the current release.

The relevant Apple questionnaire categories are expected to include Realistic Violence and Guns or Other Weapons; the frequency/intensity answers must match the submitted gameplay.

## 6. Screenshots and art

The current CI produces a 1024x1024 App Store icon artifact, but visual quality must be reviewed before submission; generation from a favicon proves dimensions, not store-quality artwork.

Because the target includes both iPhone and iPad, prepare real gameplay screenshots for both device families. Apple currently accepts one to ten screenshots per required display set. For a landscape-first game, prioritize real landscape screenshots showing:

1. fortress/economy overview;
2. wall and tower defense under siege;
3. troop training and tactical command;
4. first-person/direct Battle Mode; and
5. victory/defeat or large-battle spectacle.

Do not fabricate gameplay screens or show features that are not present in the submitted build.

## 7. Export compliance

The iOS project currently declares `ITSAppUsesNonExemptEncryption: false`. Keep that declaration only if the final build qualifies for that answer under Apple's export-compliance questions. The app uses ordinary HTTPS/WSS transport through platform networking; complete Apple's export-compliance flow truthfully when uploading the signed build.

## 8. Technical status

Verified on commit `e61c9b71d5ad07ccd0100134529b05f5ad184b46`:

- Xcode 26.3 selected in GitHub Actions;
- iOS 26 SDK-family simulator build succeeded;
- Xcode project generation succeeded;
- packaged-game asset generation succeeded;
- unsigned `.app` bundle verification succeeded;
- iOS simulator artifact uploaded; and
- store-artwork artifact uploaded.

The current release-prep branch has advanced beyond that verified commit with documentation-only updates. Re-run Mobile CI and require it to pass before treating the new head as release-ready.

## 9. Remaining Apple gates

1. Verify App Store Connect access and whether the Apple Developer membership is Individual or Organization.
2. Confirm the permanent publisher identity and bundle ID before creating the app record.
3. Confirm the support and privacy URLs are publicly reachable on the production domain.
4. Finish privacy retention/deletion language and ensure the privacy policy is easily accessible from inside the iOS app.
5. Create the App Store Connect app record.
6. Configure Apple distribution signing/provisioning without committing secrets.
7. Build a signed Release archive with Xcode 26+ / iOS 26 SDK or later.
8. Upload to App Store Connect and allow processing.
9. Complete App Privacy, age rating, content-rights, pricing/availability, review-contact, and required regional compliance fields.
10. Upload real iPhone and iPad screenshots.
11. Run TestFlight on representative physical iPhone/iPad hardware.
12. Obtain explicit founder approval immediately before submitting the production version to App Review.

## 10. Release safety

Never commit or paste Apple passwords, 2FA codes, certificates, provisioning profiles, App Store Connect private keys, API private keys, or signing secrets into the repository, issues, pull requests, logs, or chat. Use Apple/Xcode-managed signing or an approved encrypted secret store.
