import StockReadiness from '../../components/StockReadiness';
import './InventoryWorkspace.css';
import InventoryAttention from '../../components/InventoryAttention';
import InventoryFeedback from '../../components/InventoryFeedback';
import {inventoryCategory,inventoryRecords,materialRecords} from '../../utils/inventoryAttention';
import {malaysiaDate} from '../../utils/planner';
import ModalDialog from '../../components/ModalDialog';
import PageLoading from "../../components/PageLoading";
import {apiError,readApiError} from '../../utils/apiError';
import {InventoryBatchForm,IngredientForm} from '../../components/InventoryForms';
import {useUI} from '../../contexts/UIContext';
import {stockQuantity} from '../../utils/stockShortage';
import {expiryBreakdown} from '../../utils/expiryEvidence';
import {validStorageGuidance} from "../../utils/storageGuidance";
import axios from "axios";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {useAuth} from '../../contexts/AuthContext';
import { getCookie } from "../../utils/cookieUtils";
import {useSearchParams} from 'react-router-dom';
import FreshCastWorkflowContext from '../../components/FreshCastWorkflowContext';


const API_URL = "/api/admin";
const getAuthConfig=()=>({headers:{'X-CSRFToken':getCookie('csrftoken')},withCredentials:true,timeout:15000});

function inventorySaveError(error) {
  if (!error?.response || error.response.status >= 500) {
    return "The save could not be confirmed. Your entries are still here. Check inventory records before submitting again to avoid adding the same batch twice.";
  }
  return apiError(error, "Could not save this inventory batch.");
}

const emptyRawMaterial = {
  storage_guidance: [],
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
  const {isSessionCurrent}=useAuth();
  const {setAlert}=useUI();
  const writing=useRef(false);
  const [deleting,setDeleting]=useState(null);
  const [params]=useSearchParams();
  const [today,setToday]=useState(()=>malaysiaDate(new Date()));
  useEffect(()=>{const timer=setInterval(()=>setToday(malaysiaDate(new Date())),60000);return()=>clearInterval(timer)},[]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRawMaterial, setSelectedRawMaterial] = useState(()=>/^\d+$/.test(params.get('material')||'')?params.get('material'):"");
  const [ingredientScope,setIngredientScope]=useState(()=>params.get('material')?'all':'current');
  const [showEmptyBatches,setShowEmptyBatches]=useState(()=>params.has('material'));
  const currentMaterialIds=useMemo(()=>new Set(rawMaterials.filter(row=>row.active_menu_count!==0).map(row=>row.id)),[rawMaterials]);
  const scopedMaterials=rawMaterials.filter(row=>ingredientScope==='all'||currentMaterialIds.has(row.id));
  const scopedInventoryItems=inventoryItems.filter(row=>Number(row.quantity)>0&&(ingredientScope==='all'||currentMaterialIds.has(row.raw_material)));
  const [freshnessFilter, setFreshnessFilter] = useState("");
  const [visibleCount,setVisibleCount]=useState(12);
  const batchHeading=useRef(null);
  const chooseStatus=status=>{setFreshnessFilter(status);setSearchQuery('');setSelectedRawMaterial('');setVisibleCount(12);batchHeading.current?.scrollIntoView({block:"start"});batchHeading.current?.focus({preventScroll:true});};

  const [newRawMaterial, setNewRawMaterial] = useState(null);
  const [newInventoryItem, setNewInventoryItem] = useState(null);

  const [editingInventoryItem, setEditingInventoryItem] =
    useState(null);

  const [originalQuantity, setOriginalQuantity] = useState(null);
  const openInventory = item => { setError("");setEditingInventoryItem({...item}); setOriginalQuantity(item.quantity); };

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
    if (loading||writing.current) return;
    setError("");
    setter(null);
  };

  const refreshController=useRef(null);
  const refreshRecords = useCallback(async () => {
    refreshController.current?.abort();const controller=new AbortController();refreshController.current=controller;
    setRefreshing(true);
    setRefreshError("");
    try {
      const [materials, inventory] = await Promise.all([
        axios.get(`${API_URL}/raw-materials/`, {...getAuthConfig(),signal:controller.signal}),
        axios.get(`${API_URL}/inventory-items/`, {...getAuthConfig(),signal:controller.signal}),
      ]);
      const nextMaterials=materialRecords(materials.data),nextInventory=inventoryRecords(inventory.data);
      if(controller.signal.aborted||!isSessionCurrent())return;
      setRawMaterials(nextMaterials);
      setInventoryItems(nextInventory);
    } catch {
      if(!controller.signal.aborted&&isSessionCurrent())setRefreshError("Records could not be refreshed. Displayed quantities may be out of date. Refresh records before making another stock change.");
    } finally {
      if(!controller.signal.aborted&&isSessionCurrent())setRefreshing(false);
    }
  },[isSessionCurrent]);
  const formOpen=!!(newRawMaterial||newInventoryItem||editingInventoryItem||editingRawMaterial||deleting);
  useEffect(()=>{
    let timer;
    const onReturn=()=>{if(document.visibilityState==='hidden'||formOpen||loading||initialLoading||initialError)return;clearTimeout(timer);timer=setTimeout(refreshRecords,150)};
    window.addEventListener('focus',onReturn);document.addEventListener('visibilitychange',onReturn);
    return()=>{clearTimeout(timer);refreshController.current?.abort();window.removeEventListener('focus',onReturn);document.removeEventListener('visibilitychange',onReturn)};
  },[refreshRecords,formOpen,loading,initialLoading,initialError]);

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
        (showEmptyBatches||Number(item.quantity)>0) &&
        (ingredientScope==='all'||currentMaterialIds.has(item.raw_material)) &&
        matchesSearch &&
        matchesRawMaterial &&
        matchesFreshness
      );
    });
  }, [
    inventoryItems,
    ingredientScope,currentMaterialIds,showEmptyBatches,
    searchQuery,
    selectedRawMaterial,
    freshnessFilter,
    today,
  ]);

  const handleCreateRawMaterial = async () => {
    if(writing.current)return;
    if (!validStorageGuidance(newRawMaterial.storage_guidance || [])) {
      setError("Complete each guidance entry with a storage type, whole days (1–3650), source and conditions, or remove the entry to save without it.");
      return;
    }
    if (!newRawMaterial.name.trim()) {
      setError("Raw material name is required.");
      return;
    }

    writing.current=true;
    setLoading(true);
    setError("");

    try {
      await axios.post(
        `${API_URL}/raw-materials/`,
        newRawMaterial,
        getAuthConfig()
      );

      await fetchRawMaterials();

      setIngredientScope("all");setNewRawMaterial(null);setAlert({type:"success",message:"Ingredient added."});
    } catch (err) {
      setError(
        apiError(err,"Could not save this ingredient. Your entries are still here; check the records before trying again.")
      );
    } finally {
      writing.current=false;
      setLoading(false);
    }
  };

  const handleUpdateRawMaterial = async () => {
    if(writing.current)return;
    if (!validStorageGuidance(editingRawMaterial.storage_guidance || [])) {
      setError("Complete each guidance entry with a storage type, whole days (1–3650), source and conditions, or remove the entry to save without it.");
      return;
    }
    writing.current=true;
    setLoading(true);
    setError("");

    try {
      await axios.patch(
        `${API_URL}/raw-materials/${editingRawMaterial.id}/`,
        {
          name: editingRawMaterial.name,
          unit: editingRawMaterial.unit,
          storage_guidance: editingRawMaterial.storage_guidance || [],
        },
        getAuthConfig()
      );

      await fetchRawMaterials();

      setEditingRawMaterial(null);setAlert({type:"success",message:"Ingredient saved."});
    } catch (err) {
      setError(
        apiError(err,"Could not save this ingredient. Your entries are still here; check the records before trying again.")
      );
    } finally {
      writing.current=false;
      setLoading(false);
    }
  };

  const handleCreateInventory = async () => {
    if(writing.current)return;
    writing.current=true;
    setLoading(true);
    setError("");

    try {
      await axios.post(
        `${API_URL}/inventory-items/`,
        {...newInventoryItem, expiry_date:newInventoryItem.expiry_date || undefined},
        getAuthConfig()
      );

      await fetchInventoryItems();

      window.dispatchEvent(new Event('inventory-updated'));

      setIngredientScope(currentMaterialIds.has(Number(newInventoryItem.raw_material))?"current":"all");setSelectedRawMaterial(String(newInventoryItem.raw_material));setSearchQuery("");setFreshnessFilter("");setVisibleCount(12);if(Number(newInventoryItem.quantity)===0)setShowEmptyBatches(true);setNewInventoryItem(null);setAlert({type:"success",message:"Stock batch added."});
    } catch (err) {
      setError(
        inventorySaveError(err)
      );
    } finally {
      writing.current=false;
      setLoading(false);
    }
  };

  const handleUpdateInventory = async () => {
    if(writing.current)return;
    writing.current=true;
    setLoading(true);
    setError("");

    try {
      await axios.patch(
        `${API_URL}/inventory-items/${editingInventoryItem.id}/`,
        editingInventoryItem,
        getAuthConfig()
      );

      await fetchInventoryItems();

      window.dispatchEvent(new Event('inventory-updated'));

      setEditingInventoryItem(null);setAlert({type:"success",message:"Stock batch saved."});
    } catch (err) {
      setError(
        inventorySaveError(err)
      );
    } finally {
      writing.current=false;
      setLoading(false);
    }
  };

  const deleteRecord=async event=>{
    event.preventDefault();if(writing.current)return;writing.current=true;setLoading(true);setError('');
    try{
      const path=deleting.kind==='ingredient'?'raw-materials':'inventory-items';
      await axios.delete(`${API_URL}/${path}/${deleting.item.id}/`,getAuthConfig());
      if(!isSessionCurrent())return;
      setDeleting(null);setAlert({type:'success',message:deleting.kind==='ingredient'?'Ingredient deleted.':'Stock batch deleted.'});
      window.dispatchEvent(new Event('inventory-updated'));await refreshRecords();
    }catch(error){setError(apiError(error,'Could not delete this record. It may be used by orders, stock movements or recipes.'))}
    finally{writing.current=false;setLoading(false)}
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
          {inventoryItems.some(item=>/^(DEMO-FC-INV-|FRESHCAST-DEMO-)/.test(item.batch_code || '')) && <p role="status"><strong>Sample inventory included.</strong> Quantities, dates and storage positions in these batches are scenario data.</p>}
          <p>
            Review expiry priorities and record received stock.
          </p>
        </div>

        <div className="inventory-header-actions"><button type="button" disabled={refreshing} onClick={refreshRecords}>{refreshing?'Refreshing…':'Refresh records'}</button>
          <button
            className="secondary-btn" disabled={refreshing || !!refreshError}
            onClick={() =>
              (setError(""),setNewRawMaterial({...emptyRawMaterial}))
            }
          >
            Add ingredient
          </button>

          <button
            className="add-inventory-btn" disabled={refreshing || !!refreshError}
            onClick={() =>
              (setError(""),setNewInventoryItem({...emptyInventoryItem,received_date:today}))
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

      {error && !newRawMaterial && !newInventoryItem && !editingRawMaterial && !editingInventoryItem && !deleting && (
        <div className="inventory-error">
          {error}
          <button aria-label="Dismiss error" onClick={() => setError("")}>×</button>
        </div>
      )}

      {/* Summary */}
      <div className="inventory-summary" role="group" aria-label="Filter batches by recorded status">
        {[["expiring","Expiry within 3 days"],["expired","Past recorded deadline"],["held","On hold"]].map(([status,label])=><button type="button" className="summary-card" key={status} disabled={refreshing || !!refreshError} aria-pressed={freshnessFilter===status} onClick={()=>chooseStatus(freshnessFilter===status?'':status)}><span>{label}</span><strong>{scopedInventoryItems.filter(item=>inventoryCategory(item,today)===status).length}</strong><small>View batches</small></button>)}
      </div>

      <StockReadiness today={today} disabled={formOpen||loading||refreshing||!!refreshError} onAddIngredient={id=>{if(rawMaterials.some(row=>row.id===id)){setError('');setNewInventoryItem({...emptyInventoryItem,raw_material:String(id),received_date:today});}}}/>

      <details className="inventory-attention-disclosure"><summary>Review priority batches</summary><InventoryAttention disabled={refreshing || !!refreshError} items={scopedInventoryItems} today={today} onReview={id=>openInventory(inventoryItems.find(item=>item.id===id))}/></details>

      <h2 ref={batchHeading} tabIndex={-1} className="inventory-batch-heading">{ingredientScope==='current'?'Current-menu stock batches':'All stock batches'} · {filteredInventory.length}</h2>
      {/* Filters */}
      <div className="inventory-controls">
        <label>Ingredients shown<select value={ingredientScope} onChange={e=>{setIngredientScope(e.target.value);setSelectedRawMaterial('');setVisibleCount(12)}}><option value="current">Used by current menus</option><option value="all">All ingredients, including earlier menus</option></select></label>

        <label className="inventory-show-empty"><span>Include empty batches</span><input type="checkbox" checked={showEmptyBatches} onChange={e=>{setShowEmptyBatches(e.target.checked);setVisibleCount(12)}}/></label>

        <label>Search batches<input
          type="search"
          placeholder="Ingredient, batch or location"
          value={searchQuery}
          onChange={(e) =>
            {setSearchQuery(e.target.value);setVisibleCount(12);}
          }
        /></label>

        <label>Ingredient<select
          value={selectedRawMaterial}
          onChange={(e) =>
            {setSelectedRawMaterial(e.target.value);setVisibleCount(12);}
          }
        >
          <option value="">
            All ingredients
          </option>

          {scopedMaterials.map((material) => (
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
            {setFreshnessFilter(e.target.value);setVisibleCount(12);}
          }
        >
          <option value="">
            All recorded statuses
          </option>
          <option value="fresh">Within recorded shelf life</option>
          <option value="expiring">
            Due within 3 days
          </option>
          <option value="expired">
            Past recorded deadline
          </option>
          <option value="held">On hold</option><option value="unknown">Date needs review</option>
        </select></label>

      </div>
      <details className="inventory-status-help"><summary>How recorded status works</summary><p className="inventory-date-rules">Recorded status uses Malaysia’s current date and the earliest saved deadline: past date = past recorded deadline; today–3 days = attention due; more than 3 days = within recorded date. On hold overrides the date status. These are planning rules, not a physical food-safety test.</p></details>
      <p className="inventory-list-status" role="status">{Math.min(visibleCount,filteredInventory.length)} of {filteredInventory.length} matching batches shown · {inventoryItems.length} recorded{(searchQuery || selectedRawMaterial || freshnessFilter)?' · filters applied':''}. {(searchQuery || selectedRawMaterial || freshnessFilter) && <button type="button" onClick={()=>{setSearchQuery('');setSelectedRawMaterial('');setFreshnessFilter('');setVisibleCount(12)}}>Reset filters</button>}</p>

      {/* Inventory table */}
      <div className="admin-table-scroll responsive-records"><table className="admin-table inventory-table">

        <thead>
          <tr>
            <th scope="col">Ingredient</th>
            <th>Batch</th>
            <th>Quantity</th>
            <th>Storage Location</th>
            <th>Received</th>
            <th>Expiry</th>
            <th scope="col">Recorded status</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>

          {filteredInventory.length > 0 ? (

            filteredInventory.slice(0,visibleCount).map((item) => {

              const freshness =
                inventoryCategory(item,today);
              const expiry=expiryBreakdown(item,today);

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
                    {stockQuantity(item.quantity)} {item.unit}
                  </td>

                  <td data-label="Storage location">
                    {item.storage_location}
                  </td>

                  <td data-label="Received">
                    {item.received_date}
                  </td>

                  <td data-label="Expiry">
                    {item.expiry_date}
                    {expiry&&(expiry.shortened||expiry.effective!==item.expiry_date)&&<span className="inventory-expiry-explanation">{expiry.effective!==item.expiry_date?'Saved deadline differs from the calculation.':`${expiry.controlling.map(limit=>limit.label).join(' and ')} limits the ${item.shelf_life_days}-day calculation.`}<br/><button type="button" onClick={()=>openInventory(item)}>Review date limits</button></span>}
                  </td>

                  <td data-label="Recorded status">
                    <span
                      className={`freshness-badge ${freshness}`}
                    >
                      {freshness === "fresh" &&
                        "Within recorded date"}

                      {freshness === "expiring" &&
                        (item.expiry_date===today?"Expires today":"Due within 3 days")}

                      {freshness === "held" && "On hold"}
                      {freshness === "unknown" && "Date needs review"}
                      {freshness === "expired" &&
                        (item.label_date_type==='best_before'?'Past best-before':'Past recorded date')}
                    </span>
                  </td>

                  <td className="table-actions" data-label="Actions">

                    <button disabled={refreshing || !!refreshError}
                      onClick={() =>
                        openInventory(item)
                      }
                    >
                      Edit
                    </button>

                    <button
                      className="danger" disabled={refreshing || !!refreshError}
                      onClick={() =>
                        (setError(""),setDeleting({kind:"batch",item}))
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

      {visibleCount<filteredInventory.length && <div className="inventory-load-more"><button type="button" onClick={()=>setVisibleCount(count=>count+12)}>Show {Math.min(12,filteredInventory.length-visibleCount)} more batches</button></div>}

      {/* Raw Material Management */}
      <details className="raw-material-section"><summary>Ingredient directory · {scopedMaterials.length}</summary>

        <p>Manage ingredient units and reusable storage guidance. The current-menu view shows ingredients used by active menus. Choose All ingredients above to review earlier or unassigned materials; their stock and history remain recorded.</p>

        <div className="admin-table-scroll responsive-records"><table className="admin-table">

          <thead>
            <tr>
              <th>Name</th>
              <th>Unit</th>
              <th>Saved guidance</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>

            {scopedMaterials.map((material) => (

              <tr key={material.id}>

                <td data-label="Name">{material.name}</td>

                <td data-label="Unit">
                  {material.unit_display}
                </td>
                <td data-label="Saved guidance">{material.storage_guidance?.length?`${material.storage_guidance.length} storage reference${material.storage_guidance.length===1?'':'s'}`:'Custom batch entry available'}</td>

                <td className="table-actions" data-label="Actions">

                  <button
                    onClick={() =>
                      (setError(""),setEditingRawMaterial({...material}))
                    }
                  >
                    Edit
                  </button>

                  <button
                    className="danger"
                    onClick={() =>
                      (setError(""),setDeleting({kind:"ingredient",item:material}))
                    }
                  >
                    Delete
                  </button>

                </td>

              </tr>

            ))}

          </tbody>

        </table></div>

      </details>

      {newRawMaterial&&<IngredientForm value={newRawMaterial} onChange={setNewRawMaterial} onSave={handleCreateRawMaterial} onClose={()=>closeForm(setNewRawMaterial)} busy={loading} error={error}/>}
      {editingRawMaterial&&<IngredientForm value={editingRawMaterial} onChange={setEditingRawMaterial} onSave={handleUpdateRawMaterial} onClose={()=>closeForm(setEditingRawMaterial)} busy={loading} error={error}/>}
      {newInventoryItem&&<InventoryBatchForm value={newInventoryItem} onChange={setNewInventoryItem} materials={rawMaterials} onSave={handleCreateInventory} onClose={()=>closeForm(setNewInventoryItem)} busy={loading} error={error} today={today}/>}
      {editingInventoryItem&&<InventoryBatchForm value={editingInventoryItem} onChange={setEditingInventoryItem} materials={rawMaterials} originalQuantity={originalQuantity} onSave={handleUpdateInventory} onClose={()=>closeForm(setEditingInventoryItem)} busy={loading} error={error} today={today} onReload={async()=>{
        if(writing.current)return;writing.current=true;setLoading(true);
        try{const response=await axios.get(`${API_URL}/inventory-items/${editingInventoryItem.id}/`,getAuthConfig());openInventory(inventoryRecords([response.data])[0]);setError('')}
        catch(error){setError(apiError(error,'Could not reload this batch.'))}finally{writing.current=false;setLoading(false)}
      }}/>}
      {deleting&&<ModalDialog label={deleting.kind==='ingredient'?'Delete ingredient':'Delete stock batch'} onDismiss={()=>closeForm(setDeleting)}><div className="modal-overlay"><form className="modal-content inventory-entry-form" onSubmit={deleteRecord}>
        <header><h2>{deleting.kind==='ingredient'?'Delete ingredient?':'Delete stock batch?'}</h2></header>
        <p><strong>{deleting.kind==='ingredient'?deleting.item.name:deleting.item.raw_material_name}</strong>{deleting.kind==='batch'&&<> · {deleting.item.batch_code||`Batch #${deleting.item.id}`}</>}</p>
        <p>Deletion cannot be undone. Records used by recipes, orders or stock history may be protected. For discarded ingredients, record wastage instead.</p>
        <InventoryFeedback message={error}/>
        <footer><button type="button" disabled={loading} onClick={()=>closeForm(setDeleting)}>Keep record</button><button className="inventory-entry-danger" type="submit" disabled={loading}>{loading?'Deleting…':'Delete record'}</button></footer>
      </form></div></ModalDialog>}
    </main>
  );
}
