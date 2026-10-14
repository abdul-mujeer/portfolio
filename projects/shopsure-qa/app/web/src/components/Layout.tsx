import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";

export default function Layout() {
  const { user, logout } = useAuth();
  const { itemCount } = useCart();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <header className="site-header">
        <Link to="/" className="brand" data-testid="brand">
          Shop<span>Sure</span>
          <small>demo store</small>
        </Link>

        <nav className="site-nav" aria-label="Main navigation">
          <NavLink to="/" data-testid="nav-catalog">
            Catalog
          </NavLink>
          <NavLink to="/orders" data-testid="nav-orders">
            Orders
          </NavLink>
          {user?.role === "ADMIN" && (
            <>
              <NavLink to="/admin/orders" data-testid="nav-admin-orders">
                Admin orders
              </NavLink>
              <NavLink to="/admin/products" data-testid="nav-admin-products">
                Inventory
              </NavLink>
            </>
          )}
        </nav>

        <div className="header-actions">
          <Link to="/cart" className="cart-link" data-testid="nav-cart" aria-label={`Cart, ${itemCount} item(s)`}>
            Cart
            <span className="cart-count" data-testid="cart-count">
              {itemCount}
            </span>
          </Link>
          {user ? (
            <div className="user-box">
              <span className="user-name" data-testid="current-user">
                {user.name}
              </span>
              <button type="button" className="btn btn-ghost" onClick={handleLogout} data-testid="logout-button">
                Log out
              </button>
            </div>
          ) : (
            <Link to="/login" className="btn btn-primary" data-testid="nav-login">
              Log in
            </Link>
          )}
        </div>
      </header>

      <main id="main" className="site-main">
        <Outlet />
      </main>

      <footer className="site-footer">
        <p>
          <strong>ShopSure</strong> is a fictional store built as a test target for the ShopSure QA portfolio
          project. No real payments, products or personal data.
        </p>
        <p className="footer-meta">Node.js · Express · SQLite · React · Playwright · Postman/Newman</p>
      </footer>
    </div>
  );
}
