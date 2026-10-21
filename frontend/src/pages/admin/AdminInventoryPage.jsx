import './InventoryWorkspace.css';
import InventoryAttention from '../../components/InventoryAttention';
import InventoryFeedback from '../../components/InventoryFeedback';
import {inventoryCategory,inventoryRecords,materialRecords} from '../../utils/inventoryAttention';
import {malaysiaDate} from '../../utils/planner';
import ModalDialog from '../../components/ModalDialog';
import PageLoading from "../../components/PageLoading";
import {apiError,readApiError} from '../../utils/apiError';
import ExpiryFields from "../../components/ExpiryFields";
import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { getCookie } from "../../utils/cookieUtils";
import {useSearchParams} from 'react-router-dom';
import FreshCastWorkflowContext from '../../components/FreshCastWorkflowContext';


const API_URL = "/api/admin";

function inventorySaveError(error) {
  if (!error?.response || error.response.status >= 500) {
    return "The save could not be confirmed. Your entries are still here. Check inventory records before submitting again to avoid adding the same batch twice.";
  }
  return apiError(error, "Could not save this inventory batch.");
}

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
  const [params]=useSearchParams();
  const [today,setToday]=useState(()=>malaysiaDate(new Date()));
  useEffect(()=>{const timer=setInterval(()=>setToday(malaysiaDate(new Date())),60000);return()=>clearInterval(timer)},[]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRawMaterial, setSelectedRawMaterial] = useState(()=>/^\d+$/.test(params.get('material')||'')?params.get('material'):"");
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
  const [refreshError, setRefreshError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const closeForm = (setter) => {
    if (loading) return;
    setError("");
    setter(null);
  };

  const refreshRecords = async () => {
    setRefreshing(true);
    setRefreshError("");
    try {
      const [materials, inventory] = await Promise.all([
        axios.get(`${API_URL}/raw-materials/`, getAuthConfig()),
        axios.get(`${API_URL}/inventory-items/`, getAuthConfig()),
      ]);
      const nextMaterials=materialRecords(materials.data),nextInventory=inventoryRecords(inventory.data);
      setRawMaterials(nextMaterials);
      setInventoryItems(nextInventory);
    } catch {
      setRefreshError("Records could not be refreshed. Displayed quantities may be out of date. Refresh records before making another stock change.");
    } finally {
      setRefreshing(false);
    }
  };

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

      setRawMaterials(materialRecords(response.data));
      setRefreshError("");
    } catch {
      setRefreshError("Your change was saved, but raw materials could not be refreshed. Refresh records to see the latest list.");
    }
  };

  const fetchInventoryItems = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/inventory-items/`,
        getAuthConfig()
      );

      setInventoryItems(inventoryRecords(response.data));
      setRefreshError("");
    } catch {
      setRefreshError("Your change was saved, but inventory could not be refreshed. Refresh records to see the latest quantities.");
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      axios.get(API_URL + "/raw-materials/", { ...getAuthConfig(), signal: controller.signal }),
      axios.get(API_URL + "/inventory-items/", { ...getAuthConfig(), signal: controller.signal })
    ]).then(([materials, inventory]) => {
      const nextMaterials=materialRecords(materials.data),nextInventory=inventoryRecords(inventory.data);
      setRawMaterials(nextMaterials);
      setInventoryItems(nextInventory);
    }).catch(err => {
      if (!axios.isCancel(err)) setInitialError(readApiError(err,'Could not load inventory records.'));
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
          ? inventoryCategory(item,today) ===
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
    today,
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
    } catch {
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
        inventorySaveError(err)
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
        inventorySaveError(err)
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
    } catch {
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
  if (initialError) return <main className="admin-inventory-container inventory-workspace"><FreshCastWorkflowContext/>
    <h1>Inventory</h1><p role="alert">{initialError}</p>
    <button type="button" onClick={() => {setInitialLoading(true);setInitialError("");setRetry(n => n + 1)}}>Try again</button>
  </main>;

  return (
    <main className="admin-inventory-container inventory-workspace"><FreshCastWorkflowContext/>

      <div className="admin-header">
        <div>
          <span className="admin-kicker">KITCHEN OPERATIONS</span><h1>Inventory</h1>
          {inventoryItems.some(item=>item.batch_code?.startsWith('DEMO-FC-INV-')) && <p role="status"><strong>Demo stock included.</strong> These batches use fictional quantities and dates for availability and planning.</p>}
          <p>
            Review expiry priorities and record received stock.
          </p>
        </div>

        <div className="inventory-header-actions"><button type="button" disabled={refreshing} onClick={refreshRecords}>{refreshing?'Refreshing…':'Refresh records'}</button>
          <button
            className="secondary-btn" disabled={refreshing || !!refreshError}
            onClick={() =>
              setNewRawMaterial({
                ...emptyRawMaterial,
              })
            }
          >
            Add ingredient
          </button>

          <button
            className="add-inventory-btn" disabled={refreshing || !!refreshError}
            onClick={() =>
              setNewInventoryItem({
                ...emptyInventoryItem,
              })
            }
          >
            Add stock batch
          </button>
        </div>
      </div>

      <InventoryFeedback message={refreshError}>
        <button type="button" disabled={refreshing} onClick={refreshRecords}>
          {refreshing ? "Refreshing..." : "Retry refresh"}
        </button>
      </InventoryFeedback>

      {error && !newRawMaterial && !newInventoryItem && !editingRawMaterial && !editingInventoryItem && (
        <div className="inventory-error">
          {error}
          <button aria-label="Dismiss error" onClick={() => setError("")}>×</button>
        </div>
      )}

      {/* Summary */}
      <div className="inventory-summary">

        <div className="summary-card warning">
          <span>Expiry within 3 days</span>
          <strong>
            {
              inventoryItems.filter(
                (item) => Number(item.quantity)>0 &&
                  inventoryCategory(item,today) === "expiring"
              ).length
            }
          </strong>
        </div>

        <div className="summary-card danger">
          <span>Past recorded expiry</span>
          <strong>
            {
              inventoryItems.filter(
                (item) => Number(item.quantity)>0 &&
                  inventoryCategory(item,today) === "expired"
              ).length
            }
          </strong>
        </div>

      </div>

      <InventoryAttention disabled={refreshing || !!refreshError} items={inventoryItems} today={today} onReview={id=>setEditingInventoryItem({...inventoryItems.find(item=>item.id===id)})}/>

      <h2 className="inventory-batch-heading">All stock batches · {inventoryItems.length}</h2>
      {/* Filters */}
      <div className="inventory-controls">

        <label>Search batches<input
          type="search"
          placeholder="Ingredient, batch or location"
          value={searchQuery}
          onChange={(e) =>
            setSearchQuery(e.target.value)
          }
        /></label>

        <label>Ingredient<select
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
        </select></label>

        <label>Recorded status<select
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
          <option value="held">On hold</option><option value="unknown">Date needs review</option>
        </select></label>

      </div>
      <p className="inventory-list-status" role="status">{filteredInventory.length} of {inventoryItems.length} batches shown{(searchQuery || selectedRawMaterial || freshnessFilter)?' · filters applied':''}. {(searchQuery || selectedRawMaterial || freshnessFilter) && <button type="button" onClick={()=>{setSearchQuery('');setSelectedRawMaterial('');setFreshnessFilter('')}}>Reset filters</button>}</p>

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
                inventoryCategory(item,today);

              return (
                <tr key={item.id} aria-label={`Batch ${item.batch_code || item.id}`}>

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

                      {freshness === "held" && "On hold"}
                      {freshness === "unknown" && "Date needs review"}
                      {freshness === "expired" &&
                        "Expired"}
                    </span>
                  </td>

                  <td className="table-actions" data-label="Actions">

                    <button disabled={refreshing || !!refreshError}
                      onClick={() =>
                        setEditingInventoryItem({
                          ...item,
                        })
                      }
                    >
                      Edit
                    </button>

                    <button
                      className="danger" disabled={refreshing || !!refreshError}
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
                {inventoryItems.length?'No batches match these filters. Reset the filters to review all stock.':'No stock batches recorded. Add a batch when ingredients are received.'}
              </td>
            </tr>

          )}

        </tbody>

      </table></div>

      {/* Raw Material Management */}
      <div className="raw-material-section">

        <div className="section-header">
          <div>
            <h2>Ingredient directory · {rawMaterials.length}</h2>
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
        <ModalDialog label="Create Raw Material" onDismiss={() => closeForm(setNewRawMaterial)}>
<div
          className="modal-overlay"
          onClick={() =>
            closeForm(setNewRawMaterial)
          }
        >
          <div
            className="modal-content form-modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <h2>Create Raw Material</h2>
            <InventoryFeedback message={error}/>

            <label htmlFor="admininventorypage-field-1">Name</label>

            <input id="admininventorypage-field-1"
              value={newRawMaterial.name}
              placeholder="e.g. Chicken"
              onChange={(e) =>
                setNewRawMaterial({
                  ...newRawMaterial,
                  name: e.target.value,
                })
              }
            />

            <label htmlFor="admininventorypage-field-2">Unit</label>

            <select id="admininventorypage-field-2"
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
                disabled={loading}
                onClick={() =>
                  closeForm(setNewRawMaterial)
                }
              >
                Cancel
              </button>

            </div>

          </div>
        </div>
</ModalDialog>
      )}

      {/* EDIT RAW MATERIAL MODAL */}
      {editingRawMaterial && (
        <ModalDialog label="Edit Raw Material" onDismiss={() => closeForm(setEditingRawMaterial)}>
<div
          className="modal-overlay"
          onClick={() =>
            closeForm(setEditingRawMaterial)
          }
        >
          <div
            className="modal-content form-modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <h2>Edit Raw Material</h2>
            <InventoryFeedback message={error}/>

            <label htmlFor="admininventorypage-field-3">Name</label>

            <input id="admininventorypage-field-3"
              value={editingRawMaterial.name}
              onChange={(e) =>
                setEditingRawMaterial({
                  ...editingRawMaterial,
                  name: e.target.value,
                })
              }
            />

            <label htmlFor="admininventorypage-field-4">Unit</label>

            <select id="admininventorypage-field-4"
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
                disabled={loading}
                onClick={() =>
                  closeForm(setEditingRawMaterial)
                }
              >
                Cancel
              </button>

            </div>

          </div>
        </div>
</ModalDialog>
      )}

      {/* CREATE INVENTORY MODAL */}
      {newInventoryItem && (
        <ModalDialog label="Add Inventory Item" onDismiss={() => closeForm(setNewInventoryItem)}>
<div
          className="modal-overlay"
          onClick={() =>
            closeForm(setNewInventoryItem)
          }
        >
          <div
            className="modal-content form-modal inventory-form"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <h2>Add Inventory Item</h2>
            <InventoryFeedback message={error}/>

            <label htmlFor="admininventorypage-field-5">Raw Material</label>

            <select id="admininventorypage-field-5"
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

            <label htmlFor="admininventorypage-field-6">
              Quantity
              {newInventoryItem.raw_material &&
                ` (${getUnit(
                  newInventoryItem.raw_material
                )})`}
            </label>

            <input id="admininventorypage-field-6"
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

            <label htmlFor="admininventorypage-field-7">Batch Code</label>

            <input id="admininventorypage-field-7"
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

            <label htmlFor="admininventorypage-field-8">Storage Location</label>

            <input id="admininventorypage-field-8"
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

            <label htmlFor="admininventorypage-field-9">Received Date</label>

            <input id="admininventorypage-field-9"
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
            <label htmlFor="admininventorypage-field-10">Original printed date (leave blank for calculated shelf life)</label>

            <input id="admininventorypage-field-10"
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
                disabled={loading}
                onClick={() =>
                  closeForm(setNewInventoryItem)
                }
              >
                Cancel
              </button>

            </div>

          </div>
        </div>
</ModalDialog>
      )}

      {/* EDIT INVENTORY MODAL */}
      {editingInventoryItem && (
        <ModalDialog label="Edit Inventory Item" onDismiss={() => closeForm(setEditingInventoryItem)}>
<div
          className="modal-overlay"
          onClick={() =>
            closeForm(setEditingInventoryItem)
          }
        >
          <div
            className="modal-content form-modal inventory-form"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <h2>Edit Inventory Item</h2>
            <InventoryFeedback message={error}><button type="button" disabled={loading} onClick={async () => {
              setLoading(true);
              try {
                const response = await axios.get(`${API_URL}/inventory-items/${editingInventoryItem.id}/`, getAuthConfig());
                setEditingInventoryItem(response.data);
                setError("");
              } catch (err) { setError(apiError(err, "Could not reload this batch.")); }
              finally { setLoading(false); }
            }}>Reload latest batch (discards edits)</button></InventoryFeedback>

            <label htmlFor="admininventorypage-field-11">Raw Material</label>

            <select id="admininventorypage-field-11" disabled
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

            <label>Reason for quantity adjustment<input maxLength={200} value={editingInventoryItem.adjustment_reason || ''} onChange={e=>setEditingInventoryItem({...editingInventoryItem,adjustment_reason:e.target.value})}/></label>
              <label htmlFor="admininventorypage-field-12">
              Quantity (
              {editingInventoryItem.unit}
              )
            </label>

            <input id="admininventorypage-field-12"
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

            <label htmlFor="admininventorypage-field-13">Batch Code</label>

            <input id="admininventorypage-field-13"
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

            <label htmlFor="admininventorypage-field-14">Storage Location</label>

            <input id="admininventorypage-field-14"
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

            <label htmlFor="admininventorypage-field-15">Received Date</label>

            <input id="admininventorypage-field-15"
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
            <label htmlFor="admininventorypage-field-16">Original printed date / calculated shelf-life deadline</label>

            <input id="admininventorypage-field-16"
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
                disabled={loading}
                onClick={() =>
                  closeForm(setEditingInventoryItem)
                }
              >
                Cancel
              </button>

            </div>

          </div>
        </div>
</ModalDialog>
      )}

    </main>
  );
}
