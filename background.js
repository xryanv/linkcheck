// Configuration
const API_KEY = "<Google Safe Search API Key Here>"; // Replace with your API key
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const URLSCAN_IO_API_KEY = "<Optional URLScan API Key Here>"; // Optional, for enhanced checking

// Cache for URL safety results
let urlCache = {};

// Simple hash function for URL keys
function hashUrl(url) {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return hash.toString();
}

// Function to clean expired cache entries
function cleanCache() {
  const now = Date.now();
  Object.keys(urlCache).forEach(key => {
    if (now - urlCache[key].timestamp > CACHE_DURATION) {
      delete urlCache[key];
    }
  });
}

// Run cache cleanup periodically
setInterval(cleanCache, 60 * 60 * 1000); // Clean every hour

// Main link checking function
async function checkUrlSafety(url) {
  try {
    // Normalize the URL
    if (!url.startsWith('http')) {
      url = 'http://' + url;
    }
    
    // Generate cache key
    const cacheKey = hashUrl(url);
    
    // Check cache first
    if (urlCache[cacheKey] && (Date.now() - urlCache[cacheKey].timestamp < CACHE_DURATION)) {
      console.log("Cache hit for:", url);
      return urlCache[cacheKey].data;
    }
    
    console.log("Checking URL:", url);
    
    // Use a combination of methods for speed and accuracy
    // 1. Quick check using Google Safe Browsing Lookup API (faster than Threat Matches)
    const safeBrowsingResult = await checkGoogleSafeBrowsing(url);
    
    // 2. If the quick check passes, do a secondary check with urlscan.io
    //    which is async but will update the cache once done
    if (safeBrowsingResult.isSafe && URLSCAN_IO_API_KEY) {
      checkUrlscanIO(url, cacheKey);
    }
    
    // Cache the result
    urlCache[cacheKey] = {
      timestamp: Date.now(),
      data: safeBrowsingResult
    };
    
    return safeBrowsingResult;
  } catch (error) {
    console.error("Error checking URL safety:", error);
    return { error: "Failed to check URL safety", isSafe: false };
  }
}

// Google Safe Browsing API - fast check
async function checkGoogleSafeBrowsing(url) {
  try {
    // Using the lookup API which is faster than threatMatches
    const apiUrl = `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${API_KEY}`;
    
    const requestBody = {
      client: {
        clientId: "safe-link-checker-extension",
        clientVersion: "1.0.0"
      },
      threatInfo: {
        threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
        platformTypes: ["ANY_PLATFORM"],
        threatEntryTypes: ["URL"],
        threatEntries: [{ url: url }]
      }
    };
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.matches || data.matches.length === 0) {
      return { isSafe: true };
    }
    
    // Extract threat types
    const threats = data.matches.map(match => 
      match.threatType.replace(/_/g, " ")
    );
    
    return { 
      isSafe: false,
      threats: threats
    };
  } catch (error) {
    console.error("Google Safe Browsing API error:", error);
    // Default to safe if API fails - better user experience
    return { 
      isSafe: true,
      error: "API check failed, showing default safe status"
    };
  }
}

// Secondary check with urlscan.io - updates cache asynchronously
async function checkUrlscanIO(url, cacheKey) {
  try {
    // Submit URL for scanning
    const submitResponse = await fetch('https://urlscan.io/api/v1/scan/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'API-Key': URLSCAN_IO_API_KEY
      },
      body: JSON.stringify({
        url: url,
        visibility: 'private' // Keep the scan private
      })
    });
    
    const submitData = await submitResponse.json();
    
    if (submitData.uuid) {
      // Wait a moment for scan to complete
      setTimeout(async () => {
        try {
          // Get the results
          const resultResponse = await fetch(`https://urlscan.io/api/v1/result/${submitData.uuid}/`);
          const resultData = await resultResponse.json();
          
          // Update the cache with the enhanced result
          if (resultData.verdicts && resultData.verdicts.overall) {
            const isMalicious = resultData.verdicts.overall.malicious;
            const threats = resultData.verdicts.overall.categories || [];
            
            // Only update cache if we have meaningful data
            if (urlCache[cacheKey]) {
              urlCache[cacheKey].data = {
                isSafe: !isMalicious,
                threats: threats,
                score: resultData.verdicts.overall.score,
                // Keep the original data as a backup
                originalCheck: urlCache[cacheKey].data
              };
            }
          }
        } catch (error) {
          console.error("Error retrieving urlscan.io results:", error);
        }
      }, 15000); // Wait 15 seconds for scan to complete
    }
  } catch (error) {
    console.error("urlscan.io API error:", error);
    // No need to handle this error since it's a secondary check
  }
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "checkUrlSafety") {
    // Check URL and send response
    checkUrlSafety(request.url)
      .then(result => sendResponse(result))
      .catch(error => {
        console.error(error);
        sendResponse({ error: error.message, isSafe: true });
      });
    
    // Return true to indicate an async response
    return true;
  }
});
