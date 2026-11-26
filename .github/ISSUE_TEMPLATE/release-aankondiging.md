---
name: Release aankondiging
about: Template voor het aankondigen van een release
title: Release JJJJ.xx op DD-MM-JJJJ om 11:30
labels: AO api, AO backend/core, AO webapplicatie
milestone: Announcement
assignees: ''

---

<!--
Deze toelichting is niet zichtbaar op de statuspagina.

Vooraf
1. Vul in de titel het versienummer, de datum en de tijd in, en pas zo nodig de dag en tijden in de tekst aan.
   De datum en tijd uit de titel ("op DD-MM-JJJJ om HH:MM") gelden als start; de statuspagina telt af naar
   dat moment en zet de release in de agenda. Zonder eindtijd duurt een release 30 minuten.
   Duurt hij langer of start hij op een ander moment? Vul dan de regel "start: … eind: …" hieronder in.
2. Controleer rechts de milestone: Announcement. De release staat dan onder "Gepland" en telt niet mee
   voor de status. Zonder milestone verschijnt de aankondiging NIET op de statuspagina.
3. Controleer de labels: één per onderdeel dat door de release geraakt wordt.
4. Vervang de voorbeeldregels onderaan door de tickets uit de release.

Bij de start van de release
5. Tussen start- en eindtijd toont de statuspagina vanzelf "Systeem is in onderhoud". Loopt de release uit,
   zet dan de milestone op Maintenance; dat blijft gelden tot je het issue sluit.
6. Plaats een REACTIE op dit issue (niet deze tekst aanpassen), bijvoorbeeld:
   "De update is zojuist van start gegaan en zal naar verwachting over 30 minuten gereed zijn."
   Reacties verschijnen met tijdstip als updates op de statuspagina.

Na de release
7. Plaats een reactie, bijvoorbeeld:
   "Het updateproces is zojuist afgerond. Rechtsonder zou nu het versienummer 123456@prod moeten staan,
   zo niet, vernieuw dan de pagina een keer (F5)."
8. Sluit het issue. Het verhuist dan naar de geschiedenis.
-->

<!-- start: DD-MM-JJJJ 11:30, eind: DD-MM-JJJJ 12:00 -->

Donderdagochtend a.s. om 11:30 uur wordt er een update uitgerold. Naar verwachting is de update om 12:00 uur gereed. Gedurende deze periode kunnen fouten optreden en zal de gebruiker enige vertraging ervaren. Zodra de release begint, volgt er een update.

In deze versie zitten de volgende wijzigingen:

* AO-xxxx Omschrijving
* AO-xxxx Omschrijving
