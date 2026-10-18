# Loddtrekning — julebasar

Enkelt, statisk nettbasert verktøy for å trekke unike vinnernumre i en
loddtrekning (f.eks. til en julebasar). Ingen backend, ingen avhengigheter —
bare HTML, CSS og vanilla JavaScript.

Se designspesifikasjonen i
[`docs/superpowers/specs/2026-10-18-loddtrekning-design.md`](docs/superpowers/specs/2026-10-18-loddtrekning-design.md).

## Bruk

1. Åpne `index.html` i nettleseren (via en lokal server, se under). Dette er
   en velkomstside der du velger trekningsmodus.
2. Velg **Trekk nummer** for å trekke unike enkeltnumre fra et intervall,
   eller **Trekk fra bok** for å trekke en tilfeldig bok + et tilfeldig
   nummer i den boken (samme bok/nummer-kombinasjon trekkes aldri to
   ganger).
3. Angi loddintervall ("fra og med" / "til og med"), og for bok-modus også
   "Antall bøker".
4. Velg animasjonshastighet, fargetema, og om trekningen skal vises i et eget
   vindu (f.eks. for en prosjektor).
5. Klikk "Trekk" for å trekke. I bok-modus ruller boknummeret ferdig først,
   deretter nummeret i boken.

## Sider

- `index.html` — velkomstside, velg trekningsmodus.
- `nummer-trekning.html` — kontrollpanel for nummer-trekning.
- `bok-trekning.html` — kontrollpanel for bok-trekning.
- `visning.html` — delt visningsvindu (prosjektor) for begge moduser, åpnes
  automatisk av kontrollpanelene.

## Kjøre lokalt

Nettleseren blokkerer ES-moduler over `file://`, så bruk en enkel lokal
server:

```bash
npx http-server . -p 8080
# eller
python -m http.server 8080
```

Åpne deretter `http://localhost:8080/`.

## Kjøre tester

Kjernelogikken (intervallvalidering, trekning, animasjonstiming) er dekket av
enhetstester som kjøres med Node sin innebygde test-runner:

```bash
npm test
```

## Hosting på GitHub Pages

Dette er et rent statisk nettsted og kan hostes direkte fra repoet:

1. Gå til repoets **Settings → Pages** på GitHub.
2. Under "Build and deployment", velg **Deploy from a branch**.
3. Velg branch `master` og mappe `/ (root)`, lagre.
4. Siden blir tilgjengelig på `https://<bruker>.github.io/<repo>/` innen
   noen minutter.
