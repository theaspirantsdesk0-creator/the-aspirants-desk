"""PIB feed updater with optional Gemini-first and Groq-fallback explanations."""
import datetime
import html
import json
import os
import re
import sys
import feedparser
import requests

FEEDS = [u for u in [
    os.environ.get("PIB_FEED", ""),
    "https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3",
    "https://www.pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3&reg=48",
] if u]
HEAD = {"User-Agent": "Mozilla/5.0 (compatible; TheAspirantsDesk/1.0)",
        "Accept": "application/rss+xml, application/xml, text/xml, */*",
        "Accept-Language": "en-IN,en;q=0.9"}
OUT = "data/pib.json"
MAX_NEW, KEEP = 10, 300
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
GROQ_MODEL = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")


def clean(value):
    value = re.sub(r"<[^>]+>", " ", value or "")
    return re.sub(r"\s+", " ", html.unescape(value)).strip()


def parse_json(value):
    value = value.strip()
    fence = chr(96) * 3
    if value.startswith(fence):
        value = value.split("\n", 1)[-1]
    if value.endswith(fence):
        value = value[:-3]
    start, end = value.find("{"), value.rfind("}")
    if start < 0 or end <= start:
        raise ValueError("AI response did not contain JSON")
    parsed = json.loads(value[start:end + 1])
    if not isinstance(parsed, dict):
        raise ValueError("AI response was not an object")
    return parsed


def prompt_for(title, summary):
    return (
        "You help UPSC aspirants understand an official government press release. "
        "Use ONLY the headline and summary below for claims about this release. "
        "Return one JSON object with keys: "
        '"what" (1-2 plain sentences summarising what happened), '
        '"why" (2-3 sentences of stable background; do not invent release details), '
        '"upsc" (1-2 sentences suggesting a relevant Prelims or Mains syllabus angle). '
        'If the summary is insufficient, begin "what" with "See the full release". '
        "Do not invent numbers, dates, schemes, quotes or sources. JSON only.\n\n"
        f"Headline: {title}\nSummary: {summary}"
    )


def call_gemini(title, summary, key):
    response = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent",
        headers={"Content-Type": "application/json", "x-goog-api-key": key},
        json={
            "systemInstruction": {"parts": [{"text": "You are a careful educational editor. Do not invent facts or citations."}]},
            "contents": [{"role": "user", "parts": [{"text": prompt_for(title, summary)}]}],
            "generationConfig": {"temperature": 0.2, "maxOutputTokens": 500},
        }, timeout=30,
    )
    if response.status_code == 429 or response.status_code >= 500:
        raise RuntimeError(f"Gemini temporarily unavailable ({response.status_code})")
    response.raise_for_status()
    data = response.json()
    answer = "".join(part.get("text", "") for part in data["candidates"][0]["content"]["parts"])
    return parse_json(answer)


def call_groq(title, summary, key):
    response = requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={
            "model": GROQ_MODEL, "temperature": 0.2, "max_tokens": 500,
            "messages": [
                {"role": "system", "content": "You are a careful educational editor. Do not invent facts or citations."},
                {"role": "user", "content": prompt_for(title, summary)},
            ],
        }, timeout=30,
    )
    if response.status_code == 429 or response.status_code >= 500:
        raise RuntimeError(f"Groq temporarily unavailable ({response.status_code})")
    response.raise_for_status()
    return parse_json(response.json()["choices"][0]["message"]["content"])


def explain(title, summary):
    gemini_key, groq_key = os.environ.get("GEMINI_API_KEY"), os.environ.get("GROQ_API_KEY")
    if gemini_key:
        try:
            return call_gemini(title, summary, gemini_key)
        except Exception as error:
            print("Gemini summary unavailable:", error)
            if not groq_key:
                return None
    if groq_key:
        try:
            return call_groq(title, summary, groq_key)
        except Exception as error:
            print("Groq summary unavailable:", error)
    return None


def get_entries():
    for url in FEEDS:
        try:
            response = requests.get(url, headers=HEAD, timeout=30, allow_redirects=True)
            print(url, "->", response.status_code, response.headers.get("content-type"), len(response.content), "bytes")
            response.raise_for_status()
            feed = feedparser.parse(response.content)
            if feed.entries:
                return feed.entries
            print("No feed entries:", response.text[:200].replace("\n", " "))
        except Exception as error:
            print(url, "failed:", error)
    return []


def main():
    try:
        with open(OUT, encoding="utf-8") as file:
            old = json.load(file)
        if not isinstance(old, list):
            old = []
    except (OSError, json.JSONDecodeError):
        old = []
    seen = {item.get("l") for item in old if isinstance(item, dict)}
    entries = get_entries()
    if not entries:
        print("No entries returned from any PIB feed address.")
        sys.exit(1)
    new = []
    for entry in entries:
        link = entry.get("link", "")
        if not link or link in seen:
            continue
        if len(new) >= MAX_NEW:
            break
        title, summary = clean(entry.get("title")), clean(entry.get("summary"))
        date = (datetime.date(*entry.published_parsed[:3]).isoformat()
                if entry.get("published_parsed") else datetime.date.today().isoformat())
        ai = explain(title, summary) or {}
        suffix = re.sub(r"\D", "", link)[-10:] or str(abs(hash(link)))
        new.append({
            "id": "pib-" + suffix, "k": "pib", "p": "PIB", "s": "PIB",
            "d": date, "t": title, "l": link,
            "w": ai.get("what") or "See the full release at the source link.",
            "e": ai.get("why") or "", "u": ai.get("upsc") or "",
        })
    data = sorted(new + old, key=lambda item: item.get("d", ""), reverse=True)[:KEEP]
    with open(OUT, "w", encoding="utf-8") as file:
        json.dump(data, file, ensure_ascii=False, indent=1)
    print("Added", len(new), "new PIB items")


if __name__ == "__main__":
    main()
