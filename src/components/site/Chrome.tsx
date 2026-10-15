import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Instagram, Mail, Phone, Search, ShoppingBag, User, LayoutDashboard, LogOut, Package, Menu, X } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { BRAND } from "@/lib/format";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function SiteHeader() {
  const { count } = useCart();
  const { user, isAdmin, signOut } = useAuth();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    nav({ to: "/products", search: { q: q.trim() || undefined } });
    setOpen(false);
  };
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="bg-primary py-1.5 text-center text-xs font-bold text-primary-foreground">
        Cash on Delivery available across India · Call/WhatsApp {BRAND.phone}
      </div>
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2">
        <button className="md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu">
          {open ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
        <Link to="/" className="shrink-0">
          <img src="/logo-sm.png" alt="TrendyToyz" className="h-12 w-auto md:h-14" width={96} height={56} />
        </Link>
        <nav className="hidden items-center gap-5 font-bold md:flex">
          <Link to="/products" className="hover:text-secondary" activeProps={{ className: "text-secondary" }}>Shop all</Link>
          <Link to="/categories" className="hover:text-secondary" activeProps={{ className: "text-secondary" }}>Categories</Link>
        </nav>
        <form onSubmit={submit} className="ml-auto hidden max-w-sm flex-1 md:block">
          <label className="flex items-center gap-2 rounded-full border-2 bg-muted px-4 py-2">
            <Search className="size-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search toys…" className="w-full bg-transparent text-sm outline-none" />
          </label>
        </form>
        <div className="ml-auto flex items-center gap-1 md:ml-2">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="rounded-full p-2 hover:bg-muted" aria-label="Account">
                <User className="size-6" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <div className="truncate px-2 py-1.5 text-xs text-muted-foreground">{user.email}</div>
                <DropdownMenuItem onClick={() => nav({ to: "/orders" })}><Package /> My orders</DropdownMenuItem>
                <DropdownMenuItem onClick={() => nav({ to: "/account" })}><User /> My account</DropdownMenuItem>
                {isAdmin && <DropdownMenuItem onClick={() => nav({ to: "/admin" })}><LayoutDashboard /> Admin panel</DropdownMenuItem>}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut}><LogOut /> Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link to="/auth" className="rounded-full px-3 py-2 text-sm font-bold hover:bg-muted">Login</Link>
          )}
          <Link to="/cart" className="relative rounded-full p-2 hover:bg-muted" aria-label="Cart">
            <ShoppingBag className="size-6" />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-destructive px-1 text-[11px] font-bold text-destructive-foreground">
                {count}
              </span>
            )}
          </Link>
        </div>
      </div>
      {open && (
        <div className="border-t px-4 pb-4 md:hidden">
          <form onSubmit={submit} className="mt-3">
            <label className="flex items-center gap-2 rounded-full border-2 bg-muted px-4 py-2">
              <Search className="size-4 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search toys…" className="w-full bg-transparent text-sm outline-none" />
            </label>
          </form>
          <div className="mt-3 flex flex-col gap-2 font-bold">
            <Link to="/products" onClick={() => setOpen(false)}>Shop all</Link>
            <Link to="/categories" onClick={() => setOpen(false)}>Categories</Link>
            {user && <Link to="/orders" onClick={() => setOpen(false)}>My orders</Link>}
          </div>
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 bg-primary text-primary-foreground">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-4">
        <div>
          <div className="inline-block rounded-2xl bg-background p-2">
            <img src="/logo-sm.png" alt="TrendyToyz" className="h-16 w-auto" loading="lazy" width={110} height={64} />
          </div>
          <p className="mt-3 text-sm opacity-80">Trendy toys that spark smiles, delivered across India.</p>
        </div>
        <div className="space-y-2 text-sm">
          <h4 className="text-base text-sun">Contact</h4>
          <a href={`tel:${BRAND.phoneRaw}`} className="flex items-center gap-2"><Phone className="size-4" />{BRAND.phone}</a>
          <a href={`mailto:${BRAND.email}`} className="flex items-center gap-2 break-all"><Mail className="size-4" />{BRAND.email}</a>
          <a href={BRAND.instagram} target="_blank" rel="noreferrer" className="flex items-center gap-2"><Instagram className="size-4" />@{BRAND.instagramHandle}</a>
        </div>
        <div className="space-y-2 text-sm">
          <h4 className="text-base text-sun">Shop</h4>
          <Link to="/products" className="block">All toys</Link>
          <Link to="/categories" className="block">Categories</Link>
          <Link to="/orders" className="block">My orders</Link>
        </div>
        <div className="space-y-2 text-sm">
          <h4 className="text-base text-sun">Policies</h4>
          <Link to="/policies/$slug" params={{ slug: "privacy" }} className="block">Privacy Policy</Link>
          <Link to="/policies/$slug" params={{ slug: "terms" }} className="block">Terms & Conditions</Link>
          <Link to="/policies/$slug" params={{ slug: "shipping" }} className="block">Shipping Policy</Link>
          <Link to="/policies/$slug" params={{ slug: "cancellation-refund" }} className="block">Cancellation & Refund</Link>
        </div>
      </div>
      <div className="border-t border-sidebar-border py-4 text-center text-xs opacity-70">© {new Date().getFullYear()} TrendyToyz. All rights reserved.</div>
    </footer>
  );
}

export function WhatsAppButton() {
  return (
    <a
      href={`${BRAND.whatsapp}?text=${encodeURIComponent("Hi TrendyToyz! I have a question.")}`}
      target="_blank"
      rel="noreferrer"
      aria-label="Chat on WhatsApp"
      className="fixed bottom-5 right-5 z-50 grid size-14 place-items-center rounded-full bg-whatsapp text-primary-foreground shadow-card transition-transform hover:scale-105"
    >
      <svg viewBox="0 0 24 24" className="size-7 fill-current" aria-hidden>
        <path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3zM12 21.8c-1.8 0-3.5-.5-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4C2.6 15.6 2.2 13.8 2.2 12 2.2 6.6 6.6 2.2 12 2.2S21.8 6.6 21.8 12 17.4 21.8 12 21.8zM12 0C5.4 0 0 5.4 0 12c0 2.1.6 4.2 1.6 6L0 24l6.2-1.6c1.8 1 3.8 1.5 5.8 1.5 6.6 0 12-5.4 12-12S18.6 0 12 0z" />
      </svg>
    </a>
  );
}
