import React, { useState, useEffect, useRef } from "react";
import "./App.css";

// --------------------------------------------------
// Salesforce Objects
// --------------------------------------------------

const OBJECT_OPTIONS = [
  { value: "Account", label: "Accounts" },
  { value: "Opportunity", label: "Opportunities" },
  { value: "Lead", label: "Leads" },
  { value: "Contact", label: "Contacts" },
  { value: "Case", label: "Cases" }
];

// --------------------------------------------------
// Fields for each Salesforce object
// --------------------------------------------------

const COLUMN_MAPPING = {
  Account: ["Id", "Name", "Industry", "Phone", "Website"],

  Opportunity: [
    "Id",
    "Name",
    "StageName",
    "Amount",
    "CloseDate"
  ],

  Lead: [
    "Id",
    "FirstName",
    "LastName",
    "Company",
    "Email"
  ],

  Contact: [
    "Id",
    "FirstName",
    "LastName",
    "Email",
    "Phone"
  ],

  Case: [
    "Id",
    "CaseNumber",
    "Subject",
    "Status",
    "Priority"
  ]
};

// --------------------------------------------------
// API URL
// --------------------------------------------------

const API_URL = "http://localhost:5000";

// --------------------------------------------------
// Main App
// --------------------------------------------------

function App() {
  // Selected Salesforce object
  const [selectedObject, setSelectedObject] = useState("Account");

  // Salesforce records
  const [records, setRecords] = useState([]);

  // Loading states
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Error
  const [error, setError] = useState(null);

  // Pagination
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // Create form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);

  // New record
  const [newRecord, setNewRecord] = useState({});

  // Edit form
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [updating, setUpdating] = useState(false);

  // View record
  const [viewingRecord, setViewingRecord] = useState(null);

  // Reference to scrolling table
  const tableContainerRef = useRef(null);

  // Current columns
  const currentColumns = COLUMN_MAPPING[selectedObject] || [];

  // --------------------------------------------------
  // Load first 20 records
  // --------------------------------------------------

  const loadInitialRecords = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_URL}/api/records/${selectedObject}?offset=0`
      );

      if (response.status === 401) {
        window.location.href = `${API_URL}/auth/login`;
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.details || data.error || "Failed to load records"
        );
      }

      setRecords(data.records || []);
      setOffset(20);

      // Salesforce tells us whether there are more records
      setHasMore(!data.done);
    } catch (err) {
      console.error("Load records error:", err);

      setError(err.message || "Failed to load records");
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // Load next 20 records
  // --------------------------------------------------

  const loadMoreRecords = async () => {
    if (loadingMore || !hasMore || loading) {
      return;
    }

    setLoadingMore(true);

    try {
      const response = await fetch(
        `${API_URL}/api/records/${selectedObject}?offset=${offset}`
      );

      if (response.status === 401) {
        window.location.href = `${API_URL}/auth/login`;
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.details || data.error || "Failed to load more records"
        );
      }

      const newRecords = data.records || [];

      // Add next 20 records to existing records
      setRecords((previousRecords) => [
        ...previousRecords,
        ...newRecords
      ]);

      // Move offset forward by 20
      setOffset((previousOffset) => previousOffset + 20);

      // Stop if Salesforce says there are no more records
      if (data.done || newRecords.length === 0) {
        setHasMore(false);
      }
    } catch (err) {
      console.error("Load more error:", err);

      setError(err.message || "Failed to load more records");
    } finally {
      setLoadingMore(false);
    }
  };

  // --------------------------------------------------
  // Load records when object changes
  // --------------------------------------------------

  useEffect(() => {
    setRecords([]);
    setOffset(0);
    setHasMore(true);
    setError(null);

    loadInitialRecords();
  }, [selectedObject]);

  // --------------------------------------------------
  // Detect scroll to bottom
  // --------------------------------------------------

  const handleTableScroll = (event) => {
    const element = event.currentTarget;

    const reachedBottom =
      element.scrollTop + element.clientHeight >=
      element.scrollHeight - 50;

    if (reachedBottom) {
      loadMoreRecords();
    }
  };

  // --------------------------------------------------
  // Create record
  // --------------------------------------------------

  const handleCreateRecord = async () => {
    setCreating(true);

    try {
      const response = await fetch(
        `${API_URL}/api/records/${selectedObject}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(newRecord)
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.details ||
            data.error ||
            "Failed to create record"
        );
      }

      alert("Record created successfully in Salesforce!");

      setShowCreateForm(false);
      setNewRecord({});

      // Reload from beginning
      setOffset(0);
      setHasMore(true);

      await loadInitialRecords();
    } catch (err) {
      console.error("Create error:", err);

      alert(`Create failed: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  // --------------------------------------------------
  // View record
  // --------------------------------------------------

  const handleView = (record) => {
    setViewingRecord(record);
  };

  // --------------------------------------------------
  // Edit record
  // --------------------------------------------------

  const handleEdit = (record) => {
    setEditingRecord({ ...record });
    setShowEditForm(true);
  };

  // --------------------------------------------------
  // Update record
  // --------------------------------------------------

  const handleUpdateRecord = async () => {
    if (!editingRecord || !editingRecord.Id) {
      return;
    }

    setUpdating(true);

    try {
      // Only send editable fields
      const updateData = { ...editingRecord };

      delete updateData.Id;
      delete updateData.attributes;

      // CaseNumber is automatically generated by Salesforce
      if (selectedObject === "Case") {
        delete updateData.CaseNumber;
      }

      const response = await fetch(
        `${API_URL}/api/records/${selectedObject}/${editingRecord.Id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(updateData)
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.details ||
            data.error ||
            "Failed to update record"
        );
      }

      alert("Record updated successfully in Salesforce!");

      setShowEditForm(false);
      setEditingRecord(null);

      // Reload records
      setOffset(0);
      setHasMore(true);

      await loadInitialRecords();
    } catch (err) {
      console.error("Update error:", err);

      alert(`Update failed: ${err.message}`);
    } finally {
      setUpdating(false);
    }
  };

  // --------------------------------------------------
  // Delete record
  // --------------------------------------------------

  const handleDelete = async (record) => {
    const recordId = record.Id;

    if (!recordId) {
      alert("Record ID not found.");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete this ${selectedObject}?`
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/api/records/${selectedObject}/${recordId}`,
        {
          method: "DELETE"
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.details ||
            data.error ||
            "Failed to delete record"
        );
      }

      alert("Record deleted successfully from Salesforce!");

      // Remove from screen immediately
      setRecords((previousRecords) =>
        previousRecords.filter(
          (item) => item.Id !== recordId
        )
      );
    } catch (err) {
      console.error("Delete error:", err);

      alert(`Delete failed: ${err.message}`);
    }
  };

  // --------------------------------------------------
  // Handle create form input
  // --------------------------------------------------

  const handleCreateInputChange = (field, value) => {
    setNewRecord((previous) => ({
      ...previous,
      [field]: value
    }));
  };

  // --------------------------------------------------
  // Handle edit form input
  // --------------------------------------------------

  const handleEditInputChange = (field, value) => {
    setEditingRecord((previous) => ({
      ...previous,
      [field]: value
    }));
  };

  // --------------------------------------------------
  // Get editable fields
  // --------------------------------------------------

  const getEditableFields = () => {
    return currentColumns.filter((field) => {
      if (field === "Id") return false;
      if (field === "CaseNumber") return false;

      return true;
    });
  };

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <div
      style={{
        padding: "20px",
        fontFamily: "Arial, sans-serif",
        maxWidth: "1200px",
        margin: "0 auto"
      }}
    >
      {/* -------------------------------------------- */}
      {/* Header */}
      {/* -------------------------------------------- */}

      <div style={{ textAlign: "center" }}>
        <h1
          style={{
            fontSize: "42px",
            marginBottom: "15px"
          }}
        >
          Salesforce CRUD Application
        </h1>

        {/* ------------------------------------------ */}
        {/* Dropdown + Create */}
        {/* ------------------------------------------ */}

        <div
          style={{
            marginBottom: "20px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "15px",
            flexWrap: "wrap"
          }}
        >
          <label
            style={{
              fontWeight: "bold",
              fontSize: "17px"
            }}
          >
            Select Salesforce Object:
          </label>

          <select
            value={selectedObject}
            onChange={(e) =>
              setSelectedObject(e.target.value)
            }
            style={{
              padding: "9px 15px",
              borderRadius: "5px",
              border: "1px solid #aaa",
              fontSize: "16px",
              cursor: "pointer"
            }}
          >
            {OBJECT_OPTIONS.map((object) => (
              <option
                key={object.value}
                value={object.value}
              >
                {object.label}
              </option>
            ))}
          </select>

          <button
            onClick={() => {
              setNewRecord({});
              setShowCreateForm(true);
            }}
            style={{
              padding: "9px 15px",
              fontWeight: "bold",
              cursor: "pointer"
            }}
          >
            + Create New
          </button>
        </div>

        <h2
          style={{
            fontSize: "28px",
            marginBottom: "15px"
          }}
        >
          {selectedObject}
        </h2>
      </div>

      {/* -------------------------------------------- */}
      {/* Loading */}
      {/* -------------------------------------------- */}

      {loading && (
        <div style={{ textAlign: "center" }}>
          <p>⏳ Loading records from Salesforce...</p>
        </div>
      )}

      {/* -------------------------------------------- */}
      {/* Error */}
      {/* -------------------------------------------- */}

      {error && (
        <div
          style={{
            textAlign: "center",
            color: "red",
            fontWeight: "bold",
            margin: "20px"
          }}
        >
          ❌ Error: {error}
        </div>
      )}

      {/* -------------------------------------------- */}
      {/* Table */}
      {/* -------------------------------------------- */}

      {!loading && !error && (
        <div
          ref={tableContainerRef}
          onScroll={handleTableScroll}
          style={{
            maxHeight: "500px",
            overflowY: "auto",
            border: "1px solid #ccc"
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              textAlign: "center"
            }}
          >
            <thead
              style={{
                position: "sticky",
                top: 0,
                backgroundColor: "#f5f5f5",
                zIndex: 1
              }}
            >
              <tr>
                {currentColumns.map((column) => (
                  <th
                    key={column}
                    style={{
                      border: "1px solid #ccc",
                      padding: "12px",
                      fontWeight: "bold"
                    }}
                  >
                    {column}
                  </th>
                ))}

                <th
                  style={{
                    border: "1px solid #ccc",
                    padding: "12px"
                  }}
                >
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {records.length > 0 ? (
                records.map((record) => (
                  <tr key={record.Id}>
                    {currentColumns.map((column) => (
                      <td
                        key={column}
                        style={{
                          border: "1px solid #ddd",
                          padding: "10px"
                        }}
                      >
                        {record[column] !== undefined &&
                        record[column] !== null
                          ? String(record[column])
                          : "-"}
                      </td>
                    ))}

                    <td
                      style={{
                        border: "1px solid #ddd",
                        padding: "10px",
                        whiteSpace: "nowrap"
                      }}
                    >
                      <button
                        onClick={() =>
                          handleView(record)
                        }
                        style={{
                          marginRight: "5px",
                          cursor: "pointer"
                        }}
                      >
                        View
                      </button>

                      <button
                        onClick={() =>
                          handleEdit(record)
                        }
                        style={{
                          marginRight: "5px",
                          cursor: "pointer"
                        }}
                      >
                        Edit
                      </button>

                      <button
                        onClick={() =>
                          handleDelete(record)
                        }
                        style={{
                          cursor: "pointer"
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={currentColumns.length + 1}
                    style={{
                      padding: "25px",
                      color: "#777"
                    }}
                  >
                    No records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* ---------------------------------------- */}
          {/* Loading More */}
          {/* ---------------------------------------- */}

          {loadingMore && (
            <div
              style={{
                textAlign: "center",
                padding: "15px"
              }}
            >
              ⏳ Loading next 20 records...
            </div>
          )}

          {!loadingMore && !hasMore && records.length > 0 && (
            <div
              style={{
                textAlign: "center",
                padding: "15px",
                color: "#777"
              }}
            >
              No more records.
            </div>
          )}
        </div>
      )}

      {/* ================================================== */}
      {/* CREATE MODAL */}
      {/* ================================================== */}

      {showCreateForm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "25px",
              width: "450px",
              maxWidth: "90%",
              maxHeight: "80vh",
              overflowY: "auto",
              borderRadius: "8px"
            }}
          >
            <h2>
              Create {selectedObject}
            </h2>

            {getEditableFields().map((field) => (
              <div
                key={field}
                style={{
                  marginBottom: "15px"
                }}
              >
                <label
                  style={{
                    display: "block",
                    fontWeight: "bold",
                    marginBottom: "5px"
                  }}
                >
                  {field}
                </label>

                <input
                  type={
                    field === "Amount"
                      ? "number"
                      : field === "CloseDate"
                      ? "date"
                      : "text"
                  }
                  value={newRecord[field] || ""}
                  onChange={(e) =>
                    handleCreateInputChange(
                      field,
                      e.target.value
                    )
                  }
                  style={{
                    width: "100%",
                    padding: "8px",
                    boxSizing: "border-box"
                  }}
                />
              </div>
            ))}

            <button
              onClick={handleCreateRecord}
              disabled={creating}
              style={{
                marginRight: "10px",
                padding: "8px 15px",
                cursor: "pointer"
              }}
            >
              {creating ? "Creating..." : "Create"}
            </button>

            <button
              onClick={() => {
                setShowCreateForm(false);
                setNewRecord({});
              }}
              style={{
                padding: "8px 15px",
                cursor: "pointer"
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ================================================== */}
      {/* VIEW MODAL */}
      {/* ================================================== */}

      {viewingRecord && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "25px",
              width: "500px",
              maxWidth: "90%",
              maxHeight: "80vh",
              overflowY: "auto",
              borderRadius: "8px"
            }}
          >
            <h2>
              View {selectedObject}
            </h2>

            {currentColumns.map((field) => (
              <p key={field}>
                <strong>{field}:</strong>{" "}
                {viewingRecord[field] !== undefined &&
                viewingRecord[field] !== null
                  ? String(viewingRecord[field])
                  : "-"}
              </p>
            ))}

            <button
              onClick={() =>
                setViewingRecord(null)
              }
              style={{
                padding: "8px 15px",
                cursor: "pointer"
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ================================================== */}
      {/* EDIT MODAL */}
      {/* ================================================== */}

      {showEditForm && editingRecord && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "25px",
              width: "450px",
              maxWidth: "90%",
              maxHeight: "80vh",
              overflowY: "auto",
              borderRadius: "8px"
            }}
          >
            <h2>
              Edit {selectedObject}
            </h2>

            {getEditableFields().map((field) => (
              <div
                key={field}
                style={{
                  marginBottom: "15px"
                }}
              >
                <label
                  style={{
                    display: "block",
                    fontWeight: "bold",
                    marginBottom: "5px"
                  }}
                >
                  {field}
                </label>

                <input
                  type={
                    field === "Amount"
                      ? "number"
                      : field === "CloseDate"
                      ? "date"
                      : "text"
                  }
                  value={
                    editingRecord[field] ?? ""
                  }
                  onChange={(e) =>
                    handleEditInputChange(
                      field,
                      e.target.value
                    )
                  }
                  style={{
                    width: "100%",
                    padding: "8px",
                    boxSizing: "border-box"
                  }}
                />
              </div>
            ))}

            <button
              onClick={handleUpdateRecord}
              disabled={updating}
              style={{
                marginRight: "10px",
                padding: "8px 15px",
                cursor: "pointer"
              }}
            >
              {updating ? "Updating..." : "Update"}
            </button>

            <button
              onClick={() => {
                setShowEditForm(false);
                setEditingRecord(null);
              }}
              style={{
                padding: "8px 15px",
                cursor: "pointer"
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;