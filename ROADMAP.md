# Ice Dynasty - Game Design & Roadmap

## Vision

Build a hockey empire from a small amateur club to an international franchise. Inspired by Antimatter Dimensions with cascading progression, challenges, achievements, and multiple prestige layers.

---

## Era 1: Grassroots (2-6 timmar)

### Kärnmekanik
- **Training Minutes** - Huvudvaluta (passiv + klick)
- **Matcher** - Ger fans och pengar, låses upp vid 100 träningsminuter
- **Lagmoral** - Global multiplier som köps med pengar

### Resurser
| Resurs | Källa | Användning |
|--------|-------|------------|
| Training Minutes | Passiv + klick | Köp upgrades |
| Fans | Vinn matcher | Ökar matchinkomst, unlock-krav |
| Money | Spela matcher | Köp Lagmoral |

### Lagmoral (Global Multiplier)
- Börjar på 1.0x
- Uppgraderas med pengar (inte träningsminuter)
- Varje nivå: +0.05x (1.0 → 1.05 → 1.10 → ...)
- Maxnivå: 100 (= 6x multiplicator)
- Kostnad skalas exponentiellt (100 → 150 → 225 → ...)
- **Påverkar:** Träning/s, klickstyrka, matchvinst-chans (+1% per 20 nivåer)

### Upgrades (14 totalt)

**Alltid Tillgängliga (7):**
| ID | Namn | Effekt | Baskostnad | Skalning | Max |
|----|------|--------|------------|----------|-----|
| better_skates | Better Skates | +1 click | 10 | 1.5x | 50 |
| training_rink | Training Rink | +0.5/s training | 50 | 1.4x | 100 |
| youth_program | Youth Program | +10% fans | 200 | 1.8x | 25 |
| merchandise | Merchandise Stand | +20% money | 500 | 2.0x | 25 |
| hockey_sticks | Better Sticks | +2 click | 25 | 1.6x | 40 |
| volunteer_coaches | Volunteer Coaches | +1/s training | 100 | 1.5x | 75 |
| garage_rink | Garage Rink | +2.5% win chance | 150 | 1.7x | 20 |

**Upplåsbara (7):**
| ID | Namn | Effekt | Kostnad | Krav |
|----|------|--------|---------|------|
| equipment_locker | Equipment Locker | 1.1x click mult | 400 | 500 fans |
| local_sponsors | Local Sponsors | +$25 base money | 750 | 50 matcher |
| team_jerseys | Team Jerseys | +5% fans & money | 1000 | 1000 fans |
| outdoor_flooding | Outdoor Flooding | +3/s training | 2500 | 100 matcher |
| community_support | Community Support | +50% fans | 5000 | 2500 fans |
| tournament_entry | Tournament Entry | +100% win bonus | 10000 | 25 vinster |
| grassroots_legend | Grassroots Legend | 1.25x training mult | 25000 | 5000 fans |

### Match System
- **Unlock:** 100 träningsminuter
- **Cooldown:** 30 sekunder
- **Vinst-chans:** 40% bas, +30% max från träning, +bonus från upgrades/achievements
- **Vinst:** ~15 fans, 1.5x pengar
- **Förlust:** ~5 fans, 1x pengar
- **Pengar:** 50 + (fans × 2) × multipliers

---

## Challenges (Era 1)

Frivilliga men starkt incentiverade. Utan challenges tar Era 2 ~3x längre.

| Challenge | Restriktion | Belöning | Unlock vid |
|-----------|-------------|----------|------------|
| **Rookie Mode** | 50% win chance cap | +10% base fan gain | 10 matcher |
| **Fatigue Test** | Ingen passiv träning | +15% training rate | 500 fans |
| **Budget Season** | 0$ i 10 matcher | +30% base money | $5000 |
| **Marathon** | Vinn 5 i rad | +20% click power | 25 vinster |
| **Underdog** | Vinn utan click-upgrades | +5% win chance | 50 vinster |

**Total bonus (alla challenges):** +10% fans, +15% training, +30% money, +20% click, +5% win

---

## Achievements

Alla achievements har dolda krav. Svåra/meningsfulla ger permanenta bonusar.

### Med Permanent Bonus
| Namn | Krav (dolt) | Bonus | Svårighet |
|------|-------------|-------|-----------|
| **"Hot Streak"** | Vinn 5 i rad | +5% win chance | Medium |
| **"Clutch Player"** | Vinn med <45% chance | +3% win chance | Svår |
| **"The Comeback"** | Vinn efter 5 förluster | +10% fan gain | Medium |
| **"Century"** | 100 vinster | +15% money | Lång |
| **"Devoted Coach"** | 10,000 träningsmin | +10% training rate | Lång |
| **"Sellout"** | $25,000 samlat | +20% base money | Medium |
| **"Viral Moment"** | 5,000 fans | +25% fan gain | Lång |
| **"Lucky Number"** | Vinn 7-0 | +7% allt | Tur |

### Cosmetic Achievements
| Namn | Krav (dolt) | Reward |
|------|-------------|--------|
| **"Speed Demon"** | 20 klick på 3s | Badge: Lightning |
| **"Night Owl"** | Spela 00:00-04:00 | Mörkt tema |
| **"Hyperactive"** | 100 klick på 10s | Badge: Tornado |
| **"Patience"** | 5 min utan klick | Badge: Zen |
| **"Marathon Runner"** | 100 matcher/session | Gold border |
| **"First Steps"** | Skapa klubb | Badge: Baby skate |
| **"First Blood"** | Vinn första match | Badge: Trophy |

---

## Era 1 Completion

**Krav för Era 2:**
- 10,000 fans
- 50 vinster
- $50,000

**Förväntad tid:** 2-6 timmar (med challenges)

---

## Era 2: Local Club (4-10 timmar)

### Nya Mekaniker
- **Spelartrupp** - 5 spelare med stats (skating, shooting, passing, defense, goaltending)
- **Erfarenhet** - Ny resurs som cascadar till träning
- **Liga-matcher** - Matcher mot AI-lag i tabell

### Nya Challenges
- Liga-relaterade utmaningar
- Säsongsbaserade mål

### Prestige
- "Säsongsreset" för permanent bonus
- Behåller achievements och cosmetics

---

## Era 3: Elite Push (8-20 timmar)

### Nya Mekaniker
- **Ungdomsakademi** - Producerar nya spelare
- **Talang** - Sällsynt resurs, förbättrar spelarpotential
- **Sponsorer** - Passiv inkomst baserat på prestanda

### Automation
- Auto-träning
- Auto-köp av upgrades

### Nya Challenges
- Cupspel med knockout-format
- Rivallag-utmaningar

---

## Era 4: International (20+ timmar)

### Nya Mekaniker
- **Franchise** - Äg flera klubbar
- **Synergier** - Klubbar boostrar varandra
- **Internationella turneringar**

### Final Prestige
- "Dynasty Reset" → Permanent legacy bonus
- Ny spelomgång med bonusar

---

## Design Decisions Log

### 2026-01-12
- **Tema:** Hockey empire building (unikt i incremental-genren)
- **Perspektiv:** Klubbhantering (inte individuell spelare)
- **Estetik:** Vintage arena scoreboard (Bebas Neue, Orbitron, Barlow)
- **Default färger:** Röd (#dc2626) och vit (#ffffff)

### 2026-01-12 (Kväll)
- **Antimatter Dimensions-inspirerad:** Challenges, achievements, cascading progression
- **Lagmoral:** Global multiplier som "Tickspeed"-equivalent
- **Play Match unlock:** Låst bakom 100 träningsminuter
- **Achievements:** Blandning av bonus och cosmetic med dolda krav
- **Challenges:** Frivilliga men starkt incentiverade (3x längre utan)
