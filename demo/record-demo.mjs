// Records a captioned walkthrough of every AI tool and feature in the AIVOA
// Deviation Intake module.
//
//   cd demo && npm install && npx playwright install chromium
//   node record-demo.mjs https://<your-app>.onrender.com
//
// Output: demo/output/aivoa-demo.webm (and .mp4 if ffmpeg is installed).
// The script waits on the app's own signals (progress bar, "Thinking..."), so
// it works with real Groq responses whatever their exact wording.

import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, renameSync, readdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const BASE_URL = (process.argv[2] || process.env.BASE_URL || 'http://localhost:8000').replace(/\/$/, '')
const NOTE = process.env.DEMO_NOTE || '' // optional line shown on the title card
const OUT_DIR = path.join(HERE, 'output')
const SAMPLES = path.join(HERE, 'samples')
const W = 1920
const H = 1080

const PASTE_TEXT =
  'QC lab update 22-Sep-2026: Routine release testing of Metformin HCl API batch MTF-2609-031 gave an ' +
  'assay of 94.1% against the specification of 98.0-102.0%. System suitability passed and the analyst ' +
  'found no obvious lab error. Phase I OOS investigation started; batch remains in quarantine.'

const CHAT_LOG_TEXT =
  'Night shift report: cold room 2 in the warehouse went up to 12 C (limit 2-8 C) for about 3 hours on ' +
  '24 Sep 2026 after the compressor tripped. 40 drums of Amoxicillin Trihydrate batch AMX-2609-007 were ' +
  'inside. Stock moved to cold room 1 and put on hold.'

// ---------------------------------------------------------------------------
// In-page overlay: captions, chapter cards, a visible cursor, highlights.
// ---------------------------------------------------------------------------
const OVERLAY = () => {
  const css = `
  #demo-cap{position:fixed;left:50%;bottom:34px;transform:translateX(-50%);max-width:1250px;z-index:99999;
    background:rgba(15,23,42,.92);color:#fff;font:500 23px/1.45 Inter,system-ui,sans-serif;padding:16px 28px;
    border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.25);transition:opacity .35s;opacity:0;pointer-events:none;text-align:center}
  #demo-cap b{color:#93b4ff;font-weight:700}
  #demo-card{position:fixed;inset:0;z-index:99998;display:flex;align-items:center;justify-content:center;
    background:linear-gradient(135deg,#0f172a 0%,#1e3a8a 100%);color:#fff;font-family:Inter,system-ui,sans-serif;
    transition:opacity .5s;opacity:0;pointer-events:none}
  #demo-card .in{max-width:1560px;padding:0 60px}
  #demo-card .k{font-size:22px;letter-spacing:.18em;text-transform:uppercase;color:#93b4ff;font-weight:600;margin-bottom:18px}
  #demo-card h1{font-size:64px;line-height:1.1;margin:0 0 20px;font-weight:700;letter-spacing:-.02em}
  #demo-card p{font-size:27px;line-height:1.5;color:#cbd5e1;margin:0 0 10px}
  #demo-card ul{font-size:25px;line-height:1.75;color:#e2e8f0;margin:22px 0 0;padding-left:30px}
  #demo-card .note{margin-top:34px;font-size:19px;color:#94a3b8}
  #demo-card table{border-collapse:collapse;font-size:18px;margin-top:26px;width:100%;background:rgba(255,255,255,.04)}
  #demo-card th,#demo-card td{border-bottom:1px solid rgba(255,255,255,.15);padding:10px 14px;text-align:left}
  #demo-card th{color:#93b4ff;font-weight:600}
  #demo-card .flow{display:flex;gap:12px;align-items:center;flex-wrap:nowrap;margin-top:26px;font-size:19px}
  #demo-card .flow span{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);border-radius:10px;padding:10px 16px}
  #demo-card .flow i{color:#93b4ff;font-style:normal}
  #demo-cursor{position:fixed;z-index:100000;width:22px;height:22px;margin:-3px 0 0 -3px;pointer-events:none;
    transition:transform .12s}
  #demo-cursor.down{transform:scale(.8)}
  .demo-hl{outline:4px solid #f59e0b !important;outline-offset:4px;border-radius:10px;transition:outline-color .3s}`
  const boot = () => {
    if (document.getElementById('demo-cap')) return
    const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s)
    const cap = document.createElement('div'); cap.id = 'demo-cap'; document.body.appendChild(cap)
    const card = document.createElement('div'); card.id = 'demo-card'; card.innerHTML = '<div class="in"></div>'
    document.body.appendChild(card)
    const cur = document.createElement('div'); cur.id = 'demo-cursor'
    cur.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M3 2l7.5 19 2.6-7.9L21 10.5z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>'
    cur.style.left = '-50px'; document.body.appendChild(cur)
    addEventListener('mousemove', (e) => { cur.style.left = e.clientX + 'px'; cur.style.top = e.clientY + 'px' }, true)
    addEventListener('mousedown', () => cur.classList.add('down'), true)
    addEventListener('mouseup', () => cur.classList.remove('down'), true)
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot()
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  const tmpVideoDir = path.join(OUT_DIR, 'raw')
  rmSync(tmpVideoDir, { recursive: true, force: true })

  // Wake the service (free Render instances sleep) before recording starts.
  process.stdout.write(`Waking ${BASE_URL} ...`)
  for (let i = 0; i < 30; i++) {
    try { const r = await fetch(`${BASE_URL}/api/health`); if (r.ok) break } catch {}
    await sleep(4000); process.stdout.write('.')
  }
  console.log(' ok')

  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: W, height: H },
    recordVideo: { dir: tmpVideoDir, size: { width: W, height: H } },
  })
  await context.addInitScript(OVERLAY)
  const page = await context.newPage()
  page.setDefaultTimeout(120000)

  // ---- helpers -------------------------------------------------------------
  const caption = async (html, holdMs = 0) => {
    await page.evaluate((h) => {
      const c = document.getElementById('demo-cap'); c.innerHTML = h; c.style.opacity = h ? 1 : 0
    }, html)
    if (holdMs) await sleep(holdMs)
  }
  const card = async (html, holdMs) => {
    await caption('')
    await page.evaluate((h) => {
      const c = document.getElementById('demo-card'); c.firstChild.innerHTML = h; c.style.opacity = 1
    }, html)
    await sleep(holdMs)
    await page.evaluate(() => { document.getElementById('demo-card').style.opacity = 0 })
    await sleep(600)
  }
  const chapter = (n, title, sub) =>
    card(`<div class="k">${n}</div><h1>${title}</h1><p>${sub}</p>`, 3200)

  let mouse = { x: W - 120, y: H - 120 }
  const moveTo = async (locator, { dx = 0, dy = 0 } = {}) => {
    await locator.scrollIntoViewIfNeeded()
    const b = await locator.boundingBox()
    const x = b.x + b.width / 2 + dx, y = b.y + Math.min(b.height / 2, 24) + dy
    await page.mouse.move(x, y, { steps: 28 })
    mouse = { x, y }
    await sleep(250)
  }
  const click = async (locator, opts) => { await moveTo(locator, opts); await locator.click(); await sleep(350) }
  const highlight = async (locators, ms) => {
    for (const l of locators) await l.evaluate((el) => el.classList.add('demo-hl'))
    await sleep(ms)
    for (const l of locators) await l.evaluate((el) => el.classList.remove('demo-hl'))
  }

  const assistantMsgs = page.locator('.thin-scroll > div')
  const chatInput = page.getByPlaceholder('Ask me anything about deviations...')
  const saveBtn = page.getByRole('button', { name: 'Save Deviation' })
  const resetBtn = page.getByRole('button', { name: 'Reset Form' })

  const waitExtraction = async () => {
    await page.getByText('Extraction Progress').waitFor({ state: 'visible' })
    await page.getByText('Extraction Progress').waitFor({ state: 'hidden' })
    await sleep(900)
  }
  const waitChat = async (before) => {
    await page.waitForFunction((n) => {
      const items = document.querySelectorAll('.thin-scroll > div')
      return items.length >= n + 2 && !document.body.innerText.includes('Thinking...')
    }, before)
    await sleep(900)
  }
  const sendChat = async (text, delay = 28) => {
    const before = await assistantMsgs.count()
    await click(chatInput)
    await chatInput.pressSequentially(text, { delay })
    await sleep(400)
    await chatInput.press('Enter')
    await waitChat(before)
  }
  const save = async () => {
    await click(saveBtn)
    await page.getByText('Deviation saved successfully').waitFor()
    await sleep(600)
  }

  // ---- 0. Title -------------------------------------------------------------
  await page.goto(BASE_URL)
  await page.getByText('Log Deviation').first().waitFor()
  await page.mouse.move(mouse.x, mouse.y)
  await card(`
    <div class="k">Project demonstration</div>
    <h1>AIVOA — AI-Powered Deviation Intake</h1>
    <p>Deviation document or notes → AI extraction → Log Deviation form → AI impact &amp; severity → review → save</p>
    <ul>
      <li>AI extraction from uploaded documents (PDF, DOCX, XLSX, TXT) and scanned images (OCR)</li>
      <li>AI extraction from pasted notes / emails, and logging a deviation straight from chat</li>
      <li>AI impact &amp; severity assessment with a written justification</li>
      <li>AI edits by chat instruction, and a Q&amp;A assistant</li>
      <li>Human review with AI provenance badges, save to database, reset</li>
    </ul>
    ${NOTE ? `<div class="note">${NOTE}</div>` : ''}`, 9000)

  // ---- 1. Tour --------------------------------------------------------------
  await caption('The <b>Log Deviation</b> page: the QMS form on the left…', 0)
  await highlight([page.locator('form').first()], 2600)
  await caption('…and the <b>AI Deviation Assistant</b> on the right — upload, paste, or chat.', 0)
  await highlight([page.getByText('AI Deviation Assistant').locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]')], 2800)
  await caption('')

  // ---- 2. PDF extraction + assessment --------------------------------------
  await chapter('AI tool 1', 'Document extraction', 'Upload a deviation report — the AI reads it and fills the form.')
  await moveTo(page.getByText('Drag & drop supporting document here'))
  await caption('Uploading <b>Deviation_Report_DR-2026-0147.pdf</b> — a real incident report from production.')
  await sleep(1200)
  await page.locator('input[type=file]').setInputFiles(path.join(SAMPLES, 'Deviation_Report_DR-2026-0147.pdf'))
  await caption('Progress is streamed live from the backend while the <b>LangGraph</b> workflow runs: <b>extract_fields → assess_impact_severity</b>.')
  await waitExtraction()
  await caption('Every field is filled from the PDF. The <b>✦ AI</b> badge marks each value the AI wrote.', 0)
  await highlight([page.locator('form').first()], 3500)

  await chapter('AI tool 2', 'Impact & severity assessment', 'A second, focused AI step triages the deviation like a QA reviewer.')
  await caption('The assessment node recommends <b>Initial Impact</b> and <b>Initial Severity</b>…', 0)
  await moveTo(page.locator('select').nth(2))
  await highlight([page.locator('select').nth(2), page.locator('select').nth(3)], 3000)
  await caption('…and explains why in the assistant panel, so the reviewer can judge the call.', 0)
  await moveTo(assistantMsgs.last())
  await highlight([assistantMsgs.last()], 4500)

  // ---- 3. Human review, save, reset ----------------------------------------
  await chapter('Review & save', 'Human in the loop', 'Nothing is saved until a person reviews it.')
  const titleInput = page.getByPlaceholder('e.g. OOS result for Assay in Batch ABC-001')
  await caption('Editing a field by hand <b>removes its AI badge</b> — the record keeps track of what the AI wrote vs. what a person confirmed.')
  await click(titleInput)
  await titleInput.press('End')
  await titleInput.pressSequentially(' – batch on QA hold', { delay: 45 })
  await sleep(1800)
  await caption('<b>Save Deviation</b> stores the record through the REST API (<b>POST /api/deviations</b>).')
  await save()
  await sleep(1800)
  await caption('<b>Reset Form</b> clears everything for the next deviation.')
  await click(resetBtn)
  await sleep(1800)
  await caption('')

  // ---- 4. Paste notes -------------------------------------------------------
  await chapter('AI tool 3', 'Paste notes or an email', 'No document? Paste the text and get the same extraction.')
  await click(page.getByText('Paste deviation details / notes'))
  const pasteBox = page.getByPlaceholder('e.g. On 20-Sep', { exact: false })
  await caption('Pasting a QC lab message about an <b>out-of-specification assay</b>.')
  await pasteBox.pressSequentially(PASTE_TEXT, { delay: 6 })
  await sleep(900)
  await click(page.getByRole('button', { name: 'Extract details' }))
  await waitExtraction()
  await caption('Form filled from free text, with <b>Source = QC Laboratory</b> and a severity suggestion.', 3800)

  // ---- 5. Edit via chat -----------------------------------------------------
  await chapter('AI tool 4', 'Edit by chat', 'Tell the assistant what to change — only that field changes.')
  await caption('Asking the assistant to <b>raise the severity</b>…')
  await sendChat('Set severity to Critical')
  await caption('Only <b>Initial Severity</b> changed. Every other field is untouched.', 0)
  await moveTo(page.locator('select').nth(3))
  await highlight([page.locator('select').nth(3)], 3200)
  await caption('Correcting a <b>typo in the batch number</b> the same way…')
  await sendChat('The batch number is actually MTF-2609-013')
  await moveTo(page.getByPlaceholder('Enter batch / lot no.'))
  await highlight([page.getByPlaceholder('Enter batch / lot no.')], 3000)
  await caption('Saving the corrected record.')
  await save()
  await click(resetBtn)
  await caption('')

  // ---- 6. Log via chat ------------------------------------------------------
  await chapter('AI tool 5', 'Log a deviation from chat', 'Type or paste a report into the chat box — the assistant recognises it and fills the form.')
  await caption('The chat box routes each message by intent: <b>log</b>, <b>edit</b> or <b>chat</b>. This one is a new report.')
  await sendChat(CHAT_LOG_TEXT, 8)
  await caption('Recognised as a new deviation — form filled, <b>Source = Warehouse / Storage</b>, impact & severity suggested.', 3800)
  await save()

  // ---- 7. Q&A ---------------------------------------------------------------
  await chapter('AI tool 6', 'Ask the assistant', 'Questions get an answer — the form is left alone.')
  await caption('A plain question is routed to <b>chat</b>: no fields change.')
  await sendChat("What's the difference between a Major and a Critical deviation?", 22)
  await moveTo(assistantMsgs.last())
  await highlight([assistantMsgs.last()], 6000)
  await click(resetBtn)
  await caption('')

  // ---- 8. Image OCR ---------------------------------------------------------
  await chapter('AI tool 7', 'Scanned note (OCR)', 'A photo of a shift note → OCR → the same AI pipeline.')
  await moveTo(page.getByText('Drag & drop supporting document here'))
  await caption('Uploading <b>shift_note_packaging_line3.jpg</b> — the image is read with Tesseract OCR first.')
  await sleep(1000)
  await page.locator('input[type=file]').setInputFiles(path.join(SAMPLES, 'shift_note_packaging_line3.jpg'))
  await waitExtraction()
  await caption('A labelling mix-up is a patient-safety risk — the assessment reflects that and explains why.', 0)
  await moveTo(page.locator('select').nth(3))
  await highlight([page.locator('select').nth(2), page.locator('select').nth(3), assistantMsgs.last()], 5000)
  await save()
  await caption('')

  // ---- 9. Saved records via API --------------------------------------------
  const rows = await page.evaluate(async () => {
    const r = await fetch('/api/deviations'); const d = await r.json()
    return d.map((x) => [x.id.slice(0, 8), x.title, x.batch_lot_number, x.source, x.initial_severity,
      (x.ai_generated_fields || []).length])
  })
  const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
  await card(`
    <div class="k">Stored in the database</div>
    <h1>GET /api/deviations</h1>
    <p>Every saved deviation, with the list of fields the AI generated kept for audit.</p>
    <table><tr><th>ID</th><th>Title</th><th>Batch</th><th>Source</th><th>Severity</th><th>AI fields</th></tr>
    ${rows.slice(-6).map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table>`, 8000)

  // ---- 10. Architecture / end ----------------------------------------------
  await card(`
    <div class="k">How it works</div>
    <h1>Architecture</h1>
    <div class="flow"><span>React + Redux Toolkit</span><i>→</i><span>FastAPI · REST + SSE</span><i>→</i>
      <span>LangGraph: extract_fields → assess_impact_severity</span><i>→</i><span>Groq · Llama 3.3 70B</span></div>
    <div class="flow"><span>Chat router: log · edit · chat</span><span>Parsers: PDF · DOCX · XLSX · OCR</span>
      <span>SQLAlchemy → PostgreSQL / SQLite</span><span>One Docker image on Render</span></div>
    <p style="margin-top:40px">Thank you.</p>`, 8000)

  await context.close()
  await browser.close()

  const raw = readdirSync(tmpVideoDir).find((f) => f.endsWith('.webm'))
  const webm = path.join(OUT_DIR, 'aivoa-demo.webm')
  renameSync(path.join(tmpVideoDir, raw), webm)
  rmSync(tmpVideoDir, { recursive: true, force: true })
  console.log('Saved', webm)
  try {
    const mp4 = path.join(OUT_DIR, 'aivoa-demo.mp4')
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', webm, '-c:v', 'libx264', '-preset', 'medium',
      '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4])
    console.log('Saved', mp4)
  } catch { console.log('(ffmpeg not found — the .webm plays in any browser and uploads to YouTube/Drive as-is)') }
}

main().catch((e) => { console.error(e); process.exit(1) })
