# Design: Velkomstside og "Trekk fra bok"-modus

## Bakgrunn

Løsningen har i dag én trekningsmodus: trekke enkeltnumre uten tilbakelegging
fra et intervall. Betania julebasar trenger i tillegg en modus for å trekke
vinnerlodd organisert i bøker: hver bok har et nummerintervall (f.eks. 1–100),
det finnes et gitt antall bøker, og en trekning skal plukke både en tilfeldig
bok og et tilfeldig nummer i den boken — uten at samme bok+nummer-kombinasjon
kan trekkes to ganger.

`index.html` blir en velkomstside der brukeren velger mellom de to modusene,
i stedet for å gå rett til nummer-trekningens kontrollpanel.

## Filstruktur

| Fil (ny/endret) | Rolle |
|---|---|
| `index.html` | **Ny.** Velkomstside med to store, stablede knapper: "🔢 Trekk nummer" og "📖 Trekk fra bok". Lenker til hhv. `nummer-trekning.html` og `bok-trekning.html`. |
| `nummer-trekning.html` | **Flyttet/omdøpt** fra dagens `index.html`. Uendret innhold og oppførsel. |
| `bok-trekning.html` | **Ny.** Kontrollpanel for bok-trekning: tre tallfelt (Fra og med, Til og med, Antall bøker), samme innstillinger for hastighet/fargetema/eget vindu/historikk/nullstill som nummer-trekning. |
| `visning.html` | **Omdøpt** fra `trekning.html`. Delt, generisk visningsvindu for begge moduser. Hvilken modus vinduet kjører i bestemmes av query-parameteren `?mode=nummer` eller `?mode=bok`, satt av kontrollpanelet som åpner det. |
| `js/control.js` | Uendret: kontrollpanel-logikk for nummer-trekning. |
| `js/control-bok.js` | **Ny.** Kontrollpanel-logikk for bok-trekning. |
| `js/control-shared.js` | **Ny.** Fellesfunksjonalitet trukket ut av `control.js`/`control-bok.js` (se under). |
| `js/display.js` | **Utvidet.** Må forstå to visningsmodi (nummer vs. bok) via `?mode=`-parameteren og rendre/animere riktig. |
| `js/draw-logic.js` | **Utvidet** med én ny, ren funksjon: `decodeBookDraw`. Eksisterende funksjoner endres ikke. |

## Trekkelogikk for bok

Bok+nummer-trekning uten tilbakelegging gjenbruker den eksisterende, testede
`createDrawState(from, to)` / `drawNumber(state)` / `remainingCount` /
`isExhausted` ved å behandle hele bok×nummer-rommet som ett sammenhengende
heltallsintervall:

```
rangeSize   = til - fra + 1                      // nummer per bok
totalCombos = antallBøker * rangeSize
drawState   = createDrawState(0, totalCombos - 1)
```

Når `drawNumber(drawState)` returnerer en indeks, oversettes den til et
bok+nummer-par med en ny, ren funksjon i `draw-logic.js`:

```js
export function decodeBookDraw(index, from, to) {
  const rangeSize = to - from + 1;
  const book = Math.floor(index / rangeSize) + 1;   // bøker nummerert fra 1
  const number = from + (index % rangeSize);
  return { book, number };
}
```

Dette gir riktig "uten tilbakelegging"-garanti på tvers av hele bok×nummer-
rommet uten å duplisere eller endre eksisterende trekkelogikk.

Validering av "Antall bøker" gjenbruker samme mønster som
`validateInterval` (må være et helt tall ≥ 1); feilmeldinger vises i
`#errorMessage` som i dag.

## Visningsvindu (`visning.html`)

- Åpnes med `window.open('visning.html?mode=bok', ...)` (ev. `mode=nummer`).
- `display.js` leser `mode` fra `location.search` ved oppstart og:
  - velger riktig `BroadcastChannel`-navn: `loddtrekning-nummer` eller
    `loddtrekning-bok` — dette isolerer de to modiene fullstendig fra
    hverandre selv om begge skulle være åpne samtidig.
  - velger riktig rendrings-/animasjonslogikk (se under).
- Klikk/mellomrom-oppførselen (vent til bruker avslører trekningen, eller
  trigge et helt nytt trekk fra selve visningsvinduet når ingenting venter)
  er identisk i begge moduser — denne logikken er modusuavhengig i dag og
  endres ikke.

### Animasjon og visningsformat (bok-modus)

- Sekvensiell animasjon: bok-tallet ruller og stopper på endelig bok først,
  deretter ruller lodd-nummeret og stopper på endelig nummer. Implementeres
  ved å kalle den eksisterende `runRollingAnimation` to ganger etter
  hverandre (bok-fasen sin `onComplete` starter nummer-fasen) — selve
  animasjonsfunksjonen endres ikke.
- Sluttresultat vises som tekst «Bok 3 — nummer 42».
- Historikklisten (kompakt, øverst til høyre i visningsvinduet, og i
  kontrollpanelets historikk-ramme) viser formatet «3-42» per trekning.

## Deling av kode mellom kontrollpanelene

`control.js` og den nye `control-bok.js` er identiske i struktur (de skiller
seg i: input-felt, hvordan `drawState` opprettes/valideres, og hvordan et
resultat formateres for broadcast/historikk). Følgende trekkes ut til
`js/control-shared.js` for å unngå duplisering:

- `isDrawing`-sperren (synkron låsing før `await`, se tidligere feilretting).
- `openDisplayWindowIfNeeded()` (åpne/gjenbruke visningsvindu, vente på at
  det er lastet før første broadcast).
- Felles `channel.onmessage`-håndtering for `request-draw` / `request-reset`
  / `request-sync` fra visningsvinduet.
- Generisk `resetAll()` / historikk-oppdatering (tar inn en
  formateringsfunksjon for hvordan et trekk vises i historikklisten).

`control.js` og `control-bok.js` blir dermed tynne moduler som definerer:
sine egne input-felt, sin egen `validate+createState`-funksjon, og en
`formatDraw(result)`-funksjon som returnerer teksten som skal vises i
historikk og sendes i broadcast-meldingen.

## Testing

- `decodeBookDraw` er en ren funksjon og testes med `node --test` på samme
  måte som resten av `draw-logic.js` (eksempler: indeks 0 → bok 1/nummer
  `from`; siste indeks → siste bok/nummer `to`; riktig bok-oppdeling ved
  intervallgrenser).
- Resten av endringene er UI/integrasjon (kontrollpanel + visningsvindu) og
  verifiseres manuelt med en lokal `http-server` (og ev. en kort
  Playwright-sjekk for kryss-vindu-oppførsel), slik som tidligere UI-arbeid
  i dette prosjektet.

## Omfang / avgrensning

- Ingen endring i nummer-trekningens eksisterende oppførsel eller utseende
  utover filnavnbyttet (`index.html` → `nummer-trekning.html`).
- Ingen persistens (localStorage e.l.) er del av dette — som i dag nullstilles
  alt ved sideoppdatering/"Nullstill".
- README oppdateres til å beskrive de tre sidene og den nye velkomstsiden.
