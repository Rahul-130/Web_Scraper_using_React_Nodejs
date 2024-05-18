const express = require("express");
const puppeteer = require("puppeteer");
const fs = require("fs");
const bodyParser = require("body-parser");
const multer = require("multer");

const app = express();
const port = 4000;
const path = require("path");

// Middleware to allow CORS
app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*"); // Allow requests from any origin
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE"); // Allow specific HTTP methods
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization"); // Allow specific headers
    next();
});

app.use(express.json());

const set_of_links = new Set(); // Global set variable to store unique URLs

app.get("/getAllLinks", (req, res) => {
    try {
        // Convert the set_of_links Set to an array and send it as a response
        const allLinks = Array.from(set_of_links);
        res.json(allLinks);
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({error: "Error retrieving all links"});
    }
});

app.get("/scrapeLinks", async (req, res) => {
    try {
        const {url} = req.query;
        if (!url) {
            return res.status(400).json({error: "URL parameter is required"});
        }

        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.goto(url);

        const links = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll("a"));
            return links.map((link) => link.href);
        });

        links.forEach((link) => {
            set_of_links.add(link); // Add links to the global variable
        });

        await browser.close();

        // Convert the Set back to an array before sending the response
        const uniqueLinks = Array.from(set_of_links);
        res.json(uniqueLinks);
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({error: "Error scraping links from URL"});
    }
});

app.get("/scrapeTextData", async (req, res) => {
    try {
        const {url} = req.query;
        if (!url) {
            return res.status(400).json({error: "URL parameter is required"});
        }

        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        // Set the navigation timeout to 60 seconds (60000 milliseconds)
        await page.setDefaultNavigationTimeout(60000);
        await page.goto(url);

        try {
            // Extract text content recursively while preserving line breaks and adding markdown formatting for headings
            const {textData, urls} = await page.evaluate(() => {
                const getTextContent = (element, level) => {
                    let text = "";
                    let urls = new Set();
                    // Check if the element is a text node
                    if (element.nodeType === Node.TEXT_NODE) {
                        text += element.textContent;
                    } else if (element.nodeType === Node.ELEMENT_NODE) {
                        // Exclude unwanted elements and their children
                        if (
                            element.tagName === "SCRIPT" ||
                            element.tagName === "STYLE" ||
                            element.tagName === "IFRAME" ||
                            element.tagName === "iframe" ||
                            element.matches(".medium-zoom-overlay, .hs-messages-widget-open")
                        ) {
                            return {text: "", urls};
                        }
                        // Exclude text content from <nav> element and its children
                        if (element.tagName === "NAV" || element.tagName === "FOOTER") {
                            return {text: "", urls};
                        }
                        // Add markdown formatting for headings
                        if (element.tagName.startsWith("H")) {
                            const headingLevel = parseInt(element.tagName.charAt(1));
                            const headingPrefix = "#".repeat(headingLevel);
                            text += `${headingPrefix} ${element.textContent}\n\n`; // Include line break after the heading
                        } else {
                            // Process element's children recursively for non-heading elements
                            Array.from(element.childNodes).forEach((child) => {
                                const {text: childText, urls: childUrls} = getTextContent(child, level);
                                text += childText;
                                childUrls.forEach((link) => urls.add(link));
                            });
                            // Add line break after block-level elements
                            if (["P", "DIV", "UL", "OL", "LI", "BR"].includes(element.tagName)) {
                                text += "\n";
                            }
                        }
                    }
                    // Add URLs from <a> elements
                    if (element.tagName === "A") {
                        const href = element.href;
                        urls.add(href);
                    }
                    return {text, urls};
                };

                const body = document.body;
                // Get text content from the body element
                const {text, urls} = getTextContent(body, 0);
                return {textData: text, urls: Array.from(urls)};
            });

            // Filter out duplicate links before adding to the global set
            urls.forEach((link) => set_of_links.add(link));

            await browser.close();

            // Send the MD content, extracted URLs, and set_of_links to the frontend
            res.json({textData, urls: Array.from(set_of_links)});
        } catch (evaluateError) {
            console.error("Error during page evaluation:", evaluateError);
        }
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({error: "Error scraping data from URL"});
    }
});

// Middleware to parse JSON bodies
// Increase payload size limit to 50MB
app.use(bodyParser.json({limit: "50mb"}));
app.use(bodyParser.urlencoded({limit: "50mb", extended: true}));
// app.use(bodyParser.toString({limit: '50mb'}));

app.use(express.json());

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "retrivals"); // Specify the directory where files should be stored
    },
    filename: function (req, file, cb) {
        cb(null, file.fieldname + "-" + Date.now() + path.extname(file.originalname));
    },
});

const upload = multer({storage: storage});

// Endpoint to save Markdown file
app.post("/saveMarkdownFile", upload.none(), async (req, res) => {
    const {fileName, mdContent} = await req.body;

    try {
        // Define the directory path for saving Markdown files
        const directoryPath = path.join(__dirname, "retrivals");

        // Ensure the directory exists, if not, create it
        if (!fs.existsSync(directoryPath)) {
            fs.mkdirSync(directoryPath, {recursive: true});
        }

        // Define the file path for the Markdown file
        const filePath = path.join("retrivals", fileName);

        // Write the Markdown content to the file
        console.log(filePath);
        console.log("fs running");
        fs.writeFileSync(filePath, mdContent);

        console.log("Markdown file saved successfully.");

        res.sendStatus(200);
    } catch (error) {
        res.status(500).json({message: "Error occured", error});
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
