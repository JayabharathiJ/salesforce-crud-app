# Salesforce CRUD Web Application

A React and Node.js web application that performs CRUD (Create, Read, Update, Delete) operations on Salesforce standard objects through the Salesforce API.

## Features

- Salesforce OAuth 2.0 authentication
- Central object selection dropdown
- Supports the following Salesforce standard objects:
  - Account
  - Opportunity
  - Lead
  - Contact
  - Case
- View Salesforce records
- Create new records
- Edit existing records
- Delete records
- Loads 20 records at a time
- Pagination / loading of additional records
- React frontend with Node.js backend
- Salesforce API integration

## Technology Stack

- React
- Vite
- Node.js
- Express.js
- Salesforce REST API
- OAuth 2.0

## Project Structure

```text
salesforce-crud-app/
├── public/
├── server/
│   └── server.js
├── src/
│   ├── App.jsx
│   ├── App.css
│   ├── index.css
│   └── main.jsx
├── .env
├── .gitignore
├── package.json
├── salesforceConfig.js
├── index.html
└── vite.config.js