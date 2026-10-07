# Shopping hospitalar 

Implement exactly the screenshot and nothing else

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://shopping-hospitalar.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/9307696b-3411-4b4f-9125-52eebc082b8c).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Android push notifications

Configure Firebase Cloud Messaging for the Android application (`br.com.shoppinghospitalar.portal`) and place its `google-services.json` in `android/app/` (this file is intentionally not committed). Then run `npm run android:sync` before building the APK. Administrators and employees can register their devices from **Notificações → Ativar no celular**; DAV alerts are delivered through Firebase even when the app is in the background or the screen is locked.
