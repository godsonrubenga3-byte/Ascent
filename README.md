# ⚔️ Duo Leveling: The Covenant System

A gamified discipline matrix inspired by "Solo Leveling," designed for partners and couples to synchronize schedules, track high-income skills, and master daily habits together in real-time.

---

## 🛠️ System Configuration

To initiate the link with the **Turso Relational Cloud**, you must configure your environment variables.

1.  **Clone the Repository** and run `npm install`.
2.  **Create a `.env` file** (or use `.env.local`) and add your credentials:

```env
# TURSO DATABASE CONFIG
TURSO_CONNECTION_URL=libsql://your-db-name.turso.io
TURSO_AUTH_TOKEN=your_secure_auth_token_here

# VERCEL DEPLOYMENT (Internal Routing)
VERCEL=1
```

---

## 🚀 Deployment (The Cloud Brain)

The app is optimized for **Vercel**. The Vercel server acts as the central brain that synchronizes data between the Web, Desktop, and Mobile APK.

1.  Push your code to GitHub.
2.  Connect the repository to Vercel.
3.  Add your `TURSO_CONNECTION_URL` and `TURSO_AUTH_TOKEN` to the Vercel Dashboard Environment Variables.
4.  **Important:** Update the `BASE_URL` in `src/lib/api.ts` to your actual Vercel URL (e.g., `https://your-app.vercel.app`).

---

## 📱 Mobile APK Build (Android)

To get the **APK file** onto your desktop for transfer to your phone:

1.  **Sync Capacitor:**
    ```bash
    npm run build
    npx cap sync android
    ```
2.  **Open in Android Studio:**
    ```bash
    npx cap open android
    ```
3.  **Build the APK:**
    *   In Android Studio: `Build` > `Build Bundle(s) / APK(s)` > `Build APK(s)`.
4.  **Locate the APK:**
    *   After the build finishes, a notification will appear. Click **"locate"**.
    *   The file is usually at: `android/app/build/outputs/apk/debug/app-debug.apk`.
    *   **Move this file to your Desktop** to install it on any Android device.

---

## 💻 Desktop Build (Windows EXE/MSI)

To generate a standalone **Windows application**:

1.  **Run the Build Script:**
    ```bash
    npm run desktop:build
    ```
2.  **Locate the Installer:**
    *   The output will be generated in the `build-desktop/` folder.
    *   You will find a `.exe` or `.msi` file there. This is your standalone desktop portal.

---

## 🛡️ Admin Control Center

The system includes a hidden **Turso Admin Route** for manual database maintenance and schema inspection.

*   **URL:** `https://your-app.vercel.app/turso`
*   **Passkey:** `covenant2026`
*   **Features:** Raw SQL Console, Live Table Counts, Latency Tracking.

---

## 🧪 Testing Connectivity

If you want to visualize how the APK communicates with the cloud without building it:
*   Open the `/trial/index.html` file in your browser. 
*   It uses a **Live Bridge** to your Vercel server to show real-time packet data and HUD updates.

---

## 📁 Project Structure

*   `/api`: Vercel Serverless Function entry point.
*   `/server`: Turso Database logic and SQL queries.
*   `/src/components`: "Solo Leveling" UI HUD components.
*   `/src/lib`: Core networking and sync logic (`api.ts`, `firebase.ts`).
*   `/trial`: Standalone APK visualization and testing suite.

---

**"The system has assigned you a quest. Will you accept?"**
