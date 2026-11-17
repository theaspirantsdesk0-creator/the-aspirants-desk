"""Reads the official PIB RSS feed and adds new items to data/pib.json.
With an ANTHROPIC_API_KEY secret it also writes a short explanation for each item.
Without the key it saves the headline and link only."""
import datetime, html, json, os, re, sys
import feedparser

FEED = os.environ.get("PIB_FEED", "https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3")
OUT = "data/pib.json"
MAX_NEW = 10      # new items handled per run
KEEP = 300        # items kept in the file

def clean(t):
    t = re.sub(r"<[^>]+>", " ", t or "")
    return re.sub(r"\s+", " ", html.unescape(t)).strip()

def explain(title, summary):
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        return None
    import anthropic
    client = anthropic.Anthropic(api_key=key)
    prompt = (
        "You help UPSC aspirants. Using ONLY the headline and summary below, return JSON with keys "
        '"what" (1 to 2 sentences in your own words), "why" (2 to 3 sentences of well-established '
        'background; add no new facts about this release) and "upsc" (1 to 2 sentences on the Prelims '
        'or Mains angle). If the summary has too little detail, start "what" with "See the full release". '
        "Return JSON only.\n\nHeadline: %s\nSummary: %s" % (title, summary)
    )
    try:
        r = client.messages.create(model="claude-sonnet-5-5", max_tokens=500,
                                   messages=[{"role": "user", "content": prompt}])
        txt = re.sub(r"^```(?:json)?|```$", "", r.content[0].text.strip(), flags=re.M).strip()
        return json.loads(txt)
    except Exception as e:
        print("AI step skipped:", e)
        return None

def main():
    try:
        old = json.load(open(OUT, encoding="utf-8"))
    except Exception:
        old = []
    seen = {x.get("l") for x in old}
    feed = feedparser.parse(FEED)
    if not feed.entries:
        print("No entries returned. Check the feed address:", FEED)
        sys.exit(1)
    new = []
    for e in feed.entries:
        link = e.get("link", "")
        if not link or link in seen:
            continue
        if len(new) >= MAX_NEW:
            break
        title, summ = clean(e.get("title")), clean(e.get("summary"))
        if e.get("published_parsed"):
            d = datetime.date(*e.published_parsed[:3]).isoformat()
        else:
            d = datetime.date.today().isoformat()
        ai = explain(title, summ) or {}
        new.append({
            "id": "pib-" + re.sub(r"\D", "", link)[-10:],
            "k": "pib", "p": "PIB", "s": "PIB", "d": d, "t": title, "l": link,
            "w": ai.get("what") or "See the full release at the source link.",
            "e": ai.get("why") or "",
            "u": ai.get("upsc") or "",
        })
    data = sorted(new + old, key=lambda x: x.get("d", ""), reverse=True)[:KEEP]
    json.dump(data, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("Added", len(new), "items")

main()
