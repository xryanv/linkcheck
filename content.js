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
`;
document.body.appendChild(tooltip);

let currentLink = null;
let lastMouseX = 0, lastMouseY = 0;

// Extract domain from a URL string
function getDomain(url) {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

// Map known TLDs to their RDAP endpoints
const rdapEndpoints = {
  com: "https://rdap.verisign.com/com/v1/domain/",
  net: "https://rdap.verisign.com/net/v1/domain/",
  org: "https://rdap.publicinterestregistry.net/rdap/org/domain/"
  // Add more TLDs and endpoints as needed
};

async function fetchWhois(domain) {
  // Extract the TLD
  const parts = domain.split(".");
  const tld = parts[parts.length - 1].toLowerCase();
  const endpoint = rdapEndpoints[tld];
  
  if (!endpoint) {
    console.error(`No RDAP endpoint defined for .${tld}`);
    return null;
  }

  const rdapURL = endpoint + domain;
  try {
    const response = await fetch(rdapURL);
    if (!response.ok) throw new Error("Network error");
    const data = await response.json();
    console.log("RDAP response for", domain, data);
    return data;
  } catch (err) {
    console.error(err);
    return null;
  }
}

// Update tooltip content based on WHOIS data
function updateTooltipContent(data) {
  if (!data) {
    tooltip.textContent = "No WHOIS data found.";
    return;
  }
  let content = `Domain: ${data.ldhName || "N/A"}`;
  if (data.events) {
    const regEvent = data.events.find(e => e.eventAction === "registration");
    if (regEvent) {
      content += `\nRegistered: ${new Date(regEvent.eventDate).toLocaleDateString()}`;
    }
  }
  tooltip.textContent = content;
}

// Show tooltip and fetch WHOIS info for the given link
async function showTooltip(link) {
  tooltip.style.display = "block";
  tooltip.textContent = "Loading WHOIS info...";
  const domain = getDomain(link);
  if (!domain) {
    tooltip.textContent = "Invalid URL";
    return;
  }
  const data = await fetchWhois(domain);
  updateTooltipContent(data);
}

// Hide tooltip and reset current link
function hideTooltip() {
  tooltip.style.display = "none";
  currentLink = null;
}

// Mouseover: if hovering a link, store it and show tooltip if CTRL is pressed
document.addEventListener("mouseover", event => {
  const linkElem = event.target.closest("[href]");
  if (linkElem) {
    currentLink = linkElem.href;
    if (event.ctrlKey) showTooltip(currentLink);
  }
});

// Mousemove: update tooltip position and record last mouse coordinates
document.addEventListener("mousemove", event => {
  lastMouseX = event.clientX;
  lastMouseY = event.clientY;
  if (tooltip.style.display === "block") {
    tooltip.style.top = `${event.clientY + 10}px`;
    tooltip.style.left = `${event.clientX + 10}px`;
  }
});

// Mouseout: hide tooltip when leaving a link area
document.addEventListener("mouseout", event => {
  if (!event.relatedTarget || !event.relatedTarget.closest("[href]")) {
    hideTooltip();
  }
});

// Key events: show tooltip when CTRL is pressed over a link, hide when released
document.addEventListener("keydown", event => {
  if (event.key === "Control" && currentLink && tooltip.style.display !== "block") {
    showTooltip(currentLink);
  }
});

document.addEventListener("keyup", event => {
  if (event.key === "Control") {
    hideTooltip();
  }
});
