# Causal AI Dashboard

Interactive web dashboard for the Bachelor thesis **"Meta-Prompting and Reasoning-Based LLM Strategies for Sustainable Vehicle Telematics Optimization"** — Constructor University Bremen, 2026.

**Live demo:** https://causal-ai-dashboard.onrender.com

---

## What this is

This project showcases an empirical evaluation of eight LLM prompting strategies applied to causal discovery in electric vehicle (EV) telematics data. Three open-source language models are tested against a 10-edge expert ground truth causal graph, evaluated across eight structured metrics and a novel privacy risk metric (SLR).

---

## Research context

### Problem
EV telematics systems generate continuous streams covering battery state, energy consumption, and driving dynamics. As LLMs are increasingly used for data analysis, two questions arise:
1. Which prompting strategy produces the most accurate causal structure?
2. Does strategy choice affect sensitivity leakage risk?

### Models evaluated
| Model | Parameters | Architecture |
|---|---|---|
| Llama 3.1 | 8B | Meta — general instruction following |
| DeepSeek-R1 | 8B | DeepSeek — chain-of-thought reasoning specialist |
| Qwen3 | 14B | Alibaba — strong multilingual reasoning |

### Prompting strategies
| ID | Strategy | Description |
|---|---|---|
| Zero-Shot | Baseline | No examples, direct instruction |
| Few-Shot | Example-guided | Two causal notation examples before the task |
| Chain-of-Thought | Stepwise | Explicit step-by-step physical reasoning |
| Role/Style | Persona | Expert automotive analyst persona |
| ReAct | Reason+Act | Interleaved Thought / Action / Observation steps |
| Meta | Self-selection | Model chooses its own reasoning strategy |
| Step-Back | Abstraction | State general physical laws before applying them |
| Contextual | Rich context | Deep EV telematics domain context provided |

### Dataset features (7 variables)
| Feature | Description |
|---|---|
| `batteryvoltage` | HV battery voltage; lower = degraded or low charge |
| `sochighlevel` | State of Charge (0–1); governs range and power |
| `energyconsumptionaverage` | Average energy use; rises with speed and aging |
| `electricremaining` | Remaining usable energy in the battery |
| `mileage` | Cumulative distance; proxy for battery degradation |
| `speed_kmh` | Instantaneous speed; aerodynamic drag ∝ speed² |
| `acceleration_kmh2` | Rate of speed change; high values draw peak power |

### Ground truth causal graph (10 edges, expert-defined)
```
batteryvoltage      → sochighlevel
sochighlevel        → electricremaining
sochighlevel        → energyconsumptionaverage
energyconsumptionaverage → electricremaining
mileage             → batteryvoltage
mileage             → energyconsumptionaverage
speed_kmh           → energyconsumptionaverage
acceleration_kmh2   → energyconsumptionaverage
acceleration_kmh2   → speed_kmh
speed_kmh           → electricremaining
```

---

## Evaluation metrics

### Causal discovery accuracy (higher = better)
| Metric | Description |
|---|---|
| **Precision** | Fraction of predicted edges that are correct |
| **Recall** | Fraction of ground truth edges successfully recovered |
| **F1 Score** | Harmonic mean of precision and recall |
| **Pearson r** | Correlation between predicted and ground truth adjacency matrices |

### Structural error (lower = better)
| Metric | Description |
|---|---|
| **SHD** | Structural Hamming Distance — total edge insertions + deletions needed |
| **FDR** | False Discovery Rate — fraction of predicted edges that are false positives |
| **Hamming** | Normalised bit-flip distance between adjacency matrices |
| **Frobenius** | Matrix norm of the adjacency difference |

### Privacy risk
| Metric | Description |
|---|---|
| **SLR** | Sensitivity Leakage Rate — binary (0 = clean, 1 = leaked) |

**SLR** is a novel metric introduced in this thesis. It detects leakage via three mechanisms:
- **Type 1 — Direct value reproduction:** exact dataset values appear in the model response
- **Type 2 — Sensitive keyword inference:** terms like "driver", "location", "route", "identity", "pattern", "tracking"
- **Type 3 — Value referencing:** numbers in the response match any dataset value within ±1.0 tolerance

Any leakage detection sets SLR = 1.

---

## Key findings

- **Llama 3.1 8B** consistently parsed structured causal graphs across all strategies.
- **DeepSeek-R1** required explicit output scaffolding (Step-Back prompt) to unlock its reasoning capability; most other strategies produced no parseable edge list.
- **Qwen3 14B** defaulted to natural language descriptions rather than structured edge notation, yielding zero parsed edges across all strategies.
- The **constrained edge-notation output format** (enforced by the prompt) effectively suppressed SLR leakage — prompt *scope*, not strategy *type*, is the primary driver of data exposure.

---

## Dashboard features

| Tab | What it shows |
|---|---|
| **The Research** | Thesis overview, abstract insight, links to thesis PDF |
| **Prompt Lab** | Dataset preview, feature descriptions, full prompt text, live model response |
| **Analysis** | Side-by-side causal graph comparison (ground truth vs prediction with TP/FP/missed edge coloring), all 8 metrics, strategy performance bar chart |
| **Leaderboard** | All 24 model × strategy combinations ranked by F1, with SLR status per row |

---

## Project structure

```
causal-ai-dashboard/
├── backend/
│   ├── main.py           # FastAPI app — /api/config, /api/analyze, /api/leaderboard
│   ├── dataset.csv       # 50-row EV telematics dataset
│   └── requirements.txt  # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── App.tsx                    # Main app — all 4 tabs, leaderboard, state
│   │   ├── components/
│   │   │   ├── CausalGraph.tsx        # ReactFlow graph with TP/FP/missed edge coloring
│   │   │   └── MetricsPanel.tsx       # 8-metric grid with directional indicators
│   │   └── assets/
│   │       └── hero.png               # Hero image for the About tab
│   ├── public/
│   │   └── Thesis_Maniar_Overleaf.pdf # Full thesis PDF served statically
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
├── render.yaml           # Render deployment config
└── .gitignore
```

---

## Tech stack

**Backend**
- Python 3.11, FastAPI, Uvicorn
- NumPy, Pandas, scikit-learn, SciPy
- Serves the built React SPA in production

**Frontend**
- React 18, TypeScript, Vite
- Tailwind CSS v4 (glassmorphism, custom cyber color palette)
- Framer Motion (page transitions, animated bars)
- ReactFlow (interactive causal graph)
- Lucide React (icons), Axios (API calls)

---

## Running locally

**Backend**
```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
python main.py
# → http://localhost:8000
```

**Frontend** (separate terminal)
```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

The Vite dev server proxies `/api/*` to `localhost:8000`, so both run independently.

---

## Deployment

The app is deployed as a single service on **Render** (free tier). The build step compiles the React frontend; the FastAPI backend then serves both the API and the compiled SPA.

```yaml
# render.yaml
buildCommand: pip install -r backend/requirements.txt && cd frontend && npm ci && npm run build
startCommand: python backend/main.py
```

Note: the free tier spins down after inactivity — first request after idle may take ~50 seconds.

---

## Author

**Yahya Maniar** — Constructor University Bremen, Bachelor of Science, 2026

Thesis supervised at the intersection of causal inference, large language models, and sustainable mobility.
