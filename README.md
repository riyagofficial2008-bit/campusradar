# CAMPUS RADAR – JECRC University

Campus Radar helps students at **JECRC University** (Jaipur, Rajasthan, India) locate campus buildings, food courts, charging points, drinking water stations, washrooms, and libraries while viewing live student-reported crowd and availability conditions.

## Preloaded JECRC University Locations

- **Buildings**: `NYB – Campus Building`, `KAB – Kautilya Bhawan`, `VIB – Vikram Sarabhai Bhawan`, `NIB – Campus Building`, `Nothing Before Coffee (NBC)` (located behind VIB)
- **Food & Charging**: `JECRC Cafeteria / Food Court`, `Nothing Before Coffee (NBC)`, and `Cafeteria Charging Points` (confirmed available in the cafeteria by a student; exact socket count unknown)
- Preloaded locations without verified coordinates are clearly labeled **Approximate location** and can be repositioned on the map using **Adjust Pin** or verified with **Mark Verified**.

## Key Features

- **Interactive Campus Map (Leaflet + OpenStreetMap)**: Distinct category icons, status colors (Green / Yellow / Red / Grey), building codes, walking directions (OSRM with straight-line fallback), GPS **Locate Me** on explicit click, **Add Missing Place**, and **Adjust Pin**.
- **Charging Point Finder & Water Station Finder**: Dedicated tabs to filter available charging points, optionally enter available/total sockets, or filter working drinking water stations with 1-click updates.
- **Honest Report Freshness & Expiration**:
  - Crowd & Library seats expire after **30 minutes**
  - Charging points expire after **20 minutes**
  - Water stations expire after **2 hours**
  - Washrooms & general facilities expire after **1 hour**
  - Shows **LIVE**, **STALE**, **UNKNOWN**, or **ISSUE REPORTED**, plus **Mixed reports** when active observations disagree and confidence indicators.

## Running Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Shared Cloud Sync (Firebase Firestore + Auth)

Campus Radar connects all devices to the same shared Cloud Firestore database (`firebase-applet-config.json`, project `fluid-boulevard-q7cdj`) using real-time `onSnapshot` listeners across `facilities`, `pinOverrides`, and `statusReports`.

- **Status Indicator**: Displays **CLOUD SYNC CONNECTED** when connected to Firestore, **OFFLINE** when network access is unavailable, or **LOCAL DEMO MODE** if Firebase configuration is removed.
- **Authentication**: Google Sign-In is preconfigured. To also allow zero-login **Anonymous** student reporting from any device, open the [Firebase Console](https://console.firebase.google.com/) for project `fluid-boulevard-q7cdj`, go to **Build → Authentication → Sign-in method**, click **Add new provider → Anonymous**, toggle **Enable**, and save.
- **Security Rules**: Deployed from `firestore.rules` and validated with `@firebase/eslint-plugin-security-rules`.

