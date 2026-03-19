AI ScreenPilot – Universal Computer Agent
AI ScreenPilot is a next-generation multimodal AI assistant that can SEE the computer screen, HEAR voice commands, THINK about the task, and ACT by controlling the computer.

🚀 Key Features
Multimodal Perception: Uses Gemini 2.0 Flash to visually interpret UI elements.
Voice Control: Integrated Web Speech API for hands-free operation.
Autonomous Reasoning: Recursive agent loop that plans and executes multi-step tasks.
Universal Automation: Powered by Playwright to navigate any web-based software.
🛠 Tech Stack
Frontend: React, TailwindCSS, Lucide Icons, Motion.
Backend: Node.js, Express, Playwright.
AI: Google GenAI SDK (Gemini 2.0 Flash).
Deployment: Google Cloud Run.
🏗 System Architecture
Perception Layer: Captures screenshots and voice transcripts.
Understanding Layer: Gemini analyzes the visual context.
Planning Layer: Agent determines coordinates and action types.
Execution Layer: Playwright performs clicks, typing, and navigation.
Feedback Layer: Loop continues until the goal is reached.
📦 Installation
Clone the repository.
Install dependencies:
npm install
Install Playwright browsers:
npx playwright install chromium
Set your environment variables in .env:
GEMINI_API_KEY=your_api_key_here
Start the development server:
npm run dev
☁️ Google Cloud Deployment
Build the Docker image:
gcloud builds submit --tag gcr.io/[PROJECT_ID]/screenpilot
Deploy to Cloud Run:
gcloud run deploy screenpilot --image gcr.io/[PROJECT_ID]/screenpilot --platform managed --set-env-vars GEMINI_API_KEY=[YOUR_KEY]
🎥 Demo Script
Introduction: "Meet ScreenPilot, the AI that uses your computer like a human."
The Problem: "Software is complex. We spend hours clicking through menus."
The Solution: "ScreenPilot sees what you see and acts for you."
Live Demo: "Find the cheapest MacBook on Amazon."
Conclusion: "The future of HCI is agentic."
Developed for the Gemini Live Agent Challenge.

