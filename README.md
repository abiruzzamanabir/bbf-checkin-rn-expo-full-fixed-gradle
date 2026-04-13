# BBF Check-in (React Native / Expo)

## Run locally
```bash
npm install
npx expo start
```

## Build APK on EAS
```bash
npm install
npx expo-doctor
eas login
eas build:configure
eas build -p android --profile production
```

## Backend
- API base: https://bangladeshbrandforum.com/checkin/api
- Auth:
  - POST /api/auth/login
  - GET  /api/auth/me
  - POST /api/auth/logout
- Scan:
  - POST /api/scan (configurable in app.config.js as SCAN_PATH)

## Notes
- Uses `react-native-gesture-handler` + `react-native-reanimated` pinned to Expo SDK 51 compatible versions.
- Includes `babel.config.js` with Reanimated plugin.
