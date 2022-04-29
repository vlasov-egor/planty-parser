const puppeteer = require("puppeteer");
const fs = require("fs").promises;
const prompt = require("async-prompt");
const util = require("util");
const exec = util.promisify(require("child_process").exec);

const mainURL =
  "https://www.patchplants.com/gb/en/w/product-type/plants/?page=";

// const DEBUG = true;
const DEBUG = false;

const findPlantLinks = async () => {
  const browser = await puppeteer.launch({
    headless: !DEBUG,
    args: [
      "--disable-web-security",
      "--disable-features=IsolateOrigins,site-per-process",
    ],
  });
  const page = await browser.newPage();
  var plantsLinks = [];

  // var pages = [1, 2, 3];
  var pages = [1];
  for (var i of pages) {
    console.log(`Processing page ${Number(i)}`);

    var pageURL = `${mainURL + Number(i)}`;
    await page.goto(pageURL);

    plantsLinks = plantsLinks.concat(
      await page.$$eval(".card__header a", (anchors) =>
        [].map.call(anchors, (a) => a.href)
      )
    );
  }

  return plantsLinks;
};

const extractPlantInfo = async (plantsLinks) => {
  const browser = await puppeteer.launch({
    headless: !DEBUG,
    args: [
      "--disable-web-security",
      "--disable-features=IsolateOrigins,site-per-process",
    ],
  });
  const page = await browser.newPage();

  var json = {};
  json["Plants"] = [];

  for (var linkIndex in plantsLinks) {
    console.log(`Processed ${Number(linkIndex) + 1} of ${plantsLinks.length}`);
    await page.goto(plantsLinks[linkIndex]);
    const shortName = await page.$$eval(".hero-space__nickname", (anchors) =>
      [].map.call(anchors, (title) => title.innerText)
    );

    const fullName = await page.$$eval(
      ".hero-space__pronunciation",
      (anchors) => [].map.call(anchors, (title) => title.innerText)
    );
    var plant = {
      shortName: shortName,
      fullName: fullName,
    };

    json["Plants"].push(plant);
  }

  return JSON.stringify(json);
};

plantsLinks = findPlantLinks().then((x) => {
  extractPlantInfo(x).then((x) => fs.writeFile("res.json", x));
});
