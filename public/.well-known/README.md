# `.well-known/` — Deep-link / App-Link verification files

These files let iOS Universal Links and Android App Links **auto-verify** that
this domain is owned by the native app, so HTTPS URLs can open the installed app
directly. They are static and must be served verbatim as JSON.

| File | Platform | Purpose |
| --- | --- | --- |
| `apple-app-site-association` | iOS | Associates `VDN4DBVKPJ.com.ankaadesign.management` with this domain (Universal Links + webcredentials). No `.json` extension, served as `application/json`. |
| `assetlinks.json` | Android | Associates package `com.ankaadesign.management` (Digital Asset Links) for App Links auto-verify. |

> This directory is **mirrored** in `api/public/.well-known/`. The two copies
> must stay byte-for-byte identical. Edit both whenever you change either.
> The **authoritative** AASA for iOS Universal Links is the one served on
> `https://ankaadesign.com.br` (the domain listed in the app's
> `associatedDomains` entitlement) — **not** the `api.` subdomain copy.

## Important: `/install` is intentionally NOT in the AASA

The install landing page (`https://ankaadesign.com.br/install`) must open in the
**browser**, never deep-link into the app — it is where a user *without* the app
goes to download it. The AASA `applinks.components` only match `/app/*`,
`/task/*`, `/order/*`, `/producao/*/detalhes/*`, etc. There is **no** component
matching `/install`, so iOS will not intercept it. **Do not add `/install` to the
AASA.**

## Android signing fingerprint — the moving part

`assetlinks.json > sha256_cert_fingerprints` **MUST** equal the SHA-256
fingerprint of the **keystore that signs the RELEASE APK that users actually
install**. Android only auto-verifies App Links when the installed APK's signing
cert matches a fingerprint listed here.

Current value:

```
BC:72:57:60:30:FB:9D:5E:D6:BE:A7:80:E1:64:66:43:E4:9B:20:EE:C0:7A:48:F9:C2:2C:0C:CE:89:F7:AE:5B
```

### Why it keeps breaking today

Release APKs are currently signed with an **ephemeral / debug / EAS-managed**
key, so the signing fingerprint **shifts on every build** and never matches the
value above. Result: **Android App Links auto-verify fails** (HTTPS links to
`ankaadesign.com.br` do not auto-open the app).

This does **not** break the install flow. The custom scheme
**`ankaadesign://`** still opens the app whenever it is installed, and the
install page's "open app" gesture (a user tap, which Android always honors for a
custom scheme) still works. So **"open app if installed"** continues to function
via the install page even while auto-verify is red. Auto-verify is a
nice-to-have (silent HTTPS interception); the custom scheme is the reliable path.

### Fixing it (after the mobile team locks a permanent keystore)

1. The mobile team generates a **permanent release keystore** and signs the
   release APK with it.
2. Extract its SHA-256 fingerprint:
   ```
   keytool -list -v -keystore release.keystore -alias <alias> | grep 'SHA256:'
   # or, from a built apk:
   apksigner verify --print-certs app-release.apk | grep -i 'SHA-256'
   ```
3. Paste the new colon-separated uppercase fingerprint into
   `sha256_cert_fingerprints` **in BOTH mirrors**:
   - `web/public/.well-known/assetlinks.json`
   - `api/public/.well-known/assetlinks.json`
4. Redeploy the web build (and API) so the new file is live, then re-trigger
   verification (reinstall the app, or
   `adb shell pm verify-app-links --re-verify com.ankaadesign.management`).

You may list **multiple** fingerprints in the array (e.g. Play App Signing key +
upload key) — keep all that can sign an installed APK.
