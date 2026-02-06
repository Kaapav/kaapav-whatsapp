/**
 * ═══════════════════════════════════════════════════════════════
 * PRODUCT CARD - Product Grid Item
 * ═══════════════════════════════════════════════════════════════
 */

import React from 'react';
import { formatCurrency } from '../utils/helpers';

function ProductCard({ product, onClick }) {
  if (!product) return null;

  const {
    name,
    sku,
    image_url,
    price,
    compare_price,
    stock,
    is_featured,
    category,
  } = product;

  const isOutOfStock = stock === 0;
  const isLowStock = stock > 0 && stock <= 5;

  const getBadge = () => {
    if (isOutOfStock) return { text: 'Out of Stock', class: 'badge-out' };
    if (is_featured) return { text: 'Bestseller', class: 'badge-best' };
    if (isLowStock) return { text: 'Low Stock', class: 'badge-out' };
    return null;
  };

  const badge = getBadge();

  return (
    <div className="product-card" onClick={onClick}>
      <div className="product-image">
        <img
          src={image_url || '/placeholder-product.png'}
          alt={name}
          onError={(e) => { e.target.src = '/placeholder-product.png'; }}
        />
        {badge && (
          <span className={`product-badge ${badge.class}`}>
            {badge.text}
          </span>
        )}
      </div>
      <div className="product-details">
        <div className="product-title">{name}</div>
        <div>
          <span className="product-price">
            {formatCurrency(price)}
          </span>
          {compare_price && compare_price > price && (
            <span className="product-old-price">
              {formatCurrency(compare_price)}
            </span>
          )}
        </div>
        <div
          className="product-stock"
          style={{ color: isOutOfStock ? 'var(--danger)' : isLowStock ? 'var(--warning)' : 'var(--success)' }}
        >
          {isOutOfStock
            ? '✗ Out of Stock'
            : `✓ In Stock (${stock})`}
        </div>
      </div>
    </div>
  );
}

export default ProductCard;
