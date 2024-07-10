// scroll selector into view
import Settings from "./settings.js";
import puppeteer from "puppeteer";
import chalk from "chalk";
import fs from "fs/promises";

const REACTED_ADVERT_URLS = 'last_reacted_url.txt';
const START_CONV_LINK = 'https://kamernet.nl/en/start-conversation/';

const DISTANCE_INDEX = {
    0: 1,
    1: 2,
    2: 3,
    5: 4,
    10: 5,
    20: 7
}

async function loginIntoAccount(page) {
    await page.locator('button ::-p-text(Log in)').click();

    await page.locator('input[type="email"]').fill(Settings.USERNAME);
    await page.locator('input[type="password"]').fill(Settings.PASSWORD);
    await page.keyboard.press('Enter');
    await page.waitForNavigation({waitUntil: 'networkidle0'});
}

function createSearchLink (pageNo) {
    // https://kamernet.nl/en/for-rent/properties-amsterdam?radius=10&minSize=2&maxRent=6&searchview=1
    // City
    let link = 'https://kamernet.nl/en/for-rent/properties-' + Settings.CITY.replace(/\s/g, '-') + '?';
    // Radius
    link += 'radius=' + DISTANCE_INDEX[Settings.RADIUS] + '&';
    // Min size
    link += 'minSize=' + Settings.MIN_SIZE + '&';
    // Max rent
    link += 'maxRent=' + Settings.MAX_RENT + '&';
    // Page number
    link += 'pageNo=' + pageNo;

    return link;
}

const noInternationalBlacklist = [
    "no international",
    "no expats",
    "geen international",
    "only dutch",
].map(phrase => new RegExp(phrase, 'gui'));

const noCouples = [
    "no couples",
    "geen koppels",
    "only one person",
    "only 1 person",
    "1 person only",
].map(phrase => new RegExp(phrase, 'gui'));

const noRegistration = [
    "no registration",
    "no registration possible",
    "geen inschrijving",
    "geen inschrijving mogelijk",
].map(phrase => new RegExp(phrase, 'gui'));

function delay(ms) {
    return new Promise(r => setTimeout(r, ms))
}

async function isAdvertForMe(page) {
    let skip = false;
    let description = await page.$eval('.About_preText__92ONZ :first-child', el => el.innerText);

    async function blacklist (regexes) {
        for (let regex of regexes)
            if (description.search(regex) !== -1)
                return true;
        return false;
    }

    // Checks blacklist
    if (Settings.INTERNATIONAL_STUDENT)
        skip = await blacklist(noInternationalBlacklist);
    if (Settings.COUPLES)
        skip = skip || await blacklist(noCouples);
    if (Settings.REGISTRATION)
        skip = skip || await blacklist(noRegistration);

    const alreadyReactedBtn = await page.$('button ::-p-text(Continue conversation)');

    if (skip || alreadyReactedBtn){
        console.log(chalk.yellow("Advert skipped due to blacklist or already being contacted."));
        return false;
    }
    
    return true;
}

async function getLatestAdvertUrl(page) {
    let link = await page.locator(`a[href^="/en/for-rent/room"]`).map(link => link.href).wait();
    console.log(chalk.green("[SUCCESS]: ") + "Found URL: " + link);
    return link;
}

async function writeLastUrl(url) {
    try {
      await fs.writeFile(REACTED_ADVERT_URLS, url + '\n');
      console.log('Content appended successfully.');
    } catch (error) {
      console.error('Error appending to file:', error);
    }
}

async function readLastUrl() {
    try {
      const data = await fs.readFile(REACTED_ADVERT_URLS, 'utf8');
      const lines = data.split('\n');
      return lines;
    } catch (error) {
      console.error('Error reading file:', error);
      return [];
    }
}

async function readMessage () {
    try {
        let data = await fs.readFile('message.txt', 'utf8');
        data = data.toString().trim();
        return data;
    } catch (error) {
        console.error('Error reading file:', error);
        return null;
    }
}

function getRoomNumber (url) {
    const regex = /\/room-(\d+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

export async function lookForRooms() {
    let browser, page;
    let urls = await readLastUrl();
    let lastUrl = (urls.length > 0) ? readLastUrl()[0] : null;
    let lastReactedUrl;
    try {
        browser = await puppeteer.launch({
            // On raspberry pi 32 bit there is no chrome for testing, so we use "normal" preinstalled chromium
            /*product: 'chrome',
            executablePath: '/usr/bin/chromium-browser',*/
            headless: false, // set it false to see chrome
            defaultViewport: null,
            args: [
                '--start-maximized',
                '--disable-dev-shm-usage'
            ],
        });

        let message = await readMessage();
        if (!message)
            throw new Error(chalk.red("Please fill in message.txt!"));

        page = (await browser.pages())[0];
        page.setDefaultTimeout(0);

        await page.goto('https://kamernet.nl/en')
        await page.locator('button ::-p-text(Log in)').wait();
        
        // Login
        console.log("Logging in to Kamernet...")
        await loginIntoAccount(page);
        
        // Creation of search link
        let search_link = createSearchLink(1);

        // Keeps looking for rooms
        while (true) {
            await page.goto(search_link);

            console.log(chalk.red("===== Getting latest advert ====="));

            let url = await getLatestAdvertUrl(page)
            
            // If we already reacted to this advert, skip it
            if (url == lastUrl) {
                console.log(chalk.yellow("URL already reacted to, skipping..."));
            // If we haven't reacted to this advert, react and then append it to the file
            } else {
                console.log(chalk.green("URL not reacted to, checking validity and then reacting..."));
                await page.goto(url);
                let isForMe = await isAdvertForMe(page);
                if (isForMe) {
                    await page.goto (START_CONV_LINK + getRoomNumber(url));
                    await page.locator ('#Message').wait();
                    await page.locator ('#Message').fill(message);
                    // Click on the send button
                    await page.locator ('button ::-p-text(Send message)').click();
                    console.log(chalk.grey(`Message sent to ${url}`));
                    lastReactedUrl = url;
                }
                lastUrl = url;
            }
            
            // Update every 10 seconds
            await delay(10000);
        }
    } catch (e) {
        console.log(chalk.red("[UNEXPECTED ERROR]: " + e));
        // Saves the last reacted URL to the file
        await writeLastUrl(lastReactedUrl);
        await page.close();
        await browser.close();
        await lookForRooms()
    }
}
