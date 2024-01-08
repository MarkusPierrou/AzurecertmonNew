const https = require("https");
const { TokenCredential, ClientSecretCredential } = require("@azure/identity");

const tenantId = "d4616c26-b9bd-4d02-91d7-60ea7be3789a";
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
    const tenantIds = req.query.tenantIds;

    if (tenantIds) {
      try {
        // Log the tenantId to the console for testing purposes
        context.log(`Received tenantIds: ${tenantIds}`);
  
        // Respond with the received tenantId as plain text
        context.res = {
          status: 200,
          body: `Received tenantIds: ${tenantIds}`,
          headers: {
            'Content-Type': 'text/plain'
          }
        };
      } catch (error) {
        context.res = {
          status: 500,
          body: `Internal Server Error: ${error.message}`,
          headers: {
            'Content-Type': 'text/plain'
          }
        };
      }
    } else {
      context.res = {
        status: 400,
        body: 'Bad Request: Tenant ID is missing',
        headers: {
          'Content-Type': 'text/plain'
        }
      };
    }
    try {
        const tokenResponse = await credential.getToken(
            "https://graph.microsoft.com/.default"
        );
        const accessToken = tokenResponse.token;

        const options = {
            hostname: "graph.microsoft.com",
            path: "/beta/deviceManagement/applePushNotificationCertificate",
            method: "GET",
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        };

        const data = await new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let data = "";

                res.on("data", (chunk) => {
                    data += chunk;
                });

                res.on("end", () => {
                    resolve(JSON.parse(data));
                });
            });

            req.on("error", (error) => {
                reject(error);
            });

            req.end();
        });

        const certificate = data.topicIdentifier;
        const expirationdatetime = data.expirationDateTime;
        const appleIdentifier = data.appleIdentifier;

        const pool = new Pool(config);

        const client = await pool.connect();
        const text =
            "INSERT INTO certificate(certificate, expirationdatetime, appleIdentifier) VALUES($1, $2, $3)";
        const values = [certificate, expirationdatetime, appleIdentifier];

        await client.query(text, values);

        client.release();

        context.res = {
            status: 200,
            body: {
                tenantId: tenantId,
                certificate: certificate,
                expirationdatetime: expirationdatetime,
                appleIdentifier: appleIdentifier,
            },
        };
    } catch (error) {
        console.error("Error:", error);
        context.res = {
            status: 500,
            body: {
                ClientID: clientId,
                Error: error,
            },
        };
    }
};
