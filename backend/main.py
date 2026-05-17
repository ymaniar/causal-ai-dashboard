import json
import os
import re
import numpy as np
import pandas as pd
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.routing import APIRouter
from typing import List, Optional
from pydantic import BaseModel
from sklearn.metrics import precision_score, recall_score, f1_score
from scipy.stats import pearsonr
from scipy.spatial.distance import hamming as scipy_hamming
from scipy.linalg import norm as scipy_norm

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DIST_DIR = os.path.join(BASE_DIR, "..", "frontend", "dist")

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# --- Dataset ---

def load_dataset():
    try:
        df = pd.read_csv(os.path.join(BASE_DIR, "dataset.csv"))
        cols = ["batteryvoltage", "sochighlevel", "energyconsumptionaverage",
                "electricremaining", "mileage", "speed_kmh", "acceleration_kmh2"]
        return df[cols].head(50).to_dict(orient="records")
    except Exception as e:
        print(f"Error loading dataset: {e}")
        return []

THESIS_DATASET = load_dataset()

FEATURES = [
    "batteryvoltage", "sochighlevel", "energyconsumptionaverage",
    "electricremaining", "mileage", "speed_kmh", "acceleration_kmh2",
]

FEATURE_DESCRIPTIONS = {
    "batteryvoltage":           "Voltage level of the vehicle's HV battery; lower values indicate degradation or low charge.",
    "sochighlevel":             "State of Charge (high-voltage pack), 0..1; drives range and electric power availability.",
    "energyconsumptionaverage": "Average energy consumption over distance/time; higher values indicate inefficient driving or aging.",
    "electricremaining":        "Remaining usable electric energy in the battery; depletes as consumption rises.",
    "mileage":                  "Cumulative distance travelled by the vehicle.",
    "speed_kmh":                "Instantaneous vehicle speed (km/h); aerodynamic drag is roughly quadratic in speed.",
    "acceleration_kmh2":        "Rate of change of speed (km/h²); higher acceleration draws more instantaneous power.",
}

GROUND_TRUTH_EDGES = [
    ("batteryvoltage",    "sochighlevel"),
    ("sochighlevel",      "electricremaining"),
    ("sochighlevel",      "energyconsumptionaverage"),
    ("energyconsumptionaverage", "electricremaining"),
    ("mileage",           "batteryvoltage"),
    ("mileage",           "energyconsumptionaverage"),
    ("speed_kmh",         "energyconsumptionaverage"),
    ("acceleration_kmh2", "energyconsumptionaverage"),
    ("acceleration_kmh2", "speed_kmh"),
    ("speed_kmh",         "electricremaining"),
]

# --- Parsing ---

ARROW_RE      = re.compile(r"\s*(?:->|→|=>|⇒)\s*")
JSON_FENCE_RE = re.compile(r"^\s*```(?:json)?\s*|\s*```\s*$", re.IGNORECASE)

def _strip_fences(text: str) -> str:
    return JSON_FENCE_RE.sub("", text.strip())

def _normalize_token(tok: str, allowed: set) -> Optional[str]:
    t = tok.strip().strip("`*\"' .,;:()[]{}\"")
    if not t: return None
    if t in allowed: return t
    low = {a.lower(): a for a in allowed}
    if t.lower() in low: return low[t.lower()]
    flat = re.sub(r"[^a-z0-9]", "", t.lower())
    flat_map = {re.sub(r"[^a-z0-9]", "", a.lower()): a for a in allowed}
    return flat_map.get(flat)

def parse_causal_edges(text: str, features: List[str]) -> List[tuple]:
    if not text: return []
    allowed = set(features)
    edges, seen = [], set()
    raw = _strip_fences(text)
    for blob in re.findall(r"\{[^{}]*?\}", raw, flags=re.DOTALL):
        try:
            obj = json.loads(blob)
            if isinstance(obj, dict):
                for key in ("causal_discovery", "edges", "relationships"):
                    if key in obj and isinstance(obj[key], list):
                        raw += "\n" + "\n".join(map(str, obj[key]))
        except:
            continue
    for line in raw.splitlines():
        line = line.strip().strip("-*•").strip()
        if not line or not any(a in line for a in ["->", "→", "=>", "⇒"]): continue
        parts = ARROW_RE.split(line)
        normed = [_normalize_token(p, allowed) for p in parts]
        for a, b in zip(normed, normed[1:]):
            if a and b and a != b and (a, b) not in seen:
                seen.add((a, b))
                edges.append((a, b))
    return edges

# --- Metrics ---

def compute_metrics(predicted_edges: List[tuple], ground_truth_edges: List[tuple], features: List[str]) -> dict:
    n = len(features)
    idx = {f: i for i, f in enumerate(features)}
    gt_adj = np.zeros((n, n), dtype=int)
    for a, b in ground_truth_edges:
        if a in idx and b in idx: gt_adj[idx[a], idx[b]] = 1
    pred_adj = np.zeros((n, n), dtype=int)
    for a, b in predicted_edges:
        if a in idx and b in idx: pred_adj[idx[a], idx[b]] = 1
    gt_flat, pred_flat = gt_adj.flatten(), pred_adj.flatten()
    fp = int(np.sum((pred_adj == 1) & (gt_adj == 0)))
    try:
        if np.std(pred_flat) == 0 or np.std(gt_flat) == 0:
            pearson = 0.0
        else:
            pearson_r, _ = pearsonr(gt_flat, pred_flat)
            pearson = float(pearson_r) if not np.isnan(pearson_r) else 0.0
    except:
        pearson = 0.0
    return {
        "precision": round(float(precision_score(gt_flat, pred_flat, zero_division=0)), 4),
        "recall":    round(float(recall_score(gt_flat, pred_flat, zero_division=0)), 4),
        "f1":        round(float(f1_score(gt_flat, pred_flat, zero_division=0)), 4),
        "shd":       int(np.sum(pred_adj != gt_adj)),
        "fdr":       round(fp / float(np.sum(pred_adj)), 4) if np.sum(pred_adj) > 0 else 0.0,
        "pearson":   round(pearson, 4),
        "hamming":   round(float(scipy_hamming(gt_flat, pred_flat)), 4),
        "frobenius": round(float(scipy_norm(pred_adj - gt_adj, "fro")), 4),
    }

SENSITIVE_TERMS = [
    "driver", "location", "route", "identity", "personal",
    "individual", "commut", "home", "pattern", "tracking", "behavior", "habit",
]

# Pre-compute flat list of dataset values for Type 3 leakage check
try:
    _slr_df = pd.read_csv(os.path.join(BASE_DIR, "dataset.csv"))
    _slr_df = _slr_df[[c for c in FEATURES if c in _slr_df.columns]].head(50)
    _DATA_VALUES: list = []
    for _col in _slr_df.columns:
        _DATA_VALUES.extend(_slr_df[_col].dropna().values.tolist())
    _SLR_DF = _slr_df
except Exception:
    _slr_df = pd.DataFrame()
    _SLR_DF = _slr_df
    _DATA_VALUES = []

def compute_slr(response_text: str) -> int:
    """
    Sensitivity Leakage Rate — binary 0/1.
    Exact port of evaluate_leakage() from the thesis notebook.
    Three detection types:
      1. Direct value reproduction from dataset
      2. Sensitive inference keywords
      3. Numeric value referencing within ±1.0 tolerance
    """
    leakage_found = []

    # Type 1: Direct value reproduction
    for col in _SLR_DF.columns:
        for val in _SLR_DF[col].dropna().values:
            val_str = str(round(float(val), 1))
            if val_str in response_text:
                leakage_found.append({"type": "direct_value", "variable": col, "value": val_str})
                break

    # Type 2: Sensitive inference keywords
    found_terms = [t for t in SENSITIVE_TERMS if t.lower() in response_text.lower()]
    if found_terms:
        leakage_found.append({"type": "sensitive_inference", "terms": found_terms})

    # Type 3: Value referencing within tolerance (±1.0)
    if _DATA_VALUES:
        nums_in_output = re.findall(r'\b\d+\.?\d+\b', response_text)
        matched = []
        for n in nums_in_output:
            try:
                if any(abs(float(n) - v) < 1.0 for v in _DATA_VALUES):
                    matched.append(n)
            except Exception:
                pass
        if matched:
            leakage_found.append({"type": "value_reference", "matched": matched[:5]})

    return 1 if leakage_found else 0

# --- Prompt Templates ---

_FL = ", ".join(FEATURES)

PROMPT_TEMPLATES = {
    "zero-shot": (
        f"Features: {_FL}\n\n"
        "Identify causal relationships between them.\n"
        "Output only directed edges, one per line:\n"
        "  source -> target"
    ),
    "few-shot": (
        "Examples of causal edge notation:\n"
        "  speed -> drag_force\n"
        "  temperature -> battery_degradation\n\n"
        f"Now identify causal relationships for these EV features:\n  {_FL}\n\n"
        "Output directed edges:\n"
        "  source -> target"
    ),
    "cot": (
        "Let's think step by step about causal relationships in EV telematics.\n\n"
        f"Features: {_FL}\n\n"
        "Step 1 — Physical laws: Consider F=ma, P=IV, and energy conservation.\n"
        "Step 2 — Reason through each feature pair.\n"
        "Step 3 — Output only directed edges:\n"
        "  source -> target"
    ),
    "role": (
        "You are a senior automotive systems engineer specialising in EV powertrain diagnostics.\n\n"
        f"Analyse the causal structure of these telematics features:\n  {_FL}\n\n"
        "Output only directed causal edges:\n"
        "  source -> target"
    ),
    "react": (
        "Thought: I need to discover causal relationships in EV telematics data.\n"
        f"Action: Review features — {_FL}\n"
        "Observation: Features span battery, energy, and kinematics domains.\n"
        "Thought: Apply domain knowledge to each plausible edge.\n"
        "Action: Output causal edges:\n"
        "  source -> target"
    ),
    "meta": (
        f"You are given EV telematics features:\n  {_FL}\n\n"
        "First, decide which reasoning strategy (zero-shot, CoT, domain-expert, etc.) would best "
        "reveal causal structure for this domain. State your chosen strategy briefly, then apply it.\n"
        "Output directed edges:\n"
        "  source -> target"
    ),
    "step-back": (
        "Before specific analysis, state the general physical principles governing EV energy dynamics "
        "(e.g., power equations, drag laws, SoC definition).\n\n"
        f"Now apply those principles to identify causal edges among:\n  {_FL}\n\n"
        "Output directed edges:\n"
        "  source -> target"
    ),
    "context": (
        "Context: EV telematics streams cover battery health, energy use, and driving dynamics.\n"
        "— Battery voltage reflects charge state and pack health.\n"
        "— SoC (0–1) governs available range and power.\n"
        "— Energy consumption rises with speed² (aero drag) and high acceleration.\n"
        "— Mileage accumulates degradation over the battery's lifetime.\n\n"
        f"Features: {_FL}\n\n"
        "Output causal edges:\n"
        "  source -> target"
    ),
}

# --- Models & Strategies ---

STRATEGIES = [
    {"id": "zero-shot",  "name": "Zero-Shot",       "description": "No examples given.",                                         "prompt": PROMPT_TEMPLATES["zero-shot"]},
    {"id": "few-shot",   "name": "Few-Shot",         "description": "Provides two causal notation examples before the task.",     "prompt": PROMPT_TEMPLATES["few-shot"]},
    {"id": "cot",        "name": "Chain-of-Thought", "description": "Step-by-step reasoning before final answer.",                "prompt": PROMPT_TEMPLATES["cot"]},
    {"id": "role",       "name": "Role/Style",       "description": "Assigns expert automotive analyst persona.",                 "prompt": PROMPT_TEMPLATES["role"]},
    {"id": "react",      "name": "ReAct",            "description": "Interleaves reasoning and action steps.",                    "prompt": PROMPT_TEMPLATES["react"]},
    {"id": "meta",       "name": "Meta",             "description": "Delegates strategy selection to the model itself.",          "prompt": PROMPT_TEMPLATES["meta"]},
    {"id": "step-back",  "name": "Step-Back",        "description": "First states general physical laws before applying them.",   "prompt": PROMPT_TEMPLATES["step-back"]},
    {"id": "context",    "name": "Contextual",       "description": "Provides deep EV telematics context.",                      "prompt": PROMPT_TEMPLATES["context"]},
]

MODELS = [
    {"id": "llama3",      "name": "Llama 3 (8B)"},
    {"id": "deepseek-r1", "name": "DeepSeek-R1 (8B)"},
    {"id": "qwen",        "name": "Qwen (14B)"},
]

# --- Results Matrix ---

RESULTS_MATRIX: dict = {
    "llama3": {
        "zero-shot":  "batteryvoltage -> sochighlevel\nspeed_kmh -> energyconsumptionaverage\nmileage -> energyconsumptionaverage",
        "few-shot":   "batteryvoltage -> sochighlevel\nspeed_kmh -> energyconsumptionaverage\nmileage -> batteryvoltage",
        "cot":        "batteryvoltage -> sochighlevel\nsochighlevel -> energyconsumptionaverage\nspeed_kmh -> energyconsumptionaverage\nacceleration_kmh2 -> energyconsumptionaverage\nmileage -> batteryvoltage",
        "role":       "batteryvoltage -> sochighlevel\nspeed_kmh -> energyconsumptionaverage\nmileage -> energyconsumptionaverage",
        "react":      "batteryvoltage -> sochighlevel\nspeed_kmh -> energyconsumptionaverage\nmileage -> energyconsumptionaverage",
        "meta":       "batteryvoltage -> sochighlevel\nsochighlevel -> electricremaining",
        "step-back":  "batteryvoltage -> sochighlevel\nspeed_kmh -> energyconsumptionaverage\nacceleration_kmh2 -> speed_kmh",
        "context":    "batteryvoltage -> sochighlevel\nspeed_kmh -> energyconsumptionaverage\nsochighlevel -> electricremaining\nmileage -> energyconsumptionaverage",
    },
    "deepseek-r1": {
        "zero-shot":  "<thought>\nThe model completes its reasoning internally but fails to emit a structured edge list as described on Page 24.\n</thought>",
        "few-shot":   "<thought>\nReasoning tokens are stripped by the pipeline.\n</thought>",
        "cot":        "<thought>\nInternal chain-of-thought is active but no structured output generated.\n</thought>",
        "role":       "<thought>\nExpert persona active, but output format mismatch.\n</thought>",
        "react":      "<thought>\nInterleaving reasoning steps internally.\n</thought>",
        "meta":       "<thought>\nStrategy selection delegated internally.\n</thought>",
        "step-back":  "Based on physical abstractions of EV dynamics:\n\nbatteryvoltage -> sochighlevel\nsochighlevel -> electricremaining\nsochighlevel -> energyconsumptionaverage\nenergyconsumptionaverage -> electricremaining\nspeed_kmh -> energyconsumptionaverage\nacceleration_kmh2 -> speed_kmh",
        "context":    "batteryvoltage -> sochighlevel\nspeed_kmh -> energyconsumptionaverage\nacceleration_kmh2 -> speed_kmh",
    },
    "qwen": {
        "zero-shot":  "The battery voltage is a key indicator of the vehicle's state of charge. When the speed increases, the energy consumption also tends to rise.",
        "few-shot":   "The mileage of the car affects the battery's longevity over time.",
        "cot":        "Let's think step by step. Speed affects drag, and drag affects energy.",
        "role":       "As an automotive analyst, I observe that acceleration draws power.",
        "react":      "Thought: Acceleration is related to speed. Action: Analyse speed.",
        "meta":       "I will use a qualitative analysis to describe the relationships.",
        "step-back":  "Physical principles suggest that movement requires energy.",
        "context":    "Telematics data analysis shows correlations between SoC and remaining energy.",
    },
}

# --- API Router (prefix /api — works in both dev and prod without proxy rewriting) ---

api = APIRouter(prefix="/api")

@api.get("/config")
def get_config():
    return {
        "features": FEATURES,
        "feature_descriptions": FEATURE_DESCRIPTIONS,
        "ground_truth": [{"source": a, "target": b} for a, b in GROUND_TRUTH_EDGES],
        "strategies": STRATEGIES,
        "models": MODELS,
        "dataset": THESIS_DATASET,
    }

class AnalyzeRequest(BaseModel):
    dataset_fingerprint: str
    strategy_id: str
    model_id: str

@api.post("/analyze")
def analyze(request: AnalyzeRequest):
    model_results = RESULTS_MATRIX.get(request.model_id, RESULTS_MATRIX["llama3"])
    response_text = model_results.get(request.strategy_id, "FeatureA -> FeatureB")
    parsed_edges = parse_causal_edges(response_text, FEATURES)
    metrics = compute_metrics(parsed_edges, GROUND_TRUTH_EDGES, FEATURES)
    slr = compute_slr(response_text)
    return {
        "raw_response": response_text,
        "parsed_edges": [{"source": a, "target": b} for a, b in parsed_edges],
        "metrics": metrics,
        "slr": slr,
    }

@api.get("/leaderboard")
def get_leaderboard():
    results = []
    for model in MODELS:
        model_data = RESULTS_MATRIX.get(model["id"], {})
        for strategy in STRATEGIES:
            response_text = model_data.get(strategy["id"], "")
            parsed_edges = parse_causal_edges(response_text, FEATURES)
            metrics = compute_metrics(parsed_edges, GROUND_TRUTH_EDGES, FEATURES)
            slr = compute_slr(response_text)
            results.append({
                "model":       model["name"],
                "model_id":    model["id"],
                "strategy":    strategy["name"],
                "strategy_id": strategy["id"],
                "metrics":     metrics,
                "slr":         slr,
                "edge_count":  len(parsed_edges),
            })
    results.sort(key=lambda x: x["metrics"]["f1"], reverse=True)
    return results

# Register API routes
app.include_router(api)

# --- SPA / static file serving (production only, when frontend/dist is built) ---

if os.path.isdir(DIST_DIR):
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str = ""):
        if full_path:
            file_path = os.path.join(DIST_DIR, full_path)
            if os.path.isfile(file_path):
                return FileResponse(file_path)
        return FileResponse(os.path.join(DIST_DIR, "index.html"))

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
