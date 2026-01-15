# Ice Dynasty - Game Design & Roadmap

## Vision

Build a hockey empire from a small amateur club to an international franchise. Inspired by Antimatter Dimensions with cascading progression, challenges, achievements, and multiple prestige layers.

---

## Era 1: Grassroots (2-6 timmar) ✅ IMPLEMENTERAT

### Kärnmekanik
- **Training Minutes** - Huvudvaluta (passiv + klick)
- **Matcher** - Ger fans och pengar, låses upp vid 100 träningsminuter, kostar training
- **Lagmoral** - Global multiplier som köps med pengar
- **Season System** - Prestige-loop med reputation som permanent valuta
- **Match Tactics** - Välj Offensive/Balanced/Defensive innan varje match

### Resurser
| Resurs | Källa | Användning |
|--------|-------|------------|
| Training Minutes | Passiv + klick | Köp upgrades, spela matcher |
| Fans | Vinn matcher | Ökar matchinkomst, unlock-krav, season progress |
| Money | Spela matcher | Köp Lagmoral |
| Reputation | Avsluta säsong | Permanenta upgrades (överlever reset) |

### Lagmoral (Global Multiplier)
- Börjar på 1.0x
- Uppgraderas med pengar (inte träningsminuter)
- Varje nivå: +0.05x (1.0 → 1.05 → 1.10 → ...)
- Maxnivå: 100 (= 6x multiplicator)
- Kostnad skalas exponentiellt (100 → 150 → 225 → ...)
- **Påverkar:** Träning/s, klickstyrka, matchvinst-chans (+1% per 20 nivåer)

### Season System (Prestige)
- **Mål:** Vinn 10 matcher per säsong
- **Belöning:** Reputation baserat på fans vid säsongsslut
- **Reset:** Förlorar training, fans, money, morale, upgrades
- **Behåller:** Reputation, achievements, challenge progress
- **Reputation upgrades:** Permanenta bonusar som gäller alla säsonger

### Match System
- **Unlock:** 100 träningsminuter
- **Kostnad:** Training minutes (skalas med antal matcher)
- **Tactics:**
  - **Offensive:** -15% win chance, +50% money
  - **Balanced:** Inga modifierare
  - **Defensive:** +10% win chance, +50% fans, -30% money
- **Vinst-chans:** 40% bas + bonusar från upgrades/achievements/tactics
- **Vinst:** ~15 fans, 1.5x pengar
- **Förlust:** ~5 fans, 1x pengar
- **Auto-match:** Kan låsas upp med "Improved Jockstraps" upgrade

### Upgrades (15 totalt)

**Alltid Tillgängliga (7):**
| ID | Namn | Effekt |
|----|------|--------|
| better_skates | Better Skates | +training per click |
| training_rink | Training Rink | +training/s |
| youth_program | Youth Program | +% fans |
| merchandise | Merchandise Stand | +% money |
| hockey_sticks | Better Sticks | +training per click |
| volunteer_coaches | Volunteer Coaches | +training/s |
| garage_rink | Garage Rink | +% win chance |

**Upplåsbara (8):**
| ID | Namn | Effekt | Krav |
|----|------|--------|------|
| equipment_locker | Equipment Locker | click multiplier | 500 fans |
| local_sponsors | Local Sponsors | +base money | 50 matcher |
| team_jerseys | Team Jerseys | +% fans & money | 1000 fans |
| outdoor_flooding | Outdoor Flooding | +training/s | 100 matcher |
| improved_jockstraps | Improved Jockstraps | **Auto-match** | 25 vinster |
| community_support | Community Support | +% fans | 2500 fans |
| tournament_entry | Tournament Entry | +win bonus | 25 vinster |
| grassroots_legend | Grassroots Legend | training multiplier | 5000 fans |

### UI: Unified Rink
- **En vy för allt:** Träning och matcher i samma rink
- **NES 8-bit stil:** Pixelspelare som åker runt
- **Knappar:** "Practice" (träning) separerat från "Play Match" (3 tactics)
- **Scoreboard:** Visar träningsrate under träning, matchresultat under match
- **Animationer:** Matchklocka, victory/defeat-skärm, puck som rör sig

---

## Challenges (Era 1) ✅ IMPLEMENTERAT

AD-inspirerat system med 8 challenges × 5 nivåer = 40 totala nivåer.
Varje nivå har ökande svårighet och stackande rewards.

### Challenge-lista
| Challenge | Bas-restriktion | Bas-belöning |
|-----------|-----------------|--------------|
| **Rookie Season** | Win chance cap | +win chance |
| **Budget Season** | No money income | +fan gain |
| **Intensive Training** | Training decay | +training rate |
| **All-Out Attack** | Forced offensive | +money gain |
| **Defensive Grind** | Forced defensive | +fan gain |
| **No Upgrades** | Can't buy upgrades | +all stats |
| **Speed Run** | Time limit | +reputation |
| **Marathon** | High win goal | +all stats |

### Nivåskalning
- **Svårighet:** `[1.0x, 1.5x, 2.0x, 3.0x, 5.0x]`
- **Rewards:** `[1.0x, 1.3x, 1.5x, 1.7x, 2.0x]` (stackar = 7.5x total vid L5)

### Exempel på nivåprogression
| Challenge | L1 | L2 | L3 | L4 | L5 |
|-----------|-----|-----|-----|-----|-----|
| Rookie Season | 50% cap | 45% | 40% | 35% | 30% |
| Speed Run | 180s | 120s | 90s | 60s | 30s |
| Marathon | 50 wins | 75 | 100 | 150 | 200 |

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

**Krav för Era 2:** (Ej implementerat ännu)
- 10,000 fans
- 50 vinster
- $50,000

**Nuvarande end-game:** Season System (prestige-loop med reputation)

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

### 2026-01-12 (Natt) - UX Beslut
- **Navigation:** Tab-baserad (Dashboard | Upgrades | Achievements | Challenges | Stats)
- **Tab-unlock:** Nya tabs dyker upp när relevant (t.ex. Achievements efter club creation)
- **Achievement-discovery (Hybrid):**
  - Bonus achievements: Synliga från start med namn + reward-typ, krav dolda ("???")
  - Cosmetic achievements: Helt dolda tills unlock (överraskning)
- **Era 2+ tabs:** Players, League, Academy, etc. läggs till när de låses upp

### 2026-01-14 - UX Förbättringar
- **Auto-match upgrade:** "Improved Jockstraps" - automatisk matchspelning (120s → 30s interval)
- **Challenge banner redesign:** Tröja med lagfärger, bättre kontrast, abandon-knapp
- **Header komprimering:** Resurser inline i header
- **Modal-komponent:** Återanvändbar för bekräftelser (reset, abandon challenge, etc.)
- **Challenge nivåsystem:** AD-inspirerat med 5 nivåer per challenge, stackande rewards

### 2026-01-14 - Dashboard Redesign: Unified Rink
- **Unified Rink:** Training och match i samma vy - större, mer dynamisk
- **NES 8-bit stil:** Animerade pixel-spelare, målvakter, domare och puck
  - Hemmalag: Spelarens valda färger
  - Bortalag: Slumpmässiga färger per match
  - Domare: Klassisk svart/vit-randig
- **4 Action buttons:** Training + 3 match tactics (Offensive/Balanced/Defensive)
- **Borttaget:** Separat "Play Match" knapp - taktik-val startar direkt matchen
- **Match animation:** 2.5s animation innan resultat visas

### 2026-01-15 - NES Ice Hockey Style & Polish
- **NES Ice Hockey sprites:** Sidovy med hjälm, visir, horisontella ränder, diagonal klubba
- **Målvakter:** Större sprites med pads, blocker, handske - placerade nära målen (7%/93%)
- **Träningsläge förbättrat:**
  - 12 spelare (5v5 + 2 målvakter)
  - Lagets två färger används (primär vs sekundär trupp)
  - Scoreboard visar träningsrate istället för matchinfo
- **Puck-animation:** Rör sig över hela isen mellan spelare
- **Knappgruppering:** "Practice" och "Play Match" separerade med olika ramar och etiketter
- **Matchklocka:** 5s nedräkning som respekterar dev speed
- **Victory/Defeat:** Fullskärmsmeddelande vid matchslut (guld konfetti vid vinst, röd text vid förlust)
- **Training boost:** 1.2s animation när man klickar (spelare rusar över isen)

---

## Backlog

### Prio 1 - Nästa att implementera
| Idé | Beskrivning |
|-----|-------------|
| **Training Boost Rework** | Klick på "Practice" boostar training/s under en viss tid istället för att ge training direkt. Mer idle-game-känsla. |

### Prio 2 - Bra idéer
| Idé | Beskrivning |
|-----|-------------|
| *Tom* | |

### Prio 3 - Kanske senare
| Idé | Beskrivning |
|-----|-------------|
| *Tom* | |
