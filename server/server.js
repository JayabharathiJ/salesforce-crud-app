import express from "express";
import cors from "cors";
import axios from "axios";
import dotenv from "dotenv";
import path from "path";
import crypto from "crypto";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "url";

// ====================================================
// LOAD .ENV
// ====================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.join(__dirname, "../.env"),
});

// ====================================================
// ENVIRONMENT CHECK
// ====================================================

console.log("========================================");
console.log("Environment check");
console.log("========================================");

console.log(
  "CLIENT ID:",
  process.env.SALESFORCE_CLIENT_ID ? "Loaded" : "MISSING"
);

console.log(
  "CLIENT SECRET:",
  process.env.SALESFORCE_CLIENT_SECRET ? "Loaded" : "MISSING"
);

console.log(
  "CALLBACK URL:",
  process.env.SALESFORCE_CALLBACK_URL || "MISSING"
);

console.log(
  "LOGIN URL:",
  process.env.SALESFORCE_LOGIN_URL || "MISSING"
);

console.log(
  "FRONTEND URL:",
  process.env.FRONTEND_URL || "MISSING"
);

console.log(
  "NODE ENV:",
  process.env.NODE_ENV || "development"
);

console.log("========================================");

// ====================================================
// APP
// ====================================================

const app = express();

const isProduction = process.env.NODE_ENV === "production";

const frontendUrl =
  process.env.FRONTEND_URL || "http://localhost:5173";

const backendUrl =
  process.env.BACKEND_URL || "http://localhost:5000";

// ====================================================
// CORS
// ====================================================

app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

// ====================================================
// SALESFORCE CONNECTION
// ====================================================

let salesforceAccessToken = null;
let salesforceInstanceUrl = null;

// ====================================================
// PKCE COOKIE
// ====================================================

const PKCE_COOKIE_NAME = "salesforce_pkce_verifier";

// ====================================================
// ALLOWED OBJECTS AND FIELDS
// ====================================================

const allowedObjects = {
  Account: [
    "Id",
    "Name",
    "Industry",
    "Phone",
    "Website",
  ],

  Opportunity: [
    "Id",
    "Name",
    "StageName",
    "Amount",
    "CloseDate",
  ],

  Lead: [
    "Id",
    "FirstName",
    "LastName",
    "Company",
    "Email",
  ],

  Contact: [
    "Id",
    "FirstName",
    "LastName",
    "Email",
    "Phone",
  ],

  Case: [
    "Id",
    "CaseNumber",
    "Subject",
    "Status",
    "Priority",
  ],
};

// ====================================================
// HOME
// ====================================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Salesforce backend is running!",
  });
});

// ====================================================
// HEALTH CHECK
// ====================================================

app.get("/health", (req, res) => {
  res.json({
    success: true,
    status: "OK",
  });
});

// ====================================================
// OAUTH LOGIN WITH PKCE
// ====================================================

app.get("/auth/login", (req, res) => {
  try {
    if (!process.env.SALESFORCE_LOGIN_URL) {
      return res.status(500).send(
        "SALESFORCE_LOGIN_URL is missing."
      );
    }

    if (!process.env.SALESFORCE_CLIENT_ID) {
      return res.status(500).send(
        "SALESFORCE_CLIENT_ID is missing."
      );
    }

    if (!process.env.SALESFORCE_CALLBACK_URL) {
      return res.status(500).send(
        "SALESFORCE_CALLBACK_URL is missing."
      );
    }

    // ------------------------------------------------
    // Generate PKCE code verifier
    // ------------------------------------------------

    const codeVerifier = crypto
      .randomBytes(32)
      .toString("base64url");

    // ------------------------------------------------
    // Generate PKCE code challenge
    // ------------------------------------------------

    const codeChallenge = crypto
      .createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");

    // ------------------------------------------------
    // Save verifier in HTTP-only cookie
    // ------------------------------------------------

    res.cookie(
      PKCE_COOKIE_NAME,
      codeVerifier,
      {
        httpOnly: true,

        // HTTPS on Render
        secure: isProduction,

        // Required when frontend/backend are different origins
        sameSite: isProduction
          ? "none"
          : "lax",

        maxAge: 10 * 60 * 1000,

        path: "/",
      }
    );

    // ------------------------------------------------
    // Salesforce OAuth parameters
    // ------------------------------------------------

    const params = new URLSearchParams();

    params.set(
      "response_type",
      "code"
    );

    params.set(
      "client_id",
      process.env.SALESFORCE_CLIENT_ID
    );

    params.set(
      "redirect_uri",
      process.env.SALESFORCE_CALLBACK_URL
    );

    params.set(
      "code_challenge",
      codeChallenge
    );

    params.set(
      "code_challenge_method",
      "S256"
    );

    // ------------------------------------------------
    // Build Salesforce login URL
    // ------------------------------------------------

    const loginUrl =
      `${process.env.SALESFORCE_LOGIN_URL}` +
      `/services/oauth2/authorize?` +
      params.toString();

    console.log("----------------------------------------");
    console.log("Starting Salesforce OAuth login");
    console.log("PKCE enabled");
    console.log("Production:", isProduction);
    console.log("Callback:", process.env.SALESFORCE_CALLBACK_URL);
    console.log("----------------------------------------");

    res.redirect(loginUrl);

  } catch (error) {
    console.error(
      "OAuth login error:",
      error.message
    );

    res.status(500).send(
      "Could not start Salesforce OAuth login."
    );
  }
});

// ====================================================
// OAUTH CALLBACK
// ====================================================

app.get(
  "/auth/callback",
  async (req, res) => {

    // ------------------------------------------------
    // Salesforce OAuth error
    // ------------------------------------------------

    if (req.query.error) {

      console.error(
        "Salesforce OAuth error:",
        req.query.error,
        req.query.error_description
      );

      return res.status(400).send(
        `Salesforce OAuth error: ${
          req.query.error_description ||
          req.query.error
        }`
      );
    }

    // ------------------------------------------------
    // Authorization code
    // ------------------------------------------------

    const code = req.query.code;

    if (!code) {
      return res.status(400).send(
        "Authorization code was not received from Salesforce."
      );
    }

    // ------------------------------------------------
    // Get PKCE verifier from cookie
    // ------------------------------------------------

    const codeVerifier =
      req.cookies[PKCE_COOKIE_NAME];

    if (!codeVerifier) {

      console.error(
        "PKCE verifier cookie was not found."
      );

      console.error(
        "Cookies received:",
        Object.keys(req.cookies)
      );

      return res.status(400).send(
        "PKCE code verifier was not found. Please start the Salesforce login again."
      );
    }

    try {

      // ------------------------------------------------
      // Token request
      // ------------------------------------------------

      const params = new URLSearchParams();

      params.set(
        "grant_type",
        "authorization_code"
      );

      params.set(
        "code",
        code
      );

      params.set(
        "client_id",
        process.env.SALESFORCE_CLIENT_ID
      );

      // Salesforce connected app secret
      if (process.env.SALESFORCE_CLIENT_SECRET) {
        params.set(
          "client_secret",
          process.env.SALESFORCE_CLIENT_SECRET
        );
      }

      params.set(
        "redirect_uri",
        process.env.SALESFORCE_CALLBACK_URL
      );

      // IMPORTANT:
      // Send the original PKCE verifier
      params.set(
        "code_verifier",
        codeVerifier
      );

      // ------------------------------------------------
      // Exchange authorization code for token
      // ------------------------------------------------

      const response = await axios.post(
        `${process.env.SALESFORCE_LOGIN_URL}/services/oauth2/token`,
        params.toString(),
        {
          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded",
          },
        }
      );

      // ------------------------------------------------
      // Store Salesforce token
      // ------------------------------------------------

      salesforceAccessToken =
        response.data.access_token;

      salesforceInstanceUrl =
        response.data.instance_url;

      // ------------------------------------------------
      // Delete PKCE cookie
      // ------------------------------------------------

      res.clearCookie(
        PKCE_COOKIE_NAME,
        {
          httpOnly: true,
          secure: isProduction,
          sameSite: isProduction
            ? "none"
            : "lax",
          path: "/",
        }
      );

      console.log("");
      console.log("========================================");
      console.log("Salesforce login successful!");
      console.log("========================================");
      console.log(
        "Instance URL:",
        salesforceInstanceUrl
      );
      console.log("Access token received.");
      console.log("PKCE verification successful.");
      console.log("========================================");
      console.log("");

      // ------------------------------------------------
      // Return to React
      // ------------------------------------------------

      res.redirect(frontendUrl);

    } catch (error) {

      console.error("");
      console.error(
        "========================================"
      );
      console.error(
        "OAuth token exchange failed"
      );
      console.error(
        "========================================"
      );

      console.error(
        error.response?.data ||
        error.message
      );

      console.error(
        "========================================"
      );

      res.status(500).send(
        "Salesforce OAuth login failed. Check the backend terminal for details."
      );
    }
  }
);

// ====================================================
// AUTH STATUS
// ====================================================

app.get(
  "/auth/status",
  (req, res) => {

    res.json({
      connected:
        !!salesforceAccessToken &&
        !!salesforceInstanceUrl,
    });
  }
);

// ====================================================
// LOGOUT
// ====================================================

app.get(
  "/auth/logout",
  (req, res) => {

    salesforceAccessToken = null;
    salesforceInstanceUrl = null;

    res.clearCookie(
      PKCE_COOKIE_NAME,
      {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction
          ? "none"
          : "lax",
        path: "/",
      }
    );

    res.json({
      success: true,
      message:
        "Logged out from the application.",
    });
  }
);

// ====================================================
// CHECK SALESFORCE CONNECTION
// ====================================================

function checkSalesforceConnection(res) {

  if (
    !salesforceAccessToken ||
    !salesforceInstanceUrl
  ) {

    res.status(401).json({
      error:
        "Not connected to Salesforce. Please login first.",
    });

    return false;
  }

  return true;
}

// ====================================================
// GET RECORDS
// ====================================================

app.get(
  "/api/records/:objectName",
  async (req, res) => {

    if (!checkSalesforceConnection(res)) {
      return;
    }

    const objectName =
      req.params.objectName;

    // ------------------------------------------------
    // Validate object
    // ------------------------------------------------

    if (!allowedObjects[objectName]) {

      return res.status(400).json({
        error:
          "Invalid Salesforce object.",
      });
    }

    // ------------------------------------------------
    // Pagination
    // ------------------------------------------------

    let limit =
      parseInt(req.query.limit, 10) || 20;

    let offset =
      parseInt(req.query.offset, 10) || 0;

    limit = Math.min(
      Math.max(limit, 1),
      20
    );

    offset = Math.max(
      offset,
      0
    );

    // ------------------------------------------------
    // Fields
    // ------------------------------------------------

    const fields =
      allowedObjects[objectName].join(", ");

    // ------------------------------------------------
    // SOQL
    // ------------------------------------------------

    const soql =
      `SELECT ${fields} ` +
      `FROM ${objectName} ` +
      `LIMIT ${limit} ` +
      `OFFSET ${offset}`;

    try {

      console.log(
        `GET ${objectName} | limit=${limit} | offset=${offset}`
      );

      const response =
        await axios.get(
          `${salesforceInstanceUrl}/services/data/v60.0/query`,
          {
            params: {
              q: soql,
            },

            headers: {
              Authorization:
                `Bearer ${salesforceAccessToken}`,
            },
          }
        );

      res.json({
        object: objectName,
        records:
          response.data.records,
        totalSize:
          response.data.totalSize,
        done:
          response.data.done,
        limit,
        offset,
      });

    } catch (error) {

      console.error(
        "Salesforce GET error:",
        error.response?.data ||
        error.message
      );

      res.status(
        error.response?.status || 500
      ).json({
        error:
          error.response?.data ||
          "Failed to retrieve Salesforce records.",
      });
    }
  }
);

// ====================================================
// CREATE RECORD
// ====================================================

app.post(
  "/api/records/:objectName",
  async (req, res) => {

    if (!checkSalesforceConnection(res)) {
      return;
    }

    const objectName =
      req.params.objectName;

    // ------------------------------------------------
    // Validate object
    // ------------------------------------------------

    if (!allowedObjects[objectName]) {

      return res.status(400).json({
        error:
          "Invalid Salesforce object.",
      });
    }

    // ------------------------------------------------
    // Request data
    // ------------------------------------------------

    const data = {
      ...req.body,
    };

    // Remove read-only fields
    delete data.Id;
    delete data.attributes;
    delete data.CaseNumber;

    try {

      console.log(
        `CREATE ${objectName}`,
        data
      );

      const response =
        await axios.post(
          `${salesforceInstanceUrl}/services/data/v60.0/sobjects/${objectName}`,
          data,
          {
            headers: {
              Authorization:
                `Bearer ${salesforceAccessToken}`,

              "Content-Type":
                "application/json",
            },
          }
        );

      res.status(201).json({
        success: true,
        object: objectName,
        id: response.data.id,
        message:
          `${objectName} created successfully.`,
      });

    } catch (error) {

      console.error(
        "Salesforce CREATE error:",
        error.response?.data ||
        error.message
      );

      res.status(
        error.response?.status || 500
      ).json({
        error:
          error.response?.data ||
          "Failed to create Salesforce record.",
      });
    }
  }
);

// ====================================================
// UPDATE RECORD
// ====================================================

app.put(
  "/api/records/:objectName/:recordId",
  async (req, res) => {

    if (!checkSalesforceConnection(res)) {
      return;
    }

    const objectName =
      req.params.objectName;

    const recordId =
      req.params.recordId;

    // ------------------------------------------------
    // Validate object
    // ------------------------------------------------

    if (!allowedObjects[objectName]) {

      return res.status(400).json({
        error:
          "Invalid Salesforce object.",
      });
    }

    // ------------------------------------------------
    // Data
    // ------------------------------------------------

    const data = {
      ...req.body,
    };

    delete data.Id;
    delete data.attributes;
    delete data.CaseNumber;

    try {

      console.log(
        `UPDATE ${objectName}/${recordId}`,
        data
      );

      await axios.patch(
        `${salesforceInstanceUrl}/services/data/v60.0/sobjects/${objectName}/${recordId}`,
        data,
        {
          headers: {
            Authorization:
              `Bearer ${salesforceAccessToken}`,

            "Content-Type":
              "application/json",
          },
        }
      );

      res.json({
        success: true,
        message:
          `${objectName} updated successfully.`,
      });

    } catch (error) {

      console.error(
        "Salesforce UPDATE error:",
        error.response?.data ||
        error.message
      );

      res.status(
        error.response?.status || 500
      ).json({
        error:
          error.response?.data ||
          "Failed to update Salesforce record.",
      });
    }
  }
);

// ====================================================
// DELETE RECORD
// ====================================================

app.delete(
  "/api/records/:objectName/:recordId",
  async (req, res) => {

    if (!checkSalesforceConnection(res)) {
      return;
    }

    const objectName =
      req.params.objectName;

    const recordId =
      req.params.recordId;

    // ------------------------------------------------
    // Validate object
    // ------------------------------------------------

    if (!allowedObjects[objectName]) {

      return res.status(400).json({
        error:
          "Invalid Salesforce object.",
      });
    }

    try {

      console.log(
        `DELETE ${objectName}/${recordId}`
      );

      await axios.delete(
        `${salesforceInstanceUrl}/services/data/v60.0/sobjects/${objectName}/${recordId}`,
        {
          headers: {
            Authorization:
              `Bearer ${salesforceAccessToken}`,
          },
        }
      );

      res.json({
        success: true,
        message:
          `${objectName} deleted successfully.`,
      });

    } catch (error) {

      console.error(
        "Salesforce DELETE error:",
        error.response?.data ||
        error.message
      );

      res.status(
        error.response?.status || 500
      ).json({
        error:
          error.response?.data ||
          "Failed to delete Salesforce record.",
      });
    }
  }
);

// ====================================================
// START SERVER
// ====================================================

const PORT =
  process.env.PORT || 5000;

app.listen(
  PORT,
  () => {

    console.log("");
    console.log(
      "========================================"
    );

    console.log(
      `Salesforce backend running on port ${PORT}`
    );

    console.log(
      `Backend URL: ${backendUrl}`
    );

    console.log(
      "========================================"
    );
  }
);