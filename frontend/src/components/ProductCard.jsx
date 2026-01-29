/**
 * ════════════════════════════════════════════════════════════════
 * PRODUCT CARD
 * Product display card with actions
 * ════════════════════════════════════════════════════════════════
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  FiEdit2, FiTrash2, FiStar, FiPackage, 
  FiAlertTriangle, FiMoreVertical
} from 'react-icons/fi';

export default function ProductCard({ product, onEdit, onDelete }) {
  const [showMenu, setShowMenu] = useState(false);
  
  // Stock status
  const getStockStatus = () => {
    if (!product.trackInventory) return null;
    if (product.stock <= 0) return { label: 'Out of Stock', color: 'bg-danger/20 text-danger' };
    if (product.stock <= 10) return { label: 'Low Stock', color: 'bg-warning/20 text-warning' };
    return { label: 'In Stock', color: 'bg-success/20 text-success' };
  };
  
  const stockStatus = getStockStatus();
  
  // Calculate discount
  const discount = product.comparePrice > product.price
    ? Math.round(((product.comparePrice - product.price) / product.comparePrice) * 100)
    : 0;
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="card overflow-hidden relative group"
    >
      {/* Image */}
      <div className="relative aspect-square -mx-4 -mt-4 mb-3 bg-dark-200 overflow-hidden">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <FiPackage size={40} className="text-gray-600" />
          </div>
        )}
        
        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {product.isFeatured && (
            <span className="px-2 py-0.5 bg-primary text-black text-[10px] font-bold rounded-full flex items-center gap-1">
              <FiStar size={10} /> Featured
            </span>
          )}
          {discount > 0 && (
            <span className="px-2 py-0.5 bg-danger text-white text-[10px] font-bold rounded-full">
              {discount}% OFF
            </span>
          )}
        </div>
        
        {/* Stock Badge */}
        {stockStatus && (
          <span className={`absolute bottom-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-medium ${stockStatus.color}`}>
            {stockStatus.label}
          </span>
        )}
        
        {/* Menu Button */}
        <button
          onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
          className="absolute top-2 right-2 w-8 h-8 bg-dark/80 backdrop-blur rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <FiMoreVertical size={16} className="text-white" />
        </button>
        
        {/* Dropdown Menu */}
        {showMenu && (
          <>
            <div 
              className="fixed inset-0 z-10" 
              onClick={() => setShowMenu(false)} 
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute top-10 right-2 bg-dark-100 border border-dark-200 rounded-xl shadow-xl z-20 overflow-hidden min-w-[120px]"
            >
              <button
                onClick={() => { onEdit?.(); setShowMenu(false); }}
                className="w-full px-4 py-2.5 text-left flex items-center gap-2 hover:bg-dark-200 text-sm"
              >
                <FiEdit2 size={14} /> Edit
              </button>
              <button
                onClick={() => { onDelete?.(); setShowMenu(false); }}
                className="w-full px-4 py-2.5 text-left flex items-center gap-2 hover:bg-dark-200 text-sm text-danger"
              >
                <FiTrash2 size={14} /> Delete
              </button>
            </motion.div>
          </>
        )}
      </div>
      
      {/* Info */}
      <div>
        <p className="text-xs text-gray-500 mb-1">{product.category}</p>
        <h3 className="font-medium text-white truncate mb-1">{product.name}</h3>
        
        {/* Price */}
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-primary">₹{product.price}</span>
          {product.comparePrice > product.price && (
            <span className="text-sm text-gray-500 line-through">₹{product.comparePrice}</span>
          )}
        </div>
        
        {/* Stock Count */}
        {product.trackInventory && (
          <p className="text-xs text-gray-400 mt-1">
            {product.stock} in stock • {product.orderCount || 0} sold
          </p>
        )}
      </div>
    </motion.div>
  );
}