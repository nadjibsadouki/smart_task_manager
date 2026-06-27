from flask import Flask, jsonify, request
from flask_cors import CORS
import html
import json
import re
import requests


app = Flask(__name__)
CORS(app)

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "llama3.2:1b"

AI_FIELDS = (
    "priority",
    "urgency",
    "advice",
    "next_action",
    "risk",
    "daily_summary",
    "ai_score",
    "ai_note",
)
ALLOWED_PRIORITIES = {"Faible", "Moyenne", "Haute"}
ALLOWED_URGENCIES = {"Faible", "Modérée", "Élevée"}


def clean_text(value):
    text = html.unescape(str(value or ""))
    return re.sub(r"\s+", " ", text.replace("\u00a0", " ")).strip()


def _contains_any(text, words):
    return any(word in text for word in words)


def fallback_analysis(text):
    original = clean_text(text)
    lowered = original.lower()

    important_context = _contains_any(
        lowered,
        [
            "étude",
            "etud",
            "travail",
            "projet",
            "examen",
            "réunion",
            "reunion",
            "devoir",
            "client",
            "deadline",
            "échéance",
            "echeance",
        ],
    )
    close_deadline = _contains_any(
        lowered,
        [
            "aujourd'hui",
            "ce soir",
            "demain",
            "urgent",
            "vite",
            "avant midi",
            "dans 1 heure",
            "dans une heure",
            "deadline",
            "échéance proche",
            "echeance proche",
        ],
    )
    optional = _contains_any(lowered, ["facultatif", "optionnel", "si j'ai le temps", "pas urgent"])
    vague = len(original.split()) < 4

    if close_deadline and important_context and not optional:
        priority = "Haute"
        urgency = "Élevée"
        score = 58
    elif important_context and not optional:
        priority = "Moyenne"
        urgency = "Modérée" if not close_deadline else "Élevée"
        score = 66
    elif close_deadline and not optional:
        priority = "Moyenne"
        urgency = "Élevée"
        score = 62
    else:
        priority = "Faible" if optional or not important_context else "Moyenne"
        urgency = "Faible" if optional or not close_deadline else "Modérée"
        score = 74 if not vague else 48

    if vague:
        advice = "La demande est encore vague : clarifiez le résultat attendu, puis choisissez une première action courte."
        next_action = "Reformuler la tâche en une phrase précise avec un livrable et une échéance."
        risk = "Risque principal à éviter : commencer sans objectif clair et perdre du temps."
        daily_summary = "Aujourd'hui, clarifiez cette demande avant de la planifier ou de la traiter."
    elif close_deadline:
        advice = f"Traitez cette demande en priorité aujourd'hui : {original}. Découpez-la en un premier bloc court, puis vérifiez l'avancement."
        next_action = "Bloquer immédiatement 25 minutes et commencer par la partie la plus urgente ou la plus difficile."
        risk = "Risque principal à éviter : repousser jusqu'à manquer de temps pour corriger ou finaliser."
        daily_summary = "Aujourd'hui, concentrez-vous d'abord sur cette tâche à échéance proche, puis terminez par une vérification rapide."
    else:
        advice = f"Organisez cette demande de façon progressive : {original}. Commencez par définir le résultat attendu, puis avancez par étapes."
        next_action = "Définir la première étape concrète et la programmer dans un créneau court."
        risk = "Risque principal à éviter : laisser la tâche trop générale et difficile à démarrer."
        daily_summary = "Aujourd'hui, transformez cette demande en action concrète et réaliste."

    if score < 40:
        note_level = "organisation faible"
    elif score < 70:
        note_level = "organisation moyenne"
    else:
        note_level = "bonne organisation"

    return {
        "priority": priority,
        "urgency": urgency,
        "advice": clean_text(advice),
        "next_action": clean_text(next_action),
        "risk": clean_text(risk),
        "daily_summary": clean_text(daily_summary),
        "ai_score": str(max(0, min(100, int(score)))),
        "ai_note": clean_text(f"{note_level.capitalize()} : la tâche mérite un cadrage clair pour rester maîtrisable."),
    }


def extract_json(raw_text):
    text = clean_text(raw_text)
    if not text:
        return None

    try:
        return json.loads(text)
    except Exception:
        pass

    match = re.search(r"\{[\s\S]*\}", text)
    if not match:
        return None

    try:
        return json.loads(match.group(0))
    except Exception:
        return None


def normalize_analysis(obj, fallback):
    if not isinstance(obj, dict):
        return fallback

    result = {}
    for field in AI_FIELDS:
        value = clean_text(obj.get(field, ""))
        result[field] = value or fallback[field]

    priority = result["priority"]
    if priority not in ALLOWED_PRIORITIES:
        lower = priority.lower()
        if "haute" in lower:
            priority = "Haute"
        elif "faible" in lower:
            priority = "Faible"
        else:
            priority = "Moyenne"
    result["priority"] = priority

    urgency = result["urgency"]
    if urgency not in ALLOWED_URGENCIES:
        lower = urgency.lower()
        if "élev" in lower or "elev" in lower:
            urgency = "Élevée"
        elif "faible" in lower:
            urgency = "Faible"
        else:
            urgency = "Modérée"
    result["urgency"] = urgency

    score_match = re.search(r"\d+", result["ai_score"])
    score = int(score_match.group(0)) if score_match else int(fallback["ai_score"])
    result["ai_score"] = str(max(0, min(100, score)))

    return {field: result[field] for field in AI_FIELDS}


def build_prompt(text):
    return f"""
Tu es l'assistant IA professionnel de Smart Task Manager.
Analyse uniquement la demande de l'utilisateur ci-dessous.
N'invente aucune information, aucun contexte, aucune contrainte non écrite.
Si la demande est vague, réponds avec prudence.
Si la demande contient une échéance proche, augmente l'urgence.
Si la demande concerne étude, travail, projet, examen, réunion, devoir, client ou deadline, ne mets pas la priorité à Faible sauf si c'est clairement facultatif.
Le conseil doit être spécifique à la phrase de l'utilisateur.
Le résumé du jour doit parler de ce que l'utilisateur doit faire aujourd'hui.
La note IA doit évaluer l'organisation actuelle :
0-39 : organisation faible
40-69 : organisation moyenne
70-100 : bonne organisation

Réponds uniquement en JSON valide.
Aucun markdown.
Aucun texte avant ou après le JSON.
Le JSON doit contenir exactement ces clés :
{{
  "priority": "Faible | Moyenne | Haute",
  "urgency": "Faible | Modérée | Élevée",
  "advice": "conseil logique et professionnel selon la demande",
  "next_action": "prochaine action concrète",
  "risk": "risque principal à éviter",
  "daily_summary": "résumé intelligent du jour selon les tâches du jour",
  "ai_score": "note IA de 0 à 100",
  "ai_note": "courte remarque professionnelle sur l'organisation"
}}

Demande utilisateur :
{text}
""".strip()


@app.route("/")
def home():
    return jsonify({"message": "Backend IA Smart Task Manager fonctionne."})


@app.route("/api/ai/analyze", methods=["POST"])
def analyze_task():
    data = request.get_json(silent=True) or {}
    text = clean_text(data.get("text", ""))
    fallback = fallback_analysis(text)

    if not text:
        return jsonify(fallback)

    try:
        response = requests.post(
            OLLAMA_URL,
            json={
                "model": MODEL_NAME,
                "prompt": build_prompt(text),
                "stream": False,
                "format": "json",
            },
            timeout=60,
        )
        response.raise_for_status()
        payload = response.json()
        raw = payload.get("response", "") if isinstance(payload, dict) else ""
        parsed = extract_json(raw)
        return jsonify(normalize_analysis(parsed, fallback))
    except Exception:
        return jsonify(fallback)


if __name__ == "__main__":
    app.run(debug=True)
