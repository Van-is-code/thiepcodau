const http = require("http");
const fs = require("fs");
const path = require("path");

let startPoints = {};
let endPoints = {};

// Doc 2 file JSON tu root folder
function loadConfig() {
  try {
    const rootDir = path.resolve(__dirname, '..');
    const startFile = path.join(rootDir, "start-points.json");
    const endFile = path.join(rootDir, "end-points.json");
    
    if (fs.existsSync(startFile)) {
      const data = fs.readFileSync(startFile, "utf8");
      startPoints = JSON.parse(data);
    }
    if (fs.existsSync(endFile)) {
      const data = fs.readFileSync(endFile, "utf8");
      endPoints = JSON.parse(data);
    }
  } catch (error) {
    console.error("Loi doc file config:", error.message);
  }
}

// Tim URL dich theo pathname
function getTargetUrl(pathname) {
  // Tim ma khop trong start-points
  for (const [code, startUrl] of Object.entries(startPoints)) {
    try {
      // Extract pathname tu start URL
      const urlObj = new URL(startUrl);
      if (pathname === urlObj.pathname) {
        // Tra ve URL dich tu end-points
        return endPoints[code] || null;
      }
    } catch (e) {
      // Ignore invalid URLs
    }
  }
  return null;
}

// Khoi dong redirect server
function startRedirectServer(port = 3001) {
  loadConfig();

  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, `http://${req.headers.host || "localhost"}`).pathname;
    const targetUrl = getTargetUrl(pathname);

    if (!targetUrl) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("404 - Duong dan khong ton tai");
      return;
    }

    res.statusCode = 302;
    res.setHeader("Location", targetUrl);
    res.setHeader("Cache-Control", "no-store");
    res.end(`Dang chuyen huong toi ${targetUrl}`);
  });

  server.listen(port, () => {
    console.log(`\n=== Redirect Server ===`);
    console.log(`Redirect server dang chay tai http://0.0.0.0:${port}`);
    console.log(`\nCac routes:`);
    for (const [code, startUrl] of Object.entries(startPoints)) {
      const endUrl = endPoints[code] || "(khong co)";
      console.log(`  ${startUrl}`);
      console.log(`    --> ${endUrl}`);
    }
    console.log(`\n`);
  });

  return server;
}

module.exports = { startRedirectServer };
