# ⚖ LexAgent — Autonomous Contract Review Agent

> Upload any contract. Get a risk score, redlines, and action plan in under 60 seconds.

---

## Overview

LexAgent is a fully autonomous multi-agent system that ingests a contract (PDF, DOCX, or plain text), runs it through **5 specialised AI agents**, and produces:

- **Risk score** (0–100)
- **Clause-by-clause redlines** with before/after diffs
- **Missing clause alerts** (GDPR DPA, SLA, etc.)
- **Prioritised action checklist**
- **Plain-English executive summary**

---

## Architecture

```
Upload → Parse Agent → Flag Agent → Compare Agent → Redline Agent → Report Agent
           ↓              ↓               ↓               ↓              ↓
        Clauses       Risk JSON      Playbook +       Redlined      Final Report
                                    GDPR check        Clauses        (JSON/UI)
```

| Agent   | Role                                      | Key Tech                        |
|---------|-------------------------------------------|---------------------------------|
| Parse   | Extract & segment clauses                 | PyPDF2, python-docx, regex      |
| Flag    | Risk-score each clause                    | Claude tool-use (structured JSON) |
| Compare | Check playbook + GDPR rules               | JSON rules engine               |
| Redline | Generate market-standard replacements     | Claude (constrained prompting)  |
| Report  | Assemble scorecard, diffs, action plan    | Python, diff-match-patch        |

---

## Tech Stack

**Backend:** Python 3.11, FastAPI, Anthropic SDK (`claude-sonnet-4-20250514`), PyPDF2, python-docx, diff-match-patch  
**Frontend:** React 18, Vite, Tailwind CSS, Recharts, Zustand, react-dropzone

---

## Quick Start

### 1. Clone & configure

```bash
git clone https://github.com/yourname/lexagent
cd lexagent

# Backend env
cp backend/.env.example backend/.env
# Add your Anthropic API key to backend/.env

# Frontend env
cp frontend/.env.example frontend/.env
```

### 2. Run with Docker Compose

```bash
docker-compose up --build
```

- Frontend: http://localhost:5173  
- Backend API: http://localhost:8000  
- API docs: http://localhost:8000/docs

### 3. Run locally (without Docker)

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

---

## API Endpoints

| Method | Path             | Description                           |
|--------|------------------|---------------------------------------|
| POST   | `/api/review`    | Upload PDF/DOCX/TXT for review        |
| POST   | `/api/review/text` | Submit raw contract text for review |
| GET    | `/health`        | Health check                          |

### Example — Upload a file

```bash
curl -X POST http://localhost:8000/api/review \
  -F "file=@my_contract.pdf"
```

### Example — Paste text

```bash
curl -X POST http://localhost:8000/api/review/text \
  -H "Content-Type: application/json" \
  -d '{"text": "1. LIABILITY\nLiability is capped at $500..."}'
```

---

## Running Tests

```bash
cd backend
pytest tests/ -v
```

Tests use mocked Claude API calls — no API key required for the test suite.

---

## Project Structure

```
lexagent/
├── backend/
│   ├── app/
│   │   ├── agents/
│   │   │   ├── parse_agent.py      # Agent 1: clause extraction
│   │   │   ├── flag_agent.py       # Agent 2: Claude tool-use risk scoring
│   │   │   ├── compare_agent.py    # Agent 3: playbook + GDPR checks
│   │   │   ├── redline_agent.py    # Agent 4: replacement text generation
│   │   │   └── report_agent.py     # Agent 5: final report assembly
│   │   ├── rules/
│   │   │   ├── gdpr.json           # GDPR mandatory clause rules
│   │   │   └── playbook.json       # Company negotiation positions
│   │   ├── tools/
│   │   │   └── flag_clause_schema.py  # Claude tool-use schema
│   │   ├── api.py                  # FastAPI routes
│   │   ├── main.py                 # App entry point + CORS
│   │   └── orchestrator.py         # Pipeline runner
│   └── tests/
│       ├── sample_contracts/
│       │   └── saas_risky.txt      # Demo contract with deliberate risks
│       ├── test_parse.py
│       ├── test_flag.py
│       └── test_pipeline.py
├── frontend/
│   └── src/
│       ├── api/client.js           # Backend API calls
│       ├── components/
│       │   ├── PipelineProgress    # Animated agent stage tracker
│       │   ├── RiskScorecard       # Gauge + risk counts
│       │   ├── ClauseTable         # Expandable clause list
│       │   ├── DiffView            # Red/green before-after diffs
│       │   ├── MissingClauses      # Missing clause alerts
│       │   └── ActionChecklist     # Prioritised action items
│       ├── pages/
│       │   ├── UploadPage.jsx      # Drag-and-drop + paste upload
│       │   └── ResultsPage.jsx     # Full report with tabs
│       ├── store.js                # Zustand global state
│       └── App.jsx                 # Route between upload / results
└── docker-compose.yml
```

---

## Demo Script (2 min)

1. Open http://localhost:5173
2. Drop `backend/tests/sample_contracts/saas_risky.txt` onto the upload zone
3. Watch the pipeline: Parse → Flag → Compare → Redline → Report
4. Point to the risk score (should be ~30–40/100)
5. Click the liability cap clause → show the $500 → $50,000 redline
6. Click the GDPR missing clause alert
7. Show the Action Checklist tab

---

## Environment Variables

**Backend (`backend/.env`):**

| Variable           | Default                     | Description              |
|--------------------|-----------------------------|--------------------------|
| `ANTHROPIC_API_KEY` | —                          | **Required.** Your key.  |
| `MODEL`            | `claude-sonnet-4-20250514`  | Claude model to use      |
| `MAX_TOKENS`       | `4096`                      | Max tokens per call      |

**Frontend (`frontend/.env`):**

| Variable             | Default                  | Description         |
|----------------------|--------------------------|---------------------|
| `VITE_API_BASE_URL`  | `http://localhost:8000`  | Backend base URL    |

---

## Post-Hackathon Roadmap

- [ ] Negotiation coach mode (how to push back in conversation)
- [ ] Playbook builder UI (legal team configures clause positions)
- [ ] Multi-party contract comparison (your form vs counterparty redlines)
- [ ] DocuSign integration (review before signing)
- [ ] Slack bot (`/lexagent review [url]`)
- [ ] DOCX export with tracked changes

---

## Licence

MIT — built for the 48-hour hackathon. See `LICENSE` for details.
