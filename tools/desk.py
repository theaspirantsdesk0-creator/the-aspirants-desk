#!/usr/bin/env python3
"""The Aspirant's Desk content tooling (standard library only).
  python tools/desk.py export            one-time: index.html -> data/questions/<subject>.json
  python tools/desk.py validate [--strict]  check data + site, print gaps vs targets
  python tools/desk.py build             data/questions -> TAD.BANK inside index.html
  python tools/desk.py news              refresh data/current-affairs.json from tools/feeds.json
"""
import argparse, json, re, sys, urllib.request, xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDEX, QDIR, CA = ROOT / 'index.html', ROOT / 'data' / 'questions', ROOT / 'data' / 'current-affairs.json'
LEVELS = ('easy', 'medium', 'hard')
PER_SUBJECT, PER_LEVEL, CHAPTERS = 200, 50, 350   # your targets

def slug(s): return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')

def load_tad():
    t = INDEX.read_text(encoding='utf-8'); m = 'window.TAD='
    a = t.index(m) + len(m)
    obj, n = json.JSONDecoder().raw_decode(t[a:])
    return t, obj, a, a + n

def load_questions():
    items = []
    for f in sorted(QDIR.glob('*.json')):
        for it in json.loads(f.read_text(encoding='utf-8')):
            it['_file'] = f.name; items.append(it)
    return items

def cmd_export(a):
    if QDIR.exists() and any(QDIR.glob('*.json')) and not a.force:
        sys.exit('data/questions already has files; use --force to overwrite')
    QDIR.mkdir(parents=True, exist_ok=True)
    by = {}
    for r in load_tad()[1]['BANK']: by.setdefault(r[0], []).append(r)
    for subj, rows in by.items():
        out = []
        for n, r in enumerate(rows, 1):
            it = {'id': f'{slug(subj)}-{n:04d}', 'subject': subj, 'difficulty': (r[7] if len(r) > 7 and r[7] else 'medium'),
                  'q': r[1], 'a': r[2], 'w': r[3:6], 'e': r[6], 'status': 'published'}
            if len(r) > 8 and r[8]: it['exam'] = r[8]
            out.append(it)
        (QDIR / f'{slug(subj)}.json').write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding='utf-8')
    print(f'exported {sum(len(v) for v in by.values())} questions into {len(by)} files')

def site_checks(errs, warns):
    sw = (ROOT / 'sw.js').read_text(encoding='utf-8')
    m = re.search(r'var SHELL = \[(.*?)\];', sw, re.S)
    need = {f for f in re.findall(r"'([^']+)'", m.group(1)) if f != './'} if m else set()
    need |= {i['src'] for i in json.loads((ROOT / 'manifest.webmanifest').read_text(encoding='utf-8')).get('icons', [])}
    for f in sorted(need):
        if not (ROOT / f).exists(): warns.append(f'file referenced by sw.js/manifest not found: {f}')
    cfg = re.sub(r'/\*.*?\*/', '', (ROOT / 'config.js').read_text(encoding='utf-8'), flags=re.S)
    if re.search(r'service_role|sb_secret_', cfg): errs.append('config.js contains a secret key. Remove it and rotate the key.')

def cmd_validate(a):
    errs, warns = [], []
    items, ids, seen = load_questions(), set(), {}
    for it in items:
        w = f"{it['_file']} {it.get('id', '?')}"
        for k in ('id', 'subject', 'q', 'a', 'w', 'e'):
            if not it.get(k): errs.append(f'{w}: missing {k}')
        if it.get('difficulty') not in LEVELS: errs.append(f'{w}: difficulty must be one of {LEVELS}')
        opts = [it.get('a')] + list(it.get('w') or [])
        if len(opts) != 4 or len({str(o).strip().lower() for o in opts}) != 4: errs.append(f'{w}: need 4 distinct options (a + 3 in w)')
        if it.get('id') in ids: errs.append(f'{w}: duplicate id')
        ids.add(it.get('id'))
        key = re.sub(r'\W+', ' ', str(it.get('q', '')).lower()).strip()
        if key in seen: errs.append(f'{w}: same question text as {seen[key]}')
        seen[key] = w
    grid = {}
    for it in items:
        if it.get('status', 'published') == 'published': grid.setdefault(it['subject'], dict.fromkeys(LEVELS, 0))[it.get('difficulty', 'medium')] += 1
    print(f"{'Subject':26}{'easy':>6}{'med':>6}{'hard':>6}{'total':>7}  target {PER_SUBJECT} (min {PER_LEVEL} per level)")
    gaps = 0
    for s, g in sorted(grid.items()):
        tot = sum(g.values()); bad = tot < PER_SUBJECT or min(g.values()) < PER_LEVEL; gaps += bad
        print(f"{s:26}{g['easy']:>6}{g['medium']:>6}{g['hard']:>6}{tot:>7}  {'GAP -' + str(max(PER_SUBJECT - tot, 0)) if bad else 'ok'}")
    nch = sum(len(v) for v in load_tad()[1]['NOTES'].values())
    print(f'Chapters: {nch} of {CHAPTERS} target ({max(CHAPTERS - nch, 0)} to go)')
    if nch < CHAPTERS: gaps += 1
    site_checks(errs, warns)
    for w in warns: print('WARN ', w)
    for e in errs: print('ERROR', e)
    print(f'{len(items)} questions checked, {len(errs)} errors, {gaps} target gaps')
    sys.exit(1 if errs or (a.strict and gaps) else 0)

def cmd_build(a):
    errs, rows = [], []
    for it in load_questions():
        if it.get('status', 'published') != 'published': continue
        r = [it['subject'], it['q'], it['a'], *it['w'], it['e'], it.get('difficulty', 'medium')]
        if it.get('exam'): r.append(it['exam'])
        rows.append(r)
    t, obj, s, e = load_tad(); obj['BANK'] = rows
    INDEX.write_text(t[:s] + json.dumps(obj, ensure_ascii=True) + t[e:], encoding='utf-8')
    print(f'built {len(rows)} published questions into index.html')

TOPICS = [('Polity', r'supreme court|high court|parliament|lok sabha|rajya sabha|constitution|election commission|governor|bill\b'),
          ('Economy', r'rbi|repo rate|inflation|gdp|budget|gst|sebi|fiscal|exports?\b'),
          ('International relations', r'summit|bilateral|treaty|quad|brics|g20|united nations|foreign minister'),
          ('Environment', r'climate|biodiversity|tiger|wildlife|pollution|wetland|ramsar|cop\d+'),
          ('Science and technology', r'isro|satellite|quantum|semiconductor|artificial intelligence|\bai\b|vaccine|drdo'),
          ('Internal security', r'terror|naxal|border|cyber|\bnia\b|\bbsf\b|crpf'),
          ('Schemes and society', r'scheme|yojana|mission|poshan|ayushman')]


def _ai_json(prompt):
    """Gemini-first, Groq-fallback helper. Returns None when no key/provider works."""
    import os
    if os.environ.get('GEMINI_API_KEY'):
        try:
            payload = json.dumps({
                'contents': [{'role': 'user', 'parts': [{'text': prompt}]}],
                'generationConfig': {'temperature': 0.2, 'maxOutputTokens': 180},
            }).encode()
            req = urllib.request.Request(
                'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
                data=payload,
                headers={'Content-Type': 'application/json', 'x-goog-api-key': os.environ['GEMINI_API_KEY']},
                method='POST')
            with urllib.request.urlopen(req, timeout=25) as response:
                data = json.loads(response.read().decode())
            return data['candidates'][0]['content']['parts'][0]['text'].strip()
        except Exception as ex:
            print('Gemini UPSC-angle generation failed:', ex)
    if os.environ.get('GROQ_API_KEY'):
        try:
            payload = json.dumps({
                'model': 'llama-3.3-70b-versatile',
                'temperature': 0.2,
                'max_tokens': 180,
                'messages': [{'role': 'user', 'content': prompt}],
            }).encode()
            req = urllib.request.Request(
                'https://api.groq.com/openai/v1/chat/completions',
                data=payload,
                headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + os.environ['GROQ_API_KEY']},
                method='POST')
            with urllib.request.urlopen(req, timeout=25) as response:
                data = json.loads(response.read().decode())
            return data['choices'][0]['message']['content'].strip()
        except Exception as ex:
            print('Groq UPSC-angle generation failed:', ex)
    return None


def _upsc_angle(title, summary, topic):
    prompt = (
        "Write one concise potential UPSC CSE relevance note (maximum 45 words) "
        "for an educational current-affairs index. Use only the headline and supplied "
        "RSS description. Do not invent facts, statistics, dates, schemes, legal provisions, "
        "or claim the article says something not present in the source. Identify a plausible "
        "GS paper or Prelims subject only when clear. If evidence is too thin, reply exactly "
        "'Open the source article; the headline alone is insufficient for a reliable UPSC angle.' "
        "Clearly phrase relevance as potential, not as an official UPSC prediction. Return plain text only.\n\n"
        f"Topic label: {topic}\nHeadline: {title}\nRSS description: {summary or '[not supplied]'}"
    )
    answer = _ai_json(prompt)
    if not answer:
        return ''
    answer = re.sub(r'^[\s"\']+|[\s"\']+
    feeds = json.loads((ROOT / 'tools' / 'feeds.json').read_text(encoding='utf-8'))
    old = json.loads(CA.read_text(encoding='utf-8'))['items'] if CA.exists() else []
    by_link, ok = {i['link']: i for i in old}, 0
    now = datetime.now(timezone.utc)
    for f in feeds:
        try:
            req = urllib.request.Request(f['url'], headers={'User-Agent': 'AspirantsDeskBot/1.0'})
            root = ET.fromstring(urllib.request.urlopen(req, timeout=25).read()); ok += 1
        except Exception as ex:
            print('feed failed:', f['name'], ex); continue
        for it in root.iter('item'):
            title, link = (it.findtext('title') or '').strip(), (it.findtext('link') or '').strip()
            if not title or not link or link in by_link: continue
            try: d = parsedate_to_datetime(it.findtext('pubDate')).astimezone(timezone.utc)
            except Exception: d = now
            topic = next((n for n, p in TOPICS if re.search(p, title.lower())), 'General')
            by_link[link] = {'date': d.date().isoformat(), 'source': f['name'], 'title': title, 'link': link, 'topic': topic, 'upsc_angle': ''}
    if not ok: sys.exit('all feeds failed')
    keep = [i for i in by_link.values() if i['date'] >= (now - timedelta(days=90)).date().isoformat()]
    keep.sort(key=lambda i: i['date'], reverse=True)
    CA.write_text(json.dumps({'updated': now.isoformat(timespec='seconds'), 'items': keep}, ensure_ascii=False, indent=1), encoding='utf-8')
    print(f'{len(keep)} current-affairs items ({ok}/{len(feeds)} feeds ok)')

if __name__ == '__main__':
    p = argparse.ArgumentParser(); s = p.add_subparsers(dest='cmd', required=True)
    s.add_parser('export').add_argument('--force', action='store_true')
    s.add_parser('validate').add_argument('--strict', action='store_true')
    s.add_parser('build'); s.add_parser('news')
    a = p.parse_args(); globals()['cmd_' + a.cmd](a)
, '', answer).strip()
    if len(answer) > 500 or len(answer) < 15:
        return ''
    return answer


def cmd_news(a):
    import os
    feeds = json.loads((ROOT / 'tools' / 'feeds.json').read_text(encoding='utf-8'))
    old = json.loads(CA.read_text(encoding='utf-8'))['items'] if CA.exists() else []
    by_link, ok = {i['link']: i for i in old}, 0
    now = datetime.now(timezone.utc)
    for f in feeds:
        try:
            req = urllib.request.Request(f['url'], headers={'User-Agent': 'AspirantsDeskBot/1.0'})
            root = ET.fromstring(urllib.request.urlopen(req, timeout=25).read()); ok += 1
        except Exception as ex:
            print('feed failed:', f['name'], ex); continue
        for it in root.iter('item'):
            title, link = (it.findtext('title') or '').strip(), (it.findtext('link') or '').strip()
            if not title or not link or link in by_link: continue
            try: d = parsedate_to_datetime(it.findtext('pubDate')).astimezone(timezone.utc)
            except Exception: d = now
            description = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', it.findtext('description') or '')).strip()
            topic = next((n for n, p in TOPICS if re.search(p, title.lower())), 'General')
            by_link[link] = {
                'date': d.date().isoformat(), 'source': f['name'], 'title': title,
                'link': link, 'topic': topic, 'upsc_angle': '', 'ai_status': 'pending'
            }
            if description:
                by_link[link]['source_summary'] = description[:1200]
    if not ok: sys.exit('all feeds failed')

    keep = [i for i in by_link.values() if i['date'] >= (now - timedelta(days=90)).date().isoformat()]
    keep.sort(key=lambda i: i['date'], reverse=True)

    # Fill a small, bounded batch each day so free provider quotas are not exhausted.
    missing = [i for i in keep if not i.get('upsc_angle')][:10]
    generated = 0
    if not os.environ.get('GEMINI_API_KEY') and not os.environ.get('GROQ_API_KEY'):
        print('AI angle generation skipped: configure GEMINI_API_KEY or GROQ_API_KEY in GitHub Actions secrets.')
    else:
        for item in missing:
            angle = _upsc_angle(item.get('title', ''), item.get('source_summary', ''), item.get('topic', 'General'))
            if angle:
                item['upsc_angle'] = angle
                item['ai_status'] = 'generated'
                generated += 1
            else:
                item['ai_status'] = 'pending'
    CA.write_text(json.dumps({'updated': now.isoformat(timespec='seconds'), 'items': keep}, ensure_ascii=False, indent=1), encoding='utf-8')
    pending = sum(1 for i in keep if not i.get('upsc_angle'))
    print(f'{len(keep)} current-affairs items ({ok}/{len(feeds)} feeds ok); generated {generated} UPSC angles; {pending} pending')
if __name__ == '__main__':
    p = argparse.ArgumentParser(); s = p.add_subparsers(dest='cmd', required=True)
    s.add_parser('export').add_argument('--force', action='store_true')
    s.add_parser('validate').add_argument('--strict', action='store_true')
    s.add_parser('build'); s.add_parser('news')
    a = p.parse_args(); globals()['cmd_' + a.cmd](a)
