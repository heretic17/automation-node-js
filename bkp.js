const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');
const fs = require('fs');
const reader = require('xlsx');
require('dotenv').config();

// Read excel file and extract SKU numbers
const file = reader.readFile('./removed_dupes.xlsx');
const sheetName = file.SheetNames[0]; // Assuming SKU numbers are in the first sheet
const worksheet = file.Sheets[sheetName];
const excelData = reader.utils.sheet_to_json(worksheet, { header: 1 }) // Read as array of arrays

// Extract SKU numbers from the first column (Column A)
const skuNumbers = excelData.map(row => row[0]);
console.log(skuNumbers.length)
// const csvData = skuNumbers.join(',');
// fs.appendFile('asd.csv', csvData, (err) => {
//     if (err) throw err;
//     console.log('Data appended to reports.csv');
// });
// Read data.json file
const data = require('./data/data.json');

// Filter URLs based on matching SKU numbers
const urls = skuNumbers
    .filter(sku => data[sku]) // Check if SKU exists in data.json
    .map(sku => data[sku].url); // Extract URL corresponding to each SKU
console.log(urls.length)
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
        console.log(`in stock: ${in_stock}`)
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
        const errorMessage = error.toString(); // Convert error object to string
        fs.appendFileSync('error_log.txt', errorMessage);
        console.error("Error logged to error_log.txt");
    }
}

// Iterate over URLs and call scrape function for each URL
urls.forEach(url => {
    scrape(url);
});
