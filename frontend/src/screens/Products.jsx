/**
 * ════════════════════════════════════════════════════════════════
 * PRODUCTS SCREEN
 * Product catalog management
 * ════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiSearch, FiPlus, FiPackage, FiAlertTriangle,
  FiEdit2, FiTrash2, FiX, FiCheck
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useProductStore } from '../store';
import api from '../api';
import PullToRefresh from '../components/PullToRefresh';
import ProductCard from '../components/ProductCard';

// ═══════════════════════════════════════════════════════════════
// ADD/EDIT PRODUCT MODAL
// ═══════════════════════════════════════════════════════════════

function ProductModal({ product, onClose, onSave }) {
  const [form, setForm] = useState({
    sku: product?.sku || '',
    name: product?.name || '',
    description: product?.description || '',
    price: product?.price || '',
    comparePrice: product?.comparePrice || '',
    category: product?.category || '',
    stock: product?.stock || 0,
    imageUrl: product?.imageUrl || '',
    isFeatured: product?.isFeatured || false,
  });
  const [isLoading, setIsLoading] = useState(false);
  
  const handleSubmit = async () => {
    if (!form.sku || !form.name || !form.price) {
      toast.error('SKU, Name, and Price are required');
      return;
    }
    
    setIsLoading(true);
    try {
      if (product) {
        await api.products.update(product.sku, form);
        toast.success('Product updated');
      } else {
        await api.products.create(form);
        toast.success('Product created');
      }
      onSave();
    } catch (error) {
      toast.error(error.message || 'Failed to save');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-dark-100 rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-hidden"
      >
        <div className="sticky top-0 bg-dark-100 border-b border-dark-200 p-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">
            {product ? 'Edit Product' : 'Add Product'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-dark-200 rounded-full">
            <FiX size={20} />
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto space-y-4" style={{ maxHeight: 'calc(90vh - 140px)' }}>
          <div>
            <label className="block text-sm text-gray-400 mb-2">SKU *</label>
            <input
              type="text"
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              disabled={!!product}
              className="input"
              placeholder="PROD-001"
            />
          </div>
          
          <div>
            <label className="block text-sm text-gray-400 mb-2">Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input"
              placeholder="Product Name"
            />
          </div>
          
          <div>
            <label className="block text-sm text-gray-400 mb-2">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="input min-h-[100px]"
              placeholder="Product description..."
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Price *</label>
              <input
                type="number"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="input"
                placeholder="299"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Compare Price</label>
              <input
                type="number"
                value={form.comparePrice}
                onChange={(e) => setForm({ ...form, comparePrice: e.target.value })}
                className="input"
                placeholder="399"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Category</label>
              <input
                type="text"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="input"
                placeholder="Earrings"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Stock</label>
              <input
                type="number"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: parseInt(e.target.value) || 0 })}
                className="input"
                placeholder="100"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm text-gray-400 mb-2">Image URL</label>
            <input
              type="url"
              value={form.imageUrl}
              onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
              className="input"
              placeholder="https://..."
            />
          </div>
          
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isFeatured}
              onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })}
              className="w-5 h-5 rounded bg-dark-200 border-dark-300"
            />
            <span className="text-white">Featured Product</span>
          </label>
        </div>
        
        <div className="sticky bottom-0 bg-dark-100 border-t border-dark-200 p-4">
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="btn-primary w-full py-3"
          >
            {isLoading ? 'Saving...' : 'Save Product'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN PRODUCTS SCREEN
// ═══════════════════════════════════════════════════════════════

export default function Products() {
  const [searchParams] = useSearchParams();
  
  const { products, categories, total, isLoading, fetchProducts, fetchCategories } = useProductStore();
  
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [showLowStock, setShowLowStock] = useState(searchParams.get('filter') === 'low_stock');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  
  const loadProducts = useCallback(async () => {
    const params = {};
    if (search) params.search = search;
    if (activeCategory !== 'all') params.category = activeCategory;
    if (showLowStock) params.in_stock = false;
    
    await fetchProducts(params);
    await fetchCategories();
  }, [search, activeCategory, showLowStock, fetchProducts, fetchCategories]);
  
  useEffect(() => {
    loadProducts();
  }, [loadProducts]);
  
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadProducts();
    setIsRefreshing(false);
  };
  
  const handleEdit = (product) => {
    setEditProduct(product);
    setShowModal(true);
  };
  
  const handleDelete = async (sku) => {
    if (!confirm('Delete this product?')) return;
    
    try {
      await api.products.delete(sku);
      toast.success('Product deleted');
      loadProducts();
    } catch (error) {
      toast.error('Failed to delete');
    }
  };
  
  return (
    <>
      <PullToRefresh onRefresh={handleRefresh} isRefreshing={isRefreshing}>
        <div className="min-h-screen bg-dark safe-top">
          {/* Header */}
          <div className="sticky top-0 z-20 bg-dark/95 backdrop-blur-lg border-b border-dark-200">
            <div className="px-4 pt-4 pb-3">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h1 className="text-2xl font-bold text-white">Products</h1>
                  <p className="text-sm text-gray-400">{total} products</p>
                </div>
                <button 
                  onClick={() => { setEditProduct(null); setShowModal(true); }}
                  className="btn-primary"
                >
                  <FiPlus /> Add
                </button>
              </div>
              
              {/* Search */}
              <div className="relative">
                <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search products..."
                  className="input pl-11 bg-dark-100"
                />
              </div>
            </div>
            
            {/* Category Tabs */}
            <div className="flex gap-2 px-4 pb-3 overflow-x-auto hide-scrollbar">
              <button
                onClick={() => setActiveCategory('all')}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                  activeCategory === 'all'
                    ? 'bg-primary text-black'
                    : 'bg-dark-200 text-gray-400'
                }`}
              >
                All
              </button>
              {categories.map(cat => (
                <button
                  key={cat.name}
                  onClick={() => setActiveCategory(cat.name)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                    activeCategory === cat.name
                      ? 'bg-primary text-black'
                      : 'bg-dark-200 text-gray-400'
                  }`}
                >
                  {cat.name} ({cat.productCount})
                </button>
              ))}
            </div>
          </div>
          
          {/* Product Grid */}
          <div className="p-4 pb-20">
            {isLoading && !products.length ? (
              <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-64 skeleton rounded-2xl" />
                ))}
              </div>
            ) : products.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {products.map(product => (
                  <ProductCard
                    key={product.sku}
                    product={product}
                    onEdit={() => handleEdit(product)}
                    onDelete={() => handleDelete(product.sku)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                <FiPackage size={48} className="mb-4 opacity-50" />
                <p className="text-lg">No products found</p>
                <button 
                  onClick={() => { setEditProduct(null); setShowModal(true); }}
                  className="btn-primary mt-4"
                >
                  <FiPlus /> Add Product
                </button>
              </div>
            )}
          </div>
        </div>
      </PullToRefresh>
      
      {/* Product Modal */}
      <AnimatePresence>
        {showModal && (
          <ProductModal
            product={editProduct}
            onClose={() => { setShowModal(false); setEditProduct(null); }}
            onSave={() => { setShowModal(false); setEditProduct(null); loadProducts(); }}
          />
        )}
      </AnimatePresence>
    </>
  );
}