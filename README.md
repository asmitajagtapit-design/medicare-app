# 💊 MediCare — Medicine Reminder App

A full-stack medicine reminder web app with **real alarm sound**, built with
Node.js + Express (backend) and jQuery Mobile (frontend).

---

## 📁 Project Structure

```
medicare-app/
│
├── server.js            ← Node.js + Express backend (API + cron scheduler)
├── package.json         ← Dependencies
│
├── data/                ← JSON database (auto-created on first run)
│   ├── medicines.json
│   └── history.json
│
└── public/              ← Frontend (served by Express)
    ├── index.html       ← App pages (jQuery Mobile)
    ├── style.css        ← All styling
    └── app.js           ← Frontend logic + alarm engine
```

---

## 🚀 How to Run (Step by Step)

### Step 1 — Install Node.js
Download from: https://nodejs.org  (choose LTS version)

### Step 2 — Open in VS Code
```
File → Open Folder → select the medicare-app folder
```

### Step 3 — Open Terminal in VS Code
```
Terminal → New Terminal   (or press Ctrl + `)
```

### Step 4 — Install dependencies
```bash
npm install
```

### Step 5 — Start the server
```bash
npm start
```
You will see:
```
💊 MediCare server running at http://localhost:3000
⏰ Alarm scheduler started (checks every minute)
```

### Step 6 — Open the app
Open your browser and go to:
```
http://localhost:3000
```

### Step 7 (optional) — Auto-restart on code changes
```bash
npm run dev
```
This uses nodemon to restart the server whenever you save a file.

---

## 🔔 How the Alarm Works

1. You add a medicine with a **specific time** (e.g. 08:00 AM)
2. The **backend cron job** checks every minute if any medicine is due
3. The **frontend polls** `/api/alarms/due` every 30 seconds
4. When a match is found:
   - A full-screen **alarm popup** appears
   - A **real alarm sound** plays (Web Audio API — no file needed)
   - You can **Mark as Taken** or **Snooze for 10 minutes**
5. Browser push notification is also sent if permission is granted

---

## 🌐 REST API Endpoints

| Method | Endpoint            | Description                  |
|--------|---------------------|------------------------------|
| GET    | /api/medicines      | Get all medicines            |
| POST   | /api/medicines      | Add a new medicine           |
| PUT    | /api/medicines/:id  | Update a medicine            |
| DELETE | /api/medicines/:id  | Delete a medicine            |
| DELETE | /api/medicines      | Delete ALL medicines         |
| GET    | /api/history        | Get intake history log       |
| POST   | /api/history        | Log a dose (taken/missed)    |
| DELETE | /api/history        | Clear history                |
| GET    | /api/status         | Today's summary + statuses   |
| GET    | /api/alarms/due     | Medicines due right now      |

---

## 🛠 Technologies Used

| Layer      | Technology              | Purpose                          |
|------------|-------------------------|----------------------------------|
| Backend    | Node.js                 | JavaScript runtime               |
| Backend    | Express.js              | REST API server                  |
| Backend    | node-cron               | Scheduled alarm checking         |
| Backend    | fs-extra + JSON         | Simple file-based database       |
| Backend    | uuid                    | Unique IDs for medicines         |
| Frontend   | jQuery Mobile 1.4.5     | Mobile UI + page navigation      |
| Frontend   | jQuery 1.11.3           | DOM manipulation + AJAX          |
| Frontend   | Web Audio API           | Real alarm beep sound            |
| Frontend   | Notification API        | Browser push notifications       |
| Frontend   | CSS3 Variables          | Consistent theming               |
| Fonts      | Google Fonts (Nunito+Syne) | Typography                    |

---

## 💡 Features

- ✅ Add / Delete medicines with name, dose, time, type, frequency
- ⏰ Real alarm sound at scheduled time (Web Audio API)
- 🔔 Browser push notification support
- ⏱ Snooze alarm for 10 minutes
- 📋 Full history log of taken / missed doses
- 📊 Live dashboard: Total / Taken / Missed / Due counters
- 💾 Data saved to JSON files on the server
- 🔄 Auto-refresh every 60 seconds
- 🗑️ Clear all data from settings
- 🌐 REST API — ready to connect to a real database later
