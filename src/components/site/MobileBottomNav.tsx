import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Grid, Search, ShoppingBag, User } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";

export function MobileBottomNav({ onOpenSearch, onOpenCart }: { onOpenSearch?: () => void; onOpenCart?: () => void }) {
  const { count } = useCart();
  const { user } = useAuth();
  const currentPath = useRouterState({ select: (s) => s.location.pathname });

  const isActive = (path: string) => {
    if (path === "/") return currentPath === "/";
    return currentPath.startsWith(path);
  };

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-safe backdrop-blur md:hidden">
      <div className="grid h-14 grid-cols-5 items-center">
        <Link
          to="/"
          className={`flex flex-col items-center justify-center gap-0.5 text-xs transition ${
            isActive("/") ? "font-bold text-secondary" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Home className="size-5" />
          <span>Home</span>
        </Link>

        <Link
          to="/categories"
          className={`flex flex-col items-center justify-center gap-0.5 text-xs transition ${
            isActive("/categories") ? "font-bold text-secondary" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Grid className="size-5" />
          <span>Categories</span>
        </Link>

        <button
          onClick={onOpenSearch}
          className="flex flex-col items-center justify-center gap-0.5 text-xs text-muted-foreground transition hover:text-foreground"
          aria-label="Search"
        >
          <Search className="size-5" />
          <span>Search</span>
        </button>

        <button
          onClick={onOpenCart}
          className="relative flex flex-col items-center justify-center gap-0.5 text-xs text-muted-foreground transition hover:text-foreground"
          aria-label="Shopping Cart"
        >
          <div className="relative">
            <ShoppingBag className="size-5" />
            {count > 0 && (
              <span className="absolute -right-2 -top-1 grid size-4 place-items-center rounded-full bg-secondary text-[10px] font-bold text-secondary-foreground">
                {count > 9 ? "9+" : count}
              </span>
            )}
          </div>
          <span>Cart</span>
        </button>

        <Link
          to={user ? "/account" : "/auth"}
          className={`flex flex-col items-center justify-center gap-0.5 text-xs transition ${
            isActive("/account") || isActive("/auth")
              ? "font-bold text-secondary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <User className="size-5" />
          <span>{user ? "Account" : "Login"}</span>
        </Link>
      </div>
    </nav>
  );
}
