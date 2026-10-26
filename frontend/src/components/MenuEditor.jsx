import {useEffect,useId,useRef,useState} from 'react';
import ModalDialog from './ModalDialog';
import SellingDetailsEditor from './SellingDetailsEditor';
import RecipeEditor from './RecipeEditor';
import MenuPhotoField from './MenuPhotoField';
import {useProduct} from '../contexts/ProductContext';
import {menuFieldErrors,menuSaveError} from '../utils/menuForm';
import './MenuEditor.css';

export default function MenuEditor({value,onChange,onDismiss}){
 const {categories,addProduct,updateProduct}=useProduct();
 const id=useId(),form=useRef(null),submitted=useRef(false);
 const [errors,setErrors]=useState({}),[message,setMessage]=useState(''),[uncertain,setUncertain]=useState(false),[busy,setBusy]=useState(false),[photoBusy,setPhotoBusy]=useState(false);
 const editing=Boolean(value.id),locked=busy || photoBusy;
 const dismiss=()=>{if(!busy)onDismiss();};
 useEffect(()=>{
  const key=Object.keys(errors)[0];
  const field=key?form.current?.querySelector(`[data-menu-field="${key}"]`):message?form.current?.querySelector('.menu-form-error'):null;
  if(field){for(let parent=field.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;field.focus();field.scrollIntoView({block:'center'});}
 },[errors,message]);
 const change=(key,next)=>{onChange({...value,[key]:next});setErrors(previous=>{const copy={...previous};delete copy[key];return copy;});setMessage('');};
 const submit=async e=>{
  e.preventDefault();if(submitted.current || locked || uncertain)return;
  const next=menuFieldErrors(value);setErrors(next);setMessage('');
  if(Object.keys(next).length)return;
  submitted.current=true;setBusy(true);
  const {selling_status:ignoredStatus,can_delete:ignoredDelete,...edits}=value;void ignoredStatus;void ignoredDelete;
  try{
   const saved=await (editing?updateProduct:addProduct)({...edits,name:edits.name.trim()},{onError:error=>{const issue=menuSaveError(error);setErrors(issue.fields);setMessage(issue.message);setUncertain(issue.uncertain);}});
   if(saved)onDismiss();
  }finally{submitted.current=false;setBusy(false);}
 };
 const fieldProps=key=>({'aria-invalid':Boolean(errors[key]),'aria-describedby':errors[key]?id+'-'+key+'-error':undefined,'data-menu-field':key});
 const hint=key=>errors[key] && <p id={id+'-'+key+'-error'} className="menu-field-error">{errors[key]}</p>;
 return <ModalDialog label={editing?'Edit menu':'Create menu'} onDismiss={dismiss}><div className="modal-overlay" onClick={dismiss}><section className="modal-content form-modal menu-editor" onClick={e=>e.stopPropagation()}>
  <h2>{editing?'Edit menu':'Create menu'}</h2><p className="menu-form-help">Menu name, price and category are required.</p>
  <form ref={form} noValidate onSubmit={submit} aria-busy={locked}>
   {(message || Object.keys(errors).length>0) && <div className="menu-form-error" role="alert" tabIndex={-1}>{message || 'Check the highlighted fields.'}</div>}
   <fieldset disabled={locked} className="menu-editor-fields">
    <label htmlFor={id+'-name'}>Menu name</label><input id={id+'-name'} data-initial-focus required maxLength={200} value={value.name} onChange={e=>change('name',e.target.value)} {...fieldProps('name')}/>{hint('name')}
    <label htmlFor={id+'-price'}>Price per selling unit (RM)</label><input id={id+'-price'} required type="number" inputMode="decimal" min="0.01" step="0.01" value={value.price} onChange={e=>change('price',e.target.value)} {...fieldProps('price')}/>{hint('price')}
    <label htmlFor={id+'-category'}>Category</label><select id={id+'-category'} required value={value.category || ''} onChange={e=>change('category',e.target.value===''?'':Number(e.target.value))} {...fieldProps('category')}><option value="">Choose a category</option>{categories.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}</select>{hint('category')}
    <SellingDetailsEditor value={value} onChange={onChange}/><RecipeEditor value={value} onChange={onChange}/>
    <label htmlFor={id+'-description'}>Description (optional)</label><textarea id={id+'-description'} value={value.description || ''} onChange={e=>change('description',e.target.value)}/>
    <MenuPhotoField value={value.image_url || ''} fieldError={errors.image_url} onBusy={setPhotoBusy} onChange={url=>{onChange(previous=>previous?{...previous,image_url:url}:previous);setErrors(previous=>{const copy={...previous};delete copy.image_url;return copy;});setMessage('');}}/>
   </fieldset>
   <div className="modal-actions"><button type="submit" disabled={locked || uncertain}>{busy?'Saving…':photoBusy?'Uploading photo…':editing?'Save changes':'Create menu'}</button><button type="button" disabled={busy} onClick={dismiss}>{uncertain?'Close and check menus':'Cancel'}</button></div>
  </form>
 </section></div></ModalDialog>;
}
