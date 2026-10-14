import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { formatMoney } from "../lib/format";
import type { Order } from "../lib/types";
import { ErrorBanner, LoadingState, StatusBadge, SuccessBanner } from "../components/Feedback";

export default function OrderConfirmationPage() {
  const { id } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ order: Order }>(`/orders/${id}`)
      .then((data) => {
        if (!cancelled) setOrder(data.order);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Could not load the order.");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) {
    return (
      <section className="page narrow">
        <ErrorBanner message={error} />
        <Link to="/orders" className="btn btn-ghost">
          Back to orders
        </Link>
      </section>
    );
  }
  if (!order) return <LoadingState label="Loading your order…" />;

  return (
    <section className="page narrow">
      <SuccessBanner message={`Order ${order.orderNumber} placed successfully.`} />
      <div className="card">
        <h1 data-testid="confirmation-order-number">{order.orderNumber}</h1>
        <p>
          Status: <StatusBadge status={order.status} />
        </p>
        <ul className="summary-items">
          {order.items.map((item) => (
            <li key={item.id}>
              <span>
                {item.quantity} × {item.productName}
              </span>
              <span>{formatMoney(item.lineTotal)}</span>
            </li>
          ))}
        </ul>
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
            <dd data-testid="confirmation-total">{formatMoney(order.total)}</dd>
          </div>
        </dl>
        <p className="fine-print">
          Shipping to {order.shippingName}, {order.shippingAddress}, {order.shippingCity} {order.shippingPostcode}
        </p>
        <div className="summary-actions">
          <Link to="/orders" className="btn btn-primary">
            View order history
          </Link>
          <Link to="/" className="btn btn-ghost">
            Continue shopping
          </Link>
        </div>
      </div>
    </section>
  );
}
