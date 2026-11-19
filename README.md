# Mola — Offline-Ready Toilet Finder & Partner Business Network

**Mola** is a mobile-first Progressive Web App (PWA) that connects people in urgent need of a restroom with the nearest **free public toilets** and **partner cafés/restaurants**. It works **offline** when connectivity drops and creates a **mutually beneficial ecosystem** for both users and local businesses.

---

## Purpose & Mutual Benefit Model

Finding a clean, accessible restroom in the city is often stressful—especially in crowded streets, parks, or transit hubs where mobile connectivity can be unreliable. At the same time, cafés and restaurants restrict restroom access to paying customers to avoid maintenance strain and unpaid foot traffic. **Mola** bridges this gap with a win-win model:

- **Value for Users:**
  - Use partner business restrooms **without awkwardness, queues, or explanations** via a single-use **QR Ticket** or **Door PIN**.
  - View free municipal/park toilets on a live map with open/closed status, accessibility filters (wheelchair, baby changing), ratings, distance, and step-by-step directions.
  - Automatic location permission request on first launch for instant nearby discovery, plus **guest perks** (e.g., coffee discounts) offered by partner venues.
- **Value for Businesses:**
  - Monetize existing restroom capacity (**85% business payout / 15% platform fee**).
  - Attract new walk-in customers with custom **guest perk notes** (such as a discount on coffee or pastries).
  - Manage cashier QR verification, gross/fee/net earnings breakdowns, TR IBAN withdrawals, and customer reviews from a dedicated dashboard.

---

## Offline Support (PWA & Service Worker)

Even when internet access is weak or unavailable, Mola keeps essential information accessible:

- **App Shell Caching:** The Service Worker (`sw.js`) caches the app shell, static assets, and `manifest.webmanifest`.
- **Toilet Directory Caching (`/api/toilets`):** Uses a network-first strategy with cache fallback so previously loaded toilet locations, addresses, door PINs, and directions remain viewable offline.
- **Installable PWA:** Can be added to the home screen on mobile devices like a native app.

---

## Key Features

### User Mode
- **Interactive Map & Smart Clustering:** Leaflet-based map displaying free public restrooms, partner businesses, and live status indicators (open, maintenance, closed).
- **Quick Search & Single-Row Filters:** Search by neighborhood or venue; filter in one centered row by *All*, *Free*, *Business*, *Closed*, *Wheelchair*, and *Baby Changing*.
- **Contactless Access & Digital Wallet:** Top up wallet balance through realistic card & 3D Secure checkout steps, purchase single-use **QR Tickets** or **Door PINs**, and track active/past tickets.
- **Community Contributions:** Location-verified maintenance/status reports, opening-hours update suggestions, new free toilet submissions, and ratings/reviews.

### Business Mode
- **3-Tab Management Dashboard:**
  - **Venues:** Add new partner restrooms; edit door PIN, location hint, entry price (5–500 ₺), and guest perk note inline.
  - **Cashier & Revenue:** Verify 6-character user ticket codes to credit the business wallet, inspect gross / 15% fee / net revenue breakdowns, and submit TR IBAN withdrawal requests.
  - **Reviews:** Monitor recent ratings and feedback across all owned venues.

---

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, Leaflet, Lucide Icons, `qrcode.react`, Service Worker (PWA)
- **Backend:** Node.js, Express 5, TypeScript, SQLite (`node:sqlite`)
- **Testing:** Node.js built-in test runner (`node --test`)

---

## Getting Started

### Prerequisites
- Node.js 22+
- npm

### 1. Install Dependencies
```bash
cd server && npm install
cd ../client && npm install
```

### 2. Run Development Servers

**Backend API (Port 4000):**
```bash
cd server
npm run dev
```

**Frontend (Port 5173):**
```bash
cd client
npm run dev
```

Open `http://localhost:5173` in your browser. On first visit, Mola requests location permission to load nearby restrooms, and you can choose **User** or **Business** mode (or switch anytime from the top bar).

---

## Testing & Building

```bash
# Run backend API integration tests
npm test

# Build client and server for production
npm run build
```
