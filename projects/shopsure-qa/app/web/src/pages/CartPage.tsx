import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError } from "../lib/api";
import { formatMoney } from "../lib/format";
import { EmptyState, ErrorBanner, LoadingState } from "../components/Feedback";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";

export default function CartPage() {
  const { user } = useAuth();
  const { cart, loading, updateItem, removeItem, clear } = useCart();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  if (!user) {
    return (
      <section className="page narrow">
        <h1>Your cart</h1>
        <EmptyState
          title="Please log in to see your cart"
          hint="Carts are stored per customer account."
          action={
            <Link className="btn btn-primary" to="/login?redirect=/cart">
              Log in
            </Link>
          }
        />
      </section>
    );
  }

  if (loading && !cart) return <LoadingState label="Loading your cart…" />;

  const items = cart?.items ?? [];

  const handleQuantity = async (itemId: number, quantity: number) => {
    setError(null);
    try {
      await updateItem(itemId, quantity);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update the quantity.");
    }
  };

  const handleRemove = async (itemId: number) => {
    setError(null);
    try {
      await removeItem(itemId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove the item.");
    }
  };

  return (
    <section className="page">
      <div className="page-heading">
        <h1>Your cart</h1>
        <p>Quantities are limited to 10 per product and by available stock.</p>
      </div>

      {error && <ErrorBanner message={error} />}

      {items.length === 0 ? (
        <EmptyState
          title="Your cart is empty"
          hint="Browse the catalog and add a few demo products."
          action={
            <Link className="btn btn-primary" to="/">
              Browse catalog
            </Link>
          }
        />
      ) : (
        <div className="cart-layout">
          <table className="table" data-testid="cart-table">
            <thead>
              <tr>
                <th scope="col">Product</th>
                <th scope="col">Price</th>
                <th scope="col">Quantity</th>
                <th scope="col">Line total</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} data-testid="cart-row">
                  <td>
                    <Link to={`/product/${item.productId}`}>{item.name}</Link>
                    <div className="fine-print">SKU {item.sku}</div>
                  </td>
                  <td>{formatMoney(item.price)}</td>
                  <td>
                    <input
                      type="number"
                      min={1}
                      max={Math.min(10, item.stock)}
                      value={item.quantity}
                      data-testid="cart-quantity"
                      aria-label={`Quantity for ${item.name}`}
                      onChange={(event) => handleQuantity(item.id, Number(event.target.value))}
                    />
                  </td>
                  <td data-testid="cart-line-total">{formatMoney(item.lineTotal)}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      data-testid="cart-remove"
                      onClick={() => handleRemove(item.id)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <aside className="summary" data-testid="cart-summary">
            <h2>Order summary</h2>
            <dl>
              <div>
                <dt>Subtotal</dt>
                <dd data-testid="summary-subtotal">{formatMoney(cart?.subtotal ?? 0)}</dd>
              </div>
              <div>
                <dt>Discount</dt>
                <dd data-testid="summary-discount">-{formatMoney(cart?.discount ?? 0)}</dd>
              </div>
              <div>
                <dt>Shipping</dt>
                <dd data-testid="summary-shipping">{formatMoney(cart?.shipping ?? 0)}</dd>
              </div>
              <div className="summary-total">
                <dt>Total</dt>
                <dd data-testid="summary-total">{formatMoney(cart?.total ?? 0)}</dd>
              </div>
            </dl>
            <div className="summary-actions">
              <button type="button" className="btn btn-primary" data-testid="checkout-button" onClick={() => navigate("/checkout")}>
                Proceed to checkout
              </button>
              <button type="button" className="btn btn-ghost" data-testid="clear-cart" onClick={() => void clear()}>
                Clear cart
              </button>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}
