const objects = {
  Account: {
    fields: ["Id", "Name", "Industry", "Phone", "Website"]
  },

  Opportunity: {
    fields: [
      "Id",
      "Name",
      "StageName",
      "Amount",
      "CloseDate"
    ]
  },

  Lead: {
    fields: [
      "Id",
      "FirstName",
      "LastName",
      "Company",
      "Email"
    ]
  },

  Contact: {
    fields: [
      "Id",
      "FirstName",
      "LastName",
      "Email",
      "Phone"
    ]
  },

  Case: {
    fields: [
      "Id",
      "CaseNumber",
      "Subject",
      "Status",
      "Priority"
    ]
  }
};