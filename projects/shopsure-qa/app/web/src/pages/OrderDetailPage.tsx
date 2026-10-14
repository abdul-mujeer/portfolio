import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { formatDateTime, formatMoney } from "../lib/format";
import type { Order } from "../lib/types";
import { ErrorBanner, LoadingState, StatusBadge, SuccessBanner } from "../components/Feedback";

const CANCELABLE = ["PENDING", "PAID"];

export default function OrderDetailPage() {
  const { id } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api
      .get<{ order: Order }>(`/orders/${id}`)
      .then((data) => setOrder(data.order))
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Could not load the order."));
  }, [id]);

  useEffect(load, [load]);

  const handleCancel = async () => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const data = await api.post<{ order: Order }>(`/orders/${id}/cancel`);
      setOrder(data.order);
      setSuccess("Order canceled and stock restored.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not cancel the order.");
    } finally {
      setBusy(false);
    }
  };

  if (error && !order) {
    return (
      <section className="page narrow">
        <ErrorBanner message={error} />
        <Link className="btn btn-ghost" to="/orders">
          Back to orders
        </Link>
      </section>
    );
  }
  if (!order) return <LoadingState label="Loading order…" />;

  return (
    <section className="page narrow">
      <div className="page-heading">
        <h1 data-testid="order-number">{order.orderNumber}</h1>
        <p>
          Placed {formatDateTime(order.createdAt)} · <StatusBadge status={order.status} />
        </p>
      </div>

      {error && <ErrorBanner message={error} />}
      {success && <SuccessBanner message={success} />}

      <table className="table">
        <thead>
          <tr>
            <th scope="col">Product</th>
            <th scope="col">Unit price</th>
            <th scope="col">Qty</th>
            <th scope="col">Line total</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id}>
              <td>{item.productName}</td>
              <td>{formatMoney(item.unitPrice)}</td>
              <td>{item.quantity}</td>
              <td>{formatMoney(item.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="totals">
        <div>
          <dt>Subtotal</dt>
          <dd>{formatMoney(order.subtotal)}</dd>
        </div>
        <div>
          <dt>Discount</dt>
          <dd>-{formatMoney(order.discount)}</dd>
        </div>
        <div>
          <dt>Shipping</dt>
          <dd>{formatMoney(order.shippingFee)}</dd>
        </div>
        <div className="summary-total">
          <dt>Total</dt>
          <dd>{formatMoney(order.total)}</dd>
        </div>
      </dl>

      <h2>Status history</h2>
      <ul className="timeline" data-testid="order-events">
        {order.events.map((event) => (
          <li key={event.id}>
            <span>
              {event.fromStatus ? `${event.fromStatus} → ` : ""}
              <strong>{event.toStatus}</strong>
            </span>
            <span className="muted">{formatDateTime(event.createdAt)}</span>
          </li>
        ))}
      </ul>

      {CANCELABLE.includes(order.status) && (
        <button type="button" className="btn btn-danger" onClick={handleCancel} disabled={busy} data-testid="cancel-order">
          {busy ? "Canceling…" : "Cancel order"}
        </button>
      )}
    </section>
  );
}
