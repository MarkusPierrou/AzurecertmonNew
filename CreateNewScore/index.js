const https = require("https");
const { TokenCredential, ClientSecretCredential } = require("@azure/identity");

const clientId = process.env["client-id"];
const clientSecret = process.env["clientsecret"];

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
const tenantId = req.query.tenantIds;

let credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
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
    const tenant = tenantId;
    const certificate = data.topicIdentifier;
    const expirationdate = data.expirationDateTime;
    const email = data.appleIdentifier;

    const pool = new Pool(config);

    const client = await pool.connect();
    const text =
        "INSERT INTO applecertificate(tenant, certificate, expirationdate, email) VALUES($1, $2, $3, $4)";
    const values = [tenant, certificate, expirationdate, email];

    await client.query(text, values);

    client.release();

    context.res = {
        status: 200,
        body: {
            tenantIds: tenantId,
            certificate: certificate,
            expirationdatetime: expirationdate,
            appleIdentifier: email,
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
