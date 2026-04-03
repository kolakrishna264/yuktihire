"""Normalize job locations and detect country."""

US_STATES = {
    "alabama", "alaska", "arizona", "arkansas", "california", "colorado",
    "connecticut", "delaware", "florida", "georgia", "hawaii", "idaho",
    "illinois", "indiana", "iowa", "kansas", "kentucky", "louisiana",
    "maine", "maryland", "massachusetts", "michigan", "minnesota",
    "mississippi", "missouri", "montana", "nebraska", "nevada",
    "new hampshire", "new jersey", "new mexico", "new york",
    "north carolina", "north dakota", "ohio", "oklahoma", "oregon",
    "pennsylvania", "rhode island", "south carolina", "south dakota",
    "tennessee", "texas", "utah", "vermont", "virginia", "washington",
    "west virginia", "wisconsin", "wyoming",
}

US_STATE_ABBREVS = {
    "al", "ak", "az", "ar", "ca", "co", "ct", "de", "fl", "ga", "hi", "id",
    "il", "in", "ia", "ks", "ky", "la", "me", "md", "ma", "mi", "mn", "ms",
    "mo", "mt", "ne", "nv", "nh", "nj", "nm", "ny", "nc", "nd", "oh", "ok",
    "or", "pa", "ri", "sc", "sd", "tn", "tx", "ut", "vt", "va", "wa", "wv",
    "wi", "wy", "dc",
}

US_CITIES = {
    "new york", "los angeles", "chicago", "houston", "phoenix", "philadelphia",
    "san antonio", "san diego", "dallas", "san jose", "austin", "jacksonville",
    "san francisco", "seattle", "denver", "boston", "nashville", "portland",
    "atlanta", "miami", "minneapolis", "raleigh", "charlotte", "tampa",
    "pittsburgh", "st louis", "orlando", "columbus", "indianapolis",
    "salt lake city", "arlington", "detroit", "memphis",
}

NON_US_MARKERS = {
    "united kingdom", "uk", "london", "manchester", "birmingham", "england",
    "scotland", "wales", "ireland", "dublin",
    "germany", "berlin", "munich", "frankfurt", "hamburg",
    "france", "paris", "lyon",
    "netherlands", "amsterdam", "rotterdam",
    "spain", "madrid", "barcelona",
    "italy", "rome", "milan",
    "sweden", "stockholm", "canada", "toronto", "vancouver", "montreal",
    "australia", "sydney", "melbourne", "india", "bangalore", "mumbai",
    "singapore", "japan", "tokyo", "brazil", "sao paulo",
    "europe", "eu", "emea", "apac",
}


def detect_country(location: str) -> str:
    """Detect country from location string. Returns 'US', 'REMOTE_US', 'REMOTE', or country name."""
    if not location:
        return "UNKNOWN"

    loc = location.lower().strip()

    # Explicit US markers
    if any(m in loc for m in ["united states", "usa", ", us", " us,", "(us)", "u.s."]):
        return "US"

    # Remote + US
    if "remote" in loc and any(m in loc for m in ["us", "usa", "united states", "north america"]):
        return "REMOTE_US"

    # Check for US states
    for state in US_STATES:
        if state in loc:
            return "US"

    # Check state abbreviations (e.g., "TX", "CA, US")
    parts = [p.strip().lower() for p in loc.replace(",", " ").split()]
    for part in parts:
        if part in US_STATE_ABBREVS:
            return "US"

    # Check US cities
    for city in US_CITIES:
        if city in loc:
            return "US"

    # Check non-US markers
    for marker in NON_US_MARKERS:
        if marker in loc:
            return "NON_US"

    # "Remote" without country qualifier
    if "remote" in loc or "worldwide" in loc or "anywhere" in loc:
        return "REMOTE"

    return "UNKNOWN"


def is_us_eligible(location: str) -> bool:
    """Check if a job is likely US-eligible."""
    country = detect_country(location)
    return country in ("US", "REMOTE_US", "REMOTE", "UNKNOWN")
