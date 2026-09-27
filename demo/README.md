# Demo video recorder

Records a captioned ~3.5-minute walkthrough of every AI tool and feature,
driving the real app in a browser:

1. Document extraction (PDF upload) with live progress
2. AI impact & severity assessment with justification
3. Human review (AI badges, manual edit), save, reset
4. Paste notes / email extraction
5. Edit by chat ("Set severity to Critical", batch-number correction)
6. Log a deviation straight from chat
7. Q&A chat (form untouched)
8. Scanned image → OCR → extraction
9. Saved records via `GET /api/deviations`, architecture summary

## Record against your live deployment (real Groq responses)

Needs Node.js 18+.

```bash
cd demo
npm install
npx playwright install chromium
node record-demo.mjs https://<your-app>.onrender.com
```

Output: `demo/output/aivoa-demo.webm`, plus `aivoa-demo.mp4` if `ffmpeg` is installed.
The recording saves 4 sample deviations to the target database.
Sample input files are in `demo/samples/`.
