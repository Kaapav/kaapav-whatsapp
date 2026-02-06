/**
 * ═══════════════════════════════════════════════════════════════
 * PRODUCT PICKER COMPONENT
 * Modal to select and send products to customer
 * ═══════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect } from 'react';
import { FiX, FiSearch, FiPackage } from 'react-icons/fi';

function ProductPicker({ onSelect, onClose }) {
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      // TODO: Replace with actual API call
      // const response = await productAPI.getProducts();
      // setProducts(response.products);
      
      // Mock data for now
      setProducts([
        {
          id: 1,
          name: 'Gold Necklace',
          sku: 'GN-001',
          price: 25000,
          image: '/images/products/necklace.jpg',
          inStock: true
        },
        {
          id: 2,
          name: 'Silver Earrings',
          sku: 'SE-002',
          price: 5000,
          image: '/images/products/earrings.jpg',
          inStock: true
        }
      ]);
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectProduct = (product) => {
    onSelect(product);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <h3 className="modal-title">
            <FiPackage className="modal-icon" />
            Select Product
          </h3>
          <button className="modal-close" onClick={onClose}>
            <FiX />
          </button>
        </div>

        {/* Search */}
        <div className="search-box" style={{ padding: '1rem', borderBottom: '1px solid #e5e7eb' }}>
          <div className="search-input-wrapper">
            <FiSearch className="search-icon" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
        </div>

        {/* Product List */}
        <div className="modal-body" style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {loading ? (
            <div className="loading-state" style={{ padding: '2rem', textAlign: 'center' }}>
              <div className="spinner"></div>
              <p>Loading products...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
              <FiPackage size={48} style={{ margin: '0 auto 1rem' }} />
              <p>No products found</p>
            </div>
          ) : (
            <div className="product-list">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className="product-item"
                  onClick={() => handleSelectProduct(product)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '1rem',
                    cursor: 'pointer',
                    borderBottom: '1px solid #e5e7eb',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  {/* Product Image */}
                  <div
                    className="product-image"
                    style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '8px',
                      backgroundColor: '#e5e7eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden'
                    }}
                  >
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <FiPackage size={24} color="#9ca3af" />
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="product-info" style={{ flex: 1 }}>
                    <div className="product-name" style={{ fontWeight: 600, marginBottom: '4px' }}>
                      {product.name}
                    </div>
                    <div className="product-meta" style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      SKU: {product.sku}
                    </div>
                  </div>

                  {/* Product Price */}
                  <div className="product-price" style={{ fontWeight: 600, color: '#10b981' }}>
                    ₹{product.price.toLocaleString()}
                  </div>

                  {/* Stock Status */}
                  {!product.inStock && (
                    <div
                      className="out-of-stock"
                      style={{
                        fontSize: '0.75rem',
                        color: '#ef4444',
                        fontWeight: 500
                      }}
                    >
                      Out of Stock
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ padding: '1rem', borderTop: '1px solid #e5e7eb' }}>
          <button
            className="btn btn-secondary"
            onClick={onClose}
            style={{ width: '100%' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProductPicker;
