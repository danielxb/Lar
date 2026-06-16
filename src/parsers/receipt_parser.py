"""Woolworths e-receipt PDF parser with sub-category classification."""
import re
from pathlib import Path
from datetime import datetime

# Sub-category keyword rules
SUBCATEGORIES = {
    "cleaning": r"dettol|dishwash|soap|clean|sponge|wipe|bleach|spray|mop|detergent|softener|rinse|toilet|bin.?liner|glad|mfresh",
    "personal": r"shampoo|conditioner|deodorant|toothpaste|toothbrush|razor|shave|body.?wash|shower|shwr|moistur|sunscreen|lotion|hand.?wash|foam.?h|tena|evamay|liner|pad",
    "fruits": r"\b(?:bananas?|apple|grape|lime|mandarin|kiwi(?:fruit)?|berry|orange|pear|mango|avocado|melon|peach|plum|nectarine|cherry|strawb|blueberry|raspberry|lemon|coconut|pineapple|fig|pomegranate|papaya|passionfruit)\b",
    "vegetables": r"\b(?:tomato|onion|lettuce|potato|carrot|broccoli|capsicum|spinach|zucchini|mushroom|corn|celery|cucumber|pumpkin|beetroot|asparagus|cauliflower|cabbage|garlic|ginger|chilli|bean|pea|parsley|herb|basil|coriander|mint)\b",
    "dairy": r"\bmilk\b|cheese|yoghurt|yogurt|\bcream\b|\begg|custard|chobani|jalna|bega|cheddar|mozzarella|parmesan|grana|ricotta|cottage",
    "meat": r"pork|chicken|beef|lamb|mince|steak|sausage|bacon|ham|turkey|fish|salmon|tuna|prawn|rasher|schnitzel|roast|basa|salami|d.orsogna|riverland",
    "bakery": r"bread|roll|croissant|wrap|baguette|sourdough|muffin|scone|brioche|menissez|bake.?at.?home",
    "snacks": r"chocolate|kinder|oreo|arnott|cookie|biscuit|chip|cracker|pretzel|popcorn|nut|trail.?mix|gaiety|tim.?tam|shapes|cadbury|ferrero|nutella|brownie|cheetos|musashi",
    "drinks": r"juice|water|cola|pepsi|sprite|fanta|kombucha|tea|coffee|cordial|soda|energy|gatorade|powerade|impressed|oat.?milk",
    "pantry": r"rice|pasta|noodle|sauce|oil|vinegar|flour|sugar|salt|pepper|spice|stock|can|tin|cereal|oat|honey|jam|peanut|spread|vegemite|mayo|kewpie|bean|dolmio",
    "frozen": r"frozen|ice.?cream|pizza|nugget|chip.*frozen|gelato|sorbet|bulla",
    "baby": r"nappy|nappies|wipes|formula|baby",
    "pet": r"dog|cat|pet|whiskas|pedigree",
    "household": r"battery|bulb|candle|foil|wrap|bag|tissue|paper.?towel|napkin|sock|underwear|bonds|glove|serviette|scourer|cling|sistema|portion.?pod",
    "giftcard": r"giftcard|gift.?card",
}


def classify_item(item_name: str) -> str:
    """Classify a grocery item into a sub-category."""
    name = item_name.lower()
    for category, pattern in SUBCATEGORIES.items():
        if re.search(pattern, name):
            return category
    return "other"


def parse_woolworths_receipt(text: str) -> dict:
    """Parse extracted text from a Woolworths e-receipt PDF.
    
    Returns:
        {
            "store": str,
            "date": str (ISO),
            "items": [{"name": str, "amount": float, "subcategory": str, "qty": int}],
            "total": float,
            "savings": float,
        }
    """
    lines = text.strip().split("\n")
    
    # Extract store info (first line usually)
    store = ""
    for line in lines[:3]:
        if re.search(r"\d{4}\s+\w+", line):
            store = line.strip()
            break
    
    # Extract date from POS line near bottom
    date_str = ""
    for line in lines:
        m = re.search(r"(\d{2}/\d{2}/\d{4})", line)
        if m:
            try:
                dt = datetime.strptime(m.group(1), "%d/%m/%Y")
                date_str = dt.strftime("%Y-%m-%d")
            except ValueError:
                pass
    
    # Extract items and prices
    items = []
    i = 0
    pending_name = None  # Track item name for weight-based items
    while i < len(lines):
        line = lines[i].strip()
        
        # Skip header/footer lines
        if any(x in line.upper() for x in ["TAX INVOICE", "ABN", "SUBTOTAL", "TOTAL", "CHANGE", "EFTPOS", "POINTS", "CREDITS", "THANK YOU", "POS ", "WOOLWORTHS GROUP", "Description", "Taxable", "Promotional", "Cookware", "Earned today", "includes", "Rewards"]):
            i += 1
            continue
        # Skip payment lines (but not "Giftcard")
        if re.match(r"^\s*(Cash|X-\d|CARD\b|Change)\s", line, re.IGNORECASE):
            i += 1
            continue

        # Skip discount lines (negative amounts like "Everyday Extra 10% Discount  -33.84")
        discount_match = re.match(r"^[\^#\s]*(.+?)\s+-(\d+\.\d{2})\s*$", line)
        if discount_match:
            items.append({
                "name": discount_match.group(1).strip(),
                "amount": -float(discount_match.group(2)),
                "subcategory": "discount",
                "qty": 1,
            })
            pending_name = None
            i += 1
            continue
        
        # Match: weight line "X.XXX kg NET @ $Y.YY/kg   Z.ZZ"
        wt_match = re.match(r"^\s*([\d.]+)\s*kg\s+NET\s+@\s+\$([\d.]+)/kg\s+\$?(\d+\.\d{2})", line)
        if wt_match:
            amount = float(wt_match.group(3))
            name = pending_name or "Unknown item"
            items.append({
                "name": name,
                "amount": amount,
                "subcategory": classify_item(name),
                "qty": 1,
                "weight_kg": float(wt_match.group(1)),
            })
            pending_name = None
            i += 1
            continue
        
        # Match: "Qty X @ $Y.YY each   Z.ZZ"
        qty_match = re.match(r"^\s*Qty\s+(\d+)\s+@\s+\$?([\d.]+)\s+each\s+\$?(\d+\.\d{2})", line)
        if qty_match:
            total_price = float(qty_match.group(3))
            qty = int(qty_match.group(1))
            if pending_name:
                items.append({"name": pending_name, "amount": total_price, "subcategory": classify_item(pending_name), "qty": qty})
                pending_name = None
            elif items:
                items[-1]["qty"] = qty
                items[-1]["amount"] = total_price
            i += 1
            continue
        
        # Match: item name followed by price at end of line
        m = re.match(r"^[\^#\s]*(.+?)\s+(\d+\.\d{2})\s*$", line)
        if m:
            name = re.sub(r"^[\^#\s]+", "", m.group(1)).strip()
            amount = float(m.group(2))
            if name and amount > 0:
                items.append({
                    "name": name,
                    "amount": amount,
                    "subcategory": classify_item(name),
                    "qty": 1,
                })
                pending_name = None
            i += 1
            continue
        
        # Line with just a name (no price) — likely followed by weight or qty line
        name_match = re.match(r"^[\^#\s]*([A-Za-z].+?)\s*$", line)
        if name_match:
            candidate = re.sub(r"^[\^#\s]+", "", name_match.group(1)).strip()
            if len(candidate) > 2 and not re.match(r"^\d", candidate):
                pending_name = candidate
        
        i += 1
    
    # Extract total — use SUBTOTAL first (most reliable), then first TOTAL
    total = 0.0
    for line in lines:
        m = re.match(r"^\s*\d*\s*SUBTOTAL\s+\$?([\d.]+)", line.strip())
        if m:
            total = float(m.group(1))
            break
    if not total:
        for line in lines:
            m = re.match(r"^\s*TOTAL\s+\$?([\d.]+)", line.strip())
            if m:
                total = float(m.group(1))
                break
    
    # Extract savings
    savings = 0.0
    for line in lines:
        m = re.search(r"You saved \$([\d.]+)", line)
        if m:
            savings = float(m.group(1))
    
    return {
        "store": store,
        "date": date_str,
        "items": items,
        "total": total,
        "savings": savings,
    }


def parse_receipt_pdf(pdf_path: str) -> dict:
    """Extract text from PDF and parse it."""
    import fitz
    doc = fitz.open(pdf_path)
    text = ""
    for page in doc:
        text += page.get_text()
    doc.close()
    result = parse_woolworths_receipt(text)
    
    # Flag unclassified items
    result["unclassified"] = [item for item in result["items"] if item["subcategory"] == "other"]
    result["needs_review"] = len(result["unclassified"]) > 0
    
    return result


if __name__ == "__main__":
    import sys
    import json
    if len(sys.argv) < 2:
        print("Usage: python receipt_parser.py <path_to_pdf>")
        sys.exit(1)
    result = parse_receipt_pdf(sys.argv[1])
    print(json.dumps(result, indent=2))
    print(f"\n--- Summary ---")
    print(f"Store: {result['store']}")
    print(f"Date: {result['date']}")
    print(f"Items: {len(result['items'])}")
    print(f"Total: ${result['total']:.2f}")
    print(f"Savings: ${result['savings']:.2f}")
    print(f"\nSub-categories:")
    cats = {}
    for item in result["items"]:
        cats[item["subcategory"]] = cats.get(item["subcategory"], 0) + item["amount"]
    for cat, amt in sorted(cats.items(), key=lambda x: -x[1]):
        print(f"  {cat}: ${amt:.2f}")
