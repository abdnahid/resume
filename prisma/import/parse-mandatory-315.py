"""
Parses `utils/mandatory list.pdf` — BSTI's published "List of 315 Products
Brought Under Mandatory Certification, Marks Wing" — into
`prisma/data/mandatory-315.json`.

    pdftotext -layout "utils/mandatory list.pdf" /tmp/mand.txt
    python3 prisma/import/parse-mandatory-315.py

PROVENANCE: this is real BSTI data, not placeholder. The PDF is a Word document
printed to PDF (June 2025), so it has a clean text layer but the table is laid
out visually, and three artefacts had to be handled:

  1. Word vertically centres the serial-number cell, so a row whose product name
     wraps to two lines renders its number on the SECOND line — the row's first
     line appears *above* its own serial. Six rows do this (95, 122, 130, 147,
     154, 179), plus item 24 where the number lands on the b) sub-line.
  2. A designation that wraps ("(2nd revision)", "Amendment 1, 2: 2007") can
     share a line with the *next* part's name, so lines are split by column
     position rather than by searching for "BDS".
  3. Item 271 has two designations fused onto one line by the original wrap.

VERIFIED after parsing: 315 items; serials 1..315 with no gaps; the five
category counts match the totals the PDF declares for itself (115 + 75 + 44 +
31 + 50 = 315); every item has a name and at least one designation; every
designation starts with "BDS". One designation, item 227's "BDS 576", carries
no year — that is how the source prints it, not a parse failure.
"""
import json, re
from collections import Counter

import sys, os
SRC = sys.argv[1] if len(sys.argv) > 1 else "/tmp/mand.txt"
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "mandatory-315.json")
lines = open(SRC, encoding="utf-8").read().split("\n")

CAT    = re.compile(r'^\s*([A-H])\.\s+(.+?)\s*\((\d+)\s*[Ii]tems?\)\s*:?\s*$')
ITEM   = re.compile(r'^\s*(\d{1,3})\.\s*(.*)$')
HEADER = re.compile(r'(Name of the [Pp]roducts|Standard[s]? No\.|^\s*S[Il]\.|^List of 315)')
# A sub-marker must not be the tail of a word: "Enamel)" is not marker "l)".
STD    = re.compile(r'(?:(?<![A-Za-z])[a-z]\)\s*)?BDS\b')
SUB    = re.compile(r'^\s*(?<![A-Za-z])[b-z]\)')
PART   = re.compile(r'^\s*(Part\s*[\w\-]+)\s*:?\s*(.*)$', re.I)

# ---- pass 1: tokenise, routing each line by COLUMN, not by content ----------
toks, stdcol = [], None
for raw in lines:
    if not raw.strip():
        continue
    m = CAT.match(raw)
    if m:
        toks.append(("CAT", m.group(2).strip(), m.group(1), int(m.group(3))))
        stdcol = None
        continue
    if HEADER.search(raw):
        continue

    sm = STD.search(raw)
    if sm:
        stdcol = sm.start()                       # remember where the column sits
        left, right = raw[: sm.start()], raw[sm.start():]
    else:
        # No designation on this line, but it may still carry a wrapped name in
        # the left column AND a wrapped designation in the right ("revision)"
        # beside "Part 2: ..."). Split by column position, not all-or-nothing.
        if stdcol is not None and len(raw) > stdcol:
            left, right = raw[:stdcol], raw[stdcol:]
        else:
            left, right = raw, ""

    im = ITEM.match(raw)
    if im and (not sm or im.start(2) <= sm.start()):
        content = im.group(2)
        cm = STD.search(content)
        toks.append(("SERIAL", int(im.group(1)),
                     content[: cm.start()] if cm else (content if not right or left else ""),
                     content[cm.start():] if cm else ""))
    else:
        toks.append(("CONT", left, right))

# ---- pass 2: assign fragments to items -------------------------------------
items, cur, cat = [], None, None
for t in toks:
    if t[0] == "CAT":
        cat = {"name": t[1], "letter": t[2]}
        continue
    if t[0] == "SERIAL":
        _, n, left, right = t
        stolen = None
        if cur and len(cur["frags"]) >= 2:          # never steal an item's own serial line
            pname, pstd = cur["frags"][-1]
            # A fragment with no name text is a wrapped designation belonging to
            # the item above — never the first line of the next product's row.
            wrapped = (not right.strip() and pstd.strip() and pname.strip()
                       and not PART.match(pname))
            if not (left + right).strip() or SUB.match(left) or wrapped:
                stolen = cur["frags"].pop()
        cur = {"serial": n, "category": cat["name"], "categoryLetter": cat["letter"], "frags": []}
        if stolen:
            cur["frags"].append(stolen)
        if (left + right).strip():
            cur["frags"].append((left, right))
        items.append(cur)
    elif cur:
        cur["frags"].append((t[1], t[2]))

# ---- pass 3: render --------------------------------------------------------
def clean(s):
    return re.sub(r"\s+", " ", s).strip(" ,;:")

BDS_START = re.compile(r'^\s*(?:(?<![A-Za-z])[a-z]\)\s*)?BDS\b')


# Not an alias: a qualifier the list uses to disambiguate an edition or a variant.
NOT_ALIAS = re.compile(
    r'\b(rev|revision|reaffirmed|amendment|series|part|physical|chemical|'
    r'specification|general|type|grade|w/v|v/v|powder and paste|'
    r'emulsifiable|concentrates|non[- ]armoured|first|second|third)\b', re.I)

def aliases(name):
    """The names people actually use, taken only from what the source states.

    The list writes an alternative name in brackets ("Suji (Semolina)", "Nail
    Polish (Nail Enamel)") or with a slash ("Natural Henna/Mehedi"). Those are
    real synonyms and worth searching by. Bracketed *qualifiers* — "(2nd Rev.)",
    "(Metric Series)", "(Physical)" — are not, so they are filtered out rather
    than guessed at. Nothing here is invented; a curated list is a later data
    job on top of this.
    """
    found = []
    for m in re.finditer(r'\(([^)]{2,40})\)', name):
        cand = m.group(1).strip(" .")
        # "(ac)" is a qualifier, not a name anyone searches by.
        if (cand and len(cand.split()) <= 3 and not NOT_ALIAS.search(cand)
                and not (len(cand) <= 2 and cand.islower())):
            found.append(cand)
    bare = clean(re.sub(r'\([^)]*\)', ' ', name))
    parts = [clean(x) for x in re.split(r'\s*/\s*', bare) if clean(x)]
    if len(parts) > 1:
        # "Natural Henna/Mehedi" is two names; "Sweetened/Unsweetened Condensed
        # Filled Milk" is one name with a slashed prefix, and one side being a
        # substring of the other is what tells them apart.
        for i, part in enumerate(parts):
            others = [o.lower() for j, o in enumerate(parts) if j != i]
            if (part.lower() != bare.lower() and len(part.split()) <= 4
                    and not any(part.lower() in o or o in part.lower() for o in others)):
                found.append(part)
    seen, outl = set(), []
    for f in found:
        k = f.lower()
        if k not in seen and k != name.lower():
            seen.add(k); outl.append(f)
    return outl

out = []
for it in items:
    name_bits, standards = [], []
    for left, right in it["frags"]:
        if right.strip():
            if BDS_START.match(right) or not standards:
                standards.append(clean(right))
            else:
                # A wrapped designation ("Revision)", "Amendment 1, 2: 2007")
                # continues the one above it rather than starting a new one.
                standards[-1] = clean(standards[-1] + " " + right)
        # "Part 3: Fittings" labels the standard beside it, not the product.
        if left.strip() and not PART.match(left):
            name_bits.append(clean(left))

    name = clean(" ".join(b for b in name_bits if b)).strip(" -–—")
    out.append({"serial": it["serial"], "category": it["category"],
                "categoryLetter": it["categoryLetter"], "name": name,
                "genericNames": aliases(name),
                "standards": [t for s in standards
                                for t in re.split(r'\s+(?=BDS\b)',
                                                  re.sub(r'^(?:[a-z]\)\s*)', '', s))]})

json.dump(out, open(OUT, "w"), ensure_ascii=False, indent=1)

print("parsed:", len(out))
for k, v in Counter(i["category"] for i in out).items():
    print(f"  {k}: {v}")
print("serials 1..315:", sorted(i["serial"] for i in out) == list(range(1, 316)))
print("no standard :", [i["serial"] for i in out if not i["standards"]])
print("no name     :", [i["serial"] for i in out if not i["name"]])
