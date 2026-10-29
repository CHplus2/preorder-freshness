import {useEffect, useId, useRef, useState} from 'react';
import axios from 'axios';
import ModalDialog from './ModalDialog';
import {useProduct} from '../contexts/ProductContext';
import {getCookie} from '../utils/cookieUtils';
import {apiError, readApiError} from '../utils/apiError';
import './CategoryManager.css';

export default function CategoryManager({onDismiss}) {
  const {setCategories, fetchProducts} = useProduct();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [editor, setEditor] = useState({id: null, name: ''});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmId, setConfirmId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const nameRef = useRef(null), actionRef = useRef(false), id = useId();

  const reload = async () => {
    setLoading(true); setLoadError('');
    try {
      const {data} = await axios.get('/api/categories/', {timeout: 15000});
      if (!Array.isArray(data) || data.some(row => !Number.isInteger(row.id) || typeof row.name !== 'string' || !Number.isInteger(row.menu_count))) {
        throw Object.assign(new Error('Unexpected categories'), {code: 'INVALID_RESPONSE'});
      }
      setRows(data); setCategories(data);
      return true;
    } catch (err) {
      setLoadError(readApiError(err, 'Categories could not be loaded.'));
      return false;
    } finally { setLoading(false); }
  };
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    axios.get('/api/categories/', {signal: controller.signal, timeout: 15000}).then(({data}) => {
      if (!Array.isArray(data) || data.some(row => !Number.isInteger(row.id) || typeof row.name !== 'string' || !Number.isInteger(row.menu_count))) {
        throw Object.assign(new Error('Unexpected categories'), {code: 'INVALID_RESPONSE'});
      }
      if (active) { setRows(data); setCategories(data); }
    }).catch(err => { if (active && !axios.isCancel(err)) setLoadError(readApiError(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [setCategories]);

  const dismiss = () => { if (!actionRef.current) onDismiss(); };
  const edit = row => {
    setEditor({id: row.id, name: row.name}); setConfirmId(null); setError(''); setNotice('');
    nameRef.current?.focus();
  };
  const mutate = async (method, url, data, message) => {
    if (actionRef.current || loading || loadError || uncertain) return;
    actionRef.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const result = await axios({method, url, data, timeout: 15000, headers: {'X-CSRFToken': getCookie('csrftoken')}});
      if (method === 'delete' ? result.status !== 204 : result.status !== (method === 'post' ? 201 : 200) || !Number.isInteger(result.data?.id) || result.data?.name !== data.name) {
        throw new Error('The category change could not be verified.');
      }
      setEditor({id: null, name: ''}); setConfirmId(null);
      setNotice(message);
      if (!await reload()) setUncertain(true);
      await fetchProducts();
    } catch (err) {
      if (!err.response || err.response.status >= 500) {
        setUncertain(true);
        setError('We could not confirm the change. Refresh categories and check the list before trying again.');
      } else {
        setError(err.response.status === 404 ? 'This category is no longer available. Refresh categories to continue.' : err.response.data?.detail || apiError(err));
        if (err.response.status === 404 || err.response.data?.code === 'category_in_use') {
          setConfirmId(null);
          if (err.response.status === 404) setEditor({id: null, name: ''});
          await reload();
        }
      }
    } finally { actionRef.current = false; setBusy(false); }
  };
  const save = event => {
    event.preventDefault();
    const name = editor.name.trim().replace(/\s+/gu, ' ');
    if (!name) { setError('Enter a category name.'); nameRef.current?.focus(); return; }
    if ([...name].length > 100) { setError('Keep the category name within 100 characters.'); nameRef.current?.focus(); return; }
    if (rows.some(row => row.id !== editor.id && row.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      setError('A category with this name already exists. Choose another name.'); nameRef.current?.focus(); return;
    }
    mutate(editor.id ? 'patch' : 'post', editor.id ? `/api/categories/${editor.id}/` : '/api/categories/', {name}, editor.id ? 'Category renamed. Menus keep their category.' : 'Category created. You can now choose it when editing a menu.');
  };
  const refresh = async () => {
    if (actionRef.current) return;
    if (await reload()) {
      setUncertain(false); setError(''); setConfirmId(null); setEditor({id: null, name: ''});
      setNotice('Categories refreshed. Check the list before making another change.');
      await fetchProducts();
    }
  };
  const locked = busy || loading || Boolean(loadError) || uncertain;

  return <ModalDialog label="Manage menu categories" onDismiss={dismiss}>
    <div className="modal-overlay" onClick={dismiss}><section className="modal-content category-manager" onClick={event => event.stopPropagation()} aria-busy={busy || loading}>
      <div className="category-manager-heading"><h2>Menu categories</h2><button type="button" onClick={dismiss} disabled={busy}>Close</button></div>
      <p>Organise your menu into groups customers can browse. Renaming keeps all menus linked.</p>
      {notice && <p className="category-notice" role="status">{notice}</p>}
      {(loadError || error) && <p className="category-error" role="alert" id={id + '-error'}>{loadError || error}</p>}
      <form onSubmit={save} noValidate className="category-form">
        <label htmlFor={id + '-name'}>{editor.id ? 'Rename category' : 'New category name'}</label>
        <div className="category-form-actions"><input id={id + '-name'} ref={nameRef} data-initial-focus maxLength={100} required value={editor.name} disabled={locked}
          aria-describedby={error ? id + '-error' : undefined}
          onChange={event => {setEditor({...editor, name: event.target.value}); setError('');}}/>
          <button type="submit" className="admin-primary" disabled={locked}>{busy ? 'Saving…' : editor.id ? 'Save name' : 'Add category'}</button>
          {editor.id && <button type="button" disabled={busy} onClick={() => {setEditor({id: null, name: ''}); setError(''); nameRef.current?.focus();}}>Cancel rename</button>}
        </div>
      </form>
      <div className="category-list-heading"><h3>Current categories</h3><button type="button" disabled={busy || loading} onClick={refresh}>Refresh categories</button></div>
      {loading ? <p role="status">Loading categories…</p> : !loadError && <>
        {rows.length === 0 ? <p>No categories yet. Add your first category above.</p> : <ul className="category-list">{rows.map(row => <li key={row.id}>
          <div className="category-row"><div><strong>{row.name}</strong><span>{row.menu_count} {row.menu_count === 1 ? 'menu' : 'menus'}</span></div>
            <div className="category-row-actions"><button type="button" disabled={locked} aria-label={`Rename ${row.name}`} onClick={() => edit(row)}>Rename</button>
              {row.menu_count === 0 && <button type="button" disabled={locked} aria-label={`Delete ${row.name}`} onClick={() => {setConfirmId(row.id); setError('');}}>Delete</button>}
            </div>
          </div>
          {confirmId === row.id && <div className="category-delete-confirm"><p>Delete <strong>{row.name}</strong>? This empty category will be permanently removed.</p><div className="category-row-actions">
            <button type="button" disabled={locked} onClick={() => setConfirmId(null)}>Keep category</button>
            <button type="button" className="danger" disabled={locked} onClick={() => mutate('delete', `/api/categories/${row.id}/`, undefined, 'Empty category deleted.')}>Delete category</button>
          </div></div>}
        </li>)}</ul>}
        <p className="category-help">To delete a category with menus, move them to another category first using Edit &amp; steps. Counts include paused and archived menus; choose All menus to find them.</p>
      </>}
    </section></div>
  </ModalDialog>;
}
