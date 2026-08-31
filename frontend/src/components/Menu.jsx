import React, { useState, useEffect, useRef, useCallback } from 'react';
import { API, toast, formatPHP } from '../api';

const CATEGORIES = ['Espresso', 'Specialty', 'Frappé', 'Cold Drinks', 'Food'];

/* ── Shared helper: render image or emoji ───────────────────────────────────── */
export function ProductThumb({ product, size = 52, style = {} }) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [product?.image_url]);

  if (product?.image_url && !imgError) {
    return (
      <img
        src={product.image_url}
        alt={product.name || 'Product'}
        onError={() => setImgError(true)}
        style={{
          width: size, height: size,
          objectFit: 'cover', borderRadius: '8px',
          flexShrink: 0, display: 'block',
          ...style
        }}
      />
    );
  }
  return (
    <span style={{ fontSize: size * 0.65, lineHeight: 1, flexShrink: 0, ...style }}>
      {product?.emoji || '☕'}
    </span>
  );
}

/* ── Crop Modal ─────────────────────────────────────────────────────────────── */
function CropModal({ src, onDone, onCancel }) {
  const canvasRef  = useRef();
  const imgRef     = useRef();
  const [loaded, setLoaded]   = useState(false);
  const [crop, setCrop]       = useState({ x: 0, y: 0, size: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [resizing, setResizing]   = useState(false);
  const [resizeEdge, setResizeEdge] = useState(null);
  const CANVAS_SIZE = 380;

  const initCrop = useCallback((natW, natH) => {
    const scale = CANVAS_SIZE / Math.max(natW, natH);
    const dw = Math.round(natW * scale);
    const dh = Math.round(natH * scale);
    const s  = Math.min(dw, dh) * 0.8;
    const x  = Math.round((dw - s) / 2);
    const y  = Math.round((dh - s) / 2);
    return { x, y, size: Math.round(s), dw, dh };
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img    = imgRef.current;
    if (!canvas || !img || !loaded) return;
    const { dw, dh } = crop;
    canvas.width  = dw;
    canvas.height = dh;
    const ctx = canvas.getContext('2d');
    // Draw scaled image
    ctx.drawImage(img, 0, 0, dw, dh);
    // Dim overlay
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, dw, dh);
    // Clear crop square
    ctx.clearRect(crop.x, crop.y, crop.size, crop.size);
    // Border
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 2;
    ctx.strokeRect(crop.x, crop.y, crop.size, crop.size);
    // Corner handles
    const H = 10;
    ctx.fillStyle = '#fff';
    [[crop.x, crop.y], [crop.x + crop.size - H, crop.y], [crop.x, crop.y + crop.size - H], [crop.x + crop.size - H, crop.y + crop.size - H]]
      .forEach(([hx, hy]) => ctx.fillRect(hx, hy, H, H));
    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    [1/3, 2/3].forEach(f => {
      ctx.beginPath(); ctx.moveTo(crop.x + crop.size * f, crop.y); ctx.lineTo(crop.x + crop.size * f, crop.y + crop.size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(crop.x, crop.y + crop.size * f); ctx.lineTo(crop.x + crop.size, crop.y + crop.size * f); ctx.stroke();
    });
  }, [crop, loaded]);

  useEffect(() => { draw(); }, [draw]);

  const getEdge = (mx, my) => {
    const { x, y, size } = crop;
    const T = 14;
    const corners = [
      { name: 'nw', cx: x,        cy: y },
      { name: 'ne', cx: x + size, cy: y },
      { name: 'sw', cx: x,        cy: y + size },
      { name: 'se', cx: x + size, cy: y + size },
    ];
    for (const c of corners)
      if (Math.abs(mx - c.cx) < T && Math.abs(my - c.cy) < T) return c.name;
    return null;
  };

  const pos = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    const sc = crop.dw / r.width;
    return { x: (e.clientX - r.left) * sc, y: (e.clientY - r.top) * sc };
  };

  const onMouseDown = (e) => {
    const { x, y } = pos(e);
    const edge = getEdge(x, y);
    if (edge) { setResizing(true); setResizeEdge(edge); }
    else if (x >= crop.x && x <= crop.x + crop.size && y >= crop.y && y <= crop.y + crop.size) {
      setDragging(true); setDragStart({ ox: x - crop.x, oy: y - crop.y });
    }
  };

  const onMouseMove = (e) => {
    if (!dragging && !resizing) return;
    const { x, y } = pos(e);
    const { dw, dh } = crop;
    if (dragging && dragStart) {
      const nx = Math.max(0, Math.min(dw - crop.size, x - dragStart.ox));
      const ny = Math.max(0, Math.min(dh - crop.size, y - dragStart.oy));
      setCrop(c => ({ ...c, x: nx, y: ny }));
    }
    if (resizing) {
      setCrop(c => {
        let { x: cx, y: cy, size: cs } = c;
        if (resizeEdge === 'se') { const s = Math.max(40, Math.min(x - cx, y - cy, dw - cx, dh - cy)); return { ...c, size: s }; }
        if (resizeEdge === 'sw') { const s = Math.max(40, Math.min(cx + cs - x + 0, y - cy, cx + cs, dh - cy)); const nx = Math.max(0, cx + cs - s); return { ...c, x: nx, size: s }; }
        if (resizeEdge === 'ne') { const s = Math.max(40, Math.min(x - cx, cy + cs - y + 0, dw - cx, cy + cs)); const ny = Math.max(0, cy + cs - s); return { ...c, y: ny, size: s }; }
        if (resizeEdge === 'nw') { const s = Math.max(40, Math.min(cx + cs - x + 0, cy + cs - y + 0, cx + cs, cy + cs)); const nx = Math.max(0, cx + cs - s); const ny = Math.max(0, cy + cs - s); return { ...c, x: nx, y: ny, size: s }; }
        return c;
      });
    }
  };

  const onMouseUp = () => { setDragging(false); setResizing(false); };

  const handleApply = () => {
    const img = imgRef.current;
    const { x, y, size, dw, dh } = crop;
    const scaleX = img.naturalWidth  / dw;
    const scaleY = img.naturalHeight / dh;
    const out = document.createElement('canvas');
    out.width = out.height = 400;
    const ctx = out.getContext('2d');
    ctx.drawImage(img, x * scaleX, y * scaleY, size * scaleX, size * scaleY, 0, 0, 400, 400);
    out.toBlob(blob => onDone(blob), 'image/jpeg', 0.9);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
    }}>
      <div style={{
        background: '#fff', borderRadius: '16px', padding: '24px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)', maxWidth: '440px', width: '94vw'
      }}>
        <h3 style={{ margin: '0 0 14px', fontFamily: "'Playfair Display', serif", color: '#3d1f00', fontSize: '1.2rem' }}>
          ✂️ Crop Image
        </h3>
        <p style={{ margin: '0 0 12px', fontSize: '0.82rem', color: '#888' }}>
          Drag the square to reposition · drag corners to resize
        </p>
        <div style={{ position: 'relative', width: '100%', background: '#111', borderRadius: '10px', overflow: 'hidden', userSelect: 'none' }}>
          <img
            ref={imgRef}
            src={src}
            style={{ display: 'none' }}
            onLoad={() => {
              const img = imgRef.current;
              const init = initCrop(img.naturalWidth, img.naturalHeight);
              setCrop(c => ({ ...c, ...init }));
              setLoaded(true);
            }}
            alt="crop source"
          />
          <canvas
            ref={canvasRef}
            style={{ display: 'block', width: '100%', cursor: dragging ? 'grabbing' : 'crosshair', touchAction: 'none' }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
          />
        </div>
        <div style={{ display: 'flex', gap: '10px', marginTop: '16px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{ padding: '9px 22px', borderRadius: '8px', border: '1.5px solid #ccc', background: '#fff', cursor: 'pointer', fontWeight: 600, color: '#555' }}
          >Cancel</button>
          <button
            type="button"
            onClick={handleApply}
            style={{ padding: '9px 22px', borderRadius: '8px', border: 'none', background: '#3d1f00', color: '#fff', cursor: 'pointer', fontWeight: 700 }}
          >Apply Crop</button>
        </div>
      </div>
    </div>
  );
}

/* ── Image upload field ─────────────────────────────────────────────────────── */
function ImageUploadField({ imageUrl, onImageUploaded }) {
  const [uploading, setUploading]   = useState(false);
  const [preview, setPreview]       = useState(imageUrl || '');
  const [cropSrc, setCropSrc]       = useState(null);   // raw local URL for crop modal
  const inputRef = useRef();

  useEffect(() => { setPreview(imageUrl || ''); }, [imageUrl]);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const localUrl = URL.createObjectURL(file);
    setCropSrc(localUrl);               // open crop modal first
    e.target.value = '';                // reset so same file can be re-selected
  };

  const handleCropDone = async (blob) => {
    setCropSrc(null);
    const localUrl = URL.createObjectURL(blob);
    setPreview(localUrl);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', blob, 'product.jpg');
      const res  = await fetch('/api/products/upload-image', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      onImageUploaded(data.image_url);
      setPreview(data.image_url);
    } catch (err) {
      toast(err.message, 'error');
      setPreview(imageUrl || '');
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      {cropSrc && (
        <CropModal
          src={cropSrc}
          onDone={handleCropDone}
          onCancel={() => setCropSrc(null)}
        />
      )}
      <div className="form-group">
        <label className="form-label">Product Image</label>
        <div
          onClick={() => !uploading && inputRef.current?.click()}
          style={{
            border: '2px dashed var(--tan-dark)',
            borderRadius: '10px', padding: '12px',
            display: 'flex', alignItems: 'center', gap: '12px',
            cursor: uploading ? 'not-allowed' : 'pointer',
            background: 'var(--cream, #fdf8f0)',
            transition: 'border-color .2s', minHeight: '70px',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--espresso)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--tan-dark)'}
        >
          {preview ? (
            <img src={preview} alt="product preview"
              style={{ width: '52px', height: '52px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} />
          ) : (
            <div style={{
              width: '52px', height: '52px', borderRadius: '8px', flexShrink: 0,
              background: '#f0e8dc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem'
            }}>📷</div>
          )}
          <div>
            <div style={{ fontWeight: 600, color: 'var(--espresso)', fontSize: '0.85rem' }}>
              {uploading ? 'Uploading…' : preview ? 'Click to change image' : 'Click to upload image'}
            </div>
            <div style={{ color: '#999', fontSize: '0.75rem', marginTop: '2px' }}>
              JPG, PNG, WebP · max 5 MB · you can crop before saving
            </div>
          </div>
          {preview && !uploading && (
            <button
              type="button" title="Remove image"
              onClick={e => { e.stopPropagation(); setPreview(''); onImageUploaded(''); }}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#c0392b', fontSize: '1rem' }}
            >✕</button>
          )}
        </div>
        <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
      </div>
    </>
  );
}

/* ── Product form fields ────────────────────────────────────────────────────── */
function ProductFormFields({ form, setForm }) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div className="form-group">
          <label className="form-label">Name *</label>
          <input className="form-control" value={form.name} placeholder="e.g. Iced Latte"
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Category *</label>
          <select className="form-control" value={form.category}
            onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Price (₱) *</label>
        <input className="form-control" type="number" value={form.price} placeholder="0.00"
          onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
      </div>
      <ImageUploadField
        imageUrl={form.image_url}
        onImageUploaded={url => setForm(f => ({ ...f, image_url: url }))}
      />
      <div className="form-group">
        <label className="form-label">Description</label>
        <input className="form-control" value={form.description} placeholder="Short description..."
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
      </div>
    </>
  );
}

const BLANK_FORM = { name: '', category: 'Espresso', price: '', image_url: '', description: '' };

export default function Menu() {
  const [products, setProducts]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [addOpen, setAddOpen]           = useState(false);
  const [addForm, setAddForm]           = useState({ ...BLANK_FORM });
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [editOpen, setEditOpen]         = useState(false);
  const [editId, setEditId]             = useState(null);
  const [editForm, setEditForm]         = useState({ ...BLANK_FORM });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [deleteOpen, setDeleteOpen]     = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting]         = useState(false);

  useEffect(() => { loadMenu(); }, []);

  const loadMenu = async () => {
    setLoading(true);
    try { setProducts(await API.get('/products')); }
    catch (err) { toast(err.message, 'error'); }
    finally { setLoading(false); }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!addForm.name.trim() || !addForm.price) { toast('Name and price are required', 'error'); return; }
    setAddSubmitting(true);
    try {
      await API.post('/products', {
        name: addForm.name.trim(), category: addForm.category,
        price: parseFloat(addForm.price), description: addForm.description,
        emoji: '☕', image_url: addForm.image_url
      });
      toast('Item added!', 'success');
      setAddOpen(false); setAddForm({ ...BLANK_FORM }); loadMenu();
    } catch (err) { toast(err.message, 'error'); }
    finally { setAddSubmitting(false); }
  };

  const handleOpenEdit = async (id) => {
    try {
      const p = await API.get('/products/' + id);
      setEditId(id);
      setEditForm({ name: p.name, category: p.category, price: p.price, image_url: p.image_url || '', description: p.description || '' });
      setEditOpen(true);
    } catch (err) { toast(err.message, 'error'); }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!editForm.name.trim() || !editForm.price) { toast('Name and price are required', 'error'); return; }
    setEditSubmitting(true);
    try {
      await API.put('/products/' + editId, {
        name: editForm.name.trim(), category: editForm.category,
        price: parseFloat(editForm.price), description: editForm.description,
        emoji: '☕', image_url: editForm.image_url, active: 1
      });
      toast('Item updated!', 'success');
      setEditOpen(false); loadMenu();
    } catch (err) { toast(err.message, 'error'); }
    finally { setEditSubmitting(false); }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await API.del('/products/' + deleteTarget.id);
      toast('Item removed from menu', 'success');
      setDeleteOpen(false); setDeleteTarget(null); loadMenu();
    } catch (err) { toast(err.message, 'error'); }
    finally { setDeleting(false); }
  };

  if (loading) return <div className="flex-center" style={{ height: '400px' }}><div className="spinner"></div></div>;

  const categories = [...new Set(products.map(p => p.category))];

  return (
    <div className="menu-view-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', fontWeight: 700, color: 'var(--espresso)', margin: 0 }}>Menu</h2>
        <div style={{ width: '4px', height: '34px', background: 'var(--tan-dark)', borderRadius: '2px' }}></div>
      </div>

      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '24px' }}>
        <span className="text-muted" style={{ fontSize: '0.9rem', fontWeight: 500 }}>{products.length} items on menu</span>
        <button className="btn btn-primary" onClick={() => { setAddForm({ ...BLANK_FORM }); setAddOpen(true); }}>+ Add Item</button>
      </div>

      {categories.map(cat => (
        <div key={cat} style={{ marginBottom: '32px', width: '100%' }}>
          <h3 style={{ fontFamily: "'Playfair Display', serif", color: 'var(--espresso)', marginBottom: '14px', fontSize: '1.2rem', fontWeight: 700 }}>{cat}</h3>
          <div className="menu-grid">
            {products.filter(p => p.category === cat).map(p => (
              <div className="menu-item-card" key={p.id}>
                <div className="menu-card-top">
                  <div className="menu-card-emoji" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ProductThumb product={p} size={52} />
                  </div>
                  <div className="menu-card-actions">
                    <button className="btn-icon-edit" title="Edit" onClick={() => handleOpenEdit(p.id)}>✏️</button>
                    <button className="btn-icon-delete" title="Delete" onClick={() => { setDeleteTarget({ id: p.id, name: p.name }); setDeleteOpen(true); }}>🗑</button>
                  </div>
                </div>
                <div className="menu-card-name">{p.name}</div>
                <div className="menu-card-cat">{p.category}</div>
                <div className="menu-card-price">{formatPHP(p.price)}</div>
                {p.description && <div className="menu-card-desc">{p.description}</div>}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Add Modal */}
      {addOpen && (
        <div className="modal-overlay" style={{ display: 'flex' }} onClick={e => e.target.classList.contains('modal-overlay') && setAddOpen(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Add Menu Item</h2>
              <button className="modal-close" onClick={() => setAddOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleAdd}>
              <div className="modal-body" style={{ display: 'grid', gap: '14px' }}>
                <ProductFormFields form={addForm} setForm={setAddForm} />
              </div>
              <div className="modal-actions" style={{ padding: '0 20px 20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setAddOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={addSubmitting}>{addSubmitting ? 'Adding...' : 'Add Item'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editOpen && (
        <div className="modal-overlay" style={{ display: 'flex' }} onClick={e => e.target.classList.contains('modal-overlay') && setEditOpen(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Edit: {editForm.name}</h2>
              <button className="modal-close" onClick={() => setEditOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleEdit}>
              <div className="modal-body" style={{ display: 'grid', gap: '14px' }}>
                <ProductFormFields form={editForm} setForm={setEditForm} />
              </div>
              <div className="modal-actions" style={{ padding: '0 20px 20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={editSubmitting}>{editSubmitting ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteOpen && deleteTarget && (
        <div className="modal-overlay" style={{ display: 'flex' }} onClick={e => e.target.classList.contains('modal-overlay') && setDeleteOpen(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Delete Item</h2>
              <button className="modal-close" onClick={() => setDeleteOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to remove <strong>{deleteTarget.name}</strong> from the menu?</p>
            </div>
            <div className="modal-actions" style={{ padding: '0 20px 20px', marginTop: '16px' }}>
              <button className="btn btn-secondary" onClick={() => setDeleteOpen(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleConfirmDelete} disabled={deleting}>{deleting ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
