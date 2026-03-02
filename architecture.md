# Look For Neighbourhood — Server Architecture

## High-Level System Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (React + Map)                          │
│  ┌──────────┐  ┌────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Map View │  │ Search Bar │  │ Score Cards  │  │ Neighbourhood Detail │  │
│  └────┬─────┘  └─────┬──────┘  └──────┬───────┘  └──────────┬───────────┘  │
│       └──────────────┼────────────────┼──────────────────────┘              │
└──────────────────────┼────────────────┼─────────────────────────────────────┘
                       │  GET /api/v1/neighbourhoods/:zipOrCoords
                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                        API GATEWAY (Express + Node)                         │
│                                                                             │
│  ┌─────────────┐  ┌──────────────────┐  ┌─────────────┐  ┌──────────────┐  │
│  │  Validator  │→ │  Orchestrator    │→ │  AI Enricher│→ │  Response    │  │
│  │  (Zod)     │  │  (Promise.all)   │  │  (Abacus)   │  │  Builder     │  │
│  └─────────────┘  └───────┬──────────┘  └─────────────┘  └──────────────┘  │
│                           │                                                 │
│              ┌────────────┼─────────────────────┐                           │
│              ▼            ▼                     ▼                           │
│  ┌──────────────┐ ┌──────────────┐  ┌──────────────────┐                   │
│  │ Cache Check  │ │ Data Fetchers│  │  CSV Pre-loader  │                   │
│  │ (Supabase)   │ │ (parallel)   │  │  (startup)       │                   │
│  └──────┬───────┘ └──────┬───────┘  └──────────────────┘                   │
│         │                │                                                  │
│         │    ┌───────────┼───────────┬──────────────┬──────────┐           │
│         │    ▼           ▼           ▼              ▼          ▼           │
│         │ ┌──────┐  ┌────────┐  ┌────────┐   ┌─────────┐ ┌────────┐      │
│         │ │Zillow│  │Overpass│  │Census  │   │WalkScore│ │Reddit  │      │
│         │ │(CSV) │  │(OSM)   │  │Bureau  │   │  API    │ │  API   │      │
│         │ └──────┘  └────────┘  └────────┘   └─────────┘ └────────┘      │
│         │                                                                  │
│         ▼                                                                  │
│  ┌─────────────────────────────────────────────────────┐                   │
│  │              SUPABASE (PostgreSQL)                   │                   │
│  │  ┌───────────┐ ┌──────────────┐ ┌────────────────┐  │                   │
│  │  │  Cache    │ │  Pre-loaded  │ │  Search Logs   │  │                   │
│  │  │  Table    │ │  Rent Data   │ │  (analytics)   │  │                   │
│  │  └───────────┘ └──────────────┘ └────────────────┘  │                   │
│  └─────────────────────────────────────────────────────┘                   │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Pipeline — Request Flow

```
User Request (zip: 53202)
        │
        ▼
┌───────────────────┐
│ 1. VALIDATE INPUT │  Zod: zip code or lat/lng
└───────┬───────────┘
        │
        ▼
┌───────────────────┐     HIT ──→ Return cached JSON (< 50ms)
│ 2. CHECK CACHE    │────────────────────────────────────────→ Response
│    (Supabase)     │
└───────┬───────────┘
        │ MISS
        ▼
┌───────────────────────────────────────────────┐
│ 3. PARALLEL DATA FETCH (Promise.allSettled)   │
│                                               │
│   ┌─────────┐ ┌──────┐ ┌──────┐ ┌──────────┐ │
│   │  Rent   │ │ POI  │ │Crime │ │ Transit  │ │   ← each fetcher is
│   │ Fetcher │ │Fetch │ │Fetch │ │ Fetcher  │ │     independent module
│   └─────────┘ └──────┘ └──────┘ └──────────┘ │
│   ┌─────────┐ ┌──────┐ ┌──────┐              │
│   │ Census  │ │Reddit│ │ Park │              │
│   │ Fetcher │ │Fetch │ │Fetch │              │
│   └─────────┘ └──────┘ └──────┘              │
└───────────────────┬───────────────────────────┘
                    │ raw data objects
                    ▼
┌───────────────────────────────────────────────────┐
│ 4. AI ENRICHMENT (Abacus — per-section prompts)   │
│                                                   │
│  Input:  raw JSON from all fetchers               │
│  Strategy: ONE structured LLM call with           │
│  per-section narrative instructions               │
│                                                   │
│  Output per section:                              │
│   • raw data (numbers/lists for UI cards)        │
│   • ai_insight (human narrative explaining data) │
│   • ai_recommendations (actionable advice)       │
└───────────────────┬───────────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────────────┐
│ 5. CACHE & RESPOND                                │
│                                                   │
│  - Store enriched result in Supabase              │
│    with TTL (24h for rent, 6h for sentiment)      │
│  - Return to client                               │
└───────────────────────────────────────────────────┘
```

---

## Key Architecture Decisions

### 1. No RAG Needed

RAG is overkill here. You're not searching through a large corpus of unstructured docs. Instead:
| What RAG solves | Your situation |
| --------------------------- | -------------------------------------------- |
| Searching 1000s of docs | You have 7 structured APIs |
| Unstructured knowledge base | APIs return JSON/CSV — already structured |
| Need semantic search | You know exactly what to query by zip/coords |
**Use AI as a "summarizer + scorer"** — feed it the raw structured data, get back a formatted report. One LLM call per request (cached).

### 2. Fetcher Module Pattern

Each data source = one isolated fetcher module. This is critical for hackathon resilience:

```
src/modules/fetchers/
  ├── rent.fetcher.ts        ← Zillow CSV lookup
  ├── safety.fetcher.ts      ← Socrata/SODA API
  ├── pois.fetcher.ts        ← Overpass API (OSM)
  ├── demographics.fetcher.ts ← Census Bureau API
  ├── transit.fetcher.ts     ← Walk Score API
  ├── sentiment.fetcher.ts   ← Reddit API
  ├── greenspace.fetcher.ts  ← Overpass API (OSM parks)
  └── index.ts               ← exports fetchAll(zip) → Promise.allSettled
```

Each fetcher implements:

```typescript
interface FetcherResult<T> {
  source: string;
  data: T | null;
  error?: string;
  fetchedAt: Date;
}
type Fetcher = (zipOrCoords: LocationInput) => Promise<FetcherResult<unknown>>;
```

`Promise.allSettled` means if Reddit API is down, you still get rent + safety + POIs. **Graceful degradation**.

### 3. Caching Strategy (Critical for Hackathon)

```
┌────────────────────┬──────────────┬────────────────────┐
│ Data Type          │ Cache TTL    │ Reason             │
├────────────────────┼──────────────┼────────────────────┤
│ Rent (Zillow CSV)  │ 7 days       │ Monthly updates    │
│ Crime/Safety       │ 24 hours     │ Daily data feeds   │
│ POIs (OSM)         │ 7 days       │ Rarely changes     │
│ Demographics       │ 30 days      │ Annual survey      │
│ Transit/Walk Score │ 30 days      │ Rarely changes     │
│ Reddit Sentiment   │ 6 hours      │ Fresh vibes matter │
│ Green Space (OSM)  │ 7 days       │ Rarely changes     │
│ AI-Enriched Report │ 12 hours     │ Balance freshness  │
│ Geocoding (Lat/Lng)│ Forever      │ Zip codes rarely move│
└────────────────────┴──────────────┴────────────────────┘
```

Supabase table:

```sql
CREATE TABLE cache (
  key       TEXT PRIMARY KEY,    -- e.g. "rent:53202" or "report:53202"
  data      JSONB NOT NULL,
  source    TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE geocode_cache (
  zip_code  TEXT PRIMARY KEY,
  lat       FLOAT NOT NULL,
  lng       FLOAT NOT NULL
);
```

> [!CAUTION]
> **PostgreSQL has no automatic TTL eviction** like MongoDB.
> `cache.service.ts` must manually filter out expired rows on read:
> `SELECT * FROM cache WHERE key = $1 AND expires_at > NOW()`.
> Write operations should upsert (`ON CONFLICT (key) DO UPDATE`).

### 4. CSV Pre-loading (Zillow ZORI)

Zillow CSV is ~50MB. Don't parse it per-request.

```
Server Startup
      │
      ▼
┌─────────────────────────────────┐
│  Load ZORI CSV into Supabase   │
│  (one-time script / seed)      │
│                                 │
│  zip_code │ median_rent │ date  │
│  53202    │ $1,450      │ 2024  │
│  53211    │ $1,200      │ 2024  │
└─────────────────────────────────┘
      │
      ▼
  Runtime: SELECT * FROM rent_data WHERE zip = $1
  Response time: < 10ms
```

## Run a seed script once: `npm run seed:zillow` that parses CSV → inserts into Supabase `rent_data` table.

## Recommended Data Sources (Simplified for Hackathon)

> [!IMPORTANT]
> Prioritize **free, no-key-needed** APIs first. Only add keyed APIs if you have time.
> | Feature | **Go-To Source** | Auth | Notes |
> | ------------------ | ------------------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------- |
> | Rent | Zillow ZORI CSV (pre-loaded) | None | Download once, seed DB |
> | Safety | Socrata SODA API | None | Use city-specific endpoints (Milwaukee has one) |
> | POIs + Green Space | **Overpass API (OSM)** | None | Single source for both POIs AND parks |
> | Demographics | Census Bureau ACS | Free key | 500 req/day free |
> | Transit | Walk Score API | Free key | Limited free tier |
> | Sentiment | Reddit API (via old.reddit.com JSON) | OAuth | Append [.json](file:///Users/werty.potom/Desktop/look-for-neighbourhood/package.json) to subreddit URL for quick hack |
> [!TIP]
> **Combine POIs + Green Space into one Overpass query.** One API call returns both cafes/gyms AND parks. Saves time and API calls.

---

## Simplified User Flow (Recommended)

```
┌─────────────────────────────────────┐
│  User enters ZIP CODE (e.g. 53202) │   ← simplest input, maps to all APIs
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Server returns Neighbourhood       │
│  Report Card:                       │
│                                     │
│  ┌───────────┐ ┌──────────────────┐ │
│  │ Rent: $1450│ │ Safety: 7.2/10 │ │
│  │ median/mo  │ │ ▼12% crimes YoY│ │
│  └───────────┘ └──────────────────┘ │
│  ┌───────────┐ ┌──────────────────┐ │
│  │ Vibe:     │ │ Transit: 65/100 │ │
│  │ "Artsy"   │ │ Walk Score      │ │
│  └───────────┘ └──────────────────┘ │
│  ┌───────────┐ ┌──────────────────┐ │
│  │ Parks: 12 │ │ Demo: Median    │ │
│  │ within 1mi│ │ age 32, $55K    │ │
│  └───────────┘ └──────────────────┘ │
│  ┌──────────────────────────────────┤
│  │ AI Summary:                      │
│  │ "This area is a walkable, artsy  │
│  │  neighbourhood popular with      │
│  │  young professionals..."         │
│  └──────────────────────────────────┘
└─────────────────────────────────────┘
```

> [!TIP]
> **Zip code > map click** for hackathon. ZIP maps directly to Census, Zillow, and can be geocoded for Overpass/WalkScore. Map selection requires reverse-geocoding, boundary polygons, etc. — too much scope.

## You can still show a map on the client (Leaflet/Mapbox) that highlights the zip code area, but the **input is just a text field**.

## Proposed Folder Structure

```
src/
├── app.ts
├── index.ts
├── config/
│   └── env.ts                     ← validated env vars (Zod)
├── modules/
│   ├── neighbourhoods/
│   │   ├── neighbourhoods.routes.ts
│   │   ├── neighbourhoods.controller.ts
│   │   ├── neighbourhoods.service.ts    ← orchestrator lives here
│   │   └── neighbourhoods.types.ts
│   └── fetchers/
│       ├── fetcher.types.ts        ← shared FetcherResult interface
│       ├── rent.fetcher.ts
│       ├── safety.fetcher.ts
│       ├── pois.fetcher.ts
│       ├── demographics.fetcher.ts
│       ├── transit.fetcher.ts
│       ├── sentiment.fetcher.ts
│       ├── greenspace.fetcher.ts
│       └── index.ts                ← fetchAll()
├── services/
│   ├── ai.service.ts              ← Abacus wrapper
│   ├── cache.service.ts           ← Supabase cache R/W
│   └── supabase.client.ts         ← Supabase client init
├── utils/
│   ├── geocode.ts                 ← zip → lat/lng converter
│   └── logger.ts
└── scripts/
    └── seed-zillow.ts             ← CSV → Supabase loader
```

---

## AI Enrichment Strategy (Abacus)

**Core Principle: Don't give data — give insights.** Every section must answer "what does this mean for ME as a person moving here?"

### Strategy 1 & 4: Pre-Summarize at the Fetcher Level (Data Minimization)

Raw JSON from 7 APIs will blow up the LLM context window. Instead of a separate Aggregator step, we will use **Strategy 1** and **Strategy 4** directly inside the fetchers:

- **Strategy 1 (All Fetchers):** Each fetcher returns a pre-compressed summary. The LLM never sees raw API payloads.
  - _Example:_ Overpass API returns 847 nodes -> `pois.fetcher.ts` aggregates it into `{"cafes": 23, "top_named_places": [...]}`.
- **Strategy 4 (Reddit):** Reddit is the worst offender. `sentiment.fetcher.ts` will:
  1. Filter posts mentioning the neighbourhood name.
  2. Keep top 10 by upvotes.
  3. Extract only the first 2 sentences of each post.
  4. Feed that to the LLM (~600 tokens total instead of ~10k).

### The AI Processing Step (Parallel)

Instead of one giant call, we use **Strategy 2 (Parallel Section-Scoped LLM Calls)**.
Fire 7 small parallel LLM calls (one per section). Each call is ~500-800 tokens.

```typescript
// Promise.allSettled()
├──→ llm.enrichSafety(safety_data)
├──→ llm.enrichPOIs(poi_data)
├──→ llm.enrichDemographics(census_data)
├──→ llm.enrichTransit(transit_data)
├──→ llm.enrichRent(rent_data)
├──→ llm.enrichSentiment(reddit_data)
└──→ llm.enrichVibe(all_summaries)
```

**Trade-off:** More API calls (7 vs 1), but each is cheaper, faster, and if one fails you still get 6 sections.

- Rent: {rent_data}
- Crime incidents (last 90d): {crime_data}
- Points of Interest: {poi_data} (with names, types, ratings)
- Demographics: {census_data}
- Transit & Walk Score: {transit_data}
- Resident posts: {reddit_data}
- Parks: {park_data}
  Return JSON matching this exact schema:
  {
  "vibe": {
  "label": "Artsy & Walkable",
  "reasoning": "Explain WHY this label: which POIs, demographics,
  and sentiment signals led to it. E.g. 'High density
  of independent coffee shops and galleries, combined
  with a young median age of 32 and Reddit posts
  frequently mentioning art walks and live music.'",
  "who_fits_here": "Young professionals, creatives, people who..."
  },
  "safety": {
  "data": { incidents, trend, types },
  "top_crimes": [ top 5 most frequent crime types with counts ],
  "recent_incidents": [ 5 most recent crime reports: date, type, block ],
  "ai_assessment": "A frank, honest paragraph: Is it safe to walk
  at night? Which blocks to avoid? How does it
  compare to city average? What precautions?"
  },
  "pois": {
  "data": { counts by type },
  "recommendations": [
  "Try Colectivo Coffee on Prospect Ave — a local favourite
  with outdoor seating and lake views.",
  "Lakeshore State Park is 100m from the waterfront — perfect
  for evening runs along the lake trail.",
  "The Third Ward has 12 art galleries within walking distance..."
  ]
  },
  "demographics": {
  "data": { age, income, population, diversity_index },
  "community_profile": "Describe the PEOPLE: 'This is a young,
  diverse community. Most residents are
  25-35 working in tech and healthcare.
  You'll find people who bike to work,
  frequent farmers markets, and are
  generally progressive. The median income
  of $55K means moderate cost-consciousness
  — expect affordable dining options.'"
  },
  "transit": {
  "data": { walk_score, transit_score, bike_score },
  "bus_stops_nearby": [ list from OSM ],
  "commute_guide": "Practical commute info: 'Bus routes 15 and 30
  run every 12 min to downtown (15 min ride).
  Uber to downtown is ~$8-12. Street parking is
  tight after 6pm. Traffic noise is moderate on
  main corridors but quiet on side streets.
  If you work downtown, you can walk in 20 min.'"
  },
  "rent": {
  "data": { median, range, trend },
  "ai_insight": "Contextualize: 'At $1,450/mo median, this area
  is 15% above the Milwaukee average. A 1BR runs
  $950-$1,200, 2BR around $1,400-$1,800. Prices
  have been rising ~4% annually. For what you get
  (walkability, nightlife), it's competitive with
  similar neighbourhoods like Bay View.'"
  },
  "greenspace": {
  "data": { parks_count, nearest },
  "recommendations": [ specific park suggestions with activities ]
  },
  "sentiment": {
  "data": { positive_pct, top_topics },
  "sample_quotes": [ 3-5 actual Reddit quotes ],
  "vibe_summary": "What residents actually say about living here"
  },
  "overall_summary": "2-3 paragraph relocation brief",
  "highlights": [ top 3 pros with explanations ],
  "concerns": [ top 3 cons with explanations ]
  }

```

> [!CAUTION]
> **To avoid hitting AI rate limits**: cache the AI-enriched report for 12h per zip. Most users searching the same zip get the cached version.
> [!TIP]
> **Token optimization**: Strip raw data to essential fields before sending to LLM. E.g. for POIs, send top 20 named places, not all 200 unnamed nodes from Overpass.

---

## Why Supabase over MongoDB

For this project, **Supabase (PostgreSQL)** wins:
| Factor | Supabase | MongoDB |
| ---------------------- | ------------------------------ | --------------- |
| JSONB for cache | ✅ native | ✅ native |
| Geo queries (PostGIS) | ✅ built-in | ⚠️ needs config |
| TTL / expiry cache | ✅ `expires_at` + query filter | ✅ TTL indexes |
| Free tier | ✅ generous | ✅ Atlas free |
| Auth (if needed later) | ✅ built-in | ❌ separate |
| Hackathon speed | ✅ dashboard + instant API | ⚠️ more setup |

---

## API Contract (Single Endpoint)

```

GET /api/v1/neighbourhoods/:zip
Response 200:
{
"zip": "53202",
"city": "Milwaukee",
"neighbourhood": "East Town",
"vibe": {
"label": "Artsy & Walkable",
"reasoning": "High density of independent coffee shops (23) and
galleries (5), combined with a young median age of 32.
Reddit posts frequently mention art walks, live music,
and the Third Ward farmers market. The area attracts
creatives and young professionals.",
"who_fits_here": "Young professionals, creatives, foodies, and
anyone who values walkability over yard space."
},
"safety": {
"score": 7.2,
"incidents_last_90d": 134,
"trend": "decreasing",
"top_crimes": [
{ "type": "Theft", "count": 45 },
{ "type": "Vehicle Break-in", "count": 28 },
{ "type": "Assault", "count": 18 }
],
"recent_incidents": [
{ "date": "2026-02-28", "type": "Theft", "location": "700 block N Broadway" },
{ "date": "2026-02-27", "type": "Vandalism", "location": "500 block E Mason" }
],
"ai_assessment": "East Town is moderately safe. Property crime
(theft, car break-ins) is the main concern — avoid leaving
valuables in parked cars. Violent crime is below city average.
Walking at night on main streets (Broadway, Water St) is
generally fine. Side streets east of Van Buren are quieter
and safer. Crime has dropped 12% year-over-year.",
"source": "Milwaukee Socrata"
},
"pois": {
"counts": { "cafes": 23, "gyms": 8, "galleries": 5, "restaurants": 67, "parks": 12 },
"recommendations": [
"Colectivo Coffee on Prospect Ave is a beloved local roaster with lake views and outdoor seating — a great morning routine spot.",
"Lakeshore State Park is a 5-min walk from most of East Town — ideal for evening runs along the lake trail.",
"The Third Ward has 12 art galleries within walking distance. First Fridays gallery nights are a must.",
"Stone Creek Coffee + Crossroads Collective food hall give you variety without driving anywhere."
],
"source": "OpenStreetMap"
},
"demographics": {
"median_age": 32,
"median_income": 55000,
"population": 12400,
"diversity_index": 0.62,
"community_profile": "This is a young, moderately diverse community.
Most residents are 25-35, working in tech, healthcare, and
creative industries. You'll find people who bike to work,
frequent the farmers market on Saturdays, and are generally
progressive. The median income of $55K means the area is
middle-class — expect affordable casual dining but fewer
luxury options. Newcomers find it easy to integrate through
community events and the active bar/restaurant scene.",
"source": "Census ACS"
},
"transit": {
"walk_score": 72,
"transit_score": 58,
"bus_stops_nearby": [
{ "name": "Broadway & Mason", "routes": ["15", "30"], "distance_m": 120 },
{ "name": "Water & Wisconsin", "routes": ["GRE", "14"], "distance_m": 300 }
],
"commute_guide": "Bus routes 15 and 30 run every 12 min to downtown
(15-min ride). An Uber to downtown is ~$8-12. Street parking
is tight after 6pm — expect to walk 2-3 blocks from your spot.
Traffic noise is moderate on Broadway and Water St but quiet
on residential side streets. If you work downtown, you can
walk there in 20 minutes. No bike lanes on main streets yet,
but many residents bike on side streets.",
"source": "Walk Score + OSM"
},
"rent": {
"median": 1450,
"range": { "low": 950, "high": 2100 },
"ai_insight": "At $1,450/mo median, this area is about 15% above
the Milwaukee average. A 1BR runs $950-$1,200, a 2BR around
$1,400-$1,800. Prices have risen ~4% annually. For what you
get — walkability, nightlife, lake proximity — it's
competitive with similar areas like Bay View.",
"source": "Zillow ZORI"
},
"greenspace": {
"parks_within_1mi": 12,
"nearest_park": { "name": "Cathedral Square", "distance_m": 200 },
"recommendations": [
"Cathedral Square (200m) hosts summer concerts and a weekly farmers market.",
"Lakeshore State Park (800m) has a 2-mile lakefront trail — best sunset views in the city.",
"Juneau Park (400m) has an off-leash dog area and connects to the Oak Leaf Trail."
],
"source": "OpenStreetMap"
},
"sentiment": {
"positive_pct": 68,
"top_topics": ["nightlife", "food scene", "parking", "lake access"],
"sample_quotes": [
"Moved to East Town last year — the walkability is unreal, I barely use my car.",
"Parking is a nightmare after 6pm, but worth it for the location.",
"Third Ward farmers market every Saturday is my favourite thing about living here."
],
"vibe_summary": "Residents love the walkability and food scene but
consistently complain about parking. The area is seen as
Milwaukee's most 'urban' neighbourhood — people who move
here tend to stay.",
"source": "Reddit r/milwaukee"
},
"overall_summary": "East Town is Milwaukee's most walkable, urban-feeling
neighbourhood. If you value being able to walk to restaurants,
coffee shops, and the lakefront over having a backyard, this is
your spot. Rent is above average but justified by the lifestyle.
Safety is solid for a downtown-adjacent area — property crime
exists but violent crime is low. The community skews young and
creative. Main downside: parking is genuinely difficult.",
"highlights": [
"Exceptional walkability — most errands on foot",
"Vibrant food and coffee scene with local businesses",
"Lake Michigan access within walking distance"
],
"concerns": [
"Parking is very limited, especially evenings",
"Rent trending upward, 15% above city average",
"Some property crime (car break-ins) — don't leave valuables visible"
],
"cached_at": "2026-03-01T18:00:00Z",
"data_freshness": { "rent": "7d", "safety": "24h", "sentiment": "6h" }
}

```

---

## Implementation Priority (24h Hackathon)

| Priority | Task                                                   | Time Est. |
| -------- | ------------------------------------------------------ | --------- |
| **P0**   | Supabase setup + cache table                           | 30 min    |
| **P0**   | Fetcher pattern + `rent.fetcher.ts` (Zillow CSV seed)  | 1.5h      |
| **P0**   | `pois.fetcher.ts` + `greenspace.fetcher.ts` (Overpass) | 1h        |
| **P0**   | Orchestrator service (`Promise.allSettled` + cache)    | 1h        |
| **P0**   | AI enrichment (Abacus single call)                     | 1h        |
| **P1**   | `safety.fetcher.ts` (Socrata)                          | 1h        |
| **P1**   | `demographics.fetcher.ts` (Census)                     | 1h        |
| **P1**   | `sentiment.fetcher.ts` (Reddit)                        | 1h        |
| **P2**   | `transit.fetcher.ts` (Walk Score)                      | 45 min    |
| **P2**   | Error handling polish + logging                        | 30 min    |
| **P2**   | Client integration                                     | remaining |

---

## Verification Plan

### Automated

- `curl http://localhost:3000/api/v1/neighbourhoods/53202` → verify JSON shape matches contract
- Unit test each fetcher with mocked responses
- Cache hit/miss test: first call fetches, second call returns from cache

### Manual

- Confirm Zillow CSV seeds into Supabase correctly
- Verify Overpass API returns Milwaukee POIs
- Verify AI summary is coherent and matches structured data
```
