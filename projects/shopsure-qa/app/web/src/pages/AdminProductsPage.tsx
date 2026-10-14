import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { formatMoney } from "../lib/format";
import type { AdminProductRow } from "../lib/types";
import { EmptyState, ErrorBanner, LoadingState, SuccessBanner } from "../components/Feedback";
import { useAuth } from "../context/AuthContext";

export default function AdminProductsPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<AdminProductRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [stockDrafts, setStockDrafts] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<{ items: AdminProductRow[] }>("/admin/products?limit=50");
      setProducts(data.items);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load inventory.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === "ADMIN") void load();
    else setLoading(false);
  }, [user, load]);

  const saveStock = async (productId: number) => {
    const draft = stockDrafts[productId];
    if (draft === undefined) return;
    setError(null);
    setSuccess(null);
    try {
      await api.patch(`/admin/products/${productId}/stock`, { stock: Number(draft) });
      setSuccess("Stock updated.");
      setStockDrafts((current) => ({ ...current, [productId]: "" }));
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update stock.");
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
        <h1>Admin · Inventory</h1>
        <p>Directly adjust stock levels. Stock 0 makes a product unpurchasable.</p>
      </div>

      {error && <ErrorBanner message={error} />}
      {success && <SuccessBanner message={success} />}
      {loading && <LoadingState label="Loading inventory…" />}

      {!loading && products.length === 0 && <EmptyState title="No products found" />}

      {!loading && products.length > 0 && (
        <table className="table" data-testid="admin-products-table">
          <thead>
            <tr>
              <th scope="col">SKU</th>
              <th scope="col">Name</th>
              <th scope="col">Category</th>
              <th scope="col">Price</th>
              <th scope="col">Stock</th>
              <th scope="col">Set stock</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id} data-testid="admin-product-row">
                <td>{product.sku}</td>
                <td>{product.name}</td>
                <td>{product.categoryName}</td>
                <td>{formatMoney(product.price)}</td>
                <td data-testid="admin-product-stock">{product.stock}</td>
                <td className="inline-form">
                  <input
                    type="number"
                    min={0}
                    value={stockDrafts[product.id] ?? ""}
                    placeholder={String(product.stock)}
                    aria-label={`New stock for ${product.name}`}
                    data-testid="admin-stock-input"
                    onChange={(event) => setStockDrafts({ ...stockDrafts, [product.id]: event.target.value })}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost"
                    data-testid="admin-stock-save"
                    onClick={() => saveStock(product.id)}
                  >
                    Save
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
