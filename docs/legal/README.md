# Legal texts

The Terms & Conditions and Privacy Policy are shown to Owners inside the app and accepted at onboarding,
so their single source now lives next to the page that renders them:

- [Syarat & Ketentuan](../../web/src/features/legal/content/syarat-dan-ketentuan.md)
- [Kebijakan Privasi](../../web/src/features/legal/content/kebijakan-privasi.md)

Both are **drafts** and must be reviewed by a legal advisor before launch. When the text changes,
bump `Legal:TermsVersion` in `backend/src/EventLy.Api/appsettings.json`: Owners are then asked to accept
the new version.
