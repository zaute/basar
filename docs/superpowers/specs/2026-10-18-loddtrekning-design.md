# Loddtrekning for julebasar — design

## Bakgrunn

Det fantes tidligere en nettløsning ("Basaren", `start.basaren.net`) for å trekke
vinnere i en loddtrekning til en julebasar. Den opprinnelige løsningen er ikke
lenger tilgjengelig, og Wayback Machine har ikke arkivert selve
trekningsverktøyet — bare den tilhørende markedsføringssiden
(`basaren.net`), som bekrefter konseptet ("Gjør loddtrekningen med
Basaren!"), og et utklipp av innstillings-HTML-en som er brukt som
inspirasjon for funksjonsomfanget under.

Dette prosjektet bygger en ny, enkel versjon fra bunnen av, til hosting på
GitHub Pages.

## Mål

Et nettbasert verktøy der en arrangør kan:
- Angi et loddintervall (fra og med / til og med et tall).
- Trekke ett og ett vinnernummer om gangen.
- Se en animert trekning (tallene "ruller" før de lander på vinnernummeret).
- Se historikk over alle numre som er trukket i økten.
- Være sikker på at samme nummer ikke trekkes to ganger.
- Vise selve trekningen stort på en prosjektor/ekstra skjerm, mens
  kontrollene betjenes fra egen PC-skjerm.

## Ikke-mål (v1)

- Ingen persistent lagring (historikk nullstilles ved sideomlasting).
- Ingen fjernstyring fra mobil.
- Ingen brukerkontoer eller flerbrukerstøtte.
- Ingen backend/server — rent statisk nettsted som kan hostes på GitHub Pages.

## Tilnærming

Ren HTML/CSS/vanilla JavaScript uten rammeverk og uten byggesteg. Dette
passer godt med at prosjektet allerede er et enkelt statisk nettsted
(`index.html`), krever ingen avhengigheter, og er trivielt å hoste på GitHub
Pages.

Vurderte alternativer:
1. **Vanilla JS, to synkroniserte vinduer (valgt)** — enkelt, ingen build,
   lett å vedlikeholde, fungerer uten server.
2. **Lite rammeverk via CDN (f.eks. Vue)** — litt ryddigere
   state-håndtering, men unødvendig kompleksitet for dette omfanget.
3. **Fullt byggesteg (Vite/React)** — overkill for et enkeltsidig verktøy
   uten backend, og krever en byggprosess for GitHub Pages-deploy.

## Komponenter

- **`index.html` — kontrollpanel**
  - Skjema for loddintervall: "fra og med" og "til og med" (heltall).
  - Innstillinger: animasjonshastighet (sakte/middels/rask), fargetema
    (svart bakgrunn/hvit tekst eller hvit bakgrunn/svart tekst), valg om å
    åpne trekningsvisningen i et eget vindu.
  - Knapp "Trekk" som starter en trekning.
  - Historikkliste over alle numre trukket i denne økten (nyeste øverst),
    kun i minnet (resettes ved reload).
  - Varsel/feilmelding hvis:
    - Intervallet er ugyldig (ikke tall, eller fra > til).
    - Alle numre i intervallet allerede er trukket.

- **`trekning.html` — visningsvindu**
  - Åpnes via `window.open()` fra kontrollpanelet når "eget vindu" er valgt;
    hvis ikke valgt, vises trekningen i samme side som kontrollpanelet.
  - Stor, tydelig tallvisning egnet for prosjektor.
  - Spiller av samme animasjon og resultat som kontrollpanelet, synkronisert
    via `BroadcastChannel`.
  - Bruker valgt fargetema fra innstillingene.

- **Delt logikk (f.eks. `draw.js`)**
  - Tilstand: valgt intervall, sett med allerede trukne numre.
  - Trekk-funksjon: velger tilfeldig tall i intervallet som ikke er trukket
    før; kaster feil/varsel dersom intervallet er uttømt.
  - Animasjonsløkke: viser tilfeldige tall i intervallet i rask rekkefølge i
    en kort periode (varighet styrt av valgt hastighet), før den lander på
    det faktiske trukne tallet.
  - `BroadcastChannel`-kommunikasjon: kontrollpanelet sender
    "start trekning"-kommando (med intervall og innstillinger) og mottar
    ikke noe tilbake (det er «source of truth» selv); visningsvinduet mottar
    kommandoen og spiller av samme animasjon/resultat.

## Dataflyt

1. Bruker setter intervall og innstillinger i kontrollpanelet, trykker
   "Trekk".
2. Kontrollpanelet beregner det faktiske vinnernummeret (ekskludert
   tidligere trukne numre) og sender en melding med animasjonsparametre og
   sluttresultat til visningsvinduet via `BroadcastChannel`.
3. Begge vinduer (kontrollpanel og visningsvindu, eller bare kontrollpanelet
   hvis "eget vindu" ikke er valgt) kjører samme rulle-animasjon og lander
   samtidig på resultatet.
4. Kontrollpanelet legger det trukne nummeret til i historikklisten.

## Feilhåndtering

- Validering av intervall før trekning starter (tallformat, fra ≤ til).
- Tydelig melding når alle numre i intervallet er trukket — "Trekk"-knappen
  deaktiveres eller viser melding.
- Hvis visningsvinduet lukkes eller ikke åpnes, fortsetter kontrollpanelet å
  fungere som normalt (viser trekningen i eget panel også).

## Testing

- Manuell verifisering i nettleser (ingen backend å teste).
- Enkle JS-enhetstester (om mulig uten byggesteg, f.eks. en liten
  test-HTML-side eller Node-skript) for kjernelogikken: trekk-funksjon
  unngår duplikater, varsler ved uttømt intervall, validerer intervall.

## Hosting

Statisk nettsted hostet via GitHub Pages direkte fra repoet (f.eks. fra
`main`-branch eller en `docs/`-mappe/`gh-pages`-branch, avklares i
implementasjonsplanen).
