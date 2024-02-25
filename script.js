const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');
const fs = require('fs');
const reader = require('xlsx');
require('dotenv').config();

// Read excel file and extract SKU numbers
const file = reader.readFile('./pandas_to_excel.xlsx');
const sheetName = file.SheetNames[0]; // Assuming SKU numbers are in the first sheet
const worksheet = file.Sheets[sheetName];
const excelData = reader.utils.sheet_to_json(worksheet, { header: 1 }) // Read as array of arrays

// Extract SKU numbers from the first column (Column A)
const skuNumbers = excelData.map(row => row[0]);

// Read data.json file
const data = require('./data/data.json');

// Filter URLs based on matching SKU numbers
const urls = skuNumbers
    .filter(sku => data[sku]) // Check if SKU exists in data.json
    .map(sku => data[sku].url); // Extract URL corresponding to each SKU

// Define scrape function
async function scrape(url) {
    try {
        // Set up axios to use the proxy
        const instance = axios.create({
            proxy: {
                host: process.env.HOST,
                port: process.env.PORT,
                auth: {
                    username: process.env.USER_NAME,
                    password: process.env.PASSWORD
                }
            },
            httpsAgent: new https.Agent({
                rejectUnauthorized: false
            })
        });

        // Fetch the data
        const { data } = await instance.get(url);

        // Load html
        const $ = cheerio.load(data);

        // Extract SKU
        const skuElement = $('#pdTitleBlock ul li:contains("SKU #:")');
        const sku = skuElement.text().trim(); // Trim whitespace

        // Determine if product is in stock
        const in_stock = $('#oosBlock').text().trim(); // Using correct CSS selector and trimming whitespace

        if (in_stock) {
            // Append to CSV file only if product is out of stock
            const output = `${skuElement.text()},Out of stock\n`; // Separate columns with comma
            console.log(`${skuElement.text()} Out of stock`);

            // Write to CSV file
            fs.appendFile('report.csv', output, (err) => {
                if (err) throw err;
                console.log('Data appended to reports.csv');
            });
        } else {
            console.log(`${sku} In Stock`);
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

// Iterate over URLs and call scrape function for each URL
urls.forEach(url => {
    scrape(url);
});
