# Iron Holdfast iOS shell

This directory contains the Apple-specific native shell for Iron Holdfast. The canonical game simulation and web client remain in the parent `iron-holdfast` repository; this shell packages the web client into the application bundle and connects it to the authoritative HTTPS/WSS backend.

## Release architecture

- SwiftUI application entry point with a native launch/error/retry layer.
- `WKWebView` serves packaged assets through the private `ironholdfast://app/` scheme.
- The generated mobile package rewrites only the game WebSocket target to the production HTTPS backend; trusted damage, resources, ownership, victory, and simulation remain server-authoritative.
- `project.yml` is the reproducible XcodeGen project definition.
- Generated `www`, Xcode project, build products, icon renditions, and store artifacts are not committed.

## Runtime validation

A successful process launch is not sufficient. CI boots an iPhone Simulator, installs and launches the app, and requires the packaged `#app` DOM to report ready before capturing the smoke screenshot. Runtime readiness is written to an app-sandbox cache JSON file used only by CI diagnostics. It does not use `UserDefaults`, avoiding an unnecessary Apple required-reason API declaration.

The smoke screenshot must also be inspected visually before treating the runtime as release-ready; a blank/background-only image is a failure even if the process is alive.

## Signing

CI builds unsigned simulator and device Release bundles. Distribution certificates, provisioning profiles, App Store Connect private keys, passwords, 2FA codes, and other signing secrets must never be committed to this repository. Signed distribution and App Store submission remain separate approval-gated release actions.
