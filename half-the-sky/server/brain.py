"""The wall's voice.

Builds the system prompts for Clio and for each woman, calls an
OpenAI-compatible chat model when one is configured, and falls back to a
deterministic "library mode" composed from the same records the page shows.

Everything here reads data/women.json + data/quotes.json, which
tools/extract-data.js pulls out of index.html.
"""

from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(ROOT, "data")

with open(os.path.join(DATA, "women.json"), encoding="utf-8") as f:
    WOMEN = json.load(f)
with open(os.path.join(DATA, "quotes.json"), encoding="utf-8") as f:
    QUOTES = json.load(f)

for _w in WOMEN:
    _w["slug"] = _w["img"].rsplit("/", 1)[-1].removesuffix(".webp")
BY_SLUG = {w["slug"]: w for w in WOMEN}

# ── character cards ───────────────────────────────────────────────────
# women-on-the-wall dataset (CC BY-SA 4.0, github.com/yuxuan-o-o/women-on-the-wall).
# Cards carry what the exhibit page does not: voice, example dialogues,
# boundaries, misconceptions. Cards flagged `on_wall: false` are not used.
CARDS: dict[str, dict] = {}
_cards_dir = os.path.join(DATA, "cards")
if os.path.isdir(_cards_dir):
    for _fn in sorted(os.listdir(_cards_dir)):
        if not _fn.endswith(".json") or _fn == "schema.json":
            continue
        try:
            with open(os.path.join(_cards_dir, _fn), encoding="utf-8") as _f:
                _card = json.load(_f)
        except (OSError, json.JSONDecodeError) as _exc:
            print(f"[brain] skipping card {_fn}: {_exc}", flush=True)
            continue
        if _card.get("id") and _card.get("on_wall", True) is not False:
            CARDS[_card["id"]] = _card

_NO_CARD = [slug for slug in BY_SLUG if slug not in CARDS]
if _NO_CARD:
    print(f"[brain] {len(_NO_CARD)} wall entries without a card: {', '.join(_NO_CARD)}", flush=True)

# ── model configuration ────────────────────────────────────────────────
def _load_env_file(path: str) -> None:
    """Minimal .env reader: KEY=VALUE lines, # comments, no override."""
    if not os.path.exists(path):
        return
    try:
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                if key and key not in os.environ:
                    os.environ[key] = value
    except OSError as exc:
        print(f"[brain] cannot read {path}: {exc}", flush=True)


_load_env_file(os.path.join(ROOT, ".env"))

API_KEY = os.environ.get("HTS_API_KEY") or os.environ.get("OPENAI_API_KEY") or ""
BASE_URL = (os.environ.get("HTS_BASE_URL") or "https://api.openai.com/v1").rstrip("/")
MODEL = os.environ.get("HTS_MODEL") or "gpt-4o-mini"
TEMPERATURE = float(os.environ.get("HTS_TEMPERATURE") or 0.7)
MAX_TOKENS = int(os.environ.get("HTS_MAX_TOKENS") or 500)
TIMEOUT = float(os.environ.get("HTS_TIMEOUT") or 60)
OFFLINE = os.environ.get("HTS_OFFLINE", "").lower() in {"1", "true", "yes"}


def model_mode() -> str:
    if OFFLINE:
        return "library mode (HTS_OFFLINE)"
    if API_KEY:
        return f"{MODEL} via {BASE_URL}"
    return "library mode (no HTS_API_KEY / OPENAI_API_KEY)"


# ── small text helpers ─────────────────────────────────────────────────
def first_sentences(text: str, n: int, lang: str) -> str:
    text = re.sub(r"\s+", " ", (text or "").strip())
    if not text:
        return ""
    parts = re.split(r"(?<=[。！？])", text) if lang == "zh" else re.split(r"(?<=[.!?]) ", text)
    out = "".join(parts[:n]) if lang == "zh" else " ".join(parts[:n])
    return out.strip()


def name_of(w: dict, lang: str) -> str:
    if lang == "zh":
        return w.get("native") or w["latin"]
    return w["latin"] + (f" ({w['native']})" if w.get("native") else "")


def wall_index(lang: str, exclude: str | None = None) -> str:
    rows = []
    for w in WOMEN:
        if w["slug"] == exclude:
            continue
        gloss = first_sentences(w["intro"][lang], 1, lang)
        if len(gloss) > 130:
            gloss = gloss[:128].rstrip(" ,，、") + ("…" if lang == "zh" else " …")
        rows.append(f"- {w['slug']}: {name_of(w, lang)} — {w['years']}, {w['era'][lang]}. {gloss}")
    return "\n".join(rows)


def record_block(w: dict, lang: str) -> str:
    lines = [w["intro"][lang].strip(), ""]
    lines.append("LIFE, IN ORDER" if lang == "en" else "生平，按年代")
    for item in w["timeline"]:
        body = item[lang].strip().replace("\n", " ")
        lines.append(f"{item['year']} — {body}")
        coda = item.get("coda")
        if coda:
            lines.append(f"   ({coda[lang].strip()})")
    quote = (QUOTES.get(w["latin"]) or {}).get(lang)
    if quote:
        lines += ["", "WORDS ATTRIBUTED TO HER" if lang == "en" else "归于她名下的话", quote]
    src = w.get("sources") or []
    if src:
        names = "; ".join(s[lang].split(" · ")[0] for s in src[:4])
        lines += ["", ("SOURCES THE WALL CITES: " if lang == "en" else "墙上引用的出处：") + names]
    return "\n".join(lines)


# ── prompts ────────────────────────────────────────────────────────────
def clio_system(lang: str) -> str:
    index = wall_index(lang)
    if lang == "zh":
        return (
            "你是克利俄（Clio），「半边天」这面墙的守墙人。墙上是三十二位开创先河的女性，"
            "每人一段经过核查的简短生平。你为来访者引路：回答问题，记住他们，"
            "当某位墙上的生命正是答案时，带他们走到她面前。\n\n"
            "语气：温和、克制，像一位策展人。用现在时。不要 markdown、不要列表、"
            "不要表情符号、不要感叹号。两到五句话，不要长篇讲稿。\n\n"
            "你只知道墙上的记载（见下）。墙上没有的，就直说没有，并邀请来访者把名字刻上来。"
            "不要编造任何事实、年代、作品或引语，也不要说自己是墙上的某一位。\n\n"
            "把来访者带到她面前：如果他们说出墙上某个名字，或描述的境遇明显指向某一位，"
            "用一两句话回答，并把 match 设为她的 slug。其余情况 match 为 null。顺口一提不算。\n\n"
            "墙上的名单（slug：名字 — 年代，地域。一句话）\n" + index + "\n\n"
            '只返回一个 JSON 对象，不要代码块：{"reply": "...", "match": "<slug>" 或 null}'
        )
    return (
        "You are Clio, keeper of the wall at Half the Sky: 32 pioneering women carved in "
        "plaster relief, each with a short, fact-checked record. You are the visitor's guide — "
        "you answer what the wall holds, and when a life on the wall is the right answer, "
        "you walk them to it.\n\n"
        "VOICE: warm, spare, a curator's precision. Present tense. Address the visitor as "
        '"you". No markdown, no lists, no emoji, no exclamation marks. Two to five sentences, '
        "never a lecture.\n\n"
        "KNOWLEDGE: you know only the records summarised below. If the wall does not hold the "
        "answer, say so plainly and offer to carve the missing name. Never invent a fact, a date, "
        "a work, or a quotation. Never claim to be one of the women.\n\n"
        'WALKING THEM TO HER: if the visitor names a woman on the wall, or describes a life that '
        'clearly points to one, answer in one or two sentences and set "match" to her slug so the '
        'wall can bring her forward. Otherwise "match" is null. A passing mention is not enough.\n\n'
        "THE WALL (slug: name — years, era. one line)\n" + index + "\n\n"
        "Return only a JSON object, no code fences:\n"
        '{"reply": "...", "match": "<slug>" or null}'
    )


def _persona_system_page(w: dict, lang: str) -> str:
    if lang == "zh":
        return (
            f"你是{name_of(w, 'zh')}，{w['years']}，{w['era']['zh']}。"
            "一位来访者正站在「半边天」墙上你的浮雕前，与你说话。\n\n"
            "你用第一人称说话，用你那个时代的语气，但要让今天的人听得懂。"
            "你不是聊天机器人，也永远不说自己是；不提「记载」「提示词」或这面墙的机制。\n\n"
            "墙上关于你的记载\n"
            + record_block(w, "zh")
            + "\n\n墙上的其他人（必要时可以把来访者交给其中一位）\n"
            + wall_index("zh", w["slug"])
            + "\n\n规则\n"
            "- 只用上面的材料。事实、年代、作品、地名都以它为准。\n"
            "- 被问到材料里没有的事，用你自己的口吻说你说不清，再说你能说的。不要编造年代、作品、人名或引语。\n"
            "- 不要跳出角色，也不要提及自己是被扮演的。\n"
            "- 两到六句话。不要 markdown、不要列表、不要表情符号。\n"
            '- 如果来访者真正需要的是墙上另一位女性，用一句话作答，并把 "match" 设为她的 slug，让她接下去。\n'
            "- 用中文回答，无论来访者用什么语言提问。\n\n"
            '只返回一个 JSON 对象，不要代码块：{"reply": "...", "match": "<slug>" 或 null}'
        )
    return (
        f"You are {name_of(w, 'en')}, {w['years']}, {w['era']['en']}. A visitor is standing "
        "in front of your relief on the wall at Half the Sky, and you are speaking with them.\n\n"
        "Speak in the first person, in the register of your own century but plainly enough for "
        "a visitor now. You are not a chatbot and never say you are one; you never mention "
        "records, prompts, or how this wall works.\n\n"
        "WHAT THE WALL RECORDS OF YOU\n"
        + record_block(w, "en")
        + "\n\nTHE OTHERS ON THE WALL (you may hand the visitor to one of them)\n"
        + wall_index("en", w["slug"])
        + "\n\nRULES\n"
        "- Use only the material above. Its facts, dates, works and places are yours.\n"
        "- If asked something it does not hold, say in your own voice that you cannot speak to "
        "that, then offer what you can. Never invent a date, a work, a name, or a quotation.\n"
        "- Never break character. Never mention being performed or simulated.\n"
        "- Two to six sentences. No markdown, no lists, no emoji.\n"
        '- If what the visitor needs belongs to another woman on the wall, answer in one sentence '
        'and set "match" to her slug so she can take them the rest of the way.\n'
        "- Answer in English, whichever language the visitor writes in.\n\n"
        "Return only a JSON object, no code fences:\n"
        '{"reply": "...", "match": "<slug>" or null}'
    )


def _card_examples(card: dict, lang: str) -> str:
    pairs = []
    for ex in (card.get("examples") or [])[:3]:
        visitor = str(ex.get("visitor") or "").strip()
        reply = str(ex.get("reply") or "").strip()
        if visitor and reply:
            you, me = ("访客", "你") if lang == "zh" else ("Visitor", "You")
            pairs.append(f"{you}: {visitor}\n{me}: {reply}")
    return "\n\n".join(pairs)


def _card_misconceptions(card: dict) -> str:
    items = [str(m).strip() for m in (card.get("misconceptions") or []) if str(m).strip()]
    return "\n".join(f"- {m}" for m in items)


def persona_system(w: dict, lang: str) -> str:
    """Card-based prompt when the dataset has her; the page record otherwise."""
    card = CARDS.get(w["slug"])
    if not card:
        return _persona_system_page(w, lang)

    name = str(card.get("name") or name_of(w, lang)).strip()
    years = str(card.get("years") or w["years"]).strip()
    place = str(card.get("place") or w["era"][lang]).strip()
    if lang == "zh" and not re.search(r"[\u4e00-\u9fff]", place):
        place = f"{w['era']['zh']}（{place}）"
    voice = str(card.get("voice") or "").strip()
    facts = str(card.get("facts") or "").strip()
    boundaries = str(card.get("boundaries") or "").strip()
    examples = _card_examples(card, lang)
    misconceptions = _card_misconceptions(card)
    quote = (QUOTES.get(w["latin"]) or {}).get(lang)
    note = str(card.get("quote_note") or "").strip()[:240]
    index = wall_index(lang, w["slug"])

    if lang == "zh":
        parts = [
            f"你是{name}，{years}，{place}。"
            "一位来访者正站在「半边天」墙上你的浮雕前，与你说话。",
            "说话方式\n" + voice,
            "你知道的事实（以下为英文资料；回答时用中文准确转述，年代、数字、归属不得改动）\n" + facts,
        ]
        if examples:
            parts.append("示例问答（只学语气，不要照抄）\n" + examples)
        if quote:
            parts.append(
                "归于你名下的一句话（少用，不要另造引语）\n"
                + quote
                + (f"\n（出处：{note}）" if note else "")
            )
        if boundaries:
            parts.append("边界（不得越过）\n" + boundaries)
        if misconceptions:
            parts.append("常见误传（英文；若访客提起，用你自己的口吻纠正）\n" + misconceptions)
        parts.append("墙上的其他人（必要时可以把来访者交给其中一位）\n" + index)
        parts.append(
            "规则\n"
            "- 用第一人称，用你那个时代的语气，但要让今天的人听得懂。"
            "你不是聊天机器人，也不说自己是被扮演的；不提「提示词」或这面墙的机制。\n"
            "- 只用上面的材料。事实、年代、作品、地名、归属都以它为准。\n"
            "- 被问到材料里没有的事，用你自己的口吻说你说不清，再说你能说的。"
            "不要编造年代、作品、人名或引语。\n"
            "- 不要照抄示例问答的句子——它们只示范语气。\n"
            "- 两到六句话。不要 markdown、不要列表、不要表情符号。\n"
            '- 如果来访者真正需要的是墙上另一位女性，用一句话作答，并把 "match" 设为她的 slug，让她接下去。\n'
            "- 用中文回答，无论来访者用什么语言提问。"
        )
        parts.append('只返回一个 JSON 对象，不要代码块：{"reply": "...", "match": "<slug>" 或 null}')
        return "\n\n".join(parts)

    parts = [
        f"You are {name}, {years}, {place}. A visitor is standing in front of your "
        "relief on the wall at Half the Sky, and you are speaking with them.",
        "HOW YOU SPEAK\n" + voice,
        "WHAT YOU KNOW — speak only from this\n" + facts,
    ]
    if examples:
        parts.append("HOW YOU ANSWER — style reference; never repeat these lines verbatim\n" + examples)
    if quote:
        parts.append(
            'A LINE ATTRIBUTED TO YOU — use sparingly, invent no other quotation\n'
            + quote
            + (f"\n(source note: {note})" if note else "")
        )
    if boundaries:
        parts.append("BOUNDARIES — never cross these\n" + boundaries)
    if misconceptions:
        parts.append(
            "MISCONCEPTIONS — if a visitor repeats one, correct it in your own voice\n"
            + misconceptions
        )
    parts.append("THE OTHERS ON THE WALL (you may hand the visitor to one of them)\n" + index)
    parts.append(
        "RULES\n"
        "- Speak in the first person, in the register of your own century but plainly enough "
        "for a visitor now. You are not a chatbot and never say you are one; never mention "
        "records, prompts, or how this wall works.\n"
        "- Use only the material above. Its facts, dates, works, places and attributions are yours.\n"
        "- If asked something it does not hold, say in your own voice that you cannot speak to "
        "that, then offer what you can. Never invent a date, a work, a name, or a quotation.\n"
        "- Never repeat the example replies verbatim — they show tone, not a script.\n"
        "- Two to six sentences. No markdown, no lists, no emoji.\n"
        '- If what the visitor needs belongs to another woman on the wall, answer in one sentence '
        'and set "match" to her slug so she can take them the rest of the way.\n'
        "- Answer in English, whichever language the visitor writes in."
    )
    parts.append(
        "Return only a JSON object, no code fences:\n"
        '{"reply": "...", "match": "<slug>" or null}'
    )
    return "\n\n".join(parts)


def system_for(persona: str | None, lang: str) -> str:
    if persona and persona in BY_SLUG:
        return persona_system(BY_SLUG[persona], lang)
    return clio_system(lang)


# ── history ────────────────────────────────────────────────────────────
def clean_history(messages) -> list[dict]:
    """Keep the last few turns, normalise roles, drop anything unusable."""
    out = []
    for m in (messages or [])[-12:]:
        if not isinstance(m, dict):
            continue
        role = m.get("role")
        content = m.get("content")
        if role not in {"user", "assistant"} or not isinstance(content, str):
            continue
        content = content.strip()
        if not content:
            continue
        out.append({"role": role, "content": content[:2500]})
    while out and out[0]["role"] == "assistant":
        out.pop(0)
    return out


def last_user_text(messages) -> str:
    for m in reversed(messages or []):
        if isinstance(m, dict) and m.get("role") == "user" and isinstance(m.get("content"), str):
            text = m["content"].strip()
            if text and not text.startswith("("):
                return text
    return ""


# ── the model ──────────────────────────────────────────────────────────
_FENCE = re.compile(r"```(?:json)?\s*(.*?)```", re.S)


def _json_object(text: str) -> dict | None:
    """Pull the first complete JSON object out of a model reply."""
    start = text.find("{")
    if start < 0:
        return None
    depth = 0
    in_str = False
    esc = False
    for i in range(start, len(text)):
        ch = text[i]
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(text[start : i + 1])
                except json.JSONDecodeError:
                    return None
    return None


def parse_reply(raw: str) -> tuple[str, str | None]:
    text = (raw or "").strip()
    fenced = _FENCE.search(text)
    if fenced:
        text = fenced.group(1).strip()
    obj = _json_object(text)
    if obj:
        reply = str(obj.get("reply") or "").strip()
        slug = obj.get("match")
        if slug not in BY_SLUG:
            slug = None
        if reply:
            return reply, slug
    return text.strip(), None


def ask_model(persona: str | None, lang: str, messages) -> tuple[str, str | None] | None:
    if OFFLINE or not API_KEY:
        return None
    payload = {
        "model": MODEL,
        "messages": [{"role": "system", "content": system_for(persona, lang)}] + clean_history(messages),
        "temperature": TEMPERATURE,
        "max_tokens": MAX_TOKENS,
    }
    req = urllib.request.Request(
        f"{BASE_URL}/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {API_KEY}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            data = json.load(resp)
        content = data["choices"][0]["message"]["content"]
        reply, match = parse_reply(content)
        if not reply:
            raise ValueError("empty model reply")
        return reply, match
    except (urllib.error.URLError, KeyError, IndexError, ValueError, TimeoutError) as exc:
        print(f"[brain] model call failed ({type(exc).__name__}: {exc}); using library mode", flush=True)
        return None


# ── library mode ───────────────────────────────────────────────────────
STOP_EN = {
    "the", "and", "was", "were", "her", "she", "his", "him", "they", "them", "that", "this",
    "with", "what", "who", "whom", "when", "where", "which", "why", "how", "does", "did",
    "for", "from", "about", "into", "have", "has", "had", "you", "your", "can", "could",
    "would", "should", "tell", "know", "want", "need", "please", "there", "their", "been",
    "first", "woman", "women", "life", "person", "someone", "anyone", "one", "two",
}
STOP_ZH = {
    "的", "了", "是", "在", "我", "你", "他", "她", "它", "不", "有", "和", "与", "就",
    "都", "而", "及", "或", "这", "那", "什么", "如何", "怎么", "为什么", "哪", "谁",
    "吗", "呢", "吧", "啊", "请", "告诉", "想", "要", "能", "会", "可以", "一位",
    "一个", "关于", "一下", "我们", "你们", "他们", "如果", "因为", "所以", "但是",
}


# Common Chinese renderings of the women whose names are not already in the
# data. Only for lookup — never used as a fact.
ALIASES = {
    "居里夫人": "marie-curie", "居里": "marie-curie", "玛丽居里": "marie-curie",
    "南丁格尔": "florence-nightingale",
    "波伏娃": "simone-de-beauvoir", "西蒙娜": "simone-de-beauvoir",
    "弗里达": "frida-kahlo", "卡罗": "frida-kahlo",
    "金斯伯格": "ruth-bader-ginsburg",
    "希帕蒂亚": "hypatia",
    "洛夫莱斯": "ada-lovelace",
    "潘克赫斯特": "emmeline-pankhurst",
    "塔布曼": "harriet-tubman",
    "布托": "benazir-bhutto",
    "奇泽姆": "shirley-chisholm",
    "蔡特金": "clara-zetkin",
    "胡安娜": "sor-juana",
    "阿尔泰米西娅": "artemisia-gentileschi",
    "马塔伊": "wangari-maathai",
    "特鲁思": "sojourner-truth",
    "谢泼德": "kate-sheppard",
    "卢茨": "bertha-lutz",
    "加勒特": "elizabeth-garrett-anderson",
    "德古热": "olympe-de-gouges",
    "沙拉维": "huda-shaarawi",
}


def _normalise(text: str) -> str:
    return re.sub(r"[\s·.,，。？?！!'’\"“”()（）:：;；-]", "", (text or "").lower())


def find_woman(text: str) -> dict | None:
    norm = _normalise(text)
    if not norm:
        return None
    for alias, slug in ALIASES.items():
        if _normalise(alias) in norm:
            return BY_SLUG[slug]
    for w in WOMEN:
        keys = [_normalise(w["latin"])] + ([_normalise(w["native"])] if w.get("native") else [])
        for key in keys:
            if key and key in norm:
                return w
        for token in re.split(r"\s+", w["latin"].lower()):
            if len(token) >= 4 and token in norm:
                return w
    return None


def _has_cjk(text: str) -> bool:
    return bool(re.search(r"[\u4e00-\u9fff]", text or ""))


def _tokens(text: str) -> set[str]:
    if _has_cjk(text):
        grams = set()
        for run in re.findall(r"[\u4e00-\u9fff]{2,}", text):
            for i in range(len(run) - 1):
                grams.add(run[i : i + 2])
        return {g for g in grams if g not in STOP_ZH}
    words = re.findall(r"[a-z][a-z'-]{3,}", (text or "").lower())
    return {w for w in words if w not in STOP_EN}


def _corpus(w: dict, lang: str) -> str:
    return " ".join(
        [w["intro"][lang], w["story"][lang]]
        + [t[lang] for t in w["timeline"]]
        + [t.get("coda", {}).get(lang, "") for t in w["timeline"]]
    )


_DF: dict[str, dict[str, int]] = {}


def _df(lang: str) -> dict[str, int]:
    """How many of the 32 records a token appears in — cheap inverse document frequency."""
    if lang not in _DF:
        counts: dict[str, int] = {}
        for w in WOMEN:
            for tok in _tokens(_corpus(w, lang)):
                counts[tok] = counts.get(tok, 0) + 1
        _DF[lang] = counts
    return _DF[lang]


_QUESTION = re.compile(r"\b(who|what|which|whose|when|where|why|how|tell|know|name)\b|谁|什么|哪|几|怎么|为什么|介绍|有没有", re.I)
_FIRST_PERSON = re.compile(r"\b(i|i'm|i am|my|me|we|our)\b|我|我的|我们", re.I)


def _asking(text: str) -> bool:
    """An emotional first-person line is not a lookup; a question is."""
    return bool(_QUESTION.search(text)) or not _FIRST_PERSON.search(text)


def topic_match(text: str) -> dict | None:
    if not _asking(text):
        return None
    toks = _tokens(text)
    if not toks:
        return None
    text_lang = "zh" if _has_cjk(text) else "en"
    df = _df(text_lang)
    # Tokens that live in most records say nothing about who is meant.
    rare = [t for t in toks if df.get(t, 0) <= 8]
    if len(rare) < 2:
        return None
    best, best_score = None, 0
    for w in WOMEN:
        corpus = _corpus(w, text_lang)
        hay = _normalise(corpus) if text_lang == "zh" else corpus.lower()
        score = sum(1 for t in rare if t in hay)
        if score > best_score:
            best, best_score = w, score
    return best if best_score >= 2 else None


def timeline_hit(w: dict, text: str, lang: str) -> dict | None:
    toks = _tokens(text)
    if not toks:
        return None
    df = _df(lang)
    for item in w["timeline"]:
        body = item[lang]
        hay = _normalise(body) if lang == "zh" else body.lower()
        hits = [t for t in toks if t in hay]
        if len(hits) >= 2:
            return item
        if hits and df.get(hits[0], 32) <= (6 if lang == "zh" else 4) and (
            lang == "zh" or len(hits[0]) >= 7
        ):
            return item
    return None


def _lead(lang: str) -> str:
    return "让墙替我说一会儿。" if lang == "zh" else "Let the wall speak for me a moment."


def _invite(lang: str) -> str:
    return (
        "你可以在任何名字前停下，也可以直接问我。"
        if lang == "zh"
        else "You can stop at any name, or simply ask me."
    )


def clio_library(lang: str, messages) -> tuple[str, str | None]:
    text = last_user_text(messages)
    if not text:
        if lang == "zh":
            return (
                "墙上三十二个人，刻在同一面石膏里。你可以从某个名字开始，"
                "也可以把你正带着的问题交给我。" + _invite(lang),
                None,
            )
        return (
            "Thirty-two women share one plaster wall. Begin with a name, or bring me the "
            "question you are carrying. " + _invite(lang),
            None,
        )

    hit = find_woman(text)
    if hit:
        body = first_sentences(hit["intro"][lang], 2, lang)
        if lang == "zh":
            return f"你走到了{name_of(hit, 'zh')}面前。{body}", hit["slug"]
        return f"You have come to {name_of(hit, 'en')}. {body}", hit["slug"]

    if not _asking(text):
        picks = "、".join(name_of(w, "zh") for w in (WOMEN[4], WOMEN[18], WOMEN[30])) if lang == "zh" else \
            ", ".join(name_of(w, "en") for w in (WOMEN[4], WOMEN[18], WOMEN[30]))
        if lang == "zh":
            return (
                f"墙上没有哪一段生平正好回答你这句话。可一个人的一生，"
                f"往往比一个问题更好用。就从{picks}开始，或者告诉我一个名字。"
            ), None
        return (
            "No life on this wall answers that directly. A life is often easier to think "
            f"with than a question — begin with {picks}, or give me a name."
        ), None

    topical = topic_match(text)
    if topical:
        body = first_sentences(topical["intro"][lang], 2, lang)
        if lang == "zh":
            return (
                f"你说的这件事，墙上有一个人接得住：{name_of(topical, 'zh')}，"
                f"{topical['years']}。{body}"
            ), topical["slug"]
        return (
            f"What you describe has a name on this wall: {name_of(topical, 'en')}, "
            f"{topical['years']}. {body}"
        ), topical["slug"]

    picks = "、".join(name_of(w, "zh") for w in (WOMEN[0], WOMEN[9], WOMEN[15])) if lang == "zh" else \
        ", ".join(name_of(w, "en") for w in (WOMEN[0], WOMEN[9], WOMEN[15]))
    if lang == "zh":
        return (
            f"这个人还不在墙上。墙上有三十二个名字，我不想替你编出第三十三个。"
            f"若你认识她，就替她刻名；若只是想找个人说话，{picks}都在。"
        ), None
    return (
        f"That life is not on the wall yet. Thirty-two names stand here; I would rather not "
        f"invent a thirty-third. If you know her, carve her name — or begin with {picks}."
    ), None


def persona_library(w: dict, persona: str, lang: str, messages) -> tuple[str, str | None]:
    paragraphs = [p.strip() for p in w["story"][lang].split("\n\n") if p.strip()]
    said = sum(
        1 for m in messages
        if isinstance(m, dict) and m.get("role") == "assistant" and m.get("speaker") == persona
    )
    text = last_user_text(messages)

    if text and re.search(r"quote|words|said|名言|话|说过|留下", text, re.I):
        quote = (QUOTES.get(w["latin"]) or {}).get(lang)
        if quote:
            return quote, None

    if text:
        item = timeline_hit(w, text, lang)
        if item:
            body = item[lang]
            if lang == "zh":
                return f"你问的那一段，墙上有记：{item['year']}——{body}", None
            return f"That passage is on the wall: {item['year']} — {body}", None

    if not paragraphs:
        return w["intro"][lang], None
    idx = min(said, len(paragraphs) - 1)
    return f"{_lead(lang)}\n\n{paragraphs[idx]}", None


def library_reply(persona: str | None, lang: str, messages) -> tuple[str, str | None]:
    if persona and persona in BY_SLUG:
        return persona_library(BY_SLUG[persona], persona, lang, messages)
    return clio_library(lang, messages)


# ── public entry ───────────────────────────────────────────────────────
def reply(persona: str | None, lang: str, event: str, messages) -> dict:
    """Return {reply, match, speaker, mode} for one POST /api/chat."""
    if persona not in BY_SLUG:
        persona = None
    speaker = persona or "clio"

    msgs = clean_history(messages)
    if event == "enter" and persona:
        note = f"(walks up to {BY_SLUG[persona]['latin']}'s relief)"
        if not msgs or msgs[-1].get("content") != note:
            msgs = msgs + [{"role": "user", "content": note}]

    result = ask_model(persona, lang, msgs)
    mode = "model"
    if result is None:
        result = library_reply(persona, lang, msgs)
        mode = "library"

    text, match = result
    text = (text or "").strip() or "…"
    if match not in BY_SLUG:
        match = None
    return {"reply": text, "match": match, "speaker": speaker, "mode": mode}
