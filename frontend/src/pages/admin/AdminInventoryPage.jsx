import PageLoading from "../../components/PageLoading";
import {apiError} from '../../utils/apiError';
import ExpiryFields from "../../components/ExpiryFields";
import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { getCookie } from "../../utils/cookieUtils";


const API_URL = "/api/admin";

const emptyRawMaterial = {
  name: "",
  unit: "g",
};

const emptyInventoryItem = {
  raw_material: "",
  quantity: "",
  batch_code: "",
  storage_location: "",
  received_date: "",
  expiry_date: "",
};

export default function AdminInventoryPage() {
  const [rawMaterials, setRawMaterials] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRawMaterial, setSelectedRawMaterial] = useState("");
  const [freshnessFilter, setFreshnessFilter] = useState("");

  const [newRawMaterial, setNewRawMaterial] = useState(null);
  const [newInventoryItem, setNewInventoryItem] = useState(null);

  const [editingInventoryItem, setEditingInventoryItem] =
    useState(null);

  const [editingRawMaterial, setEditingRawMaterial] =
    useState(null);

  const [initialLoading, setInitialLoading] = useState(true);
  const [initialError, setInitialError] = useState("");
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const getAuthConfig = () => ({
    headers: {
      "X-CSRFToken": getCookie("csrftoken"),
    },
    withCredentials: true,
  });

  const fetchRawMaterials = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/raw-materials/`,
        getAuthConfig()
      );

      setRawMaterials(response.data);
    } catch (err) {
      setError("Failed to load raw materials.");
    }
  };

  const fetchInventoryItems = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/inventory-items/`,
        getAuthConfig()
      );

      setInventoryItems(response.data);
    } catch (err) {
      setError("Failed to load inventory.");
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    setInitialLoading(true);
    setInitialError("");
    Promise.all([
      axios.get(API_URL + "/raw-materials/", { ...getAuthConfig(), signal: controller.signal }),
      axios.get(API_URL + "/inventory-items/", { ...getAuthConfig(), signal: controller.signal })
    ]).then(([materials, inventory]) => {
      setRawMaterials(materials.data);
      setInventoryItems(inventory.data);
    }).catch(err => {
      if (!axios.isCancel(err)) setInitialError(apiError(err));
    }).finally(() => {
      if (!controller.signal.aborted) setInitialLoading(false);
    });
    return () => controller.abort();
  }, [retry]);

  useEffect(() => {
    if (
      newRawMaterial ||
      newInventoryItem ||
      editingInventoryItem ||
      editingRawMaterial
    ) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }

    return () => {
      document.body.style.overflow = "auto";
    };
  }, [
    newRawMaterial,
    newInventoryItem,
    editingInventoryItem,
    editingRawMaterial,
  ]);

  const getFreshnessStatus = (expiryDate) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);

    const difference =
      (expiry - today) / (1000 * 60 * 60 * 24);

    if (difference < 0) {
      return "expired";
    }

    if (difference <= 3) {
      return "expiring";
    }

    return "fresh";
  };

  const filteredInventory = useMemo(() => {
    return inventoryItems.filter((item) => {
      const search = searchQuery.toLowerCase();

      const matchesSearch =
        item.raw_material_name
          ?.toLowerCase()
          .includes(search) ||
        item.batch_code
          ?.toLowerCase()
          .includes(search) ||
        item.storage_location
          ?.toLowerCase()
          .includes(search);

      const matchesRawMaterial =
        selectedRawMaterial
          ? item.raw_material === Number(selectedRawMaterial)
          : true;

      const matchesFreshness =
        freshnessFilter
          ? getFreshnessStatus(item.expiry_date) ===
            freshnessFilter
          : true;

      return (
        matchesSearch &&
        matchesRawMaterial &&
        matchesFreshness
      );
    });
  }, [
    inventoryItems,
    searchQuery,
    selectedRawMaterial,
    freshnessFilter,
  ]);

  const handleCreateRawMaterial = async () => {
    if (!newRawMaterial.name.trim()) {
      setError("Raw material name is required.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await axios.post(
        `${API_URL}/raw-materials/`,
        newRawMaterial,
        getAuthConfig()
      );

      await fetchRawMaterials();

      setNewRawMaterial(null);
    } catch (err) {
      setError(
        err.response?.data?.name?.[0] ||
        "Failed to create raw material."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRawMaterial = async () => {
    setLoading(true);
    setError("");

    try {
      await axios.patch(
        `${API_URL}/raw-materials/${editingRawMaterial.id}/`,
        {
          name: editingRawMaterial.name,
          unit: editingRawMaterial.unit,
        },
        getAuthConfig()
      );

      await fetchRawMaterials();

      setEditingRawMaterial(null);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
        "Failed to update raw material."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRawMaterial = async (id) => {
    const confirmed = window.confirm(
      "Delete this raw material? This is only possible if it is not being used by products or inventory."
    );

    if (!confirmed) return;

    try {
      await axios.delete(
        `${API_URL}/raw-materials/${id}/`,
        getAuthConfig()
      );

      await fetchRawMaterials();
    } catch (err) {
      setError(
        "This raw material cannot be deleted because it is still being used."
      );
    }
  };

  const handleCreateInventory = async () => {
    setLoading(true);
    setError("");

    try {
      await axios.post(
        `${API_URL}/inventory-items/`,
        {...newInventoryItem, expiry_date:newInventoryItem.expiry_date || undefined},
        getAuthConfig()
      );

      await fetchInventoryItems();

      setNewInventoryItem(null);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
        apiError(err, "Failed to create inventory item.")
      );
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateInventory = async () => {
    setLoading(true);
    setError("");

    try {
      await axios.patch(
        `${API_URL}/inventory-items/${editingInventoryItem.id}/`,
        editingInventoryItem,
        getAuthConfig()
      );

      await fetchInventoryItems();

      setEditingInventoryItem(null);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
        apiError(err, "Failed to update inventory item.")
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteInventory = async (id) => {
    const confirmed = window.confirm(
      "Delete this inventory item?"
    );

    if (!confirmed) return;

    try {
      await axios.delete(
        `${API_URL}/inventory-items/${id}/`,
        getAuthConfig()
      );

      await fetchInventoryItems();
    } catch (err) {
      setError("Failed to delete inventory item.");
    }
  };

  const getUnit = (rawMaterialId) => {
    const material = rawMaterials.find(
      (item) => item.id === Number(rawMaterialId)
    );

    return material?.unit || "";
  };

  if (initialLoading) return <PageLoading label="Loading inventory..." />;
  if (initialError) return <div className="admin-inventory-container">
    <h1>Inventory</h1><p role="alert">{initialError}</p>
    <button type="button" onClick={() => setRetry(n => n + 1)}>Try again</button>
  </div>;

  return (
    <div className="admin-inventory-container">

      <div className="admin-header">
        <div>
          <h1>Inventory Management</h1>
          <p>
            Manage raw materials, inventory batches and
            freshness.
          </p>
        </div>

        <div className="inventory-header-actions">
          <button
            className="secondary-btn"
            onClick={() =>
              setNewRawMaterial({
                ...emptyRawMaterial,
              })
            }
          >
            + Raw Material
          </button>

          <button
            className="add-inventory-btn"
            onClick={() =>
              setNewInventoryItem({
                ...emptyInventoryItem,
              })
            }
          >
            + Add Inventory
          </button>
        </div>
      </div>

      {error && (
        <div className="inventory-error">
          {error}
          <button onClick={() => setError("")}>×</button>
        </div>
      )}

      {/* Summary */}
      <div className="inventory-summary">

        <div className="summary-card">
          <span>Total Batches</span>
          <strong>{inventoryItems.length}</strong>
        </div>

        <div className="summary-card">
          <span>Raw Materials</span>
          <strong>{rawMaterials.length}</strong>
        </div>

        <div className="summary-card warning">
          <span>Expiring Soon</span>
          <strong>
            {
              inventoryItems.filter(
                (item) =>
                  getFreshnessStatus(
                    item.expiry_date
                  ) === "expiring"
              ).length
            }
          </strong>
        </div>

        <div className="summary-card danger">
          <span>Expired</span>
          <strong>
            {
              inventoryItems.filter(
                (item) =>
                  getFreshnessStatus(
                    item.expiry_date
                  ) === "expired"
              ).length
            }
          </strong>
        </div>

      </div>

      {/* Filters */}
      <div className="inventory-controls">

        <input
          type="text"
          placeholder="Search material, batch or location..."
          value={searchQuery}
          onChange={(e) =>
            setSearchQuery(e.target.value)
          }
        />

        <select
          value={selectedRawMaterial}
          onChange={(e) =>
            setSelectedRawMaterial(e.target.value)
          }
        >
          <option value="">
            All Raw Materials
          </option>

          {rawMaterials.map((material) => (
            <option
              key={material.id}
              value={material.id}
            >
              {material.name}
            </option>
          ))}
        </select>

        <select
          value={freshnessFilter}
          onChange={(e) =>
            setFreshnessFilter(e.target.value)
          }
        >
          <option value="">
            All Freshness Status
          </option>
          <option value="fresh">Within recorded shelf life</option>
          <option value="expiring">
            Expiring Soon
          </option>
          <option value="expired">
            Expired
          </option>
        </select>

      </div>

      {/* Inventory table */}
      <div className="admin-table-scroll responsive-records"><table className="admin-table inventory-table">

        <thead>
          <tr>
            <th>Raw Material</th>
            <th>Batch</th>
            <th>Quantity</th>
            <th>Storage Location</th>
            <th>Received</th>
            <th>Expiry</th>
            <th>Freshness</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>

          {filteredInventory.length > 0 ? (

            filteredInventory.map((item) => {

              const freshness =
                getFreshnessStatus(
                  item.expiry_date
                );

              return (
                <tr key={item.id}>

                  <td data-label="Raw material">
                    <strong>
                      {item.raw_material_name}
                    </strong>
                  </td>

                  <td data-label="Batch">
                    {item.batch_code || "—"}{item.quarantined && " · HELD"}
                  </td>

                  <td data-label="Quantity">
                    {item.quantity} {item.unit}
                  </td>

                  <td data-label="Storage location">
                    {item.storage_location}
                  </td>

                  <td data-label="Received">
                    {item.received_date}
                  </td>

                  <td data-label="Expiry">
                    {item.expiry_date}
                  </td>

                  <td data-label="Recorded status">
                    <span
                      className={`freshness-badge ${freshness}`}
                    >
                      {freshness === "fresh" &&
                        "Within shelf life"}

                      {freshness === "expiring" &&
                        "Expiring Soon"}

                      {freshness === "expired" &&
                        "Expired"}
                    </span>
                  </td>

                  <td className="table-actions" data-label="Actions">

                    <button
                      onClick={() =>
                        setEditingInventoryItem({
                          ...item,
                        })
                      }
                    >
                      Edit
                    </button>

                    <button
                      className="danger"
                      onClick={() =>
                        handleDeleteInventory(
                          item.id
                        )
                      }
                    >
                      Delete
                    </button>

                  </td>

                </tr>
              );
            })

          ) : (

            <tr>
              <td colSpan="8">
                No inventory items found.
              </td>
            </tr>

          )}

        </tbody>

      </table></div>

      {/* Raw Material Management */}
      <div className="raw-material-section">

        <div className="section-header">
          <div>
            <h2>Raw Materials</h2>
            <p>
              Master list of ingredients used by your
              products.
            </p>
          </div>
        </div>

        <div className="admin-table-scroll responsive-records"><table className="admin-table">

          <thead>
            <tr>
              <th>Name</th>
              <th>Unit</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>

            {rawMaterials.map((material) => (

              <tr key={material.id}>

                <td data-label="Name">{material.name}</td>

                <td data-label="Unit">
                  {material.unit_display}
                </td>

                <td className="table-actions" data-label="Actions">

                  <button
                    onClick={() =>
                      setEditingRawMaterial({
                        ...material,
                      })
                    }
                  >
                    Edit
                  </button>

                  <button
                    className="danger"
                    onClick={() =>
                      handleDeleteRawMaterial(
                        material.id
                      )
                    }
                  >
                    Delete
                  </button>

                </td>

              </tr>

            ))}

          </tbody>

        </table></div>

      </div>

      {/* CREATE RAW MATERIAL MODAL */}
      {newRawMaterial && (
        <div
          className="modal-overlay"
          onClick={() =>
            setNewRawMaterial(null)
          }
        >
          <div
            className="modal-content form-modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <h2>Create Raw Material</h2>

            <label>Name</label>

            <input
              value={newRawMaterial.name}
              placeholder="e.g. Chicken"
              onChange={(e) =>
                setNewRawMaterial({
                  ...newRawMaterial,
                  name: e.target.value,
                })
              }
            />

            <label>Unit</label>

            <select
              value={newRawMaterial.unit}
              onChange={(e) =>
                setNewRawMaterial({
                  ...newRawMaterial,
                  unit: e.target.value,
                })
              }
            >
              <option value="g">Gram (g)</option>
              <option value="kg">Kilogram (kg)</option>
              <option value="ml">
                Millilitre (ml)
              </option>
              <option value="l">Litre (l)</option>
              <option value="unit">Unit</option>
            </select>

            <div className="modal-actions">

              <button
                onClick={
                  handleCreateRawMaterial
                }
                disabled={loading}
              >
                {loading
                  ? "Creating..."
                  : "Create"}
              </button>

              <button
                onClick={() =>
                  setNewRawMaterial(null)
                }
              >
                Cancel
              </button>

            </div>

          </div>
        </div>
      )}

      {/* EDIT RAW MATERIAL MODAL */}
      {editingRawMaterial && (
        <div
          className="modal-overlay"
          onClick={() =>
            setEditingRawMaterial(null)
          }
        >
          <div
            className="modal-content form-modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <h2>Edit Raw Material</h2>

            <label>Name</label>

            <input
              value={editingRawMaterial.name}
              onChange={(e) =>
                setEditingRawMaterial({
                  ...editingRawMaterial,
                  name: e.target.value,
                })
              }
            />

            <label>Unit</label>

            <select
              value={editingRawMaterial.unit}
              onChange={(e) =>
                setEditingRawMaterial({
                  ...editingRawMaterial,
                  unit: e.target.value,
                })
              }
            >
              <option value="g">Gram (g)</option>
              <option value="kg">
                Kilogram (kg)
              </option>
              <option value="ml">
                Millilitre (ml)
              </option>
              <option value="l">Litre (l)</option>
              <option value="unit">Unit</option>
            </select>

            <div className="modal-actions">

              <button
                onClick={
                  handleUpdateRawMaterial
                }
                disabled={loading}
              >
                {loading
                  ? "Saving..."
                  : "Save"}
              </button>

              <button
                onClick={() =>
                  setEditingRawMaterial(null)
                }
              >
                Cancel
              </button>

            </div>

          </div>
        </div>
      )}

      {/* CREATE INVENTORY MODAL */}
      {newInventoryItem && (
        <div
          className="modal-overlay"
          onClick={() =>
            setNewInventoryItem(null)
          }
        >
          <div
            className="modal-content form-modal inventory-form"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <h2>Add Inventory Item</h2>

            <label>Raw Material</label>

            <select
              value={
                newInventoryItem.raw_material
              }
              onChange={(e) =>
                setNewInventoryItem({
                  ...newInventoryItem,
                  raw_material:
                    Number(e.target.value),
                })
              }
            >
              <option value="">
                -- Select Raw Material --
              </option>

              {rawMaterials.map((material) => (
                <option
                  key={material.id}
                  value={material.id}
                >
                  {material.name}
                </option>
              ))}
            </select>

            <label>
              Quantity
              {newInventoryItem.raw_material &&
                ` (${getUnit(
                  newInventoryItem.raw_material
                )})`}
            </label>

            <input
              type="number"
              min="0"
              step="0.001"
              value={
                newInventoryItem.quantity
              }
              onChange={(e) =>
                setNewInventoryItem({
                  ...newInventoryItem,
                  quantity: e.target.value,
                })
              }
            />

            <label>Batch Code</label>

            <input
              value={
                newInventoryItem.batch_code
              }
              placeholder="e.g. CHK-20260901-001"
              onChange={(e) =>
                setNewInventoryItem({
                  ...newInventoryItem,
                  batch_code: e.target.value,
                })
              }
            />

            <label>Storage Location</label>

            <input
              value={
                newInventoryItem.storage_location
              }
              placeholder="Fridge A - Top Shelf - Left"
              onChange={(e) =>
                setNewInventoryItem({
                  ...newInventoryItem,
                  storage_location:
                    e.target.value,
                })
              }
            />

            <label>Received Date</label>

            <input
              type="date"
              value={
                newInventoryItem.received_date
              }
              onChange={(e) =>
                setNewInventoryItem({
                  ...newInventoryItem,
                  received_date:
                    e.target.value,
                })
              }
            />

            <ExpiryFields value={newInventoryItem} onChange={setNewInventoryItem}/>
            <label>Original printed date (leave blank for calculated shelf life)</label>

            <input
              type="date"
              value={
                newInventoryItem.original_expiry_date || newInventoryItem.expiry_date
              }
              onChange={(e) =>
                setNewInventoryItem({
                  ...newInventoryItem,
                  expiry_date: e.target.value,
                  original_expiry_date: e.target.value || null,
                })
              }
            />

            <div className="modal-actions">

              <button
                onClick={
                  handleCreateInventory
                }
                disabled={loading}
              >
                {loading
                  ? "Adding..."
                  : "Add Inventory"}
              </button>

              <button
                onClick={() =>
                  setNewInventoryItem(null)
                }
              >
                Cancel
              </button>

            </div>

          </div>
        </div>
      )}

      {/* EDIT INVENTORY MODAL */}
      {editingInventoryItem && (
        <div
          className="modal-overlay"
          onClick={() =>
            setEditingInventoryItem(null)
          }
        >
          <div
            className="modal-content form-modal inventory-form"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <h2>Edit Inventory Item</h2>

            <label>Raw Material</label>

            <select
              value={
                editingInventoryItem.raw_material
              }
              onChange={(e) =>
                setEditingInventoryItem({
                  ...editingInventoryItem,
                  raw_material:
                    Number(e.target.value),
                })
              }
            >

              {rawMaterials.map((material) => (
                <option
                  key={material.id}
                  value={material.id}
                >
                  {material.name}
                </option>
              ))}

            </select>

            <label>
              Quantity (
              {editingInventoryItem.unit}
              )
            </label>

            <input
              type="number"
              min="0"
              step="0.001"
              value={
                editingInventoryItem.quantity
              }
              onChange={(e) =>
                setEditingInventoryItem({
                  ...editingInventoryItem,
                  quantity: e.target.value,
                })
              }
            />

            <label>Batch Code</label>

            <input
              value={
                editingInventoryItem.batch_code ||
                ""
              }
              onChange={(e) =>
                setEditingInventoryItem({
                  ...editingInventoryItem,
                  batch_code: e.target.value,
                })
              }
            />

            <label>Storage Location</label>

            <input
              value={
                editingInventoryItem.storage_location
              }
              onChange={(e) =>
                setEditingInventoryItem({
                  ...editingInventoryItem,
                  storage_location:
                    e.target.value,
                })
              }
            />

            <label>Received Date</label>

            <input
              type="date"
              value={
                editingInventoryItem.received_date
              }
              onChange={(e) =>
                setEditingInventoryItem({
                  ...editingInventoryItem,
                  received_date:
                    e.target.value,
                })
              }
            />

            <ExpiryFields value={editingInventoryItem} onChange={setEditingInventoryItem}/>
            <label>Original printed date / calculated shelf-life deadline</label>

            <input
              type="date"
              value={
                editingInventoryItem.original_expiry_date || editingInventoryItem.expiry_date
              }
              onChange={(e) =>
                setEditingInventoryItem({
                  ...editingInventoryItem,
                  expiry_date: e.target.value,
                  original_expiry_date: e.target.value || null,
                })
              }
            />

            <div className="modal-actions">

              <button
                onClick={
                  handleUpdateInventory
                }
                disabled={loading}
              >
                {loading
                  ? "Saving..."
                  : "Save Changes"}
              </button>

              <button
                onClick={() =>
                  setEditingInventoryItem(null)
                }
              >
                Cancel
              </button>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}