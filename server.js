const express = require('express');
const multer = require('multer');
const archiver = require('archiver');
const fetch = require('node-fetch');
const pdfParse = require('pdf-parse');
const gdsPrompt = require('./gds-prompt');
const { buildPrototypeFiles } = require('./generator');

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GOV.UK Prototype Engine</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: "GDS Transport", arial, sans-serif; background: #f3f2f1; min-height: 100vh; display: flex; flex-direction: column; }
    .govuk-header { background: #0b0c0c; padding: 12px 0; border-bottom: 10px solid #1d70b8; }
    .govuk-header__inner { max-width: 960px; margin: 0 auto; padding: 0 30px; display: flex; align-items: center; gap: 20px; }
    .govuk-header__crown { display: flex; align-items: center; gap: 10px; color: white; text-decoration: none; }
    .crown-svg { width: 36px; height: 32px; fill: white; }
    .govuk-header__logotype-text { font-size: 30px; font-weight: 700; color: white; letter-spacing: -1px; }
    .govuk-header__service-name { color: white; font-size: 19px; font-weight: 400; border-left: 1px solid #626a6e; padding-left: 20px; margin-left: 10px; }
    main { max-width: 960px; margin: 0 auto; padding: 40px 30px; flex: 1; width: 100%; }
    .two-col { display: grid; grid-template-columns: 2fr 1fr; gap: 60px; align-items: start; }
    h1 { font-size: 48px; font-weight: 700; color: #0b0c0c; line-height: 1.1; margin-bottom: 20px; }
    .lede { font-size: 20px; color: #0b0c0c; margin-bottom: 40px; line-height: 1.5; }
    label { display: block; font-size: 19px; font-weight: 700; color: #0b0c0c; margin-bottom: 8px; }
    .hint { font-size: 16px; color: #505a5f; margin-bottom: 10px; }
    textarea, input[type="text"], input[type="url"] { width: 100%; padding: 10px; font-size: 19px; font-family: inherit; border: 2px solid #0b0c0c; border-radius: 0; background: white; color: #0b0c0c; margin-bottom: 24px; }
    textarea:focus, input:focus { outline: 3px solid #ffdd00; outline-offset: 0; box-shadow: inset 0 0 0 2px #0b0c0c; }
    textarea { resize: vertical; }
    .file-upload-label { display: inline-block; padding: 8px 14px; background: #f3f2f1; border: 2px solid #0b0c0c; cursor: pointer; font-size: 16px; margin-bottom: 8px; }
    .file-name { font-size: 16px; color: #505a5f; margin-bottom: 24px; }
    input[type="file"] { display: none; }
    .generate-btn { background: #00703c; color: white; border: none; padding: 13px 22px; font-size: 19px; font-weight: 700; font-family: inherit; cursor: pointer; display: flex; align-items: center; gap: 10px; }
    .generate-btn:hover { background: #005a30; }
    .generate-btn:focus { outline: 3px solid #ffdd00; outline-offset: 0; }
    .generate-btn:disabled { background: #505a5f; cursor: not-allowed; }
    .btn-arrow { width: 20px; height: 20px; fill: white; }
    .status-box { display: none; background: white; border-left: 5px solid #1d70b8; padding: 20px; margin-top: 30px; }
    .status-box.visible { display: block; }
    .status-box.success { border-color: #00703c; }
    .status-box.error { border-color: #d4351c; }
    .status-title { font-size: 19px; font-weight: 700; color: #0b0c0c; margin-bottom: 8px; }
    .status-msg { font-size: 16px; color: #0b0c0c; line-height: 1.5; }
    .download-btn { display: inline-block; background: #1d70b8; color: white; padding: 10px 18px; font-size: 16px; font-weight: 700; font-family: inherit; text-decoration: none; margin-top: 16px; border: none; cursor: pointer; }
    .download-btn:hover { background: #003078; }
    .steps { background: white; padding: 24px; border: 1px solid #b1b4b6; }
    .steps h2 { font-size: 19px; font-weight: 700; color: #0b0c0c; margin-bottom: 16px; }
    .steps ol { padding-left: 20px; }
    .steps li { font-size: 16px; color: #0b0c0c; margin-bottom: 12px; line-height: 1.5; }
    .steps code { background: #f3f2f1; padding: 2px 6px; font-size: 14px; font-family: monospace; }
    .spinner { display: inline-block; width: 18px; height: 18px; border: 3px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    footer { background: #0b0c0c; padding: 20px 30px; color: #bfc1c3; font-size: 14px; text-align: center; }
    @media (max-width: 768px) { .two-col { grid-template-columns: 1fr; } h1 { font-size: 32px; } }
  </style>
</head>
<body>
<header class="govuk-header">
  <div class="govuk-header__inner">
    <a href="/" class="govuk-header__crown">
      <svg class="crown-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 132 97" focusable="false">
        <path d="M25 30.2c3.5 1.5 7.7-.2 9.1-3.7 1.5-3.6-.2-7.8-3.9-9.2-3.6-1.4-7.6.3-9.1 3.9-1.4 3.5.3 7.5 3.9 9zM9 39.5c3.6 1.5 7.8-.2 9.2-3.7 1.5-3.6-.3-7.8-3.9-9.1-3.6-1.5-7.6.2-9.1 3.8-1.4 3.5.3 7.5 3.8 9zM4.4 57.2c3.5 1.5 7.7-.2 9.1-3.8 1.5-3.6-.2-7.7-3.9-9.1-3.5-1.5-7.6.3-9.1 3.8-1.4 3.5.3 7.6 3.9 9.1zm38.3-21.4c3.5 1.5 7.7-.2 9.1-3.8 1.5-3.6-.2-7.7-3.9-9.1-3.6-1.5-7.6.3-9.1 3.8-1.3 3.6.4 7.7 3.9 9.1zm64.4-5.6c-3.6 1.5-7.8-.2-9.1-3.7-1.5-3.6.2-7.8 3.8-9.2 3.6-1.4 7.7.3 9.2 3.9 1.3 3.5-.4 7.5-3.9 9zm15.9 9.3c-3.6 1.5-7.7-.2-9.1-3.7-1.5-3.6.2-7.8 3.7-9.1 3.6-1.5 7.7.2 9.2 3.8 1.5 3.5-.3 7.5-3.8 9zm4.7 17.7c-3.6 1.5-7.8-.2-9.2-3.8-1.5-3.6.2-7.7 3.9-9.1 3.6-1.5 7.7.3 9.2 3.8 1.3 3.5-.4 7.6-3.9 9.1zM89.3 35.8c-3.6 1.5-7.8-.2-9.2-3.8-1.4-3.6.2-7.7 3.9-9.1 3.6-1.5 7.7.3 9.2 3.8 1.4 3.6-.3 7.7-3.9 9.1zM69.7 17.7l8.9 4.7V9.3l-8.9 2.8c-.2-.3-.5-.6-.9-.9L72.4 0H59.6l3.5 11.2c-.3.3-.6.5-.9.9l-8.8-2.8v13.1l8.8-4.7c.3.3.6.7.9.9l-5 15.4v.1h14.2v-.1l-5-15.4c.4-.2.7-.6 1-.9zM66 92.8c16.9 0 32.8 1.1 47.1 3.2 4-16.9 8.9-26.7 14-33.5l-9.6-3.4c1 4.9 1.1 7.2 0 10.2-1.5-1.4-3-4.3-4.2-8.7L108.6 76c2.8-2 5-3.2 7.5-3.3-4.4 9.4-10 11.9-13.6 11.2-4.3-.8-6.3-4.6-5.6-7.9 1-4.7 5.7-5.9 8-.5 4.3-8.7-3-11.4-7.6-8.8 7.1-7.2 7.9-13.5 2.1-21.1-8 6.1-8.1 12.3-4.5 20.8-4.7-5.4-12.1-2.5-9.5 6.2 3.4-5.2 7.9-2 7.2 3.1-.6 4.3-6.4 7.8-13.5 7.2-10.3-.9-10.9-8-11.2-13.8 2.5-.5 7.1 1.8 11 7.3L80.2 60c-4.1 4.4-8 5.3-12.3 5.4 1.4-4.4 8-11.6 8-11.6H55.5s6.4 7.2 7.9 11.6c-4.2-.1-8-1-12.3-5.4l1.4 16.4c3.9-5.5 8.5-7.7 10.9-7.3-.3 5.8-.9 12.8-11.1 13.8-7.2.6-12.9-2.9-13.5-7.2-.7-5 3.8-8.3 7.1-3.1 2.7-8.7-4.6-11.6-9.4-6.2 3.7-8.5 3.6-14.7-4.6-20.8-5.8 7.6-5 13.9 2.2 21.1-4.7-2.6-11.9.1-7.7 8.8 2.3-5.5 7.1-4.2 8.1.5.7 3.3-1.3 7.1-5.7 7.9-3.5.7-9-1.8-13.5-11.2 2.5.1 4.7 1.3 7.5 3.3l-4.7-15.4c-1.2 4.4-2.7 7.2-4.3 8.7-1.1-3-.9-5.3 0-10.2l-9.5 3.4c5 6.9 9.9 16.7 14 33.5 14.8-2.1 30.8-3.2 47.7-3.2z"/>
      </svg>
      <span class="govuk-header__logotype-text">GOV.UK</span>
    </a>
    <span class="govuk-header__service-name">Prototype Engine</span>
  </div>
</header>
<main>
  <div class="two-col">
    <div>
      <h1>Build a GOV.UK prototype</h1>
      <p class="lede">Describe the service you need to prototype. One sentence is enough. Add a PDF or URL if you have more detail.</p>
      <form id="generateForm" enctype="multipart/form-data">
        <div>
          <label for="brief">Describe your service</label>
          <p class="hint">What does the user need to do, and why?</p>
          <textarea id="brief" name="brief" rows="5" placeholder="Example: A service for parents to apply for free school meals for their child."></textarea>
        </div>
        <div>
          <label for="pdf">Upload a PDF (optional)</label>
          <p class="hint">Policy documents, existing service specs, research findings.</p>
          <label class="file-upload-label" for="pdf">Choose file</label>
          <input type="file" id="pdf" name="pdf" accept=".pdf">
          <div class="file-name" id="fileName">No file chosen</div>
        </div>
        <div>
          <label for="url">Reference URL (optional)</label>
          <p class="hint">A live service or document to reference.</p>
          <input type="url" id="url" name="url" placeholder="https://www.gov.uk/example">
        </div>
        <button type="submit" class="generate-btn" id="generateBtn">
          <span id="btnText">Generate prototype</span>
          <svg class="btn-arrow" id="btnArrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60">
            <path d="M0 20h40l-8-8 4-4 16 16-16 16-4-4 8-8H0z"/>
          </svg>
        </button>
      </form>
      <div class="status-box" id="statusBox">
        <div class="status-title" id="statusTitle"></div>
        <div class="status-msg" id="statusMsg"></div>
        <a class="download-btn" id="downloadBtn" style="display:none">Download prototype</a>
      </div>
    </div>
    <div class="steps">
      <h2>How it works</h2>
      <ol>
        <li>Describe your service — one line or a full brief.</li>
        <li>Click Generate. Claude builds the prototype.</li>
        <li>Download the zip file.</li>
        <li>Unzip and run <code>npm install</code> then <code>npm start</code>.</li>
        <li>Open <code>localhost:3000</code> in your browser.</li>
      </ol>
    </div>
  </div>
</main>
<footer>Built on GOV.UK Prototype Kit v13 &middot; Powered by Claude</footer>
<script>
  document.getElementById('pdf').addEventListener('change', function() {
    document.getElementById('fileName').textContent = this.files[0] ? this.files[0].name : 'No file chosen';
  });
  document.getElementById('generateForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const btn = document.getElementById('generateBtn');
    const btnText = document.getElementById('btnText');
    const btnArrow = document.getElementById('btnArrow');
    const statusBox = document.getElementById('statusBox');
    const statusTitle = document.getElementById('statusTitle');
    const statusMsg = document.getElementById('statusMsg');
    const downloadBtn = document.getElementById('downloadBtn');
    btn.disabled = true;
    btnArrow.style.display = 'none';
    btnText.innerHTML = '<span class="spinner"></span> Generating…';
    statusBox.className = 'status-box visible';
    statusTitle.textContent = 'Building your prototype…';
    statusMsg.textContent = 'This takes around 30 seconds. Do not close this page.';
    downloadBtn.style.display = 'none';
    try {
      const formData = new FormData(this);
      const response = await fetch('/generate', { method: 'POST', body: formData });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Something went wrong');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      statusBox.className = 'status-box visible success';
      statusTitle.textContent = 'Your prototype is ready';
      statusMsg.textContent = 'Download it, unzip it, then run npm install and npm start.';
      downloadBtn.href = url;
      downloadBtn.download = 'prototype.zip';
      downloadBtn.style.display = 'inline-block';
    } catch (err) {
      statusBox.className = 'status-box visible error';
      statusTitle.textContent = 'Something went wrong';
      statusMsg.textContent = err.message || 'Try again. If it keeps failing, simplify your brief.';
    }
    btn.disabled = false;
    btnArrow.style.display = '';
    btnText.textContent = 'Generate prototype';
  });
</script>
</body>
</html>`);
});

app.post('/generate', upload.single('pdf'), async (req, res) => {
  try {
    const { brief, url } = req.body;
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' });
    if (!brief || brief.trim().length < 5) return res.status(400).json({ error: 'Please describe your service' });

    let userMessage = `Brief: ${brief.trim()}`;

    if (req.file) {
      try {
        const pdfData = await pdfParse(req.file.buffer);
        userMessage += `\n\nAdditional context from PDF:\n${pdfData.text.slice(0, 3000)}`;
      } catch (e) {}
    }

    if (url && url.trim()) userMessage += `\n\nReference URL: ${url.trim()}`;
    userMessage += '\n\nReturn only the JSON object. No explanation. No markdown.';

    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        system: gdsPrompt,
        messages: [{ role: 'user', content: userMessage }]
      })
    });

    if (!claudeResponse.ok) {
      const err = await claudeResponse.json();
      throw new Error(err.error?.message || 'Claude API error');
    }

    const claudeData = await claudeResponse.json();
    const rawText = claudeData.content[0].text.trim();

    let spec;
    try {
      const clean = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
      spec = JSON.parse(clean);
    } catch (e) {
      throw new Error('Claude returned invalid JSON. Try simplifying your brief.');
    }

    if (!spec.serviceName || !spec.questions || spec.questions.length < 2) {
      throw new Error('Prototype spec incomplete. Try again.');
    }

    const files = buildPrototypeFiles(spec);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="prototype.zip"');

    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.pipe(res);
    for (const [filePath, content] of Object.entries(files)) {
      archive.append(content, { name: filePath });
    }
    await archive.finalize();

  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Prototype Engine running on port ${port}`));
