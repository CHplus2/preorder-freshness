import {useRef,useState} from 'react';
import ModalDialog from '../ModalDialog';
import {useProduct} from '../../contexts/ProductContext';
import {apiError} from '../../utils/apiError';
import './DeleteProduct.css';

export default function DeleteProduct(){
 const {products,productIdToDelete,setProductIdToDelete,deleteProduct,updateProduct,fetchProducts}=useProduct();
 const product=products.find(p=>p.id===productIdToDelete);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[blocked,setBlocked]=useState(false);
 const submitting=useRef(false);
 const used=product?.can_delete===false || blocked;
 const dismiss=()=>{if(!submitting.current)setProductIdToDelete(null);};
 const act=async archive=>{
  if(submitting.current)return;submitting.current=true;setBusy(true);setError('');
  const onError=e=>{if(e.response?.data?.code==='menu_used_in_orders')setBlocked(true);setError(e.response?.status===404?'This menu is no longer available. Close this dialog and refresh menus.':!e.response || e.response.status>=500?'We could not confirm the change. Close this dialog and refresh menus before trying again.':apiError(e));};
  try{
   const saved=archive?await updateProduct({id:productIdToDelete,selling_status:'archived'},{onError}):await deleteProduct(productIdToDelete,{onError});
   if(saved)setProductIdToDelete(null);
  }finally{submitting.current=false;setBusy(false);}
 };
 return <ModalDialog label={used?'Keep menu history':'Delete menu'} onDismiss={dismiss}><div className="modal-overlay" onClick={dismiss}><section className="modal-content menu-delete-dialog" onClick={e=>e.stopPropagation()}>
  <h2>{used?'Keep this menu’s order history':`Delete ${product?.name || 'menu'}?`}</h2>
  {error && <p role="alert" className="menu-delete-error">{error}</p>}
  {used?<p>{product?.selling_status==='archived'?'This menu is already archived. It remains linked to orders so their recipes and history stay available.':'This menu is linked to orders. Archive it to stop new orders and remove it from the current menu list while keeping those records.'}</p>:<p>This permanently removes <strong>{product?.name || 'this menu'}</strong> and its current recipe. It also removes the menu from any baskets. This cannot be undone.</p>}
  <div className="delete-actions"><button type="button" disabled={busy} onClick={dismiss}>{used?'Close':'Cancel'}</button>
   {used && product?.selling_status!=='archived'?<button type="button" disabled={busy} onClick={()=>act(true)}>{busy?'Archiving…':'Archive menu'}</button>:!used && product?.can_delete===true?<button type="button" className="delete-btn" disabled={busy} onClick={()=>act(false)}>{busy?'Deleting…':'Delete menu'}</button>:!used && <button type="button" onClick={()=>fetchProducts()}>Refresh menu details</button>}
  </div>
 </section></div></ModalDialog>;
}
