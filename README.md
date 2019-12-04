# Assistance Online - Statuspagina

Automatische statuspagina voor Assistance Online. Door een nieuwe issue toe te voegen en hieraan de desbetreffende labels en een milestone te koppelen, zal de statuspagina automatisch bijwerken.

# Issue

Een issue moet minimaal een titel, 1 of meerdere labels en een milestone hebben om goed verwerkt te kunnen worden op de statuspagina. 
## Milestones

Met de milestone wordt aangegeven wat de impact/status van een issue is. Grote issues krijgen milestone `XL`, kleine issues `S`. Meldingen die nog onderzocht dienen te worden kunnen alvast aangemeld worden met milestone 'under investigation' en eventueel onderhoud kan milestone 'maintenance' krijgen.

|Milestone            |Omschrijving                                          |
|---------------------|------------------------------------------------------|
|XL                   |Blocking                                              |
|L                    |Grote verstoring                                      |
|M                    |Verstoring, maar werkbaar                             |
|S                    |Minor issue                                           |
|Under investigation  |Onderzoek naar oorzaak loopt nog                      |
|Maintenance          |Onderhoudswerkzaamheden kunnen voor verstoring zorgen |
|Announcement         |Aankondiging voor bijvoorbeeld onderhoud              |

## Labels

Naast milestones geven labels aan op welke systeem onderdelen de melding betrekking heeft. Dit moet er minimaal 1 zijn, maar meerdere is ook mogelijk. Zo zou een storing in de `api`, `webapp` en `driverapp` kunnen zitten.

|Label                |Service              |Omschrijving                          |
|---------------------|---------------------|--------------------------------------|
|AO Api               |ApiSvc               |De interne API                        | 
|AO backend/core      |CoreSvc              |Het backend gedeelte van AO           |
|AO chauffeurs app    |DriverApp (Android)  |De Driver App                         |
|AO identityservice   |IdentitySvc          |Inloggen / authenticatie              |
|AO webapplicatie     |WebApp               |Web gedeelte (UI)                     |
|Integratie Allianz   |                     |De Allianz koppeling                  |
|Integratie Eurocross |                     |De Eurocross koppeling                |
|Integratie Logicx    |                     |De Logicx koppeling                   |
|Integratie SIMN      |                     |De SIMN koppeling                     |
|Integratie SOS       |                     |De SOS koppeling                      |
|Integratie Transplan |                     |De Transplan koppeling                |
|Integratie VHD       |                     |De VHD koppeling                      |

## Sluiten van een issue

Wanneer een issue gesloten wordt zal deze in de geschiedenis komen te staan, zodat ook hier een overzicht te zien is van verholpen verstoringen.