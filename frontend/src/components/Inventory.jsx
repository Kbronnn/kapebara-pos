import React, { useState, useEffect } from 'react';
import { API, toast, formatNum } from '../api';

export default function Inventory() {
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);

  // Editable fields local state: Map of ingredientId -> { current_stock, min_stock }
  const [editStates, setEditStates] = useState({});

  // Modals state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [restockModalOpen, setRestockModalOpen] = useState(false);

  // New Ingredient form fields
  const [newName, setNewName] = useState('');
  const [newUnit, setNewUnit] = useState('');
  const [newStock, setNewStock] = useState(0);
  const [newMin, setNewMin] = useState(0);
  const [adding, setAdding] = useState(false);

  // Restock form fields
  const [selectedIng, setSelectedIng] = useState(null);
  const [restockAmount, setRestockAmount] = useState('');
  const [restocking, setRestocking] = useState(false);

  useEffect(() => {
    loadInventory();
  }, []);

  const loadInventory = async () => {
    setLoading(true);
    try {
      const data = await API.get('/inventory');
      setIngredients(data);

      // Prepopulate editable input values
      const initialEdits = {};
      data.forEach(item => {
        initialEdits[item.id] = {
          current_stock: item.current_stock,
          min_stock: item.min_stock
        };
      });
      setEditStates(initialEdits);

      setLoading(false);
    } catch (err) {
      toast('Failed to load inventory: ' + err.message, 'error');
      setLoading(false);
    }
  };

  const handleInputChange = (id, field, value) => {
    const val = parseFloat(value);
    setEditStates(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: isNaN(val) ? '' : val
      }
    }));
  };

  const handleSave = async (id) => {
    const edit = editStates[id];
    if (edit === undefined || edit.current_stock === '' || edit.min_stock === '') {
      toast('Invalid values', 'error');
      return;
    }

    try {
      await API.put('/inventory/' + id, {
        current_stock: edit.current_stock,
        min_stock: edit.min_stock
      });
      toast('Saved!', 'success');
      loadInventory();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const handleOpenRestock = (ing) => {
    setSelectedIng(ing);
    setRestockAmount('');
    setRestockModalOpen(true);
  };

  const handleRestockSubmit = async (e) => {
    e.preventDefault();
    if (!selectedIng) return;
    const amount = parseFloat(restockAmount);
    const username = sessionStorage.getItem('adminUsername') || 'unknown';

    if (isNaN(amount) || amount <= 0) {
      toast('Enter a valid amount', 'error');
      return;
    }

    setRestocking(true);
    try {
      await API.post(`/inventory/${selectedIng.id}/restock`, {
        amount,
        restocked_by: username
      });
      toast('Restocked successfully!', 'success');
      setRestockModalOpen(false);
      loadInventory();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setRestocking(false);
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    const name = newName.trim();
    const unit = newUnit.trim();
    const stock = parseFloat(newStock) || 0;
    const min = parseFloat(newMin) || 0;

    if (!name || !unit) {
      toast('Name and unit are required', 'error');
      return;
    }

    setAdding(true);
    try {
      await API.post('/inventory', { name, unit, current_stock: stock, min_stock: min });
      toast('Ingredient added!', 'success');
      setAddModalOpen(false);
      setNewName('');
      setNewUnit('');
      setNewStock(0);
      setNewMin(0);
      loadInventory();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) return;
    try {
      await API.delete('/inventory/' + id);
      toast('Ingredient deleted!', 'success');
      loadInventory();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  function invRelativeTime(iso) {
    if (!iso) return <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Never</span>;
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  if (loading) {
    return <div className="flex-center" style={{ height: '400px' }}><div className="spinner"></div></div>;
  }

  const outOfStock = ingredients.filter(i => i.status === 'out_of_stock').length;
  const critical = ingredients.filter(i => i.status === 'critical').length;
  const low = ingredients.filter(i => i.status === 'low').length;

  return (
    <div>
      <div className="inv-header">
        <div className="flex gap-2" style={{ alignItems: 'center' }}>
          {outOfStock > 0 && <span className="badge badge-out_of_stock">⚫ {outOfStock} Out of Stock</span>}
          {critical > 0 && <span className="badge badge-critical">🔴 {critical} Critical</span>}
          {low > 0 && <span className="badge badge-low">🟡 {low} Low</span>}
          {outOfStock === 0 && critical === 0 && low === 0 && <span className="badge badge-ok">✅ All Good</span>}
        </div>
        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={() => setAddModalOpen(true)}>➕ Add Ingredient</button>
          <button className="btn btn-secondary" onClick={loadInventory}>🔄 Refresh</button>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ingredient</th>
                <th>Current Stock</th>
                <th>Min. Level</th>
                <th>Status</th>
                <th>Stock Level</th>
                <th>Last Restocked</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {ingredients.map(i => {
                const edits = editStates[i.id] || { current_stock: i.current_stock, min_stock: i.min_stock };
                const pct = i.min_stock > 0 ? Math.min(100, (i.current_stock / (i.min_stock * 3)) * 100) : (i.current_stock > 0 ? 100 : 0);
                const restockedAt = invRelativeTime(i.last_restocked_at);
                const restockedBy = i.last_restocked_by
                  ? <div style={{ fontSize: '.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>by {i.last_restocked_by}</div>
                  : null;
                const badgeLabel = i.status === 'out_of_stock' ? 'OUT OF STOCK' : i.status.toUpperCase();

                return (
                  <tr key={i.id} id={`inv-row-${i.id}`}>
                    <td className="font-bold">{i.name}</td>
                    <td>
                      <input
                        className="editable-field"
                        type="number"
                        value={edits.current_stock}
                        min="0"
                        style={{ width: '90px' }}
                        onChange={(e) => handleInputChange(i.id, 'current_stock', e.target.value)}
                      />
                      <span style={{ fontSize: '.8rem', color: 'var(--text-muted)', marginLeft: '4px' }}>{i.unit}</span>
                    </td>
                    <td>
                      <input
                        className="editable-field"
                        type="number"
                        value={edits.min_stock}
                        min="0"
                        style={{ width: '90px' }}
                        onChange={(e) => handleInputChange(i.id, 'min_stock', e.target.value)}
                      />
                      <span style={{ fontSize: '.8rem', color: 'var(--text-muted)', marginLeft: '4px' }}>{i.unit}</span>
                    </td>
                    <td><span className={`badge badge-${i.status}`}>{badgeLabel}</span></td>
                    <td>
                      <div className="stock-bar-wrap">
                        <div className={`stock-bar ${i.status}`} style={{ width: `${pct}%` }}></div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '.83rem', fontWeight: 500, color: 'var(--espresso)' }}>{restockedAt}</div>
                      {restockedBy}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-sm btn-primary" onClick={() => handleSave(i.id)}>Save</button>
                        <button className="btn btn-sm btn-secondary" onClick={() => handleOpenRestock(i)}>+ Restock</button>
                        <button className="btn btn-sm btn-secondary" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }} onClick={() => handleDelete(i.id, i.name)}>🗑 Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Ingredient Modal */}
      {addModalOpen && (
        <div className="modal-overlay" style={{ display: 'flex' }} onClick={(e) => e.target.classList.contains('modal-overlay') && setAddModalOpen(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">➕ Add Ingredient</h2>
              <button className="modal-close" onClick={() => setAddModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleAddSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Ingredient Name</label>
                  <input
                    className="form-control"
                    type="text"
                    placeholder="e.g. Fresh Milk"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Unit of Measure</label>
                  <input
                    className="form-control"
                    type="text"
                    placeholder="e.g. ml, g, pcs"
                    required
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                  />
                </div>
                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">Initial Stock</label>
                    <input
                      className="form-control"
                      type="number"
                      min="0"
                      value={newStock}
                      onChange={(e) => setNewStock(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Minimum Level</label>
                    <input
                      className="form-control"
                      type="number"
                      min="0"
                      value={newMin}
                      onChange={(e) => setNewMin(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-actions" style={{ padding: '0 20px 20px 20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setAddModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={adding}>
                  {adding ? 'Adding...' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Restock Ingredient Modal */}
      {restockModalOpen && selectedIng && (
        <div className="modal-overlay" style={{ display: 'flex' }} onClick={(e) => e.target.classList.contains('modal-overlay') && setRestockModalOpen(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Restock: {selectedIng.name}</h2>
              <button className="modal-close" onClick={() => setRestockModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleRestockSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Amount to add ({selectedIng.unit})</label>
                  <input
                    className="form-control"
                    type="number"
                    min="1"
                    placeholder="Enter quantity..."
                    required
                    value={restockAmount}
                    onChange={(e) => setRestockAmount(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>
              <div className="modal-actions" style={{ padding: '0 20px 20px 20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setRestockModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={restocking}>
                  {restocking ? 'Adding...' : 'Add Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
