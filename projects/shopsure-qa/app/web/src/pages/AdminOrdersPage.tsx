import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { formatDateTime, formatMoney } from "../lib/format";
import type { AdminOrderRow, Order } from "../lib/types";
import { EmptyState, ErrorBanner, LoadingState, StatusBadge } from "../components/Feedback";
import { useAuth } from "../context/AuthContext";

const NEXT_STATUS: Record<string, string[]> = {
  PENDING: ["PAID", "CANCELED"],
  PAID: ["SHIPPED", "CANCELED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELED: [],
};

export default function AdminOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = statusFilter ? `?status=${statusFilter}` : "";
      const data = await api.get<{ items: AdminOrderRow[] }>(`/admin/orders${query}`);
      setOrders(data.items);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load orders.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    if (user?.role === "ADMIN") void load();
    else setLoading(false);
  }, [user, load]);

  const changeStatus = async (orderId: number, status: string) => {
    try {
      await api.patch<{ order: Order }>(`/admin/orders/${orderId}/status`, { status });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update the order status.");
    }
  };

  if (user?.role !== "ADMIN") {
    return (
      <section className="page narrow">
        <ErrorBanner message="Administrator access is required — the API also returns 403 for non-admin users." />
        <Link className="btn btn-ghost" to="/">
          Back to catalog
        </Link>
      </section>
    );
  }

  return (
    <section className="page">
      <div className="page-heading">
        <h1>Admin · Orders</h1>
        <p>Advance orders through the legal status transitions only.</p>
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="filters">
        <label>
          Status
          <select value={statusFilter} data-testid="admin-status-filter" onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All</option>
            {Object.keys(NEXT_STATUS).map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading && <LoadingState label="Loading orders…" />}

      {!loading && orders.length === 0 && <EmptyState title="No orders match this filter" />}

      {!loading && orders.length > 0 && (
        <table className="table" data-testid="admin-orders-table">
          <thead>
            <tr>
              <th scope="col">Order</th>
              <th scope="col">Customer</th>
              <th scope="col">Placed</th>
              <th scope="col">Total</th>
              <th scope="col">Status</th>
              <th scope="col">Next status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} data-testid="admin-order-row">
                <td>{order.orderNumber}</td>
                <td>{order.customerEmail}</td>
                <td>{formatDateTime(order.createdAt)}</td>
                <td>{formatMoney(order.total)}</td>
                <td>
                  <StatusBadge status={order.status} />
                </td>
                <td>
                  <select
                    value=""
                    data-testid="admin-status-select"
                    aria-label={`Change status for ${order.orderNumber}`}
                    disabled={NEXT_STATUS[order.status].length === 0}
                    onChange={(event) => event.target.value && changeStatus(order.id, event.target.value)}
                  >
                    <option value="">Choose…</option>
                    {NEXT_STATUS[order.status].map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
