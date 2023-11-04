const https = require("https");
const { TokenCredential, ClientSecretCredential } = require("@azure/identity");

const tenantId = "X";
const clientId = process.env["client-id"];
const clientSecret = process.env["clientsecret"];

const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);

const { Pool } = require("pg");

const config = {
    user: process.env["database-user"],
    host: process.env["database-server"],
    database: process.env["database"],
    password: process.env["database-password"],
    port: 5432, // Your PostgreSQL server port
    ssl: true, // This depends on your PostgreSQL server configuration
};

module.exports = async function(context, req) {
    credential
        .getToken("https://graph.microsoft.com/.default")
        .then((tokenResponse) => {
            const accessToken = tokenResponse.token;

            const options = {
                hostname: "graph.microsoft.com",
                path: "/beta/deviceManagement/applePushNotificationCertificate",
                method: "GET",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            };

            const req = https.request(options, (res) => {
                let data = "";

                res.on("data", (chunk) => {
                    data += chunk;
                });

                res.on("end", async() => {
                    console.log(JSON.parse(data));
                    const certificate = JSON.parse(data).topicIdentifier;
                    const expirationdatetime = JSON.parse(data).expirationDateTime;
                    const appleIdentifier = JSON.parse(data).appleIdentifier;
                    // Process the data as needed

                    const pool = new Pool(config);

                    try {
                        const client = await pool.connect();
                        const text =
                            "INSERT INTO certificate(certificate, expirationdatetime, appleIdentifier) VALUES($1, $2, $3)"; // Modify with your table and column names
                        const values = [certificate, expirationdatetime, appleIdentifier]; // Replace with your values

                        const res = await client.query(text, values);

                        context.res = {
                            status: 200,
                            body: "Data inserted successfully",
                        };

                        client.release(); // Release the client back to the pool
                    } catch (err) {
                        context.log(err);
                        context.res = {
                            status: 500,
                            body: "Error inserting data",
                        };
                    }
                });
            });

            req.on("error", (error) => {
                console.error("Error making the request:", error);
                context.res = {
                    status: 500,
                    body: "Error making the request",
                };
            });

            req.end();
        })
        .catch((error) => {
            console.error("Failed to acquire token:", error);
            context.res = {
                status: 500,
                body: "Failed to acquire token",
            };
        });
};