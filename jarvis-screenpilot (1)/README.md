# AI ScreenPilot – Universal Computer Agent

AI ScreenPilot is a next-generation multimodal AI assistant that can **SEE** the computer screen, **HEAR** voice commands, **THINK** about the task, and **ACT** by controlling the computer.

## 🚀 Key Features
- **Multimodal Perception:** Uses Gemini 2.0 Flash to visually interpret UI elements.
- **Voice Control:** Integrated Web Speech API for hands-free operation.
- **Autonomous Reasoning:** Recursive agent loop that plans and executes multi-step tasks.
- **Universal Automation:** Powered by Playwright to navigate any web-based software.

## 🛠 Tech Stack
- **Frontend:** React, TailwindCSS, Lucide Icons, Motion.
- **Backend:** Node.js, Express, Playwright.
- **AI:** Google GenAI SDK (Gemini 2.0 Flash).
- **Deployment:** Google Cloud Run.

## 🏗 System Architecture
1. **Perception Layer:** Captures screenshots and voice transcripts.
2. **Understanding Layer:** Gemini analyzes the visual context.
3. **Planning Layer:** Agent determines coordinates and action types.
4. **Execution Layer:** Playwright performs clicks, typing, and navigation.
5. **Feedback Layer:** Loop continues until the goal is reached.

## 📦 Installation
1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Install Playwright browsers:
   ```bash
   npx playwright install chromium
   ```
4. Set your environment variables in `.env`:
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```
5. Start the development server:
   ```bash
   npm run dev
   ```

## ☁️ Google Cloud Deployment
1. Build the Docker image:
   ```bash
   gcloud builds submit --tag gcr.io/[PROJECT_ID]/screenpilot
   ```
2. Deploy to Cloud Run:
   ```bash
   gcloud run deploy screenpilot --image gcr.io/[PROJECT_ID]/screenpilot --platform managed --set-env-vars GEMINI_API_KEY=[YOUR_KEY]
   ```

## 🎥 Demo Script
1. **Introduction:** "Meet ScreenPilot, the AI that uses your computer like a human."
2. **The Problem:** "Software is complex. We spend hours clicking through menus."
3. **The Solution:** "ScreenPilot sees what you see and acts for you."
4. **Live Demo:** "Find the cheapest MacBook on Amazon."
5. **Conclusion:** "The future of HCI is agentic."

---
Developed for the Gemini Live Agent Challenge.
