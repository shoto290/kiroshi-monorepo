# Kiroshi iOS

The native iOS app. `project.yml` is the only source of truth: XcodeGen generates `Kiroshi.xcodeproj` from it, and the generated project is not committed.

**Never edit the `.xcodeproj`, edit `project.yml`.**

## Install

- Xcode 27, with the iOS 27 simulator runtime (`.xcode-version` pins the version)
- XcodeGen: `brew install xcodegen`

## Commands

Run from the repo root:

```bash
bun run ios:generate  # Generate apps/ios/Kiroshi.xcodeproj from project.yml
bun run ios:build     # Generate, then build for the iOS Simulator
bun run ios:test      # Generate, then run the tests on an iPhone 17 simulator (iOS 27.0)
bun run ios:run       # Generate, build, then launch the app on the booted iOS 27 iPhone, else an iPhone 17, and open DeviceHub (IOS_SIMULATOR="iPhone 18 Pro" picks another)
```

Format Swift with the toolchain's `swift format`, configured by the root `.swift-format`:

```bash
swift format lint --recursive apps/ios
```

## Sign-in states without the network

A Debug build opens straight on one state of page 1 "Sign in" of the Paper file "Kiroshi, iOS", fed by fixtures instead of the cloud, when launched with `-fixture` and the artboard number (`1.1` to `1.10`, `1.7b`, plus `spaces` and `spaces-unreachable`):

```bash
xcrun simctl launch --terminate-running-process booted com.kiroshi.app.ios -fixture 1.7
```

The same fixtures feed the `#Preview`s.

## Settings and Sign out without the network

Page 5 "Settings" sits behind the gear of the Spaces list. Two Debug fixtures keep the real Keychain and script the cloud (three spaces, Sign out answered), so signing out really empties the Keychain:

```bash
xcrun simctl launch --terminate-running-process booted com.kiroshi.app.ios -fixture keychain-seeded  # Writes a fixture session to the Keychain, opens on the Spaces list
xcrun simctl launch --terminate-running-process booted com.kiroshi.app.ios -fixture keychain         # Opens on whatever the Keychain holds
```

Tap the gear, then Sign out. Relaunched with `-fixture keychain` after confirming, the app opens on Sign in: no session is left on the device.
