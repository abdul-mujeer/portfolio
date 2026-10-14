import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { formatDateTime, formatMoney } from "../lib/format";
import type { OrderSummary } from "../lib/types";
import { EmptyState, ErrorBanner, LoadingState, StatusBadge } from "../components/Feedback";
import { useAuth } from "../context/AuthContext";

export default function OrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    api
      .get<{ items: OrderSummary[] }>("/orders")
      .then((data) => {
        if (!cancelled) setOrders(data.items);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Could not load your orders.");
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (authLoading) return <LoadingState label="Checking your session…" />;

  if (!user) {
    return (
      <section className="page narrow">
        <h1>Order history</h1>
        <EmptyState
          title="Log in to see your orders"
          action={
            <Link className="btn btn-primary" to="/login?redirect=/orders">
              Log in
            </Link>
          }
        />
      </section>
    );
  }

  return (
    <section className="page">
      <div className="page-heading">
        <h1>Order history</h1>
        <p>Newest first. Seeded demo account starts with two orders.</p>
      </div>

      {error && <ErrorBanner message={error} />}

      {!orders && !error && <LoadingState label="Loading orders…" />}

      {orders && orders.length === 0 && (
        <EmptyState title="No orders yet" hint="Place an order from the catalog to see it here." />
      )}

      {orders && orders.length > 0 && (
        <table className="table" data-testid="orders-table">
          <thead>
            <tr>
              <th scope="col">Order</th>
              <th scope="col">Placed</th>
              <th scope="col">Items</th>
              <th scope="col">Total</th>
              <th scope="col">Status</th>
              <th scope="col" />
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} data-testid="order-row">
                <td>{order.orderNumber}</td>
                <td>{formatDateTime(order.createdAt)}</td>
                <td>{order.unitCount}</td>
                <td data-testid="order-total">{formatMoney(order.total)}</td>
                <td>
                  <StatusBadge status={order.status} />
                </td>
                <td>
                  <Link to={`/orders/${order.id}`} data-testid="order-detail-link">
                    Details
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
