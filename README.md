# Assistance Online - Statuspagina

Automatische statuspagina voor Assistance Online op [status.assistanceonline.nl](https://status.assistanceonline.nl). Maak een issue aan in deze repository, koppel er de juiste labels en een milestone aan, en de statuspagina werkt zichzelf bij.

## Hoe het werkt

De statuspagina is een statische site op GitHub Pages. De browser roept de GitHub API niet zelf aan, maar leest `status.json`.

1. Bij elke wijziging aan een issue, reactie, label of milestone start de workflow [`Statuspagina publiceren`](.github/workflows/deploy.yml). Hij start ook bij een push naar `master`, één keer per uur als vangnet en handmatig via **Actions → Statuspagina publiceren → Run workflow**.
2. De workflow draait eerst de tests. Faalt een test, dan blijft de huidige pagina staan.
3. Het script [`copy-vendor.mjs`](.github/scripts/copy-vendor.mjs) zet Bootstrap en Font Awesome uit npm in de site. De pagina laadt niets van een CDN, zodat hij ook werkt als een CDN storing heeft.
4. Het script [`build-status.mjs`](.github/scripts/build-status.mjs) haalt de labels, issues en reacties op. Het zet de markdown om naar veilige HTML, berekent de storingen van de afgelopen 90 dagen en schrijft `status.json`, de RSS-feed `feed.xml`, de agenda `agenda.ics` en de badge `badge.svg`.
5. De workflow publiceert de site samen met die bestanden op GitHub Pages.

Een wijziging staat na ongeveer een minuut op de pagina. Een geopende pagina haalt elke minuut zelf de nieuwste status op, dus verversen is niet nodig. Staat een wijziging er niet, kijk dan bij **Actions** of de laatste run gelukt is. Is de status meer dan drie uur niet bijgewerkt, dan toont de pagina een waarschuwing dat de gegevens mogelijk verouderd zijn; dan is het publiceren stuk.

## Abonneren en insluiten

- **RSS-feed:** [status.assistanceonline.nl/feed.xml](https://status.assistanceonline.nl/feed.xml).
- **Agenda** met de geplande releases en onderhoud: [status.assistanceonline.nl/agenda.ics](https://status.assistanceonline.nl/agenda.ics). In Outlook: **Agenda toevoegen → Abonneren via internet** en deze link plakken. De agenda werkt zichzelf bij.
- **Statusbadge** voor andere sites, bijvoorbeeld de helpsite. Die toont "operationeel", "onderhoud" of de ernst van een storing, en wordt bij elke publicatie (minimaal elk uur) bijgewerkt:

  ```html
  <a href="https://status.assistanceonline.nl/"><img src="https://status.assistanceonline.nl/badge.svg" alt="Status Assistance Online"></a>
  ```

Bij **Settings → Pages** moet de bron op **GitHub Actions** staan, niet op "Deploy from branch".

# Issue

Een issue heeft een titel, een milestone en minimaal één label nodig.

- **Zonder milestone wordt een issue niet getoond.** Iedereen met een GitHub-account kan een issue aanmaken in deze publieke repository, maar alleen collaborators kunnen een milestone zetten. Zo komt er niets op de pagina wat niet door ons is geplaatst. Mist een open issue een milestone of label, dan plaatst de workflow [`Controle zichtbaarheid issue`](.github/workflows/issue-check.yml) er een waarschuwing bij. Die verdwijnt vanzelf als het is aangevuld.
- **Updates plaats je als reactie op het issue**, niet door de beschrijving aan te passen. Reacties verschijnen met tijdstip als tijdlijn boven de oorspronkelijke melding, en bij open meldingen staat het tijdstip van de laatste update. Alleen reacties van teamleden worden getoond: mensen die zelf een gepubliceerd issue hebben aangemaakt. Een nieuwe collega verschijnt dus pas met reacties nadat die een eerste issue heeft geplaatst.
- Open issues met milestone `Announcement` staan onder **Gepland**. Ze tellen niet mee voor de status van de onderdelen of de algemene status.
- Alle andere open issues staan onder **Actueel** en bepalen de status van de onderdelen.
- Gesloten issues staan onder **Geschiedenis**, per maand gegroepeerd, met het tijdstip van oplossen en de duur. Daar staan alleen de laatste 50, elk als één regel die je openklikt voor de details. Bezoekers kunnen in de geschiedenis zoeken op titel, ticketnummer of tekst.
- **Analyse:** begint een reactie met de kop `## Analyse`, dan staat die niet in de tijdlijn maar apart bovenaan de melding. Bedoeld voor de oorzaak, oplossing en maatregelen na een storing `XL` of `L`.
- Bezoekers kunnen op een onderdeel klikken om alleen de meldingen daarvan te zien. Zo'n gefilterde weergave is te delen via de link, bijvoorbeeld `status.assistanceonline.nl/#onderdeel=AO%20api`.
- Elke melding heeft een directe link (**Directe link** onder de melding), bijvoorbeeld `status.assistanceonline.nl/#issue-384`. De RSS-feed linkt daar ook naar.
- De tekst is markdown. Geplakte afbeeldingen worden automatisch verkleind tot maximaal 400px hoog, en een klik opent ze op ware grootte.

Er zijn twee issue-templates: **New issue → Storing** en **New issue → Release aankondiging**.

## Begin- en eindtijden

Een tijd in een verborgen HTML-commentaar in het issue wordt door de statuspagina gelezen, bijvoorbeeld `<!-- start: 03-12-2026 11:30, eind: 03-12-2026 12:00 -->`. Toegestaan zijn `start`/`begin` en `eind`/`einde`/`end`, met een datum als `DD-MM-JJJJ` of `JJJJ-MM-DD` en Nederlandse tijd.

- **Releases en onderhoud:** zonder commentaar geldt de datum en tijd uit de titel ("… op 03-12-2026 om 11:30") als start, met een duur van 30 minuten. Vooraf staat de release onder **Gepland** met "begint over …". Tussen start en eind telt hij automatisch als onderhoud, ook als de milestone nog op `Announcement` staat. De releases staan ook in de agenda.
- **Storingen:** begon de storing eerder dan het issue is aangemaakt, of was hij eerder verholpen dan het issue gesloten werd? Dan gelden de tijden uit het commentaar voor de duur en de beschikbaarheid.

## Beschikbaarheid

Bij elk onderdeel staat de beschikbaarheid over de afgelopen 90 dagen: een balkje per dag in de kleur van de zwaarste storing op die dag, en een percentage. Het percentage telt alleen de tijd waarin een storing `XL` of `L` open stond; `M` en `S` zijn wel zichtbaar in de balkjes. Onderhoud en aankondigingen tellen niet mee. Het klopt dus alleen als storingen consequent met de juiste labels worden vastgelegd en op tijd worden gesloten.

## Taal

Bezoekers kunnen rechtsboven wisselen tussen Nederlands en Engels. Dat vertaalt de vaste teksten van beide pagina's; de inhoud van de issues blijft Nederlands. Nieuwe vaste teksten voeg je toe in [`scripts/i18n.js`](scripts/i18n.js), in beide talen.

## Milestones

Met de milestone geef je de impact of status van een issue aan. Grote issues krijgen milestone `XL`, kleine issues `S`. Meldingen die nog onderzocht worden, kun je alvast aanmaken met milestone `Under investigation`. Onderhoud krijgt milestone `Maintenance`.

|Milestone            |Omschrijving                                          |
|---------------------|------------------------------------------------------|
|XL                   |Blocking                                              |
|L                    |Grote verstoring                                      |
|M                    |Verstoring, maar werkbaar                             |
|S                    |Minor issue                                           |
|Under investigation  |Onderzoek naar oorzaak loopt nog                      |
|Maintenance          |Onderhoudswerkzaamheden kunnen voor verstoring zorgen |
|Announcement         |Aankondiging voor bijvoorbeeld onderhoud              |

Bovenaan de pagina staat één algemene status: de zwaarste van alle open issues, aankondigingen niet meegerekend. De volgorde is `Maintenance`, `XL`, `L`, `M`, `S`, `Under investigation`. Het icoon in het browsertabblad krijgt dezelfde kleur.

## Labels

Met labels geef je aan op welke onderdelen van het systeem de melding betrekking heeft. Dat moet er minimaal één zijn, maar meer mag ook. Een storing kan bijvoorbeeld in `AO api`, `AO webapplicatie` en `AO chauffeurs app` zitten. Elk label in deze repository verschijnt als onderdeel op de statuspagina. De pagina groepeert ze op de naam: labels die met `AO ` beginnen staan onder **Assistance Online**, labels die met `Integratie ` beginnen onder **Koppelingen**, en de rest onder **Overig**. Werkt alles in een groep, dan is die ingeklapt tot één regel; een groep met een storing gaat vanzelf open.

|Label                |Service              |Omschrijving                          |
|---------------------|---------------------|--------------------------------------|
|AO api               |ApiSvc               |De interne API                        |
|AO backend/core      |CoreSvc              |Het backend gedeelte van AO           |
|AO chauffeurs app    |DriverApp            |De chauffeursapp                      |
|AO identityservice   |IdentitySvc          |Inloggen / authenticatie              |
|AO webapplicatie     |WebApp               |Web gedeelte (UI)                     |
|Integratie Allianz   |                     |De Allianz koppeling                  |
|Integratie Eurocross |                     |De Eurocross koppeling                |
|Integratie Logicx    |                     |De Logicx koppeling                   |
|Integratie SIMN      |                     |De SIMN koppeling                     |
|Integratie SOS       |                     |De SOS koppeling                      |
|Integratie Transplan |                     |De Transplan koppeling                |
|Integratie VHD       |                     |De VHD koppeling                      |
|MI / OR              |                     |                                      |

## Sluiten van een issue

Een gesloten issue komt in de geschiedenis te staan. Zo blijft er een overzicht van verholpen verstoringen.

# Lokaal testen

```sh
npm ci --prefix .github/scripts
npm test --prefix .github/scripts
node .github/scripts/copy-vendor.mjs .
node .github/scripts/build-status.mjs .
npx http-server -p 8080 -c-
```

Open daarna http://localhost:8080. Het script werkt zonder token, maar dan geldt de limiet van 60 GitHub API-requests per uur. Zet `GITHUB_TOKEN` als je vaker wilt draaien. De gegenereerde bestanden (`status.json`, `feed.xml`, `agenda.ics`, `badge.svg` en de map `vendor`) staan in `.gitignore`.

De tests in [`.github/scripts/test`](.github/scripts/test) controleren de buildfuncties (opschonen van HTML, afbeeldingen, reacties, feed) en draaien de pagina zelf in een gesimuleerde browser tegen vaste testdata.

# Onderhoud

[Dependabot](.github/dependabot.yml) stelt wekelijks een PR voor als er een nieuwe versie is van de npm-pakketten (ook Bootstrap en Font Awesome) of van de GitHub Actions. Nieuwe versies worden pas na twee weken voorgesteld. Font Awesome blijft op versie 5, zodat de icoontjes gelijk blijven aan die van de AO-portals.

Alle pagina's (`index.html`, `contact.html` en `404.html`) hebben een Content-Security-Policy in een `<meta>`-tag die alleen bestanden van de eigen site toestaat. Laad je iets van een andere bron, voeg die bron dan daar toe.
