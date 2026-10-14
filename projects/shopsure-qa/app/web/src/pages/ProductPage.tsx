import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { formatMoney, stockLabel } from "../lib/format";
import type { Product } from "../lib/types";
import { ErrorBanner, LoadingState, SuccessBanner } from "../components/Feedback";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";

export default function ProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addItem } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get<{ product: Product }>(`/products/${id}`)
      .then((data) => {
        if (!cancelled) setProduct(data.product);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Could not load this product.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleAdd = async () => {
    if (!user) {
      navigate("/login?redirect=/product/" + id);
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await addItem(Number(id), quantity);
      setSuccess(`Added ${quantity} × ${product?.name} to your cart.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add this product to your cart.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState label="Loading product…" />;
  if (!product) {
    return (
      <section className="page">
        <ErrorBanner message={error ?? "Product not found."} />
        <Link to="/" className="btn btn-ghost">
          Back to catalog
        </Link>
      </section>
    );
  }

  const stock = stockLabel(product.stock, product.lowStockThreshold);
  const maxQuantity = Math.min(10, product.stock);

  return (
    <section className="page product-detail">
      <div className="product-media">
        <img src={product.image} alt={product.name} />
      </div>

      <div className="product-info">
        <p className="product-category">{product.categoryName}</p>
        <h1 data-testid="product-name">{product.name}</h1>
        <p className="product-sku" data-testid="product-sku">
          SKU {product.sku}
        </p>
        <p className="product-price large" data-testid="product-price">
          {formatMoney(product.price)}
        </p>
        <p className={`stock-note stock-${stock.tone}`} data-testid="product-stock">
          {stock.text}
        </p>
        <p className="product-description">{product.description}</p>

        {error && <ErrorBanner message={error} />}
        {success && <SuccessBanner message={success} />}

        <div className="add-to-cart">
          <label htmlFor="quantity">Quantity</label>
          <input
            id="quantity"
            type="number"
            min={1}
            max={Math.max(1, maxQuantity)}
            value={quantity}
            data-testid="quantity-input"
            disabled={product.stock === 0}
            onChange={(event) => setQuantity(Number(event.target.value))}
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleAdd}
            disabled={busy || product.stock === 0}
            data-testid="add-to-cart"
          >
            {product.stock === 0 ? "Out of stock" : busy ? "Adding…" : "Add to cart"}
          </button>
        </div>

        <p className="fine-print">
          Pricing rules: free shipping from $50 and a 10% discount from $100 subtotal — both demonstrated in the
          ShopSure test suite.
        </p>
      </div>
    </section>
  );
}
