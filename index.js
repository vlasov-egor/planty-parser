const puppeteer = require("puppeteer");
const fs = require("fs");
const prompt = require("async-prompt");
const util = require("util");
const { exit } = require("process");
const exec = util.promisify(require("child_process").exec);
const request = require("request");

const mainURL =
  "https://www.patchplants.com/gb/en/w/product-type/plants/?page=";

// const DEBUG = true;
const DEBUG = false;

function download(uri, filename) {
  return new Promise((resolve, reject) => {
    request.head(uri, function (err, res, body) {
      request(uri).pipe(fs.createWriteStream(filename)).on("close", resolve);
    });
  });
}

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

  var pages = [1, 2, 3, 4];
  // var pages = [1];
  for (var i of pages) {
    console.log(`Processing page ${Number(i)}`);

    var pageURL = `${mainURL + Number(i)}`;
    await page.goto(pageURL, { timeout: 0 });

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
  var plantsWithoutPhoto = [];

  for (var linkIndex in plantsLinks) {
    console.log(`Processed ${Number(linkIndex) + 1} of ${plantsLinks.length}`);
    await page.goto(plantsLinks[linkIndex], { timeout: 0 });

    const name = await page.$$eval(
      ".hero-space__heading",
      (anchors) => [].map.call(anchors, (title) => title.innerText)[0]
    );

    const shortName = await page.$$eval(
      ".hero-space__nickname",
      (anchors) => [].map.call(anchors, (title) => title.innerText)[0]
    );

    console.log(name, shortName);
    if (
      shortName != undefined &&
      !name.includes(" set") &&
      !name.includes("Patch")
    ) {
      const fullName = await page.$$eval(
        ".hero-space__pronunciation",
        (anchors) =>
          [].map.call(anchors, (title) => title.innerText.split("; "))[0]
      );

      const highlights = await page.$$eval(
        ".hero-space__highlight-text",
        (anchors) => [].map.call(anchors, (title) => title.innerText)
      );

      const likesSectionHeaders = await page.$$eval(
        ".likes-section__text-content-like h5",
        (anchors) => [].map.call(anchors, (title) => title.innerText)
      );

      const likesSectionValues = await page.$$eval(
        ".likes-section__text-content-like p",
        (anchors) => [].map.call(anchors, (title) => title.innerText)
      );

      var likesSection = {};
      likesSectionHeaders.forEach(
        (key, index) => (likesSection[key] = likesSectionValues[index])
      );

      const quickFactsSectionHeaders = await page.$$eval(
        ".quick-facts-section__fact p strong",
        (anchors) =>
          [].map.call(anchors, (title) =>
            title.innerText.replace("?", "").toLowerCase()
          )
      );

      const quickFactsSectionValues = await page.$$eval(
        ".quick-facts-section__fact p",
        (anchors) => [].map.call(anchors, (title) => title.innerText)
      );

      console.log(quickFactsSectionValues);

      var quickFactsSection = {};
      quickFactsSectionHeaders.forEach((key, index) =>
        key == "Nickname" ||
        key == "Plant type" ||
        key == "Plant height (including pot)" ||
        key == "Nursery pot size"
          ? (quickFactsSection[key] =
              quickFactsSectionValues[2 * index + 1]?.split("; "))
          : (quickFactsSection[key] = quickFactsSectionValues[2 * index + 1])
      );

      const aboutText = await page.$$eval(
        ".quick-facts-section__about-text--accordion",
        (anchors) =>
          [].map.call(anchors, (title) =>
            title.innerText.replace("Did you know?", "\n\n").trim()
          )[0]
      );

      try {
        try {
          await page.click(".size-selector-item");
        } catch {
          console.log("Try to find active pot");
          await page.click(".size-selector-item active");
        }
        await page.click(".img-container");

        var imageLinks = [];
        imageLinks = await page.$$eval(".preview-plant", (anchors) =>
          [].map.call(anchors, (title) => title.src)
        );

        if (imageLinks.length == 0) {
          var i = 1;
          while (imageLinks.length == 0) {
            console.log(`${i} atempt`);
            i++;
            await page.reload();
            await page.click(".size-selector-item");
            await page.click(".img-container");
            await page.waitForTimeout(1000);

            imageLinks = await page.$$eval(".preview-plant", (anchors) =>
              [].map.call(anchors, (title) => title.src)
            );
          }
        }

        var flowerPath = `parsed_images/${name}.png`;
        console.log(imageLinks);
        await download(imageLinks[0], flowerPath);
      } catch (e) {
        console.log(e);
        plantsWithoutPhoto.push(name);
        flowerLink = null;
      }

      var plant = {
        name: name,
        shortName: shortName,
        fullName: fullName,
        highlights: highlights,
        likesSection: likesSection,
        quickFactsSection: quickFactsSection,
        aboutText: aboutText,
        flowerPath: flowerPath,
      };

      json["Plants"].push(plant);
    }
  }

  fs.writeFileSync("plant_without_photo.txt", plantsWithoutPhoto.join("\n"));

  return JSON.stringify(json);
};

plantsLinks = findPlantLinks().then((x) => {
  extractPlantInfo(x).then((x) => fs.writeFileSync("res.json", x));
});
