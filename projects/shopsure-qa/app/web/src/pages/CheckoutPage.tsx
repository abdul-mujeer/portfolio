import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ApiError, api } from "../lib/api";
import { formatMoney } from "../lib/format";
import type { Order } from "../lib/types";
import { EmptyState, ErrorBanner } from "../components/Feedback";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";

const FIELDS = [
  { name: "name", label: "Recipient name", type: "text", autoComplete: "name" },
  { name: "email", label: "Email", type: "email", autoComplete: "email" },
  { name: "phone", label: "Phone", type: "tel", autoComplete: "tel" },
  { name: "address", label: "Address", type: "text", autoComplete: "street-address" },
  { name: "city", label: "City", type: "text", autoComplete: "address-level2" },
  { name: "postcode", label: "Postcode", type: "text", autoComplete: "postal-code" },
] as const;

type FormState = Record<(typeof FIELDS)[number]["name"], string>;

export default function CheckoutPage() {
  const { user } = useAuth();
  const { cart, refresh } = useCart();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>({
    name: user?.name ?? "",
    email: user?.email ?? "",
    phone: "",
    address: "",
    city: "",
    postcode: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!user) return <Navigate to="/login?redirect=/checkout" replace />;

  const items = cart?.items ?? [];
  if (items.length === 0) {
    return (
      <section className="page narrow">
        <h1>Checkout</h1>
        <EmptyState
          title="Your cart is empty"
          hint="Add products before checking out — an empty cart is rejected by the API (422 EMPTY_CART)."
          action={
            <Link className="btn btn-primary" to="/">
              Browse catalog
            </Link>
          }
        />
      </section>
    );
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      const data = await api.post<{ order: Order }>("/orders", form);
      await refresh();
      navigate(`/order-confirmation/${data.order.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        const map: Record<string, string> = {};
        for (const detail of err.details) map[detail.field] = detail.message;
        setFieldErrors(map);
      } else {
        setError("Checkout failed. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="page">
      <h1>Checkout</h1>
      {error && <ErrorBanner message={error} />}

      <div className="checkout-layout">
        <form onSubmit={handleSubmit} className="form" noValidate data-testid="checkout-form">
          {FIELDS.map((field) => (
            <label key={field.name}>
              {field.label}
              <input
                type={field.type}
                autoComplete={field.autoComplete}
                value={form[field.name]}
                aria-invalid={Boolean(fieldErrors[field.name])}
                aria-describedby={fieldErrors[field.name] ? `${field.name}-error` : undefined}
                data-testid={`checkout-${field.name}`}
                onChange={(event) => setForm({ ...form, [field.name]: event.target.value })}
              />
              {fieldErrors[field.name] && (
                <span className="field-error" id={`${field.name}-error`} data-testid={`checkout-${field.name}-error`}>
                  {fieldErrors[field.name]}
                </span>
              )}
            </label>
          ))}
          <button type="submit" className="btn btn-primary" disabled={busy} data-testid="checkout-submit">
            {busy ? "Placing order…" : "Place order"}
          </button>
          <p className="fine-print">No real payment is processed. Orders start in PENDING status.</p>
        </form>

        <aside className="summary">
          <h2>Your order</h2>
          <ul className="summary-items">
            {items.map((item) => (
              <li key={item.id}>
                <span>
                  {item.quantity} × {item.name}
                </span>
                <span>{formatMoney(item.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <dl>
            <div>
              <dt>Subtotal</dt>
              <dd>{formatMoney(cart?.subtotal ?? 0)}</dd>
            </div>
            <div>
              <dt>Discount</dt>
              <dd>-{formatMoney(cart?.discount ?? 0)}</dd>
            </div>
            <div>
              <dt>Shipping</dt>
              <dd>{formatMoney(cart?.shipping ?? 0)}</dd>
            </div>
            <div className="summary-total">
              <dt>Total</dt>
              <dd data-testid="checkout-total">{formatMoney(cart?.total ?? 0)}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </section>
  );
}
