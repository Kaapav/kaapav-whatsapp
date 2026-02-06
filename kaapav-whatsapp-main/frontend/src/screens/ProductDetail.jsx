/**
 * ═══════════════════════════════════════════════════════════════
 * PRODUCT DETAIL SCREEN - Complete Product View & Management
 * View details, manage stock, edit product, share via WhatsApp
 * ═══════════════════════════════════════════════════════════════
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUIStore } from '../store';
import { productAPI, messageAPI } from '../api';
import { formatCurrency, formatRelativeTime } from '../utils/helpers';
import Modal from '../components/Modal';

// ═══════════════════════════════════════════════════════════════
// STATUS CONFIGURATIONS
// ═══════════════════════════════════════════════════════════════

const STOCK_STATUS = {
  inStock: { color: 'var(--success)', bg: 'var(--success-light)', label: 'In Stock' },
  lowStock: { color: 'var(--warning)', bg: 'var(--warning-light)', label: 'Low Stock' },
  outOfStock: { color: 'var(--danger)', bg: 'var(--danger-light)', label: 'Out of Stock' },
};

const getStockStatus = (stock, lowStockThreshold = 10) => {
  if (stock <= 0) return STOCK_STATUS.outOfStock;
  if (stock <= lowStockThreshold) return STOCK_STATUS.lowStock;
  return STOCK_STATUS.inStock;
};

function ProductDetail() {
  const { sku } = useParams();
  const navigate = useNavigate();

  // Store
  const { showToast } = useUIStore();

  // Local state
  const [product, setProduct] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showStockModal, setShowStockModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  // Fetch product details
  const fetchProduct = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await productAPI.getProduct(sku);
      if (response?.product) {
        setProduct(response.product);
      } else {
        showToast('Product not found', 'error');
        navigate('/products');
      }
    } catch (err) {
      console.error('Failed to fetch product:', err);
      showToast('Failed to load product', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [sku]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  // Parse images
  const images = product?.images
    ? (typeof product.images === 'string' ? JSON.parse(product.images) : product.images)
    : [];

  // Parse variants
  const variants = product?.variants
    ? (typeof product.variants === 'string' ? JSON.parse(product.variants) : product.variants)
    : [];

  // Get stock status
  const stockStatus = product ? getStockStatus(product.stock, product.low_stock_threshold) : null;

  // ═══════════════════════════════════════════════════════════════
  // ACTION HANDLERS
  // ═══════════════════════════════════════════════════════════════

  const handleUpdateStock = async (newStock) => {
    setIsProcessing(true);
    try {
      const response = await productAPI.updateStock(product.sku, newStock);
      
      if (response.success) {
        setProduct({ ...product, stock: newStock });
        showToast('Stock updated successfully ✅', 'success');
      }
    } catch (err) {
      showToast('Failed to update stock', 'error');
    } finally {
      setIsProcessing(false);
      setShowStockModal(false);
    }
  };

  const handleUpdateProduct = async (updatedData) => {
    setIsProcessing(true);
    try {
      const response = await productAPI.updateProduct(product.sku, updatedData);
      
      if (response.success) {
        setProduct({ ...product, ...updatedData });
        showToast('Product updated successfully ✅', 'success');
      }
    } catch (err) {
      showToast('Failed to update product', 'error');
    } finally {
      setIsProcessing(false);
      setShowEditModal(false);
    }
  };

  const handleDeleteProduct = async () => {
    setIsProcessing(true);
    try {
      const response = await productAPI.deleteProduct(product.sku);
      
      if (response.success) {
        showToast('Product deleted', 'success');
        navigate('/products');
      }
    } catch (err) {
      showToast('Failed to delete product', 'error');
    } finally {
      setIsProcessing(false);
      setShowDeleteModal(false);
    }
  };

  const handleToggleStatus = async () => {
    const newStatus = product.status === 'active' ? 'inactive' : 'active';
    setIsProcessing(true);
    try {
      const response = await productAPI.updateProduct(product.sku, { status: newStatus });
      
      if (response.success) {
        setProduct({ ...product, status: newStatus });
        showToast(
          newStatus === 'active' ? 'Product activated ✅' : 'Product deactivated',
          'success'
        );
      }
    } catch (err) {
      showToast('Failed to update status', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleShareToCustomer = async (phone) => {
    setIsProcessing(true);
    try {
      await messageAPI.sendProduct(phone, product.sku);
      showToast('Product sent via WhatsApp! 📱', 'success');
    } catch (err) {
      showToast('Failed to send product', 'error');
    } finally {
      setIsProcessing(false);
      setShowShareModal(false);
    }
  };

  const handleCopyLink = () => {
    const productLink = `${window.location.origin}/p/${product.sku}`;
    navigator.clipboard.writeText(productLink);
    showToast('Link copied to clipboard! 📋', 'success');
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDER LOADING STATE
  // ═══════════════════════════════════════════════════════════════

  if (isLoading) {
    return (
      <div className="screen">
        <div className="header">
          <button className="header-btn" onClick={() => navigate('/products')}>
            <i className="fas fa-arrow-left"></i>
          </button>
          <h1 className="header-title">Product Details</h1>
        </div>
        <div className="screen-content" style={{ padding: 16 }}>
          <div className="skeleton" style={{ height: 300, marginBottom: 16, borderRadius: 12 }}></div>
          <div className="skeleton" style={{ height: 24, width: '60%', marginBottom: 8, borderRadius: 6 }}></div>
          <div className="skeleton" style={{ height: 32, width: '40%', marginBottom: 16, borderRadius: 6 }}></div>
          <div className="skeleton" style={{ height: 100, marginBottom: 16, borderRadius: 12 }}></div>
          <div className="skeleton" style={{ height: 80, borderRadius: 12 }}></div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="screen">
        <div className="header">
          <button className="header-btn" onClick={() => navigate('/products')}>
            <i className="fas fa-arrow-left"></i>
          </button>
          <h1 className="header-title">Product Details</h1>
        </div>
        <div className="empty-state">
          <i className="fas fa-exclamation-circle"></i>
          <p>Product not found</p>
        </div>
      </div>
    );
  }

  const isOnSale = product.sale_price && product.sale_price < product.price;
  const discountPercent = isOnSale
    ? Math.round(((product.price - product.sale_price) / product.price) * 100)
    : 0;

  return (
    <div className="screen">
      {/* Header */}
      <div className="header">
        <button className="header-btn" onClick={() => navigate('/products')}>
          <i className="fas fa-arrow-left"></i>
        </button>
        <h1 className="header-title">Product</h1>
        <div className="header-actions">
          <button
            className="header-btn header-btn-dark"
            onClick={() => setShowShareModal(true)}
          >
            <i className="fas fa-share-alt"></i>
          </button>
          <button
            className="header-btn header-btn-dark"
            onClick={() => setShowEditModal(true)}
          >
            <i className="fas fa-edit"></i>
          </button>
        </div>
      </div>

      <div className="screen-content" style={{ paddingBottom: 100 }}>
        {/* Image Gallery */}
        <div className="product-gallery">
          <div className="gallery-main">
            {images.length > 0 ? (
              <img
                src={images[activeImageIndex]?.url || images[activeImageIndex]}
                alt={product.name}
                className="gallery-image"
              />
            ) : (
              <div className="gallery-placeholder">
                <i className="fas fa-image"></i>
                <span>No Image</span>
              </div>
            )}

            {/* Status Badge */}
            {product.status === 'inactive' && (
              <div className="product-badge inactive">Inactive</div>
            )}
            {isOnSale && (
              <div className="product-badge sale">-{discountPercent}%</div>
            )}
          </div>

          {/* Thumbnail Strip */}
          {images.length > 1 && (
            <div className="gallery-thumbs">
              {images.map((img, idx) => (
                <div
                  key={idx}
                  className={`gallery-thumb ${idx === activeImageIndex ? 'active' : ''}`}
                  onClick={() => setActiveImageIndex(idx)}
                >
                  <img src={img.url || img} alt="" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="detail-section">
          <div className="product-header">
            <div>
              <div className="product-category">{product.category || 'Uncategorized'}</div>
              <h2 className="product-title">{product.name}</h2>
              <div className="product-sku">SKU: {product.sku}</div>
            </div>
          </div>

          {/* Price */}
          <div className="product-pricing">
            {isOnSale ? (
              <>
                <span className="price-sale">{formatCurrency(product.sale_price)}</span>
                <span className="price-original">{formatCurrency(product.price)}</span>
                <span className="price-discount">Save {discountPercent}%</span>
              </>
            ) : (
              <span className="price-regular">{formatCurrency(product.price)}</span>
            )}
          </div>

          {/* Stock Status */}
          <div
            className="stock-badge"
            style={{
              background: stockStatus.bg,
              color: stockStatus.color,
            }}
            onClick={() => setShowStockModal(true)}
          >
            <i className="fas fa-box"></i>
            <span>{stockStatus.label}: {product.stock} units</span>
            <i className="fas fa-chevron-right" style={{ marginLeft: 'auto', fontSize: 12 }}></i>
          </div>
        </div>

        {/* Description */}
        {product.description && (
          <div className="detail-section">
            <div className="section-header">
              <h3>Description</h3>
            </div>
            <p className="product-description">{product.description}</p>
          </div>
        )}

        {/* Variants */}
        {variants.length > 0 && (
          <div className="detail-section">
            <div className="section-header">
              <h3>Variants</h3>
            </div>
            <div className="variants-list">
              {variants.map((variant, idx) => (
                <div key={idx} className="variant-item">
                  <div className="variant-info">
                    <span className="variant-name">{variant.name || variant.option}</span>
                    {variant.sku && (
                      <span className="variant-sku">SKU: {variant.sku}</span>
                    )}
                  </div>
                  <div className="variant-details">
                    {variant.price && (
                      <span className="variant-price">{formatCurrency(variant.price)}</span>
                    )}
                    <span className="variant-stock">Stock: {variant.stock ?? 'N/A'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Product Details */}
        <div className="detail-section">
          <div className="section-header">
            <h3>Details</h3>
          </div>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Status</span>
              <span
                className="info-value"
                style={{
                  color: product.status === 'active' ? 'var(--success)' : 'var(--gray)',
                }}
              >
                {product.status === 'active' ? '● Active' : '○ Inactive'}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">Category</span>
              <span className="info-value">{product.category || 'N/A'}</span>
            </div>
            {product.weight && (
              <div className="info-item">
                <span className="info-label">Weight</span>
                <span className="info-value">{product.weight} {product.weight_unit || 'g'}</span>
              </div>
            )}
            {product.hsn_code && (
              <div className="info-item">
                <span className="info-label">HSN Code</span>
                <span className="info-value">{product.hsn_code}</span>
              </div>
            )}
            {product.gst_rate && (
              <div className="info-item">
                <span className="info-label">GST Rate</span>
                <span className="info-value">{product.gst_rate}%</span>
              </div>
            )}
            <div className="info-item">
              <span className="info-label">Created</span>
              <span className="info-value">
                {product.created_at ? formatRelativeTime(product.created_at) : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="detail-section">
          <div className="section-header">
            <h3>Quick Actions</h3>
          </div>
          <div className="actions-grid">
            <button className="action-card" onClick={() => setShowStockModal(true)}>
              <div className="action-icon" style={{ background: 'var(--info-light)' }}>
                <i className="fas fa-box" style={{ color: 'var(--info)' }}></i>
              </div>
              <span>Update Stock</span>
            </button>
            <button className="action-card" onClick={() => setShowShareModal(true)}>
              <div className="action-icon" style={{ background: 'var(--success-light)' }}>
                <i className="fab fa-whatsapp" style={{ color: 'var(--success)' }}></i>
              </div>
              <span>Share Product</span>
            </button>
            <button className="action-card" onClick={handleCopyLink}>
              <div className="action-icon" style={{ background: 'var(--cream)' }}>
                <i className="fas fa-link" style={{ color: 'var(--gold-dark)' }}></i>
              </div>
              <span>Copy Link</span>
            </button>
            <button className="action-card" onClick={handleToggleStatus} disabled={isProcessing}>
              <div
                className="action-icon"
                style={{
                  background: product.status === 'active' ? 'var(--warning-light)' : 'var(--success-light)',
                }}
              >
                <i
                  className={`fas ${product.status === 'active' ? 'fa-pause' : 'fa-play'}`}
                  style={{ color: product.status === 'active' ? 'var(--warning)' : 'var(--success)' }}
                ></i>
              </div>
              <span>{product.status === 'active' ? 'Deactivate' : 'Activate'}</span>
            </button>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="detail-section danger-zone">
          <div className="section-header">
            <h3 style={{ color: 'var(--danger)' }}>Danger Zone</h3>
          </div>
          <button
            className="btn btn-danger-outline"
            onClick={() => setShowDeleteModal(true)}
          >
            <i className="fas fa-trash-alt"></i> Delete Product
          </button>
          <p className="danger-hint">
            This action cannot be undone. All data related to this product will be permanently deleted.
          </p>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="bottom-action-bar">
        <button className="btn btn-ghost" onClick={() => setShowEditModal(true)}>
          <i className="fas fa-edit"></i> Edit
        </button>
        <button className="btn btn-gold" onClick={() => setShowShareModal(true)}>
          <i className="fab fa-whatsapp"></i> Send to Customer
        </button>
      </div>

      {/* Modals */}
      {showStockModal && (
        <StockModal
          product={product}
          isProcessing={isProcessing}
          onUpdate={handleUpdateStock}
          onClose={() => setShowStockModal(false)}
        />
      )}

      {showEditModal && (
        <EditProductModal
          product={product}
          isProcessing={isProcessing}
          onUpdate={handleUpdateProduct}
          onClose={() => setShowEditModal(false)}
        />
      )}

      {showDeleteModal && (
        <DeleteModal
          product={product}
          isProcessing={isProcessing}
          onDelete={handleDeleteProduct}
          onClose={() => setShowDeleteModal(false)}
        />
      )}

      {showShareModal && (
        <ShareModal
          product={product}
          isProcessing={isProcessing}
          onShare={handleShareToCustomer}
          onCopyLink={handleCopyLink}
          onClose={() => setShowShareModal(false)}
        />
      )}

      {/* Inline Styles */}
      <style>{`
        .product-gallery {
          background: var(--white);
          padding: 16px;
        }
        
        .gallery-main {
          position: relative;
          width: 100%;
          aspect-ratio: 1;
          border-radius: var(--radius-lg);
          overflow: hidden;
          background: var(--off-white);
        }
        
        .gallery-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .gallery-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: var(--gray);
          gap: 8px;
        }
        
        .gallery-placeholder i {
          font-size: 48px;
          opacity: 0.5;
        }
        
        .product-badge {
          position: absolute;
          top: 12px;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 700;
        }
        
        .product-badge.inactive {
          left: 12px;
          background: var(--gray);
          color: white;
        }
        
        .product-badge.sale {
          right: 12px;
          background: var(--danger);
          color: white;
        }
        
        .gallery-thumbs {
          display: flex;
          gap: 8px;
          margin-top: 12px;
          overflow-x: auto;
          padding: 4px 0;
        }
        
        .gallery-thumb {
          width: 60px;
          height: 60px;
          border-radius: var(--radius);
          overflow: hidden;
          border: 2px solid transparent;
          cursor: pointer;
          flex-shrink: 0;
        }
        
        .gallery-thumb.active {
          border-color: var(--gold);
        }
        
        .gallery-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .detail-section {
          background: var(--white);
          margin: 12px 16px;
          border-radius: var(--radius-lg);
          padding: 16px;
        }
        
        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        
        .section-header h3 {
          font-size: 15px;
          font-weight: 700;
          color: var(--dark);
        }
        
        .product-header {
          margin-bottom: 16px;
        }
        
        .product-category {
          font-size: 12px;
          color: var(--gold-dark);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }
        
        .product-title {
          font-size: 22px;
          font-weight: 700;
          color: var(--dark);
          margin-bottom: 4px;
          line-height: 1.3;
        }
        
        .product-sku {
          font-size: 13px;
          color: var(--gray);
          font-family: monospace;
        }
        
        .product-pricing {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 16px;
        }
        
        .price-regular,
        .price-sale {
          font-size: 26px;
          font-weight: 800;
          color: var(--gold-dark);
        }
        
        .price-original {
          font-size: 18px;
          color: var(--gray);
          text-decoration: line-through;
        }
        
        .price-discount {
          font-size: 12px;
          font-weight: 700;
          color: var(--success);
          background: var(--success-light);
          padding: 4px 8px;
          border-radius: 4px;
        }
        
        .stock-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          border-radius: var(--radius);
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
        }
        
        .product-description {
          font-size: 14px;
          color: var(--dark);
          line-height: 1.6;
        }
        
        .variants-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        
        .variant-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          background: var(--off-white);
          border-radius: var(--radius);
        }
        
        .variant-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        
        .variant-name {
          font-weight: 600;
          font-size: 14px;
        }
        
        .variant-sku {
          font-size: 11px;
          color: var(--gray);
          font-family: monospace;
        }
        
        .variant-details {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
        }
        
        .variant-price {
          font-weight: 700;
          color: var(--gold-dark);
        }
        
        .variant-stock {
          font-size: 12px;
          color: var(--gray);
        }
        
        .info-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
        }
        
        .info-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        
        .info-label {
          font-size: 12px;
          color: var(--gray);
        }
        
        .info-value {
          font-weight: 600;
          font-size: 14px;
        }
        
        .actions-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }
        
        .action-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 16px;
          background: var(--off-white);
          border: none;
          border-radius: var(--radius);
          cursor: pointer;
          transition: transform 0.2s;
        }
        
        .action-card:active {
          transform: scale(0.98);
        }
        
        .action-icon {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
        }
        
        .action-card span {
          font-size: 12px;
          font-weight: 600;
          color: var(--dark);
        }
        
        .danger-zone {
          border: 1px solid var(--danger-light);
        }
        
        .btn-danger-outline {
          width: 100%;
          padding: 12px;
          background: transparent;
          border: 1px solid var(--danger);
          color: var(--danger);
          border-radius: var(--radius);
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
        }
        
        .danger-hint {
          font-size: 12px;
          color: var(--gray);
          margin-top: 8px;
          text-align: center;
        }
        
        .bottom-action-bar {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: var(--white);
          padding: 12px 16px;
          padding-bottom: max(12px, env(safe-area-inset-bottom));
          display: flex;
          gap: 12px;
          box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
          z-index: 100;
        }
        
        .bottom-action-bar .btn {
          flex: 1;
        }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// STOCK UPDATE MODAL
// ═══════════════════════════════════════════════════════════════

function StockModal({ product, isProcessing, onUpdate, onClose }) {
  const [stock, setStock] = useState(product.stock || 0);
  const [adjustment, setAdjustment] = useState('set'); // 'set', 'add', 'subtract'

  const handleSubmit = () => {
    let newStock = stock;
    if (adjustment === 'add') {
      newStock = (product.stock || 0) + parseInt(stock);
    } else if (adjustment === 'subtract') {
      newStock = Math.max(0, (product.stock || 0) - parseInt(stock));
    }
    onUpdate(newStock);
  };

  return (
    <Modal title="Update Stock" onClose={onClose}>
      <div style={{ padding: 20 }}>
        <div style={{ marginBottom: 20 }}>
          <p style={{ color: 'var(--gray)', fontSize: 14, marginBottom: 16 }}>
            Current Stock: <strong>{product.stock || 0}</strong> units
          </p>

          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">Adjustment Type</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { key: 'set', label: 'Set to' },
                { key: 'add', label: 'Add' },
                { key: 'subtract', label: 'Remove' },
              ].map((type) => (
                <button
                  key={type.key}
                  onClick={() => setAdjustment(type.key)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    border: `2px solid ${adjustment === type.key ? 'var(--gold)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius)',
                    background: adjustment === type.key ? 'var(--cream)' : 'var(--white)',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">
              {adjustment === 'set' ? 'New Stock Quantity' : 'Quantity'}
            </label>
            <input
              type="number"
              className="form-input"
              placeholder="Enter quantity"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              min="0"
              style={{ paddingLeft: 16, fontSize: 18, fontWeight: 700, textAlign: 'center' }}
            />
          </div>

          {adjustment !== 'set' && (
            <p style={{ marginTop: 12, fontSize: 14, color: 'var(--gray)' }}>
              New stock will be:{' '}
              <strong style={{ color: 'var(--gold-dark)' }}>
                {adjustment === 'add'
                  ? (product.stock || 0) + parseInt(stock || 0)
                  : Math.max(0, (product.stock || 0) - parseInt(stock || 0))}
              </strong>{' '}
              units
            </p>
          )}
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-ghost" onClick={onClose} style={{ flex: 1 }}>
            Cancel
          </button>
          <button
            className={`btn btn-gold ${isProcessing ? 'loading' : ''}`}
            onClick={handleSubmit}
            disabled={isProcessing || stock === ''}
            style={{ flex: 1 }}
          >
            <span className="btn-text">Update Stock</span>
            <div className="spinner"></div>
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════
// EDIT PRODUCT MODAL
// ═══════════════════════════════════════════════════════════════

function EditProductModal({ product, isProcessing, onUpdate, onClose }) {
  const [formData, setFormData] = useState({
    name: product.name || '',
    description: product.description || '',
    price: product.price || '',
    sale_price: product.sale_price || '',
    category: product.category || '',
  });

  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleSubmit = () => {
    onUpdate({
      ...formData,
      price: parseFloat(formData.price),
      sale_price: formData.sale_price ? parseFloat(formData.sale_price) : null,
    });
  };

  return (
    <Modal title="Edit Product" onClose={onClose}>
      <div style={{ padding: 20, maxHeight: '70vh', overflowY: 'auto' }}>
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label className="form-label">Product Name</label>
          <input
            type="text"
            className="form-input"
            placeholder="Enter product name"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
          />
        </div>

        <div className="form-group" style={{ marginBottom: 16 }}>
          <label className="form-label">Description</label>
          <textarea
            className="form-input"
            placeholder="Enter product description"
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            rows={3}
            style={{ resize: 'none' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Price (₹)</label>
            <input
              type="number"
              className="form-input"
              placeholder="0"
              value={formData.price}
              onChange={(e) => handleChange('price', e.target.value)}
            />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Sale Price (₹)</label>
            <input
              type="number"
              className="form-input"
              placeholder="Optional"
              value={formData.sale_price}
              onChange={(e) => handleChange('sale_price', e.target.value)}
            />
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: 20 }}>
          <label className="form-label">Category</label>
          <input
            type="text"
            className="form-input"
            placeholder="Enter category"
            value={formData.category}
            onChange={(e) => handleChange('category', e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-ghost" onClick={onClose} style={{ flex: 1 }}>
            Cancel
          </button>
          <button
            className={`btn btn-gold ${isProcessing ? 'loading' : ''}`}
            onClick={handleSubmit}
            disabled={isProcessing || !formData.name || !formData.price}
            style={{ flex: 1 }}
          >
            <span className="btn-text">Save Changes</span>
            <div className="spinner"></div>
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════
// DELETE PRODUCT MODAL
// ═══════════════════════════════════════════════════════════════

function DeleteModal({ product, isProcessing, onDelete, onClose }) {
  const [confirmText, setConfirmText] = useState('');

  return (
    <Modal title="Delete Product" onClose={onClose}>
      <div style={{ padding: 20, textAlign: 'center' }}>
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: '50%',
            background: 'var(--danger-light)',
            margin: '0 auto 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <i className="fas fa-trash-alt" style={{ fontSize: 24, color: 'var(--danger)' }}></i>
        </div>
        <h3 style={{ marginBottom: 8 }}>Delete "{product.name}"?</h3>
        <p style={{ color: 'var(--gray)', fontSize: 14, marginBottom: 16 }}>
          This action cannot be undone. Type <strong>DELETE</strong> to confirm.
        </p>

        <div className="form-group" style={{ marginBottom: 20, textAlign: 'left' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Type DELETE to confirm"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            style={{ textAlign: 'center' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-ghost" onClick={onClose} style={{ flex: 1 }}>
            Cancel
          </button>
          <button
            className={`btn ${isProcessing ? 'loading' : ''}`}
            onClick={onDelete}
            disabled={isProcessing || confirmText !== 'DELETE'}
            style={{ flex: 1, background: 'var(--danger)', color: 'white' }}
          >
            <span className="btn-text">Delete Product</span>
            <div className="spinner"></div>
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════
// SHARE PRODUCT MODAL
// ═══════════════════════════════════════════════════════════════

function ShareModal({ product, isProcessing, onShare, onCopyLink, onClose }) {
  const [phone, setPhone] = useState('');

  return (
    <Modal title="Share Product" onClose={onClose}>
      <div style={{ padding: 20 }}>
        {/* Product Preview */}
        <div
          style={{
            display: 'flex',
            gap: 12,
            padding: 12,
            background: 'var(--off-white)',
            borderRadius: 'var(--radius)',
            marginBottom: 20,
          }}
        >
          <img
            src={
              product.images
                ? typeof product.images === 'string'
                  ? JSON.parse(product.images)[0]?.url || JSON.parse(product.images)[0]
                  : product.images[0]?.url || product.images[0]
                : '/placeholder-product.png'
            }
            alt={product.name}
            style={{
              width: 60,
              height: 60,
              borderRadius: 'var(--radius)',
              objectFit: 'cover',
            }}
          />
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{product.name}</div>
            <div style={{ color: 'var(--gold-dark)', fontWeight: 700 }}>
              {formatCurrency(product.sale_price || product.price)}
            </div>
          </div>
        </div>

        {/* WhatsApp Share */}
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label className="form-label">Send to Customer via WhatsApp</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="tel"
              className="form-input"
              placeholder="Enter phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={{ flex: 1 }}
            />
            <button
              className={`btn btn-gold ${isProcessing ? 'loading' : ''}`}
              onClick={() => onShare(phone)}
              disabled={isProcessing || !phone}
              style={{ flexShrink: 0 }}
            >
              <span className="btn-text">
                <i className="fab fa-whatsapp"></i>
              </span>
              <div className="spinner"></div>
            </button>
          </div>
        </div>

        {/* Divider */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            margin: '20px 0',
            color: 'var(--gray)',
          }}
        >
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }}></div>
          <span style={{ fontSize: 12 }}>OR</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }}></div>
        </div>

        {/* Copy Link */}
        <button
          className="btn btn-ghost"
          onClick={() => {
            onCopyLink();
            onClose();
          }}
          style={{ width: '100%' }}
        >
          <i className="fas fa-link"></i> Copy Product Link
        </button>
      </div>
    </Modal>
  );
}

export default ProductDetail;
