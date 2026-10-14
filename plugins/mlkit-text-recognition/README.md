# ML Kit text recognition, Latin only

A trimmed copy of [`@capacitor-mlkit/text-recognition`](https://github.com/capawesome-team/capacitor-mlkit) 8.2.1
(Apache License 2.0, see `LICENSE`), installed under the same package name so the app code does not change.

ScanReceipt reads receipts with the Latin script only. The original plugin also bundles the Chinese, Devanagari,
Japanese and Korean recognizers, whose models the app never loads: about 4 MB on Android and several times that on
iOS.

## Changes from the original

- `CapacitorMlkitTextRecognition.podspec`: only the `GoogleMLKit/TextRecognition` pod.
- `android/build.gradle`: only `com.google.mlkit:text-recognition`.
- `ios/Plugin/TextRecognition.swift` and `android/.../TextRecognition.java`: every script uses the Latin recognizer.
- `package.json`: build scripts and dev dependencies removed; `dist/` is the published build, unchanged.

## Upgrading

Copy the new version of the package over this folder, then apply the changes above again.
