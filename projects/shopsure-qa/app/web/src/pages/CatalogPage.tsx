import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { formatMoney, stockLabel } from "../lib/format";
import type { Category, Paged, Product } from "../lib/types";
import { EmptyState, ErrorBanner, LoadingState } from "../components/Feedback";

export default function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Paged<Product> | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const q = searchParams.get("q") ?? "";
  const category = searchParams.get("category") ?? "";
  const sort = searchParams.get("sort") ?? "name";
  const order = searchParams.get("order") ?? "asc";
  const inStock = searchParams.get("inStock") === "true";
  const page = Number(searchParams.get("page") ?? "1");

  const updateParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(searchParams);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== "page") next.delete("page");
      setSearchParams(next);
    },
    [searchParams, setSearchParams]
  );

  useEffect(() => {
    api
      .get<{ items: Category[] }>("/categories")
      .then((data) => setCategories(data.items))
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Could not load categories."));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "12", sort, order });
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    if (inStock) params.set("inStock", "true");

    api
      .get<Paged<Product>>(`/products?${params.toString()}`)
      .then((data) => {
        if (!cancelled) {
          setProducts(data);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Could not load products.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [q, category, sort, order, inStock, page]);

  return (
    <section className="page">
      <div className="page-heading">
        <h1>Catalog</h1>
        <p>Demo products with stock limits, pricing rules and search — all testable.</p>
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="filters" data-testid="catalog-filters">
        <label>
          Search
          <input
            type="search"
            value={q}
            placeholder="Search products…"
            data-testid="search-input"
            onChange={(event) => updateParam("q", event.target.value)}
          />
        </label>

        <label>
          Category
          <select value={category} data-testid="category-filter" onChange={(event) => updateParam("category", event.target.value)}>
            <option value="">All categories</option>
            {categories.map((item) => (
              <option key={item.id} value={item.slug}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Sort
          <select
            value={`${sort}:${order}`}
            data-testid="sort-select"
            onChange={(event) => {
              const [nextSort, nextOrder] = event.target.value.split(":");
              const next = new URLSearchParams(searchParams);
              next.set("sort", nextSort);
              next.set("order", nextOrder);
              next.delete("page");
              setSearchParams(next);
            }}
          >
            <option value="name:asc">Name (A–Z)</option>
            <option value="name:desc">Name (Z–A)</option>
            <option value="price:asc">Price (low to high)</option>
            <option value="price:desc">Price (high to low)</option>
          </select>
        </label>

        <label className="checkbox">
          <input
            type="checkbox"
            checked={inStock}
            data-testid="in-stock-filter"
            onChange={(event) => updateParam("inStock", event.target.checked ? "true" : "")}
          />
          In stock only
        </label>
      </div>

      {loading && <LoadingState label="Loading products…" />}

      {!loading && products && products.items.length === 0 && (
        <EmptyState title="No products match your filters" hint="Try clearing the search or choosing another category." />
      )}

      {!loading && products && products.items.length > 0 && (
        <>
          <p className="result-count" data-testid="result-count">
            {products.total} product(s) found
          </p>
          <div className="product-grid" data-testid="product-grid">
            {products.items.map((product) => {
              const stock = stockLabel(product.stock, product.lowStockThreshold);
              return (
                <article className="product-card" key={product.id} data-testid="product-card">
                  <Link to={`/product/${product.id}`} className="product-card-media">
                    <img src={product.image} alt={product.name} loading="lazy" />
                  </Link>
                  <div className="product-card-body">
                    <p className="product-category">{product.categoryName}</p>
                    <h3>
                      <Link to={`/product/${product.id}`} data-testid="product-link">
                        {product.name}
                      </Link>
                    </h3>
                    <p className="product-price" data-testid="product-price">
                      {formatMoney(product.price)}
                    </p>
                    <p className={`stock-note stock-${stock.tone}`} data-testid="product-stock">
                      {stock.text}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>

          <nav className="pagination" aria-label="Pagination">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={products.page <= 1}
              data-testid="pagination-prev"
              onClick={() => updateParam("page", String(products.page - 1))}
            >
              Previous
            </button>
            <span data-testid="pagination-info">
              Page {products.page} of {products.totalPages}
            </span>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={products.page >= products.totalPages}
              data-testid="pagination-next"
              onClick={() => updateParam("page", String(products.page + 1))}
            >
              Next
            </button>
          </nav>
        </>
      )}
    </section>
  );
}
