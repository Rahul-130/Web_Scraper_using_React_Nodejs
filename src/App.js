import "./App.css";
import React, {useState} from "react";
import axios from "axios";
import Spinner from "react-bootstrap/Spinner";

function App() {
    const [url1, setUrl1] = useState("");
    const [url2, setUrl2] = useState("");
    const [links, setLinks] = useState([]);
    const [textData, setTextData] = useState("");
    const [error, setError] = useState("");

    const [isLoading, setIsLoading] = useState(false);

    const fetchLinks = async () => {
        setIsLoading(true);
        try {
            const response = await axios.get(`http://localhost:4000/scrapeLinks?url=${url1}`);
            // const filteredLinks = response.data.filter((link) => link.includes("docs"));
            const filteredLinks = response.data;

            setLinks((prevLinks) => [...new Set([...prevLinks, ...filteredLinks])]); // Merge and remove duplicates
            setError("");
        } catch (error) {
            setError("Error fetching links");
        } finally {
            setIsLoading(false);
        }
    };

    const fetchTextData = async () => {
        setIsLoading(true);
        setTextData("");
        try {
            const fetchedLinks = new Set(); // Keep track of fetched links
            const fetchedData = [];

            const linksToFetch = url2 ? [url2] : links; // Use url2 if provided, else use links array

            for (const link of linksToFetch) {
                if (!fetchedLinks.has(link) && link.includes("docs")) {
                    setUrl2(link);
                    const response = await axios.get(`http://localhost:4000/scrapeTextData?url=${link}`);
                    const {textData: newData} = response.data;
                    fetchedData.push(newData);
                    fetchedLinks.add(link); // Add fetched link to the set
                }
            }

            // Ask user to fetch data from newly stored links
            const shouldFetchNewLinks = window.confirm("Do you want to fetch data from newly stored links?");

            // Check for any new links added to the global variable
            const allLinksResponse = await axios.get("http://localhost:4000/getAllLinks");
            const newLinks = allLinksResponse.data.filter((link) => !fetchedLinks.has(link) && link.includes("docs"));

            // for (const newLink of newLinks) {
            //   const response = await axios.get(`http://localhost:4000/scrapeTextData?url=${newLink}`);
            //   const { textData: newData } = response.data;
            //   fetchedData.push(newData);
            //   fetchedLinks.add(newLink); // Add fetched link to the set
            // }

            if (shouldFetchNewLinks) {
                for (const newLink of newLinks) {
                    const response = await axios.get(`http://localhost:4000/scrapeTextData?url=${newLink}`);
                    const {textData: newData} = response.data;
                    fetchedData.push(newData);
                    fetchedLinks.add(newLink);
                }
            }

            // Combine all fetched text data into a single string
            const combinedData = fetchedData.join("\n\n");
            setTextData(combinedData);
            setError("");
        } catch (error) {
            setError("Error fetching text data");
        } finally {
            setIsLoading(false);
        }
    };

    // working to download in your download location
    const handleDownload = async () => {
        try {
            const allLinksResponse = await axios.get("http://localhost:4000/getAllLinks");
            const allLinks = allLinksResponse.data;

            const mdContent = `${textData}\n\n# All Links:\n ${allLinks
            .map((link) => `**[EFF](${link})**`)
            .join("\n")}\n\n`;
            const blob = new Blob([mdContent], {type: "text/plain"});
            const downloadUrl = window.URL.createObjectURL(blob);

            const link = document.createElement("a");
            link.href = downloadUrl;
            link.setAttribute("download", "scraped_data.md");

            document.body.appendChild(link);
            link.click();

            window.URL.revokeObjectURL(downloadUrl);
            document.body.removeChild(link);
        } catch (error) {
            console.error("Error downloading file:", error);
        }
    };

    const handleDownloadToDirectory = async () => {
        try {
            const allLinksResponse = await axios.get("http://localhost:4000/getAllLinks");
            const allLinks = allLinksResponse.data;

            const mdContent = `${textData}\n\n# All Links:\n ${allLinks
            .map((link) => `**[EFF](${link})**`)
            .join("\n")}\n\n`;

            const formdata = new FormData();
            console.log(mdContent);

            formdata.append("mdContent", mdContent);
            formdata.append("fileName", "scraped_data.md");

            // Send a request to the server to save the Markdown file
            await axios.post("http://localhost:4000/saveMarkdownFile", formdata, {
                headers: {
                    "content-type": "multipart/form-data",
                },
            });

            console.log("Markdown file saved successfully.");
        } catch (error) {
            console.error("Error downloading file:", error);
        }
    };

    return (
        <div>
            <h1>Web Scraper</h1>
            <div>
                <h2>Fetch Links from URL</h2>
                <input type="text" value={url1} onChange={(e) => setUrl1(e.target.value)} placeholder="Enter URL" />
                <button onClick={fetchLinks} disabled={isLoading}>
                    Fetch Links
                </button>
                <br />
                {!isLoading && links && (
                    <textarea rows="10" cols="50" value={links.join("\n")} readOnly placeholder="Links" />
                )}
            </div>
            <br />
            <div>
                <h2>Fetch Text Data from URLs</h2>

                <input
                    type="text"
                    value={url2}
                    onChange={(e) => setUrl2(e.target.value)}
                    placeholder="Enter URL"
                    style={{width: "500px"}}
                />

                <button onClick={fetchTextData} disabled={isLoading}>
                    Fetch Text Data
                </button>
                <br />
                {!isLoading && textData && (
                    <textarea rows="10" cols="50" value={textData} readOnly placeholder="Text Data" />
                )}
            </div>
            <br />
            <button onClick={handleDownloadToDirectory} disabled={isLoading}>
                Download MD File to Retrivals directory
            </button>
            <br />
            <button onClick={handleDownload} disabled={isLoading}>
                Download MD File
            </button>
            {isLoading && (
                <Spinner animation="border" role="status">
                    <span className="visually-hidden">Loading...</span>
                </Spinner>
            )}
            {error && <p>{error}</p>}
        </div>
    );
}
export default App;
