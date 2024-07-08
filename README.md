# KamernetBot
This bot automatically responds to the latest published advert on Kamernet that is compatible with your search query.
## Bot workflow overview
The bot automatically:
- Opens Kamernet.nl/en
- Logs in (with your credentials specified in settings.js)
- Searches rooms (based on the info provided in settings.js)
- Filters out adverts that do not correspond to your needs based on the advert's description (e.g. if you're a couple, it filters out adverts that are looking for one person only).
- Reacts to the latest published advert.
- Waits for a new advert to be published.
## Kamernet-Puppeteer
KamernetBot is a derived work from Kamernet-Puppeteer by nomomon. It uses the same code structure but the code inside is totally different since Kamernet-Puppeteer does not work anymore. Moreover, this bot keeps waiting and refreshing until new adverts come up which is a totally different behaviour compared to Kamernet-Puppeteer.
