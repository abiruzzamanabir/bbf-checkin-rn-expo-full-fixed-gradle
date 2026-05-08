# BBF Check-in System

Production-ready QR-based event check-in and analytics platform built with React Native (Expo) and Laravel.

---

# Features

* QR Code Entry & Exit Scanning
* Real-time Sync Across Devices
* Multi-Gate Management
* Live Analytics Dashboard
* Attendee Search & Tracking
* Inside Venue Time Calculation
* Role-Based Authentication
* Dynamic API-Driven Architecture
* Production-Ready UI/UX

---

# Tech Stack

## Mobile App

* React Native
* Expo SDK 51
* React Navigation
* Axios
* React Native Reanimated
* React Native Gesture Handler
* AsyncStorage
* Expo Camera

## Backend

* Laravel 9+
* MySQL
* REST API
* Sanctum Authentication

---

# Project Structure

```bash
bbf-checkin/
├── mobile/      # React Native Expo App
├── api/         # Laravel Backend
```

---

# Run Mobile App Locally

```bash
npm install

npx expo start
```

---

# Build APK using EAS

```bash
npm install

npx expo-doctor

eas login

eas build:configure

eas build -p android --profile production
```

---

# Backend Setup

```bash
cd api

composer install

cp .env.example .env

php artisan key:generate

php artisan migrate

php artisan serve
```

---

# API Configuration

## Base URL

```text
https://bangladeshbrandforum.com/checkin/api
```

---

# Authentication Endpoints

```text
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/logout
```

---

# Scan Endpoint

```text
POST /api/scan
```

Configurable in:

```text
app.config.js
```

Using:

```js
SCAN_PATH
```

---

# Expo Compatibility

This project uses Expo SDK 51 compatible packages:

* react-native-gesture-handler
* react-native-reanimated

Includes:

* babel.config.js with Reanimated plugin
* Hermes support
* Production-ready Expo configuration

---

# Production Features

* Real-time analytics updates
* Shared live scan history
* API-driven attendee data
* Optimized performance
* Scalable architecture
* Secure authentication flow
* Offline-ready foundation

---

# Future Improvements

* Face Recognition Check-In
* Offline Scan Queue Sync
* AI-Based Crowd Analytics
* Badge Printing System
* Push Notifications
* Multi-Event Support

---

# License

Private Proprietary Software

---

# Developed By

Abiruzzaman Abir
