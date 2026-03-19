import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Mic, 
  MicOff, 
  Play, 
  Square, 
  Terminal, 
  Eye, 
  Activity, 
  ChevronRight,
  Monitor,
  Cpu,
  CheckCircle2,
  Loader2,
  RefreshCw,
  X,
  Settings,
  Camera,
  Video,
  MessageSquare,
  Search,
  AlertCircle,
  Info,
  ScreenShare,
  StopCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import Tesseract from 'tesseract.js';

interface AgentDecision {
  reasoning: string;
  action: string;
  target: string;
  text?: string;
  coordinates?: [number, number];
  isSensitive?: boolean;
}

interface LogEntry {
  id: string;
  timestamp: string;
  type: 'info' | 'action' | 'success' | 'error';
  message: string;
  details?: any;
}

const USER_NAME = 'Sharan';

const JARVIS_RESPONSES = {
  greetings: [
    `At your service, ${USER_NAME}. What can I do for you?`,
    `I'm listening, ${USER_NAME}. How may I assist you today?`,
    `Yes, ${USER_NAME}? I'm ready for your instructions.`,
    `Systems online. What's the plan, ${USER_NAME}?`,
    `Always a pleasure to see you, ${USER_NAME}. How can I help?`,
    `Reporting for duty, ${USER_NAME}. Your command?`
  ],
  confirmations: [
    "Task completed successfully, sir.",
    "I've finished that for you. Anything else?",
    "All done. The results are on your screen.",
    "Mission accomplished. What's next on the agenda?",
    "I have successfully executed your request.",
    "That's taken care of. Ready for the next task."
  ],
  listening: [
    `I'm all ears, ${USER_NAME}.`,
    "Please, go ahead. I'm listening.",
    "Ready for your command.",
    "What do you need me to do?",
    "Standing by for instructions."
  ]
};

const SYSTEM_PROMPT = `
You are JARVIS, a highly advanced AI assistant. Your personality is sophisticated, helpful, and slightly witty, similar to the AI from Iron Man.
You have the ability to navigate the web, control device hardware (camera/recording), perform messaging tasks, and automate complex web workflows like form filling.

CRITICAL RULES:
1. PERSONALITY: Speak like JARVIS. Use phrases like "At your service, sir," or "I'm on it."
2. SPEED: Respond INSTANTLY. No delays. Keep your "reasoning" under 3 words. ACT IMMEDIATELY.
3. COMPLETION: You MUST complete the task FAST. Do not stop until the goal is 100% achieved.
4. EFFICIENCY: Choose the shortest path to completion. Skip unnecessary steps.
5. CAPTCHA: You are capable of solving "I'm not a robot" tasks (CAPTCHAs). 
   - If you see a CAPTCHA, identify the target (e.g., "click all squares with traffic lights").
   - Use the screenshot to find the coordinates of the correct squares and click them one by one.
   - If it's a simple checkbox, click it directly.
4. MULTI-CAPABLE: You can answer general questions, perform web actions, control the camera, and automate forms.
5. SEQUENTIAL TASKS: If the user gives multiple instructions, perform them one by one. Do not stop until the entire goal is achieved.
6. WEB ACTIONS: If the user asks to do something on the web, use the appropriate action.
7. FORM AUTOMATION: If the user says "fill this form" or similar, use the provided "Interactive Elements on Page" list to identify fields.
   - Look for elements with tag "input", "textarea", or "select".
   - Use "label", "placeholder", "name", or "id" to match the data you need to fill.
   - Some fields might be "isVisible: false" but still relevant (e.g., custom styled checkboxes). If you can't find a visible field, look for these.
   - Use the "type" action for each field, providing the EXACT "coordinates" from the elements list.
   - If user hasn't provided specific data, use realistic placeholder data (e.g., "John Doe" for name, "john@example.com" for email).
   - Proceed one field at a time. After typing in one field, the loop will continue and you should move to the next field.
   - IMPORTANT: You MUST provide coordinates for the "type" action. The system will automatically click the field at those coordinates before typing to ensure focus.
8. DEVICE CONTROL: 
   - If the user says "open camera", set action to "open_camera".
   - If the user says "start recording", set action to "start_recording".
   - If the user says "stop recording", set action to "stop_recording".
10. MESSAGING (WHATSAPP): If the user says "send a whatsapp message to [name] saying [message]":
    - Step 1: Navigate to web.whatsapp.com.
    - Step 2: Look for the search box or contact list.
    - Step 3: Type the [name] into the search box and use "press_enter".
    - Step 4: Click on the contact in the results if needed.
    - Step 5: Type the [message] into the message box and use "press_enter".
11. YOUTUBE MUSIC: If the user says "play [song/artist] on youtube":
    - Step 1: Navigate to youtube.com.
    - Step 2: Type "[song/artist]" into the search bar and use "press_enter".
    - Step 3: Wait for results.
    - Step 4: Click on the first video result to start playback.
    - Step 5: Once the video starts, set action to "complete" and respond with "Now playing [song name]".
12. SEARCHING: If the user asks to search for something:
    - Step 1: Navigate to google.com or bing.com.
    - Step 2: Type the query into the search box and use "press_enter".
    - Step 3: Browse results.
13. SENSITIVE ACTIONS: Before performing any irreversible action (e.g., clicking "Send", "Pay", "Buy", "Delete", "Confirm Order"), you MUST set action to "request_confirmation".
    - Explain exactly what you are about to do in the "reasoning" field.
    - Provide the details of the action in "text" (e.g., "Sending message to John: Hello").
    - Provide the coordinates of the button you will click if confirmed.
    - Once the user confirms, the loop will continue and you can then perform the actual "click" or "type" action.

14. COMPLEX FORMS & DYNAMIC CONTENT:
    - If a form has multiple steps, complete the current step and look for "Next", "Continue", or "Submit" buttons.
    - If fields appear dynamically after an interaction, use the "wait" action or "refresh" if you suspect the page is stuck.
    - For custom dropdowns (not standard <select>), click the element to open the menu, then click the desired option from the newly appeared elements.
    - For date pickers, try typing the date directly if an input is available; otherwise, interact with the calendar widget step-by-step.
    - If you see a loading spinner or progress bar, use the "wait" action until it disappears.

15. GENERAL KNOWLEDGE: If the user asks a question, answer it directly in the "reasoning" field and set action to "complete".
16. SCREEN CONTEXT: Use the provided screenshot and OCR text to understand what's happening on the page or the user's screen. 
    - If "OCR Text Recognition" is provided, use it to find text that might not be in the elements list (e.g., in images or canvases).
    - If the context is "user's ACTUAL screen", you can see the desktop, but remember you can only control the remote browser via actions.
    - Use coordinates [0-1000, 0-1000] to target elements.

17. CLARIFICATION & INSUFFICIENT DATA: If the screenshot, OCR data, or interactive elements are insufficient to complete the task, or if the user's request is ambiguous:
    - Set action to "complete".
    - In the "reasoning" field, politely explain the limitation and ask for the missing information or clarification (e.g., "Sir, I've reached the login screen, but I'll need your password to proceed.").

18. ACTIONS:
    - "navigate": Go to a URL.
    - "click": Click at coordinates.
    - "type": Type text at coordinates. (The system will click these coordinates first to ensure focus).
    - "select": Select an option from a dropdown at coordinates. Use the option text in the "text" field.
    - "scroll_down" / "scroll_up": Scroll the page.
    - "scroll_to": Scroll to specific coordinates.
    - "go_back": Go to the previous page in history.
    - "go_forward": Go to the next page in history.
    - "refresh": Reload the current page.
    - "wait": Wait for 2 seconds.
    - "press_enter": Press the Enter key.
    - "complete": Task is finished.
    - "open_camera" / "start_recording" / "stop_recording": Device control.
    - "request_confirmation": Ask the user for permission before a sensitive action.
    
Return your response in EXACTLY this JSON format:
{
  "reasoning": "Your spoken response to the user. This should be a full, helpful answer or an explanation of your next action.",
  "action": "One of the actions listed above",
  "target": "Description of the element or URL",
  "text": "Text to type or select",
  "coordinates": [x, y] // [0-1000, 0-1000] normalized coordinates
}
`;

export default function App() {
  const [isListening, setIsListening] = useState(false);
  const [command, setCommand] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const isRunningRef = useRef(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [ocrText, setOcrText] = useState<string>('');
  const [ocrConfidence, setOcrConfidence] = useState<number>(0);
  const [isProcessingOCR, setIsProcessingOCR] = useState(false);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const [currentElements, setCurrentElements] = useState<any[]>([]);
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [lastDecision, setLastDecision] = useState<AgentDecision | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showKeyError, setShowKeyError] = useState(false);
  const [agentError, setAgentError] = useState<{ message: string; suggestions: string[] } | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<AgentDecision | null>(null);

  const recognitionRef = useRef<any>(null);
  const isRecognitionActiveRef = useRef(false);
  const isStartingRef = useRef(false);
  const lastErrorWasNetworkRef = useRef(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  const [isWakeWordMode, setIsWakeWordMode] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showWakeWordFeedback, setShowWakeWordFeedback] = useState(false);
  const [wakeWords, setWakeWords] = useState<string[]>(['sharan', 'ai hello', 'hey ai', 'ai', 'hi pilot', 'hey pilot', 'pilot', 'hi', 'hello', 'hey']);
  const [showSettings, setShowSettings] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showOCRPanel, setShowOCRPanel] = useState(false);

  const showNotification = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  }, []);

  const safeFetch = useCallback(async (url: string, options?: RequestInit) => {
    try {
      const response = await fetch(url, options);
      const contentType = response.headers.get("content-type");
      
      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        if (contentType && contentType.includes("application/json")) {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } else {
          // If it's not JSON, it might be an HTML error page
          const text = await response.text();
          console.error("Non-JSON error response:", text.substring(0, 200));
          if (text.includes("<!DOCTYPE html>") || text.includes("<html>")) {
            errorMessage = `Server returned an HTML error page (Status ${response.status}). The backend might be misconfigured or crashing.`;
          }
        }
        throw new Error(errorMessage);
      }

      if (contentType && contentType.includes("application/json")) {
        return await response.json();
      } else {
        const text = await response.text();
        console.error("Expected JSON but got:", text.substring(0, 200));
        throw new Error("Server returned non-JSON response. Please check if the backend is running correctly.");
      }
    } catch (error: any) {
      if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
        throw new Error('Network error: Please check your internet connection or server status.');
      }
      throw error;
    }
  }, []);

  const [newWakeWord, setNewWakeWord] = useState('');
  
  // Media States
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Initialize Web Speech API
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (SpeechRecognition && !recognitionRef.current) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognitionRef.current = recognition;

      recognition.onstart = () => {
        isRecognitionActiveRef.current = true;
        isStartingRef.current = false;
        console.log('Speech recognition started');
      };

      recognition.onresult = (event: any) => {
        // Use refs or latest state via closure if needed, but for now we'll keep it simple
        // and re-attach handlers when state changes if necessary, OR use a more stable approach.
      };
      
      // We will define handlers that use the latest state via refs
    }
  }, []);

  // Separate effect to update handlers with latest state
  useEffect(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      const currentTranscript = (finalTranscript || interimTranscript).toLowerCase().trim();
      
      const hasWakeWord = wakeWords.some(word => 
        currentTranscript === word || 
        currentTranscript.startsWith(word + ' ') ||
        currentTranscript.endsWith(' ' + word) ||
        currentTranscript.includes(' ' + word + ' ')
      );
      
      if (!isRunningRef.current && !isProcessing && hasWakeWord && !isListening) {
        handleWakeWordDetected();
        return;
      }

      if (currentTranscript && isListening) {
        setCommand(currentTranscript);
        
        if (finalTranscript.trim() && (wakeWords.includes(currentTranscript) || currentTranscript.includes('hello'))) {
          speak(`Hello ${USER_NAME}! I'm here and ready to help. What would you like me to do?`);
          setCommand('');
          return;
        }

        if (finalTranscript.trim() && !isRunningRef.current && !isProcessing) {
          const finalCmd = finalTranscript.trim();
          setIsListening(false);
          recognition.stop();
          
          addLog('info', `Voice command captured: "${finalCmd}"`);
          
          setTimeout(() => {
            startPilotWithCommand(finalCmd);
          }, 800);
        }
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'aborted' || event.error === 'no-speech') {
        isStartingRef.current = false;
        return;
      }

      // Suppress frequent network errors from the main log to avoid cluttering
      if (event.error === 'network') {
        console.warn('Speech recognition network error - will attempt to restart');
        lastErrorWasNetworkRef.current = true;
        isStartingRef.current = false;
        setIsListening(false);
        return;
      }

      lastErrorWasNetworkRef.current = false;
      console.error('Speech recognition error:', event.error);
      isStartingRef.current = false;
      
      const errorMessages: Record<string, string> = {
        'not-allowed': 'Microphone access denied. Please enable it in browser settings.',
        'audio-capture': 'Microphone not found.',
        'bad-grammar': 'Grammar error.',
        'language-not-supported': 'Language not supported.'
      };

      const msg = errorMessages[event.error] || `Error: ${event.error}`;
      addLog('error', msg);
      speak(msg);
      
      setIsListening(false);
    };

    recognition.onend = () => {
      isRecognitionActiveRef.current = false;
      isStartingRef.current = false;
      console.log('Speech recognition ended');
      
      if (isWakeWordMode && !isListening && !isRunningRef.current && !isProcessing) {
        // Use a longer delay if the last error was a network error to avoid rapid retries
        const restartDelay = lastErrorWasNetworkRef.current ? 5000 : 500;
        
        setTimeout(() => {
          if (!isRecognitionActiveRef.current && !isStartingRef.current && isWakeWordMode && !isListening && !isRunningRef.current && !isProcessing) {
            try {
              isStartingRef.current = true;
              recognition.start();
              // Reset network error flag after a successful start attempt
              lastErrorWasNetworkRef.current = false;
            } catch (e) {
              isStartingRef.current = false;
            }
          }
        }, restartDelay);
      }
    };

    // Initial start if needed
    if (isWakeWordMode && !isListening && !isRunningRef.current && !isProcessing && !isRecognitionActiveRef.current && !isStartingRef.current) {
      try {
        isStartingRef.current = true;
        recognition.start();
      } catch (e) {
        isStartingRef.current = false;
      }
    }
  }, [isWakeWordMode, isRunning, isProcessing, isListening, wakeWords]);

  const handleWakeWordDetected = () => {
    setLastDecision(null); // Clear previous Jarvis response
    
    setShowWakeWordFeedback(true);
    setIsListening(true);
    speak(JARVIS_RESPONSES.greetings);
    addLog('info', `Wake word detected. Greeting ${USER_NAME}...`);
    
    // Hide feedback after 3 seconds
    setTimeout(() => {
      setShowWakeWordFeedback(false);
    }, 3000);
  };

  const addWakeWord = () => {
    if (newWakeWord.trim() && !wakeWords.includes(newWakeWord.toLowerCase().trim())) {
      const word = newWakeWord.toLowerCase().trim();
      setWakeWords([...wakeWords, word]);
      setNewWakeWord('');
      addLog('success', `Added "${word}" as a custom wake word`);
      showNotification(`Added "${word}" as wake word`, 'success');
      speak(`Added ${word} to my wake words.`);
    }
  };

  const removeWakeWord = (word: string) => {
    if (wakeWords.length <= 1) {
      addLog('error', 'You must have at least one wake word');
      showNotification('At least one wake word required', 'error');
      return;
    }
    setWakeWords(wakeWords.filter(w => w !== word));
    addLog('info', `Removed "${word}" from wake words`);
    showNotification(`Removed "${word}"`, 'info');
  };
  const toggleWakeWordMode = () => {
    if (isWakeWordMode) {
      recognitionRef.current?.stop();
      setIsWakeWordMode(false);
      addLog('info', 'Wake word detection disabled');
    } else {
      recognitionRef.current?.start();
      setIsWakeWordMode(true);
      addLog('success', `Wake word detection active. Say "Hi Pilot" or just "Hello" to start.`);
      speak(`Wake word detection is now active, ${USER_NAME}. You can just say hello to wake me up.`);
    }
  };

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const addLog = (type: LogEntry['type'], message: string, details?: any) => {
    setLogs(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      type,
      message,
      details
    }]);
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      setCommand('');
      // Small delay to ensure any previous session is fully closed
      setTimeout(() => {
        try {
          if (!isRecognitionActiveRef.current && !isStartingRef.current) {
            isStartingRef.current = true;
            recognitionRef.current?.start();
          }
          setIsListening(true);
          speak(JARVIS_RESPONSES.listening);
          addLog('info', 'Listening for voice command...');
        } catch (e) {
          isStartingRef.current = false;
          console.error('Failed to start recognition:', e);
          setIsListening(true);
          speak(JARVIS_RESPONSES.listening);
        }
      }, 200);
    }
  };

  const getErrorFeedback = (errorMessage: string) => {
    const lowerError = errorMessage.toLowerCase();
    let message = "I encountered an issue while executing the action.";
    let suggestions = [
      "Try rephrasing your command to be more specific.",
      "Check if the website you're trying to reach is currently online.",
      "Ensure you've provided all necessary information for the task."
    ];

    if (lowerError.includes('not be found') || lowerError.includes('err_name_not_resolved') || lowerError.includes('enotfound')) {
      message = "I couldn't find that website. The URL might be incorrect or the site is down.";
      suggestions = [
        "Double-check the website address for typos.",
        "Try searching for the site on Google first to get the correct URL.",
        "Check if you need to include 'www.' or a specific subdomain."
      ];
    } else if (lowerError.includes('refused to connect') || lowerError.includes('err_connection_refused')) {
      message = "The website refused to connect. It might be blocking automated access or is currently down.";
      suggestions = [
        "Try a different website that offers similar information.",
        "Check if the site requires a login that I haven't performed yet.",
        "The site might have anti-bot protections; try a more direct URL if possible."
      ];
    } else if (lowerError.includes('timed out') || lowerError.includes('timeout') || lowerError.includes('etimedout')) {
      message = "The action timed out. The page is loading too slowly or I couldn't find the element to interact with.";
      suggestions = [
        "Wait a moment and try the command again.",
        "Try a simpler command to see if the page responds.",
        "Use the 'refresh' icon to reset the browser session and try again.",
        "If searching, try a more specific search query."
      ];
    } else if (lowerError.includes('unexpectedly closed') || lowerError.includes('target closed') || lowerError.includes('no active session')) {
      message = "The browser session was interrupted or closed unexpectedly.";
      suggestions = [
        "Click the 'refresh' icon in the browser header to start a new session.",
        "Reload the entire application in your browser.",
        "Check if the server is still running correctly."
      ];
    } else if (lowerError.includes('api key') || lowerError.includes('401') || lowerError.includes('unauthorized') || lowerError.includes('invalid api key')) {
      message = "There's an authentication issue, likely with the Gemini API key.";
      suggestions = [
        "Go to the 'Secrets' or 'Settings' panel and verify your GEMINI_API_KEY is correct.",
        "Ensure there are no extra spaces at the beginning or end of the API key.",
        "Check if your API key has been restricted or disabled in the Google AI Studio console."
      ];
    } else if (lowerError.includes('quota') || lowerError.includes('429') || lowerError.includes('limit reached')) {
      message = "I've reached the rate limit for requests to the AI model.";
      suggestions = [
        "Wait about 60 seconds before trying your next command.",
        "Check your usage limits in the Google AI Studio dashboard.",
        "If this happens frequently, consider using a different model or upgrading your quota."
      ];
    } else if (lowerError.includes('network error') || lowerError.includes('failed to fetch')) {
      message = "I'm having trouble communicating with the backend server.";
      suggestions = [
        "Check your internet connection.",
        "Ensure the development server is still active and hasn't crashed.",
        "Try refreshing the page to re-establish the connection."
      ];
    } else if (lowerError.includes('protocol error')) {
      message = "A communication error occurred between the agent and the browser.";
      suggestions = [
        "Reset the session using the refresh button.",
        "Try a different command to see if it's a specific action causing the issue.",
        "Check the server logs for more technical details."
      ];
    }

    return { message, suggestions };
  };

   const runAgentStep = async (currentCommand: string) => {
    if (!process.env.GEMINI_API_KEY) {
      setShowKeyError(true);
      addLog('error', 'Gemini API Key is missing. Please add it to the Secrets panel.');
      setIsRunning(false);
      isRunningRef.current = false;
      return;
    }
    setIsLoading(true);
    setIsProcessing(true);
    setAgentError(null);
    try {
      // 1. Get current screenshot from backend
      const screenshotData = await safeFetch('/api/agent/screenshot');
      
      // 1.5 Handle Screen Sharing
      let activeScreenshot = screenshotData.screenshot;
      let isUserScreen = false;
      
      if (isScreenSharing) {
        const screenFrame = captureScreenFrame();
        if (screenFrame) {
          activeScreenshot = screenFrame;
          isUserScreen = true;
          addLog('info', 'Capturing live screen for analysis...');
        }
      }
      
      setScreenshot(activeScreenshot);
      setCurrentUrl(screenshotData.url);
      setCurrentElements(screenshotData.elements || []);

      // 1.6 Perform Advanced OCR Recognition
      addLog('info', 'Analyzing screen content with advanced OCR...');
      const { text: ocrData, confidence } = await performAdvancedOCR(activeScreenshot);
      
      if (ocrData.trim()) {
        addLog('info', `OCR completed. Confidence: ${confidence.toFixed(1)}%. Detected ${ocrData.split('\n').length} lines of text.`);
      }

      // 2. Call Gemini from frontend
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            role: 'user',
            parts: [
              { text: `User Goal: ${currentCommand}\n\n` +
                      `Context: ${isUserScreen ? "This is a screenshot of the user's ACTUAL screen (desktop/OS)." : "This is a screenshot of the remote browser page."}\n` +
                      `Current Page URL: ${screenshotData.url}\n\n` +
                      `OCR Text Recognition:\n${ocrData || "No text detected via OCR."}\n\n` +
                      `Interactive Elements on Page:\n${JSON.stringify(screenshotData.elements, null, 2)}\n\n` +
                      `Current Screenshot attached.` 
              },
              {
                inlineData: {
                  mimeType: "image/jpeg",
                  data: activeScreenshot
                }
              }
            ]
          }
        ],
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: "application/json",
          thinkingConfig: { thinkingLevel: "LOW" as any }
        }
      });

      let result: AgentDecision;
      try {
        const text = response.text || '{}';
        // Remove markdown code blocks if present
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const cleanJson = jsonMatch ? jsonMatch[0] : text;
        result = JSON.parse(cleanJson);
      } catch (e) {
        console.error("Failed to parse Gemini response:", response.text);
        throw new Error(`Failed to parse JARVIS decision. The model might have returned an invalid format. Response: ${response.text?.substring(0, 100)}...`);
      }
      
      setLastDecision(result);
      addLog('action', `Action: ${result.action}`, result);

      // Conversational feedback
      if (result.reasoning) {
        speak(result.reasoning);
      }

      if (result.action === 'complete') {
        setIsRunning(false);
        isRunningRef.current = false;
        setIsProcessing(false);
        addLog('success', 'Task completed successfully!');
        showNotification('Task completed successfully!', 'success');
        speak(JARVIS_RESPONSES.confirmations);
      } else if (result.action === 'open_camera') {
        handleOpenCamera();
        setIsRunning(false);
        isRunningRef.current = false;
        setIsProcessing(false);
        showNotification('Camera opened', 'info');
      } else if (result.action === 'start_recording') {
        handleStartRecording();
        setIsRunning(false);
        isRunningRef.current = false;
        setIsProcessing(false);
        showNotification('Recording started', 'info');
      } else if (result.action === 'stop_recording') {
        handleStopRecording();
        setIsRunning(false);
        isRunningRef.current = false;
        setIsProcessing(false);
        showNotification('Recording stopped', 'info');
      } else if (result.action === 'request_confirmation') {
        setPendingConfirmation(result);
        setIsProcessing(false);
        addLog('info', 'Waiting for user confirmation for sensitive action.');
      } else {
        // 3. Execute action via backend
        const executeData = await safeFetch('/api/agent/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(result)
        });

        setScreenshot(executeData.screenshot);
        setCurrentUrl(executeData.url);
        setCurrentElements(executeData.elements || []);

        // Continue loop if running
        if (isRunningRef.current) {
          setTimeout(() => runAgentStep(currentCommand), 0);
        } else {
          setIsProcessing(false);
        }
      }
    } catch (error: any) {
      console.error("Agent Error:", error);
      const feedback = getErrorFeedback(error.message);
      setAgentError(feedback);
      addLog('error', `Agent Error: ${error.message}`);
      showNotification(feedback.message, 'error');
      speak(`I'm sorry, sir. ${feedback.message}`);
      setIsRunning(false);
      isRunningRef.current = false;
      setIsProcessing(false);
    } finally {
      setIsLoading(false);
    }
  };

  const startPilotWithCommand = (cmd: string) => {
    if (isProcessing || isRunningRef.current) return;
    setCommand(cmd);
    setIsRunning(true);
    isRunningRef.current = true;
    addLog('info', `Starting ScreenPilot with goal: "${cmd}"`);
    runAgentStep(cmd);
  };

  const startPilot = () => {
    if (!command) {
      addLog('error', 'Please provide a command first');
      return;
    }
    startPilotWithCommand(command);
  };

  const stopPilot = () => {
    setIsRunning(false);
    isRunningRef.current = false;
    addLog('info', 'ScreenPilot stopped by user');
  };

  const handleConfirmAction = async () => {
    if (!pendingConfirmation) return;
    const actionToExecute = { ...pendingConfirmation, action: 'click' }; // Default to click for confirmed actions
    setPendingConfirmation(null);
    setIsProcessing(true);
    addLog('success', 'Action confirmed by user.');
    
    try {
      const executeData = await safeFetch('/api/agent/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(actionToExecute)
      });

      setScreenshot(executeData.screenshot);
      setCurrentUrl(executeData.url);
      setCurrentElements(executeData.elements || []);

      if (isRunningRef.current) {
        runAgentStep(command);
      } else {
        setIsProcessing(false);
      }
    } catch (error: any) {
      console.error("Confirmation Execution Error:", error);
      showNotification('Failed to execute confirmed action', 'error');
      setIsProcessing(false);
    }
  };

  const handleCancelAction = () => {
    setPendingConfirmation(null);
    setIsRunning(false);
    isRunningRef.current = false;
    setIsProcessing(false);
    addLog('info', 'Action cancelled by user.');
    speak('Action cancelled, sir. Standing by.');
  };

  const resetSession = async () => {
    try {
      await safeFetch('/api/agent/reset', { method: 'POST' });
      setScreenshot(null);
      setCurrentUrl('');
      setLastDecision(null);
      addLog('info', 'Browser session reset successfully');
      showNotification('Browser session reset', 'success');
      speak('Browser session has been reset.');
    } catch (error: any) {
      addLog('error', `Failed to reset session: ${error.message}`);
      showNotification('Failed to reset session', 'error');
    }
  };

  const toggleCamera = () => {
    if (isCameraOpen) {
      closeCamera();
    } else {
      handleOpenCamera();
    }
  };

  const handleOpenCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setMediaStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraOpen(true);
      addLog('success', 'Camera initialized.');
      showNotification('Camera initialized', 'success');
      speak('Camera is online, sir.');
      return stream;
    } catch (err) {
      addLog('error', 'Failed to access camera.');
      showNotification('Failed to access camera', 'error');
      speak('I am unable to access the camera, sir. Please check permissions.');
      return null;
    }
  };

  const handleStartRecording = () => {
    if (!mediaStream) {
      handleOpenCamera().then((stream) => {
        if (stream) startRecording(stream);
      });
    } else {
      startRecording(mediaStream);
    }
  };

  const startRecording = (stream: MediaStream) => {
    const recorder = new MediaRecorder(stream);
    mediaRecorderRef.current = recorder;
    const chunks: Blob[] = [];
    
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `jarvis-recording-${new Date().getTime()}.webm`;
      a.click();
      setRecordedChunks([]);
      addLog('success', 'Recording saved.');
      showNotification('Recording saved to downloads', 'success');
      speak('Recording has been saved to your downloads, sir.');
    };

    recorder.start();
    setIsRecording(true);
    addLog('info', 'Recording started.');
    showNotification('Recording started', 'info');
    speak('Recording initiated.');
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      showNotification('Recording stopped', 'info');
    }
  };

  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" } as any,
        audio: false
      });
      screenStreamRef.current = stream;
      setIsScreenSharing(true);
      addLog('success', 'Screen sharing active. JARVIS can now see your desktop.');
      showNotification('Screen sharing active', 'success');

      // Create a hidden video element to keep the stream active and allow frame capture
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();
      screenVideoRef.current = video;

      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };
    } catch (err) {
      console.error("Error starting screen share:", err);
      showNotification('Failed to share screen', 'error');
    }
  };

  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    if (screenVideoRef.current) {
      screenVideoRef.current.pause();
      screenVideoRef.current.srcObject = null;
      screenVideoRef.current = null;
    }
    setIsScreenSharing(false);
    addLog('info', 'Screen sharing stopped');
  };

  const captureScreenFrame = (): string | null => {
    if (!screenVideoRef.current) return null;
    const video = screenVideoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
  };

  const preprocessImageForOCR = async (base64Data: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(base64Data);
          return;
        }

        // 1. Scaling: Upscale for better recognition of small text
        const scaleFactor = 2;
        canvas.width = img.width * scaleFactor;
        canvas.height = img.height * scaleFactor;

        // 2. Initial Enhancement via Filters
        ctx.filter = 'grayscale(100%) contrast(200%) brightness(100%)';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // 3. Manual Sharpening Convolution
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        
        // Simple Sharpening Kernel: [0, -1, 0, -1, 5, -1, 0, -1, 0]
        const output = ctx.createImageData(width, height);
        const outData = output.data;
        
        for (let y = 1; y < height - 1; y++) {
          for (let x = 1; x < width - 1; x++) {
            for (let c = 0; c < 3; c++) { // R, G, B
              const i = (y * width + x) * 4 + c;
              const val = 
                5 * data[i] -
                data[((y - 1) * width + x) * 4 + c] -
                data[((y + 1) * width + x) * 4 + c] -
                data[(y * width + (x - 1)) * 4 + c] -
                data[(y * width + (x + 1)) * 4 + c];
              outData[i] = Math.min(255, Math.max(0, val));
            }
            outData[(y * width + x) * 4 + 3] = 255; // Alpha
          }
        }
        ctx.putImageData(output, 0, 0);

        // 4. Simple Binarization (Thresholding)
        const finalData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = finalData.data;
        const threshold = 128;
        for (let i = 0; i < pixels.length; i += 4) {
          const avg = (pixels[i] + pixels[i+1] + pixels[i+2]) / 3;
          const val = avg > threshold ? 255 : 0;
          pixels[i] = pixels[i+1] = pixels[i+2] = val;
        }
        ctx.putImageData(finalData, 0, 0);

        resolve(canvas.toDataURL('image/jpeg', 0.9).split(',')[1]);
      };
      img.onerror = () => resolve(base64Data);
      img.src = `data:image/jpeg;base64,${base64Data}`;
    });
  };

  const performAdvancedOCR = async (base64Data: string) => {
    setIsProcessingOCR(true);
    try {
      // 1. Preprocess the image
      const enhancedImage = await preprocessImageForOCR(base64Data);
      
      // 2. Perform OCR with Tesseract
      const worker = await Tesseract.createWorker('eng');
      
      await worker.setParameters({
        tessedit_pageseg_mode: Tesseract.PSM.AUTO_OSD as any,
        tessjs_create_hocr: '0',
        tessjs_create_tsv: '0',
        tessedit_do_invert: '1', // Handle white text on black background
      });

      const { data: { text, confidence } } = await worker.recognize(`data:image/jpeg;base64,${enhancedImage}`);
      await worker.terminate();
      
      setOcrText(text);
      setOcrConfidence(confidence);
      return { text, confidence };
    } catch (err) {
      console.error("Advanced OCR Error:", err);
      return { text: "", confidence: 0 };
    } finally {
      setIsProcessingOCR(false);
    }
  };

  const closeCamera = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      setMediaStream(null);
    }
    setIsCameraOpen(false);
    setIsRecording(false);
  };
  const speak = (text: string | string[]) => {
    if (!text || (Array.isArray(text) && text.length === 0)) return;
    
    const message = Array.isArray(text) 
      ? text[Math.floor(Math.random() * text.length)] 
      : text;

    if ('speechSynthesis' in window) {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      // Handle potential speech synthesis errors
      utterance.onerror = (e) => {
        console.error('SpeechSynthesisUtterance error:', e);
      };

      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="min-h-screen flex flex-col p-6 gap-6 max-w-[1600px] mx-auto">
      <AnimatePresence>
        {isCameraOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
          >
            <div className="relative glass rounded-3xl overflow-hidden max-w-4xl w-full aspect-video border-emerald-500/30 shadow-2xl">
              <video 
                ref={videoRef} 
                autoPlay 
                muted 
                playsInline 
                className="w-full h-full object-cover"
              />
              
              <div className="absolute top-6 right-6 flex gap-3">
                <button 
                  onClick={closeCamera}
                  className="p-3 bg-zinc-950/50 hover:bg-red-500/50 rounded-full text-white transition-all backdrop-blur-md"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-6 px-8 py-4 bg-zinc-950/50 rounded-full backdrop-blur-md border border-white/10">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-zinc-500'}`} />
                  <span className="text-xs font-bold uppercase tracking-widest">
                    {isRecording ? 'Recording' : 'Standby'}
                  </span>
                </div>
                
                <div className="w-px h-4 bg-white/10" />

                <button 
                  onClick={isRecording ? handleStopRecording : handleStartRecording}
                  className={`flex items-center gap-2 px-6 py-2 rounded-full font-bold text-xs uppercase tracking-widest transition-all ${
                    isRecording 
                      ? 'bg-red-500 text-white hover:bg-red-600' 
                      : 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400'
                  }`}
                >
                  {isRecording ? <Square className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                  {isRecording ? 'Stop Recording' : 'Start Recording'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
        {showWakeWordFeedback && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed bottom-32 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-zinc-950 px-6 py-3 rounded-full font-bold shadow-2xl flex items-center gap-3 border-2 border-white/20"
          >
            <Mic className="w-5 h-5 animate-bounce" />
            <span>WAKE WORD DETECTED: LISTENING...</span>
          </motion.div>
        )}

        {showKeyError && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-red-500/10 border border-red-500/50 rounded-2xl p-4 flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center">
                <Cpu className="text-white w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-red-400">Gemini API Key Required</h3>
                <p className="text-xs text-red-400/80">Please add your <code className="bg-red-500/20 px-1 rounded">GEMINI_API_KEY</code> to the Secrets panel in the sidebar.</p>
              </div>
            </div>
            <button 
              onClick={() => setShowKeyError(false)}
              className="text-xs font-bold uppercase tracking-widest text-red-400 hover:text-red-300"
            >
              Dismiss
            </button>
          </motion.div>
        )}

        {agentError && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-amber-500/10 border border-amber-500/50 rounded-2xl p-6 flex flex-col gap-4"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center">
                  <AlertCircle className="text-zinc-950 w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-amber-400">Action Encountered an Issue</h3>
                  <p className="text-xs text-amber-400/80">{agentError.message}</p>
                </div>
              </div>
              <button 
                onClick={() => setAgentError(null)}
                className="text-xs font-bold uppercase tracking-widest text-amber-400 hover:text-amber-300"
              >
                Dismiss
              </button>
            </div>
            
            <div className="flex flex-col gap-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Suggested Alternatives:</p>
              <div className="flex flex-wrap gap-2">
                {agentError.suggestions.map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setAgentError(null);
                      if (suggestion.includes('Reset')) {
                        resetSession();
                      } else if (suggestion.includes('refreshing')) {
                        // Just clear error and let user try again or wait
                      } else {
                        startPilotWithCommand(suggestion);
                      }
                    }}
                    className="text-[11px] bg-zinc-800 hover:bg-zinc-700 border border-white/5 px-3 py-1.5 rounded-lg text-zinc-300 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
                <button
                  onClick={() => {
                    setAgentError(null);
                    resetSession();
                  }}
                  className="text-[11px] bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 px-3 py-1.5 rounded-lg text-emerald-500 transition-colors flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3 h-3" />
                  Reset Session
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="flex items-center justify-between glass p-6 rounded-3xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center neon-glow">
            <Cpu className="text-zinc-950 w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">AI ScreenPilot</h1>
            <p className="text-emerald-500/80 text-xs font-mono uppercase tracking-widest">Universal Computer Agent</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-full border transition-all ${
              showSettings ? 'bg-zinc-800 border-white/20 text-white' : 'bg-zinc-900 border-white/5 text-zinc-500 hover:text-zinc-300'
            }`}
            title="Voice Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button 
            onClick={toggleWakeWordMode}
            className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all ${
              isWakeWordMode 
                ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-500' 
                : 'bg-zinc-900 border-white/5 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Mic className={`w-4 h-4 ${isWakeWordMode ? 'animate-pulse' : ''}`} />
            <span className="text-xs font-medium uppercase tracking-wider">
              {isWakeWordMode ? 'Wake Word Active' : 'Enable Wake Word'}
            </span>
          </button>
          <button 
            onClick={resetSession}
            className="p-2 bg-zinc-900 border border-white/5 rounded-full text-zinc-500 hover:text-emerald-400 transition-colors"
            title="Reset Browser Session"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 px-4 py-2 bg-zinc-900 rounded-full border border-white/5">
            <div className="flex items-center gap-1.5 mr-2 pr-2 border-r border-white/10">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">System Health</span>
            </div>
            <Activity className={`w-4 h-4 ${isRunning ? 'text-emerald-500 animate-pulse' : 'text-zinc-600'}`} />
            <span className="text-xs font-medium uppercase tracking-wider">
              {isRunning ? 'Agent Active' : 'Agent Idle'}
            </span>
          </div>
          
          <div className="w-px h-6 bg-white/10 mx-2" />
          
          <button 
            onClick={() => startPilotWithCommand('Open WhatsApp Web')}
            className="p-2 bg-zinc-900 border border-white/5 rounded-full text-zinc-500 hover:text-emerald-400 transition-colors"
            title="Open WhatsApp"
          >
            <MessageSquare className="w-4 h-4" />
          </button>
          <button 
            onClick={toggleCamera}
            className={`p-2 border rounded-full transition-all ${
              isCameraOpen 
                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.3)]' 
                : 'bg-zinc-900 border-white/5 text-zinc-500 hover:text-emerald-400'
            }`}
            title={isCameraOpen ? "Close Camera" : "Open Camera"}
          >
            <Camera className="w-4 h-4" />
          </button>
          <button 
            onClick={() => startPilotWithCommand('Automatically fill this form')}
            className="p-2 bg-zinc-900 border border-white/5 rounded-full text-zinc-500 hover:text-emerald-400 transition-colors"
            title="Auto-fill Form"
          >
            <Terminal className="w-4 h-4" />
          </button>
          <button 
            onClick={() => startPilotWithCommand('Search Google for ')}
            className="p-2 bg-zinc-900 border border-white/5 rounded-full text-zinc-500 hover:text-emerald-400 transition-colors"
            title="Web Search"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="glass rounded-3xl p-6 border-emerald-500/20"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-emerald-500" />
                <h2 className="text-lg font-bold">Voice Settings</h2>
              </div>
              <button onClick={() => setShowSettings(false)} className="text-zinc-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-3 block">
                  Custom Wake Words
                </label>
                <div className="flex gap-2 mb-4">
                  <input 
                    type="text"
                    value={newWakeWord}
                    onChange={(e) => setNewWakeWord(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addWakeWord()}
                    placeholder="Add new wake word..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500/50"
                  />
                  <button 
                    onClick={addWakeWord}
                    className="bg-emerald-500 text-zinc-950 px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-400 transition-colors"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {wakeWords.map(word => (
                    <div 
                      key={word}
                      className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg text-sm group"
                    >
                      <span>{word}</span>
                      <button 
                        onClick={() => removeWakeWord(word)}
                        className="text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 block">
                  Voice Personality
                </label>
                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                  <p className="text-sm text-zinc-400 mb-2">Current Voice: <span className="text-emerald-500">Friendly Assistant</span></p>
                  <p className="text-xs text-zinc-500 italic mb-4">"I'll greet you as {USER_NAME} and respond with a helpful tone."</p>
                  <button 
                    onClick={() => speak(`Hello ${USER_NAME}, this is a test of my voice. Can you hear me?`)}
                    className="w-full py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
                  >
                    <Activity className="w-3 h-3" />
                    Test Voice Output
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Voice Status Indicator */}
      {isWakeWordMode && !isListening && !isRunning && !isProcessing && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2 bg-zinc-900/80 backdrop-blur-md border border-emerald-500/20 rounded-full shadow-2xl shadow-emerald-500/10">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-500/80">
            Listening for "Sharan" or "AI Hello"
          </span>
        </div>
      )}

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Vision & Control */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* AI Status Bar */}
          <AnimatePresence>
            {isRunning && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-6 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping absolute inset-0" />
                      <div className="w-2 h-2 bg-emerald-500 rounded-full relative" />
                    </div>
                    <span className="text-sm font-medium text-emerald-400">
                      {isProcessing ? "JARVIS is thinking..." : lastDecision ? `Executing: ${lastDecision.action} on ${lastDecision.target}` : "Initializing JARVIS systems..."}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="h-1 w-12 bg-zinc-800 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-emerald-500"
                          animate={{ width: isProcessing ? ['0%', '100%'] : '100%' }}
                          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Jarvis Response Display */}
          <AnimatePresence>
            {lastDecision?.reasoning && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="glass border-emerald-500/30 p-6 rounded-3xl relative overflow-hidden group"
              >
                <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-emerald-500/10 rounded-2xl">
                    <Activity className="w-6 h-6 text-emerald-500 animate-pulse" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-widest text-emerald-500">Jarvis Response</span>
                      <span className="text-[10px] text-zinc-500 font-mono uppercase">Systems Nominal</span>
                    </div>
                    <p className="text-lg text-zinc-100 leading-relaxed font-medium">
                      {lastDecision.reasoning}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Screen Vision */}
          <div className="glass rounded-3xl overflow-hidden flex-1 flex flex-col">
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/2">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Eye className={`w-4 h-4 ${isRunning ? 'text-emerald-500' : 'text-zinc-400'}`} />
                  {isRunning && (
                    <motion.div 
                      animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                      className="absolute inset-0 bg-emerald-500 rounded-full"
                    />
                  )}
                </div>
                <span className="text-sm font-medium text-zinc-400">Visual Perception</span>
                <button
                  onClick={isScreenSharing ? stopScreenShare : startScreenShare}
                  className={`ml-4 flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${
                    isScreenSharing 
                      ? 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20' 
                      : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20'
                  }`}
                >
                  {isScreenSharing ? (
                    <>
                      <StopCircle className="w-3 h-3" />
                      Stop Sharing
                    </>
                  ) : (
                    <>
                      <ScreenShare className="w-3 h-3" />
                      Share Screen
                    </>
                  )}
                </button>
              </div>
              {currentUrl && (
                <div className="flex items-center gap-3">
                  <div className="text-xs font-mono text-zinc-500 truncate max-w-md">
                    {currentUrl}
                  </div>
                  <a 
                    href={currentUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-zinc-400 hover:text-white"
                    title="Open in new tab"
                  >
                    <Play className="w-3 h-3" />
                  </a>
                  <button
                    onClick={() => setShowOCRPanel(!showOCRPanel)}
                    className={`p-1.5 rounded-lg transition-colors ${showOCRPanel ? 'bg-emerald-500/20 text-emerald-500' : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'}`}
                    title="Toggle OCR Analysis"
                  >
                    <Terminal className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
            <div className="flex-1 bg-zinc-900 relative flex items-center justify-center p-8 overflow-hidden">
              {screenshot ? (
                <div className="relative h-full aspect-[414/896] max-h-[700px] group flex gap-6">
                  {/* Mobile Device Frame */}
                  <div className="relative h-full aspect-[414/896]">
                    <div className="absolute -inset-4 border-[12px] border-zinc-800 rounded-[3rem] shadow-2xl pointer-events-none z-10" />
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-zinc-800 rounded-b-2xl z-20 pointer-events-none" />
                    
                    <img 
                      src={`data:image/jpeg;base64,${screenshot}`} 
                      alt="Agent View" 
                      className="h-full w-full object-cover rounded-[2rem] shadow-2xl border border-white/10"
                    />

                    {/* Action Indicator */}
                    {lastDecision?.coordinates && isRunning && (
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        key={`${lastDecision.coordinates[0]}-${lastDecision.coordinates[1]}`}
                        className="absolute z-30 pointer-events-none"
                        style={{
                          left: `${(lastDecision.coordinates[0] / 1000) * 100}%`,
                          top: `${(lastDecision.coordinates[1] / 1000) * 100}%`,
                          transform: 'translate(-50%, -50%)'
                        }}
                      >
                        <div className="relative flex items-center justify-center">
                          <div className="absolute w-12 h-12 bg-emerald-500/30 rounded-full animate-ping" />
                          <div className="absolute w-8 h-8 bg-emerald-500/50 rounded-full animate-pulse" />
                          <div className="w-4 h-4 bg-emerald-500 rounded-full border-2 border-white shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
                          
                          {/* Action Label */}
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="absolute top-8 left-1/2 -translate-x-1/2 bg-emerald-500 text-zinc-950 text-[10px] font-bold px-2 py-1 rounded-md whitespace-nowrap shadow-lg"
                          >
                            {lastDecision.action.toUpperCase()}
                          </motion.div>
                        </div>
                      </motion.div>
                    )}
                  </div>

                  {/* OCR Analysis Panel */}
                  <AnimatePresence>
                    {showOCRPanel && (
                      <motion.div
                        initial={{ opacity: 0, x: 20, width: 0 }}
                        animate={{ opacity: 1, x: 0, width: 300 }}
                        exit={{ opacity: 0, x: 20, width: 0 }}
                        className="bg-zinc-950/50 backdrop-blur-md border border-white/10 rounded-3xl p-4 flex flex-col h-full overflow-hidden"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">OCR Analysis</span>
                            {ocrConfidence > 0 && (
                              <span className={`text-[8px] font-mono ${ocrConfidence > 80 ? 'text-emerald-500/60' : ocrConfidence > 50 ? 'text-yellow-500/60' : 'text-red-500/60'}`}>
                                Confidence: {ocrConfidence.toFixed(1)}%
                              </span>
                            )}
                          </div>
                          {isProcessingOCR && <Loader2 className="w-3 h-3 text-emerald-500 animate-spin" />}
                        </div>
                        <div className="flex-1 overflow-y-auto font-mono text-[10px] text-zinc-400 leading-relaxed whitespace-pre-wrap">
                          {ocrText || (isProcessingOCR ? "Analyzing screen..." : "No text detected yet.")}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4 text-zinc-600">
                  <Monitor className="w-16 h-16 opacity-20" />
                  <p className="text-sm">Waiting for agent to start...</p>
                </div>
              )}
              
              {isLoading && (
                <div className="absolute inset-0 bg-zinc-950/40 backdrop-blur-sm flex items-center justify-center">
                  <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
                </div>
              )}
            </div>
          </div>

          {/* Command Input */}
          <div className="glass rounded-3xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Mic className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-medium">Voice Command Center</span>
              </div>
              <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                <span>Try: "Send WhatsApp to Mom"</span>
                <div className="w-1 h-1 bg-zinc-700 rounded-full" />
                <span>"Fill this form"</span>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <input 
                  type="text" 
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  disabled={isProcessing}
                  placeholder={isProcessing ? "Processing command..." : isListening ? "Listening... Speak now" : "e.g., 'Find the cheapest MacBook on Amazon'"}
                  className={`w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:outline-none focus:border-emerald-500/50 transition-colors text-lg ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''} ${isListening ? 'ring-2 ring-emerald-500/30' : ''}`}
                />
                {isListening && !isProcessing && (
                  <div className="absolute left-6 -top-6 flex items-center gap-2 text-emerald-500 animate-pulse">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Listening...</span>
                  </div>
                )}
                {!isProcessing && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    {command && (
                      <button 
                        onClick={() => setCommand('')}
                        className="p-2 text-zinc-500 hover:text-zinc-300 transition-colors"
                        title="Clear command"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    <button 
                      onClick={toggleListening}
                      className={`p-3 rounded-xl transition-all relative group ${
                        isListening ? 'bg-emerald-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      }`}
                    >
                      {isListening && (
                        <>
                          <div className="absolute -inset-1 bg-emerald-500/50 rounded-xl blur-md animate-pulse" />
                          <div className="absolute -inset-2 bg-emerald-500/20 rounded-xl blur-lg animate-ping" />
                        </>
                      )}
                      <div className="relative z-10">
                        {isListening ? <Square className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                      </div>
                    </button>
                  </div>
                )}
                {isProcessing && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
                  </div>
                )}
              </div>
              <button 
                onClick={isRunning ? stopPilot : startPilot}
                disabled={isLoading || isProcessing}
                className={`px-8 rounded-2xl font-bold flex items-center gap-3 transition-all relative overflow-hidden group ${
                  isRunning 
                    ? 'bg-zinc-800 text-white hover:bg-zinc-700' 
                    : 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400 neon-glow'
                } ${isLoading || isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {(isLoading || isProcessing) && (
                  <motion.div 
                    className="absolute inset-0 bg-white/20"
                    animate={{ x: ['-100%', '100%'] }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                  />
                )}
                {isRunning ? (
                  <>
                    <Square className="w-5 h-5 fill-current" />
                    STOP PILOT
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 fill-current" />
                    START PILOT
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Reasoning & Logs */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Reasoning Engine */}
          <div className="glass rounded-3xl p-6 flex flex-col gap-4 h-[300px]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-medium">Reasoning Engine</span>
              </div>
              {isProcessing && (
                <div className="flex gap-1">
                  <motion.div animate={{ height: [4, 12, 4] }} transition={{ repeat: Infinity, duration: 0.6 }} className="w-1 bg-emerald-500 rounded-full" />
                  <motion.div animate={{ height: [8, 4, 8] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} className="w-1 bg-emerald-500 rounded-full" />
                  <motion.div animate={{ height: [4, 12, 4] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} className="w-1 bg-emerald-500 rounded-full" />
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto pr-2">
              <AnimatePresence mode="wait">
                {lastDecision ? (
                  <motion.div 
                    key={lastDecision.reasoning}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    <p className="text-zinc-300 leading-relaxed italic">
                      "{lastDecision.reasoning}"
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                        <span className="text-[10px] uppercase text-zinc-500 block mb-1">Current Action</span>
                        <span className="text-emerald-400 font-mono text-sm uppercase">{lastDecision.action}</span>
                      </div>
                      <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                        <span className="text-[10px] uppercase text-zinc-500 block mb-1">Target</span>
                        <span className="text-zinc-300 font-mono text-sm truncate block">{lastDecision.target}</span>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <div className="h-full flex items-center justify-center text-zinc-600 text-sm italic">
                    Waiting for agent reasoning...
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Action Log */}
          <div className="glass rounded-3xl flex-1 flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/2">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-zinc-400" />
                <span className="text-sm font-medium text-zinc-400">Execution Log</span>
              </div>
              <button 
                onClick={() => setLogs([])}
                className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-red-400 transition-colors"
              >
                Clear
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 font-mono text-xs space-y-4 scrollbar-hide">
              {logs.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-zinc-600 gap-3 opacity-50">
                  <Terminal className="w-8 h-8" />
                  <p>System logs will appear here...</p>
                </div>
              )}
              {logs.map((log) => (
                <motion.div 
                  key={log.id} 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex gap-3 group"
                >
                  <span className="text-zinc-600 shrink-0 select-none">[{log.timestamp}]</span>
                  <div className="flex flex-col gap-1 flex-1">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        log.type === 'success' ? 'bg-emerald-500' : 
                        log.type === 'error' ? 'bg-red-500' : 
                        log.type === 'action' ? 'bg-blue-500' : 'bg-zinc-500'
                      }`} />
                      <span className={`
                        ${log.type === 'info' ? 'text-zinc-400' : ''}
                        ${log.type === 'action' ? 'text-blue-400 font-bold' : ''}
                        ${log.type === 'success' ? 'text-emerald-500' : ''}
                        ${log.type === 'error' ? 'text-red-400' : ''}
                      `}>
                        {log.message}
                      </span>
                    </div>
                    {log.details && (
                      <pre className="bg-white/2 p-3 rounded-xl mt-1 text-[10px] text-zinc-500 overflow-x-auto border border-white/5 group-hover:border-white/10 transition-colors">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    )}
                  </div>
                </motion.div>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>
      </main>
      {/* Confirmation Modal */}
      <AnimatePresence>
        {pendingConfirmation && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCancelAction}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md glass rounded-[2rem] p-8 border border-white/10 shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500" />
              
              <div className="flex flex-col items-center text-center gap-6">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                  <AlertCircle className="w-8 h-8 text-amber-500" />
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-white">Confirmation Required</h3>
                  <p className="text-zinc-400 text-sm leading-relaxed">
                    Sir, I'm about to perform a sensitive action. Please confirm if you'd like me to proceed.
                  </p>
                </div>

                <div className="w-full bg-white/5 rounded-2xl p-4 border border-white/5 text-left">
                  <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-2">Action Details</div>
                  <div className="text-sm text-zinc-300 font-medium italic">
                    "{pendingConfirmation.text || pendingConfirmation.reasoning}"
                  </div>
                </div>

                <div className="flex w-full gap-3">
                  <button
                    onClick={handleCancelAction}
                    className="flex-1 px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 font-bold transition-all border border-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmAction}
                    className="flex-1 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-bold transition-all shadow-lg shadow-amber-500/20"
                  >
                    Confirm Action
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Notification Toast */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl shadow-2xl border backdrop-blur-xl flex items-center gap-3 ${
              notification.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
              notification.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
              'bg-zinc-900/90 border-white/10 text-white'
            }`}
          >
            {notification.type === 'success' && <CheckCircle2 className="w-5 h-5" />}
            {notification.type === 'error' && <AlertCircle className="w-5 h-5" />}
            {notification.type === 'info' && <Info className="w-5 h-5" />}
            <span className="text-sm font-medium">{notification.message}</span>
            <button 
              onClick={() => setNotification(null)}
              className="ml-2 p-1 hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
