/**
 * ═══════════════════════════════════════════════════════════════
 * PRODUCTS SCREEN - Product Catalog Management
 * Grid view, Categories, Stock management
 * ═══════════════════════════════════════════════════════════════
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProductStore, useUIStore } from '../store';
import { productAPI } from '../api';
import { formatCurrency } from '../utils/helpers';
import PullToRefresh from '../components/PullToRefresh';
import ProductCard from '../components/ProductCard';

function Products() {
  const navigate = useNavigate();

  // Store
  const {
    products,
    setProducts,
    categories,
    setCategories,
    isLoading,
    setLoading,
    filters,
    setFilters,
    getFilteredProducts,
  } = useProductStore();
  const { showToast } = useUIStore();

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'

  // Fetch products and categories
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [productsRes, categoriesRes] = await Promise.all([
        productAPI.getProducts(),
        productAPI.getCategories(),
      ]);

      if (productsRes?.products) {
        setProducts(productsRes.products);
      }
      if (categoriesRes?.categories) {
        setCategories(categoriesRes.categories);
      }
    } catch (err) {
      console.error('Failed to fetch products:', err);
      showToast('Failed to load products', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter products
  const filteredProducts = useMemo(() => {
    let result = products || [];

    // Category filter
    if (activeCategory !== 'all') {
      result = result.filter((p) => 
        p.category?.toLowerCase() === activeCategory.toLowerCase()
      );
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((p) =>
        p.name?.toLowerCase().includes(query) ||
        p.sku?.toLowerCase().includes(query) ||
        p.category?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [products, activeCategory, searchQuery]);

  // Get category counts
  const getCategoryCount = (category) => {
    if (!products?.length) return 0;
    if (category === 'all') return products.length;
    return products.filter((p) => 
      p.category?.toLowerCase() === category.toLowerCase()
    ).length;
  };

  // Stock stats
  const stockStats = useMemo(() => {
    if (!products?.length) return { inStock: 0, outOfStock: 0, lowStock: 0 };
    
    return {
      inStock: products.filter((p) => p.stock > 5).length,
      lowStock: products.filter((p) => p.stock > 0 && p.stock <= 5).length,
      outOfStock: products.filter((p) => p.stock === 0).length,
    };
  }, [products]);

  // Handle refresh
  const handleRefresh = async () => {
    await fetchData();
  };

  // Handle product click
  const handleProductClick = (product) => {
    navigate(`/products/${product.sku}`);
  };

  return (
    <div className="screen">
      {/* Header */}
      <div className="header">
        <h1 className="header-title">Products</h1>
        <div className="header-actions">
          <button
            className="header-btn header-btn-dark"
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
          >
            <i className={`fas fa-${viewMode === 'grid' ? 'list' : 'th'}`}></i>
          </button>
          <button className="header-btn header-btn-dark">
            <i className="fas fa-search"></i>
          </button>
          <button
            className="header-btn header-btn-dark"
            onClick={() => navigate('/products/new')}
          >
            <i className="fas fa-plus"></i>
          </button>
        </div>
      </div>

      <div className="screen-content with-nav">
        <PullToRefresh onRefresh={handleRefresh} isRefreshing={isLoading}>
          {/* Stock Summary */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px',
            padding: '12px 16px',
            background: 'var(--white)',
            borderBottom: '1px solid var(--border)',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--success)' }}>
                {stockStats.inStock}
              </div>
              <div style={{ fontSize: 11, color: 'var(--gray)' }}>In Stock</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--warning)' }}>
                {stockStats.lowStock}
              </div>
              <div style={{ fontSize: 11, color: 'var(--gray)' }}>Low Stock</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--danger)' }}>
                {stockStats.outOfStock}
              </div>
              <div style={{ fontSize: 11, color: 'var(--gray)' }}>Out of Stock</div>
            </div>
          </div>

          {/* Category Pills */}
          <div className="pills">
            <div
              className={`pill ${activeCategory === 'all' ? 'active' : ''}`}
              onClick={() => setActiveCategory('all')}
            >
              All ({products?.length || 0})
            </div>
            {categories?.map((category) => (
              <div
                key={category}
                className={`pill ${activeCategory === category ? 'active' : ''}`}
                onClick={() => setActiveCategory(category)}
              >
                {category}
              </div>
            ))}
          </div>

          {/* Search */}
          <div style={{ padding: '12px 16px 0' }}>
            <div className="search-bar" style={{ background: 'var(--white)' }}>
              <i className="fas fa-search"></i>
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Products Grid/List */}
          {viewMode === 'grid' ? (
            <div className="products-grid">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.sku}
                  product={product}
                  onClick={() => handleProductClick(product)}
                />
              ))}
            </div>
          ) : (
            <div className="products-list" style={{ padding: '16px' }}>
              {filteredProducts.map((product) => (
                <ProductListItem
                  key={product.sku}
                  product={product}
                  onClick={() => handleProductClick(product)}
                />
              ))}
            </div>
          )}

          {/* Empty State */}
          {filteredProducts.length === 0 && !isLoading && (
            <div className="empty-state">
              <i className="fas fa-box-open"></i>
              <p>
                {searchQuery
                  ? `No products matching "${searchQuery}"`
                  : activeCategory !== 'all'
                  ? `No products in ${activeCategory}`
                  : 'No products yet'}
              </p>
              <button
                className="btn btn-gold"
                onClick={() => navigate('/products/new')}
                style={{ marginTop: 16 }}
              >
                <i className="fas fa-plus"></i>
                Add Product
              </button>
            </div>
          )}
        </PullToRefresh>
      </div>

      {/* FAB - Add Product */}
      <button className="fab" onClick={() => navigate('/products/new')}>
        <i className="fas fa-plus"></i>
      </button>
    </div>
  );
}

// Product List Item for List View
function ProductListItem({ product, onClick }) {
  const isOutOfStock = product.stock === 0;
  const isLowStock = product.stock > 0 && product.stock <= 5;

  return (
    <div
      className="order-card"
      onClick={onClick}
      style={{ marginBottom: 12, cursor: 'pointer' }}
    >
      <div style={{ display: 'flex', gap: 12 }}>
        <img
          src={product.image_url || '/placeholder-product.png'}
          alt=""
          style={{
            width: 70,
            height: 70,
            borderRadius: 'var(--radius)',
            objectFit: 'cover',
          }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
            {product.name}
          </div>
          <div style={{ fontSize: 12, color: 'var(--gray)', marginBottom: 6 }}>
            SKU: {product.sku}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--gold-dark)' }}>
              {formatCurrency(product.price)}
            </span>
            {product.compare_price && (
              <span style={{
                fontSize: 12,
                color: 'var(--gray-light)',
                textDecoration: 'line-through',
              }}>
                {formatCurrency(product.compare_price)}
              </span>
            )}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontSize: 11,
            fontWeight: 600,
            color: isOutOfStock ? 'var(--danger)' : isLowStock ? 'var(--warning)' : 'var(--success)',
          }}>
            {isOutOfStock ? 'Out of Stock' : isLowStock ? 'Low Stock' : 'In Stock'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--gray)', marginTop: 4 }}>
            {product.stock} units
          </div>
        </div>
      </div>
    </div>
  );
}

export default Products;
