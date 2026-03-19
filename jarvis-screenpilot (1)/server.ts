import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import cors from 'cors';
import { chromium, Browser, Page } from 'playwright';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Request logger middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

let browser: Browser | null = null;
let page: Page | null = null;

async function getBrowser() {
  if (!browser) {
    browser = await chromium.launch({ 
      headless: true,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-extensions'
      ]
    });
    const context = await browser.newContext({
      viewport: { width: 414, height: 896 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      ignoreHTTPSErrors: true,
      bypassCSP: true
    });
    page = await context.newPage();
    
    // Block ads and trackers to speed up loading
    await page.route('**/*', (route) => {
      const url = route.request().url();
      const blockedResources = [
        'google-analytics.com',
        'doubleclick.net',
        'adsystem.com',
        'adservice.google',
        'facebook.net',
        'hotjar.com',
        'scorecardresearch.com',
        'analytics.js',
        'gtm.js'
      ];
      if (blockedResources.some(resource => url.includes(resource))) {
        route.abort();
      } else {
        route.continue();
      }
    });

    await page.setDefaultNavigationTimeout(30000);
    await page.setDefaultTimeout(10000);
  }
  return { browser, page };
}

app.post('/api/agent/execute', async (req, res) => {
  const { action, target, text, coordinates } = req.body;
  
  try {
    const { page } = await getBrowser();
    if (!page) throw new Error("Failed to initialize page");

    if (action === 'navigate') {
      let url = target;
      if (!url.startsWith('http')) {
        url = 'https://' + url;
      }
      await page.goto(url, { waitUntil: 'load', timeout: 60000 });
      await page.waitForLoadState('networkidle').catch(() => {}); // Optional but helpful
    } else if (action === 'click' && coordinates) {
      const x = (coordinates[0] / 1000) * 414;
      const y = (coordinates[1] / 1000) * 896;
      await page.mouse.click(x, y);
      await page.waitForTimeout(500); // Optimized from 1000ms
    } else if (action === 'type') {
      if (coordinates) {
         const x = (coordinates[0] / 1000) * 414;
         const y = (coordinates[1] / 1000) * 896;
         
         // Ensure focus by clicking the field
         await page.mouse.click(x, y);
         await page.waitForTimeout(100); // Optimized from 200ms
         
         // Clear field - try multiple methods for robustness
         await page.keyboard.down('Control');
         await page.keyboard.press('a');
         await page.keyboard.up('Control');
         await page.keyboard.press('Backspace');
         
         // Also try Command+A for Mac-like environments if Control+A fails
         await page.keyboard.down('Meta');
         await page.keyboard.press('a');
         await page.keyboard.up('Meta');
         await page.keyboard.press('Backspace');
         
         await page.waitForTimeout(50); // Optimized from 100ms
      }
      await page.keyboard.type(text || '', { delay: 20 }); // Optimized from 50ms
      await page.waitForTimeout(300); // Optimized from 500ms
    } else if (action === 'press_enter') {
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000); // Optimized from 2000ms
    } else if (action === 'select') {
      if (coordinates) {
        const x = (coordinates[0] / 1000) * 414;
        const y = (coordinates[1] / 1000) * 896;
        await page.mouse.click(x, y);
        await page.selectOption('select', text || '');
      }
    } else if (action === 'scroll_down') {
      await page.evaluate(() => window.scrollBy(0, 500));
    } else if (action === 'scroll_up') {
      await page.evaluate(() => window.scrollBy(0, -500));
    } else if (action === 'go_back') {
      await page.goBack().catch(() => {});
    } else if (action === 'go_forward') {
      await page.goForward().catch(() => {});
    } else if (action === 'refresh') {
      await page.reload().catch(() => {});
    } else if (action === 'scroll_to' && coordinates) {
      const x = (coordinates[0] / 1000) * 414;
      const y = (coordinates[1] / 1000) * 896;
      await page.evaluate(({ x, y }) => window.scrollTo({ top: y, left: x, behavior: 'smooth' }), { x, y });
    } else if (action === 'wait') {
      const waitTime = text ? parseInt(text) : 2000;
      await page.waitForTimeout(waitTime);
    }

    await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});

    const nextScreenshot = await page.screenshot({ 
      type: 'jpeg', 
      quality: 60,
      animations: 'disabled'
    });

    const getElements = async () => {
      return await page!.evaluate(() => {
        const interactiveElements: any[] = [];
        const selectors = [
          'input:not([type="hidden"])',
          'textarea',
          'select',
          'button',
          '[role="button"]',
          '[role="checkbox"]',
          '[role="radio"]',
          '[role="combobox"]',
          '[role="listbox"]',
          '[role="menuitem"]',
          '[role="tab"]',
          '[role="switch"]',
          '[role="textbox"]',
          'a',
          '[onclick]',
          '.btn',
          '.button',
          '.input'
        ].join(', ');
        const els = document.querySelectorAll(selectors);
        
        els.forEach((el: any) => {
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          const isVisible = rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
          
          // Even if not strictly "visible" by rect, it might be an important form field
          if (isVisible || (el.tagName === 'INPUT' && el.type !== 'hidden')) {
            let label = '';
            
            // 1. Try aria-label
            label = el.getAttribute('aria-label') || '';
            
            // 2. Try aria-labelledby
            if (!label && el.getAttribute('aria-labelledby')) {
              const labelledBy = el.getAttribute('aria-labelledby');
              const labelEl = document.getElementById(labelledBy);
              if (labelEl) label = labelEl.textContent || '';
            }
            
            // 3. Try associated label
            if (!label && el.id) {
              const labelEl = document.querySelector(`label[for="${el.id}"]`);
              if (labelEl) label = labelEl.textContent || '';
            }
            
            // 4. Try parent label
            if (!label) {
              const parentLabel = el.closest('label');
              if (parentLabel) label = parentLabel.textContent || '';
            }
            
            // 5. Fallbacks
            if (!label) label = el.placeholder || el.title || el.innerText || el.value || el.name || '';
            
            interactiveElements.push({
              tag: el.tagName.toLowerCase(),
              type: el.type || '',
              role: el.getAttribute('role') || '',
              name: el.name || '',
              id: el.id || '',
              label: label.trim().substring(0, 100),
              placeholder: el.placeholder || '',
              value: el.value || '',
              required: el.required || false,
              isVisible,
              coordinates: [
                Math.round(((rect.left + rect.width / 2) / window.innerWidth) * 1000),
                Math.round(((rect.top + rect.height / 2) / window.innerHeight) * 1000)
              ]
            });
          }
        });
        return interactiveElements.slice(0, 60); 
      });
    };

    const elements = await getElements();
    
    res.json({
      screenshot: nextScreenshot.toString('base64'),
      url: page.url(),
      elements
    });

  } catch (error: any) {
    console.error("Execution Error:", error);
    let errorMessage = error.message;
    
    if (errorMessage.includes('net::ERR_NAME_NOT_RESOLVED')) {
      errorMessage = "The website address could not be found. Please check the URL.";
    } else if (errorMessage.includes('net::ERR_CONNECTION_REFUSED')) {
      errorMessage = "The website refused to connect. It might be down or blocking automated access.";
    } else if (errorMessage.includes('Timeout')) {
      errorMessage = "The action timed out. The page might be loading too slowly or an element is missing.";
    } else if (errorMessage.includes('Target closed')) {
      errorMessage = "The browser session was unexpectedly closed. Please reset the session.";
    } else if (errorMessage.includes('Protocol error')) {
      errorMessage = "There was a communication error with the browser. Try resetting the session.";
    }

    res.status(500).json({ error: errorMessage });
  }
});

app.post('/api/agent/reset', async (req, res) => {
  try {
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        console.error("Error closing browser:", e);
      }
      browser = null;
      page = null;
    }
    res.json({ status: 'ok' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/agent/screenshot', async (req, res) => {
    try {
        const { page } = await getBrowser();
        if (!page) return res.status(404).json({ error: 'No active session' });
        await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
        const screenshot = await page.screenshot({ 
            type: 'jpeg', 
            quality: 60,
            animations: 'disabled'
        });

        const getElements = async () => {
            return await page!.evaluate(() => {
                const interactiveElements: any[] = [];
                const selectors = [
                    'input:not([type="hidden"])',
                    'textarea',
                    'select',
                    'button',
                    '[role="button"]',
                    '[role="checkbox"]',
                    '[role="radio"]',
                    '[role="combobox"]',
                    '[role="listbox"]',
                    '[role="menuitem"]',
                    '[role="tab"]',
                    '[role="switch"]',
                    '[role="textbox"]',
                    'a',
                    '[onclick]',
                    '.btn',
                    '.button',
                    '.input'
                ].join(', ');
                const els = document.querySelectorAll(selectors);
                
                els.forEach((el: any) => {
                    const rect = el.getBoundingClientRect();
                    const style = window.getComputedStyle(el);
                    const isVisible = rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
                    
                    if (isVisible || (el.tagName === 'INPUT' && el.type !== 'hidden')) {
                        let label = '';
                        label = el.getAttribute('aria-label') || '';
                        if (!label && el.getAttribute('aria-labelledby')) {
                            const labelledBy = el.getAttribute('aria-labelledby');
                            const labelEl = document.getElementById(labelledBy);
                            if (labelEl) label = labelEl.textContent || '';
                        }
                        if (!label && el.id) {
                            const labelEl = document.querySelector(`label[for="${el.id}"]`);
                            if (labelEl) label = labelEl.textContent || '';
                        }
                        if (!label) {
                            const parentLabel = el.closest('label');
                            if (parentLabel) label = parentLabel.textContent || '';
                        }
                        if (!label) label = el.placeholder || el.title || el.innerText || el.value || el.name || '';
                        
                        interactiveElements.push({
                            tag: el.tagName.toLowerCase(),
                            type: el.type || '',
                            role: el.getAttribute('role') || '',
                            name: el.name || '',
                            id: el.id || '',
                            label: label.trim().substring(0, 100),
                            placeholder: el.placeholder || '',
                            value: el.value || '',
                            required: el.required || false,
                            isVisible,
                            coordinates: [
                                Math.round(((rect.left + rect.width / 2) / window.innerWidth) * 1000),
                                Math.round(((rect.top + rect.height / 2) / window.innerHeight) * 1000)
                            ]
                        });
                    }
                });
                return interactiveElements.slice(0, 60);
            });
        };

        const elements = await getElements();
        res.json({ screenshot: screenshot.toString('base64'), url: page.url(), elements });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Catch-all for API routes to prevent falling through to SPA HTML
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.url}` });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

process.on('SIGINT', async () => {
  if (browser) await browser.close();
  process.exit();
});

process.on('SIGTERM', async () => {
  if (browser) await browser.close();
  process.exit();
});

startServer();
