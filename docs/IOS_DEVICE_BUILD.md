# iOS device build signing

## Symptom

`expo run:ios --device` fails with provisioning profile errors:

- App Groups / `group.com.cameroncons.listio` not supported
- Sign in with Apple entitlement missing

## Cause

New entitlements were added (widget App Group, Sign in with Apple) but the cached provisioning profile predates them. Expo only passes `-allowProvisioningUpdates` on the **first** auto-sign setup; once `DEVELOPMENT_TEAM` is in the Xcode project, later builds skip profile refresh.

## Fix (automatic)

This repo patches `@expo/cli` so **physical device builds always pass** `-allowProvisioningUpdates`.

```bash
npm run ios:run-device
```

If profiles are still stale, refresh once manually:

```bash
cd ios
xcodebuild -workspace Listio.xcworkspace -scheme Listio -configuration Debug \
  -destination 'id=<YOUR_DEVICE_UDID>' \
  -allowProvisioningUpdates -allowProvisioningDeviceRegistration \
  DEVELOPMENT_TEAM=8BHN6DJ84V build
```

## Apple Developer Portal (one-time)

Ensure these exist under [Identifiers](https://developer.apple.com/account/resources/identifiers/list):

| Identifier | Capabilities |
|------------|--------------|
| `com.cameroncons.listio` | Sign in with Apple, App Groups → `group.com.cameroncons.listio` |
| `com.cameroncons.listio.ListioWidget` | App Groups → `group.com.cameroncons.listio` |
| `group.com.cameroncons.listio` | App Group container |

Xcode must be signed in with the same Apple Developer team (`8BHN6DJ84V`).
