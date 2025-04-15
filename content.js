// Create tooltip element
const tooltip = document.createElement("div");
tooltip.style.cssText = `
  position: fixed;
  background: #fff;
  border: 1px solid #ccc;
  padding: 8px;
  border-radius: 4px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  font-size: 12px;
  color: #333;
  z-index: 10000;
  display: none;
  white-space: pre-wrap;
  max-width: 300px;
`;
document.body.appendChild(tooltip);
let hoverStatus = false
let currentLink = null;
let tooltipTimeout = null;
let storedData= null; //data from last displayed tooltip
let storedLink = null; //last hovered link
const HOVER_DELAY = 300; // ms before showing tooltip

// Function to check if a URL is on a common safe domain list (for instant safe response)
function isCommonSafeDomain(url) {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    
    // List of commonly trusted domains for instant "safe" feedback
    const trustedDomains = [
      'google.com', 'www.google.com',
      'microsoft.com', 'www.microsoft.com',
      'github.com', 'www.github.com',
      'stackoverflow.com', 'www.stackoverflow.com',
      'wikipedia.org', 'www.wikipedia.org',
      'mozilla.org', 'www.mozilla.org',
      'amazon.com', 'www.amazon.com',
      'apple.com', 'www.apple.com'
      // Add more trusted domains as needed
    ];
    
    // Check if domain or its parent domain is in the trusted list
    return trustedDomains.some(trusted => 
      domain === trusted || domain.endsWith('.' + trusted)
    );
  } catch (e) {
    return false;
  }
}

// Function to fetch threat intelligence data
async function fetchThreatIntelligence(url) {
  try {
    
    // First check if domain is commonly known safe
    if (isCommonSafeDomain(url)) {
      return { isSafe: true, fastResponse: true };
    }
    
    // Then check local cache via background script
    const response = await chrome.runtime.sendMessage({
      action: "checkUrlSafety",
      url: url
    });
    
    return response;
  } catch (err) {
    console.error("Fetch error:", err);
    return { error: err.message };
  }
}

// Function to update tooltip content
function updateTooltipContent(url, data) {
  let urlObj = new URL(url);
  let domainName = urlObj.host
  // If there was an error
  if (data.error) {
    tooltip.innerHTML = `⚠️ Error checking: <br> ${domainName}<br><small>${data.error}</small>`;
    tooltip.style.borderColor = "#FFA000";
    tooltip.style.background = "#FFF8E1";
    return;
  }
  
  // If the URL is safe
  if (data.isSafe) {
    let content = `✅ Safe: <br> ${domainName}`;
    
    // If this was an instant response from our common domains list
    if (data.fastResponse) {
      content += `<br><small>Common trusted domain</small>`;
    }
    
    tooltip.innerHTML = content;
    tooltip.style.borderColor = "#4CAF50";
    tooltip.style.background = "#E8F5E9";
    return;
  }

  // If the URL is unsafe
  let content = `❌ Threats found: <br> ${domainName} <br><br>`;
  
  if (data.threats && data.threats.length > 0) {
    data.threats.forEach((threat, index) => {
      content += `⚠️ ${threat}<br>`;
    });
  } else {
    content += `⚠️ Potentially unsafe URL`;
  }

  tooltip.innerHTML = content.trim();
  tooltip.style.borderColor = "#F44336";
  tooltip.style.background = "#FFEBEE";
}

// Show tooltip and fetch threat intelligence data
async function showTooltip(link) {
  tooltip.style.display = "block";
  tooltip.innerHTML = "🔍 Checking...";
  tooltip.style.borderColor = "#2196F3";
  tooltip.style.background = "#E3F2FD";

  if(link==storedLink)
  {
   
    updateTooltipContent(link, storedData);
  }else{

    const data = await fetchThreatIntelligence(link);
    storedLink = currentLink
    storedData = data
    
    updateTooltipContent(link, data);
  }
  
}

// Hide tooltip
function hideTooltip() {
  if (tooltipTimeout) {
    clearTimeout(tooltipTimeout);
    tooltipTimeout = null;
  }
  tooltip.style.display = "none";
  
}

// Event listeners
document.addEventListener("mouseover", event => {
  const linkElem = event.target.closest("a[href]");
  if (linkElem && linkElem.href) {
    hoverStatus = true
    currentLink = linkElem.href;
   
  }
});

document.addEventListener("mousemove", event => {
  
    // Position tooltip near cursor but avoid going off-screen
    const tooltipWidth = tooltip.offsetWidth;
    const tooltipHeight = tooltip.offsetHeight;
    
    let left = event.clientX + 10;
    let top = event.clientY + 10;
    
    // Check if tooltip would go off right edge
    if (left + tooltipWidth > window.innerWidth) {
      left = event.clientX - tooltipWidth - 10;
    }
    
    // Check if tooltip would go off bottom edge
    if (top + tooltipHeight > window.innerHeight) {
      top = event.clientY - tooltipHeight - 10;
    }
    
    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
  
});

document.addEventListener("mouseout", event => {
  const relatedTarget = event.relatedTarget;
  hoverStatus = false
  if (!relatedTarget || (!relatedTarget.closest("a[href]") && !event.target.closest("a[href]"))) {
    hideTooltip();
    
  }
  else if (hoverStatus == false){
    hideTooltip();
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Control" &&  tooltip.style.display !== "block" && hoverStatus==true) {
    showTooltip(currentLink);
    
  }
  
});

document.addEventListener("keyup", event => {
  if (event.key === "Control") {
    hideTooltip();
  }
});

