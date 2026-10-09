# 🏗️ SiteCommand

SiteCommand is a production-grade, AI-powered construction site management tool. It allows site supervisors to send unstructured updates (in Hindi, English, or Hinglish) via a Telegram Bot (text or voice notes). An AI engine parses these updates and automatically manages attendance, material inventory, petty cash, and daily reports on a premium real-time React dashboard.

## 🚀 How to Run Locally (Development)

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Configure Environment Variables:**
   Make sure your `.env` file is set up in the root directory:
   ```env
   # .env
   PORT=3001
   GROQ_API_KEY=your_groq_api_key_here
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
   ```

3. **(Optional) Seed the Database:**
   If you want to start with sample sites, materials, and users:
   ```bash
   npm run db:seed
   ```

4. **Start the Application:**
   This will start both the backend API (port 3001) and the React frontend (port 5173).
   ```bash
   npm run dev
   ```

5. **Access the Dashboard:**
   Open your browser and navigate to: **[http://localhost:5173](http://localhost:5173)**

---

## 🤖 Using the Telegram Bot

1. Open Telegram and search for your bot (the one you created with BotFather).
2. Start a chat with the bot.
3. The bot uses your Telegram Username (e.g., `@johndoe`) or Phone Number to authenticate you. 
4. **Important:** Your Telegram username must be registered in the system (in the `wa_sessions` table) and linked to an active `site_id` (or have the `owner` role) for the bot to accept your commands.
5. Try sending test messages like:
   - *"Sab hajir hain"* (Marks all workers present)
   - *"Aaj 50 bag cement aaya ABC dealer se"* (Logs a material receipt)
   - *"500 rupaye chai nashta"* (Logs a petty cash debit)

---

## 🐳 How to Run in Production (Docker)

SiteCommand is ready for deployment to production environments using Docker.

1. **Build and Start using Docker Compose:**
   Run the following command in the root directory. It will build the multi-stage image (React build + Node.js backend) and start the container:
   ```bash
   docker-compose up -d --build
   ```

2. **Access the Production Dashboard:**
   In production, the backend serves the built React files automatically on port 3001.
   Navigate to: **[http://localhost:3001](http://localhost:3001)**

3. **View Logs:**
   To see the server and Telegram bot logs:
   ```bash
   docker-compose logs -f
   ```

4. **Stop the Server:**
   ```bash
   docker-compose down
   ```

## 🔐 Security Features

- **API Security:** The `/api` routes are protected by a basic authentication middleware (`server/middleware/auth.js`) in production mode.
- **Telegram Verification:** The bot rejects commands from unregistered users, keeping your site data secure.
- **Model Fallback:** The AI engine uses a fallback chain (`Qwen` -> `GPT-OSS` -> `Allam`) with exponential backoff to guarantee high availability.
