# 🎵 D-Music

**A modern, premium, feature-rich Android music application for offline local audio & online streaming. Powered by JioSaavn & YouTube Music APIs, featuring dynamic theme colors, 23 language localization, live lyrics, advanced filters, sleep timers, and detailed listening analytics.**

[![Repository](https://img.shields.io/badge/GitHub-Ronak--Patra%2FD--Music-blue?style=flat-square&logo=github)](https://github.com/Ronak-Patra/D-Music)
[![Platform](https://img.shields.io/badge/Platform-Android-green?style=flat-square&logo=android)](#)
[![Languages](https://img.shields.io/badge/Languages-23%20Supported-orange?style=flat-square)](#)

---

## 📖 About The Project

**D-Music** is a comprehensive, modern Android music application built with React Native & Expo (TrackPlayer Native Engine). It bridges local offline file playback with instant access to millions of streaming tracks via JioSaavn and YouTube Music integration.

Designed with a sleek dark/light dynamic design system, D-Music allows users to effortlessly scan local device audio, download high-quality streaming tracks for offline playback, sing along with synchronized live lyrics, track their exact music statistics, and customize the experience in 23 native languages.

---

## ✨ Comprehensive Feature Details

### 🎧 1. Audio Playback & Engine
* **High-Fidelity Audio Engine**: Powered by `react-native-track-player` with background playback support, lock screen controls, and notification media session integration.
* **Full-Screen Player**: Interactive player view featuring vinyl rotating album covers, progressive timeline seeking, shuffle, loop mode, volume control, and playback speed adjustment.
* **Swipe Gestures**: Swipe left or right on the player screen to instantly skip tracks.
* **Live Synchronized Lyrics**: Synchronized, line-by-line real-time lyrics scrolling automatically with track playback.
* **Sleep Timer**: Advanced sleep timer supporting standard presets (15 min, 30 min, 45 min, 60 min) as well as **custom minute durations**. Integrated directly into native audio events (`progressUpdateEventInterval: 1`) to guarantee accurate **screen-off background enforcement**, automatically pausing playback exact to the second even when the phone screen is locked and off.

### 💾 2. Local Audio & Offline Download Manager
* **Local Audio Scanner**: Automatic device storage scanning (`.mp3`, `.m4a`, `.flac`, `.wav`, `.ogg`, `.opus`, `.aac`) with instant metadata extraction and seamless library integration.
* **High-Quality Offline Downloads**: Download any online song or entire playlists directly to device storage for offline playback with high-bitrate audio.
* **Dedicated Downloads Hub**: Separate sections for *Downloaded Playlists*, *Downloaded Songs*, and *Scanned Local Audio Files* with batch operations (multi-select, select all, batch delete).
* **Automatic File Sync & Auto-Clean**: Automatic background sync that cleans up missing or manually deleted files from the library database.

### 🌐 3. Multi-Provider Music Streaming & Discovery
* **Dual Music Streaming Providers**:
  * **JioSaavn API Integration**: Access millions of Bollywood, Regional Indian, and International songs, albums, and playlists in high audio quality.
  * **YouTube Music API Integration (Beta)**: Stream music and audio tracks directly powered by YouTube Music.
* **Individual Songs Algorithm**: All songs on the Home page are fetched directly as standalone individual song entities — not bundled from playlists or albums. Every section (Trending, New Releases, Discover Random) returns individual tracks forming a direct playback queue when tapped.
* **Smart New Releases Engine**: Intelligent filter engine verifying exact release dates to deliver genuine fresh releases without older catalog clutter.
* **Trending Charts & Country Filters**: Global and region-specific trending lists (including auto-location detection and country picker).
* **Anime Region**: Dedicated **Anime** region option in the Region selector. Selecting Anime fetches Japanese Anime OSTs, openings, endings, and J-Pop tracks directly.
* **Discover Random Section**: A new shuffled song discovery section on the Home page. Songs are randomized on every page refresh while strictly respecting the active Region, Sub-Region, and Music Genre filters.
* **Advanced Multi-Filter Discovery**: Filter songs by genre (Pop, Hip Hop, Rock, Acoustic, Devotional, Classical, Lofi), release year, sub-region language (for India: Hindi, Punjabi, Tamil, Telugu, Marathi, Bhojpuri, Bengali, Malayalam, Kannada, Haryanvi), and popularity.
* **Personalized Recommendations**: Smart recommendation engine serving songs based on your recently played tracks and favorites.
* **Smart Region Keyword Engine**: Search queries are constructed using actual musical genre keywords relevant to a region (e.g. `English` for US/UK/Global, `Hindi` for India, `Anime Japanese OST` for Anime) instead of literal country names — preventing irrelevant results like songs literally titled "United States".

### 📚 4. Library & Playlist Management
* **Custom Playlists**: Create, rename, customize covers, and reorder tracks within custom playlists.
* **Liked Songs & Liked Playlists**: One-tap hearting to save songs into a dedicated Liked Songs library with offline availability options.
* **Spotify Playlist Importer**: Easily import and sync public playlists from Spotify into D-Music.

### 🌍 5. Native 23-Language Localization (i18n)
D-Music natively supports full UI translation across **23 official languages**, using native scripts and Unicode character sets:

| Region / Type | Supported Languages |
| :--- | :--- |
| **Indian Languages (15)** | Hindi (`हिन्दी`), Bengali (`বাংলা`), Punjabi (`ਪੰਜਾਬੀ`), Marathi (`मराठी`), Gujarati (`ગુજરાતી`), Tamil (`தமிழ்`), Telugu (`తెలుగు`), Kannada (`ಕನ್ನಡ`), Malayalam (`മലയാളം`), Odia (`ଓଡ଼ିଆ`), Assamese (`অসমীয়া`), Urdu (`اردو`), Nepali (`नेपाली`), Sanskrit (`সংस्कृतम्`) |
| **Global Languages (8)** | English, Spanish (`Español`), Chinese (`中文`), German (`Deutsch`), French (`Français`), Russian (`Русский`), Hebrew (`עברית`), Turkish (`Türkçe`), Korean (`한국어`) |

### 🎨 6. Modern Aesthetics & Theme System
* **Dynamic UI Colors**: Extract dominant color accents from the album art of the currently playing track to colorize buttons, controls, and background gradients dynamically.
* **Rotating Vinyl Album Cover**: Aesthetic rotating album art animation during playback.
* **Dark / Light / System Auto Mode**: Sleek dark mode by default, clean light mode, and system auto theme switching.

### 📊 7. Listening Analytics & Stats
* **Total Play Time Tracker**: Calculates and displays total time spent listening to music.
* **Recently Played History**: Tracks your playback timeline so you can jump back to previous songs anytime.

---

## 🏠 Home Page Sections

| Section | Description |
| :--- | :--- |
| **Trending** | Live region-specific trending songs fetched as individual tracks |
| **New Releases** | Latest individual songs filtered by region, sub-region, and genre |
| **Discover Random** | Randomly shuffled songs respecting all active filters — refreshes every session |
| **Liked Songs** | Your saved/hearted tracks for quick access |
| **Continue Listening** | Recently played tracks history |
| **Recommended For You** | Personalized recommendations based on listening history |

---

## 📱 Screenshots & Previews

| Home & Player | Dynamic Colors | Downloads & Local Files |
| :---: | :---: | :---: |
| 🎵 **Trending & Player** | 🎨 **Dynamic Album Palette** | 💾 **Offline & Local Audio** |

---

## 🚀 Download & Installation

You can download the compiled Android APK directly from the project repository:

📦 **Latest Release:** [Download DMusic-Release.apk](https://github.com/Ronak-Patra/D-Music/blob/main/DMusic-Release.apk)

### Installation Steps:
1. Download the `DMusic-Release.apk` file onto your Android device.
2. Open the downloaded file. If prompted, enable **"Allow from this source"** or **"Install Unknown Apps"** in your Android Security Settings.
3. Tap **Install** and launch D-Music to start listening!

---

## 🛠️ Built With

* **Framework**: React Native (Expo SDK 52)
* **Audio Engine**: `react-native-track-player`
* **Navigation**: Expo Router (File-based navigation)
* **Localization**: `i18next` & `react-i18next`
* **Storage & Database**: `@react-native-async-storage/async-storage` & `expo-file-system`
* **Media Library**: `expo-media-library`

---

## 🙏 Acknowledgements

* **Original Foundation:** Built upon the open-source foundation of [OpenSpot Music App](https://github.com/BlackHatDevX/openspot-music-app) by [BlackHatDevX](https://github.com/BlackHatDevX).
