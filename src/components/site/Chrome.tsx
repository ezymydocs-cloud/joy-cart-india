import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Instagram,
  Mail,
  Phone,
  Search,
  ShoppingBag,
  User,
  LayoutDashboard,
  LogOut,
  Package,
  Menu,
  X,
  Sparkles,
  ShieldCheck,
  Send,
  CreditCard,
  Banknote,
} from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { BRAND } from "@/lib/format";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TopAnnouncementBar } from "./TopAnnouncementBar";
import { CartDrawer } from "./CartDrawer";
import { MobileBottomNav } from "./MobileBottomNav";

export function SiteHeader() {
  const { count } = useCart();
  const { user, isAdmin, signOut } = useAuth();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim()) {
      nav({ to: "/products", search: { q: q.trim() } });
    } else {
      nav({ to: "/products" });
    }
    setMobileMenuOpen(false);
  };

  return (
    <>
      <TopAnnouncementBar />
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur-md transition-all">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 sm:px-6">
          {/* Mobile Menu Button */}
          <button
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted md:hidden"
            onClick={() => setMobileMenuOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>

          {/* Brand Logo & Name: TrendyToyze */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold shadow-xs transition group-hover:scale-105">
              <Sparkles className="size-5 text-secondary" />
            </div>
            <div className="flex flex-col">
              <span className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                Trendy<span className="text-secondary">Toyze</span>
              </span>
              <span className="text-[10px] font-semibold text-muted-foreground -mt-1 hidden sm:block tracking-wider uppercase">
                India's Toy Destination
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden items-center gap-6 font-semibold text-sm md:flex ml-6">
            <Link
              to="/products"
              className="text-foreground/80 transition hover:text-secondary"
              activeProps={{ className: "text-secondary font-bold" }}
            >
              Shop All
            </Link>
            <Link
              to="/categories"
              className="text-foreground/80 transition hover:text-secondary"
              activeProps={{ className: "text-secondary font-bold" }}
            >
              Categories
            </Link>
            <Link
              to="/products"
              search={{ sort: "new" }}
              className="text-foreground/80 transition hover:text-secondary"
            >
              New Arrivals
            </Link>
          </nav>

          {/* Modern Search Bar */}
          <form onSubmit={submit} className="ml-auto hidden max-w-md flex-1 md:block">
            <label className="flex items-center gap-2.5 rounded-full border bg-muted/60 px-4 py-2 text-sm transition focus-within:border-secondary focus-within:bg-background focus-within:ring-2 focus-within:ring-secondary/20">
              <Search className="size-4 text-muted-foreground shrink-0" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search toys, cars, puzzles & games…"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </label>
          </form>

          {/* Action Icons: Account & Cart */}
          <div className="ml-auto flex items-center gap-1.5 md:ml-3">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="flex items-center gap-2 rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  aria-label="Account options"
                >
                  <User className="size-5" />
                  <span className="hidden text-xs font-semibold md:inline-block max-w-28 truncate">
                    {user.email?.split("@")[0]}
                  </span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-xl p-1.5">
                  <div className="px-3 py-2 text-xs text-muted-foreground border-b mb-1">
                    <p className="font-semibold text-foreground">Signed in as</p>
                    <p className="truncate">{user.email}</p>
                  </div>
                  <DropdownMenuItem onClick={() => nav({ to: "/orders" })} className="rounded-lg gap-2">
                    <Package className="size-4" /> My Orders
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => nav({ to: "/account" })} className="rounded-lg gap-2">
                    <User className="size-4" /> Account Details
                  </DropdownMenuItem>
                  {isAdmin && (
                    <DropdownMenuItem onClick={() => nav({ to: "/admin" })} className="rounded-lg gap-2 text-secondary font-semibold">
                      <LayoutDashboard className="size-4" /> Admin Dashboard
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut} className="rounded-lg gap-2 text-destructive">
                    <LogOut className="size-4" /> Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link
                to="/auth"
                className="hidden md:inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold text-foreground transition hover:bg-muted"
              >
                <User className="size-4" />
                <span>Login</span>
              </Link>
            )}

            {/* Shopping Cart Drawer Trigger */}
            <button
              onClick={() => setCartDrawerOpen(true)}
              className="relative flex items-center gap-1.5 rounded-full p-2 text-foreground transition hover:bg-muted"
              aria-label="View Cart"
            >
              <div className="relative">
                <ShoppingBag className="size-5 text-foreground" />
                {count > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 grid min-w-4 h-4 place-items-center rounded-full bg-secondary px-1 text-[10px] font-bold text-secondary-foreground shadow-xs">
                    {count}
                  </span>
                )}
              </div>
              <span className="hidden text-xs font-bold md:inline-block">Cart</span>
            </button>
          </div>
        </div>

        {/* Mobile Slide-down Search & Links */}
        {mobileMenuOpen && (
          <div className="border-t bg-background px-4 pb-4 pt-2 md:hidden animate-in slide-in-from-top-2">
            <form onSubmit={submit} className="mt-2">
              <label className="flex items-center gap-2.5 rounded-full border bg-muted/60 px-4 py-2 text-sm">
                <Search className="size-4 text-muted-foreground shrink-0" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search toys…"
                  className="w-full bg-transparent text-sm outline-none"
                />
              </label>
            </form>
            <div className="mt-4 flex flex-col gap-2 font-semibold text-sm">
              <Link
                to="/products"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-2 py-1.5 hover:bg-muted"
              >
                Shop All Toys
              </Link>
              <Link
                to="/categories"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-2 py-1.5 hover:bg-muted"
              >
                Browse Categories
              </Link>
              <Link
                to="/orders"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-2 py-1.5 hover:bg-muted"
              >
                Track My Orders
              </Link>
              {!user && (
                <Link
                  to="/auth"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-lg px-2 py-1.5 text-secondary hover:bg-muted font-bold"
                >
                  Customer Login / Register
                </Link>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Cart Drawer Component */}
      <CartDrawer open={cartDrawerOpen} onOpenChange={setCartDrawerOpen} />

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav
        onOpenCart={() => setCartDrawerOpen(true)}
        onOpenSearch={() => {
          setMobileMenuOpen(true);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />
    </>
  );
}

export function SiteFooter() {
  const [newsEmail, setNewsEmail] = useState("");

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsEmail || !newsEmail.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }
    toast.success("Thank you for subscribing to TrendyToyze VIP Club!", {
      description: "You'll receive exclusive discount codes and new toy drops.",
    });
    setNewsEmail("");
  };

  return (
    <footer className="mt-20 border-t bg-primary text-primary-foreground">
      {/* Upper Newsletter Ribbon */}
      <div className="border-b border-primary-foreground/10 bg-primary/60 px-4 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 md:flex-row">
          <div>
            <h3 className="font-display text-xl font-bold tracking-tight text-primary-foreground md:text-2xl">
              Join the TrendyToyze Club
            </h3>
            <p className="mt-1 text-xs text-primary-foreground/75">
              Subscribe for exclusive secret coupons, new arrival alerts & toy giveaways.
            </p>
          </div>
          <form onSubmit={handleSubscribe} className="flex w-full max-w-sm gap-2">
            <input
              type="email"
              value={newsEmail}
              onChange={(e) => setNewsEmail(e.target.value)}
              placeholder="Enter your email"
              className="w-full rounded-xl border border-primary-foreground/20 bg-background/10 px-4 py-2 text-xs text-primary-foreground placeholder:text-primary-foreground/50 outline-none focus:border-secondary"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-xl bg-secondary px-4 py-2 text-xs font-bold text-secondary-foreground transition hover:bg-secondary/90 shrink-0"
            >
              <span>Subscribe</span>
              <Send className="size-3.5" />
            </button>
          </form>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:grid-cols-2 md:grid-cols-4 lg:gap-12">
        {/* Brand Information */}
        <div>
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-xl bg-secondary text-secondary-foreground font-bold">
              <Sparkles className="size-5" />
            </div>
            <span className="font-display text-2xl font-bold tracking-tight text-primary-foreground">
              TrendyToyze
            </span>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-primary-foreground/75">
            India's favorite online toy destination. We deliver premium, child-safe, and educational toys that inspire imagination and spark smiles.
          </p>
          <div className="mt-4 flex items-center gap-2 text-xs text-secondary font-semibold">
            <ShieldCheck className="size-4" />
            <span>100% Certified Child-Safe Products</span>
          </div>
        </div>

        {/* Shop Links */}
        <div className="space-y-3 text-xs">
          <h4 className="font-display text-sm font-bold uppercase tracking-wider text-secondary">
            Quick Shop
          </h4>
          <ul className="space-y-2 text-primary-foreground/80">
            <li><Link to="/products" className="transition hover:text-secondary">All Toys</Link></li>
            <li><Link to="/categories" className="transition hover:text-secondary">Shop by Category</Link></li>
            <li><Link to="/products" search={{ sort: "new" }} className="transition hover:text-secondary">New Arrivals</Link></li>
            <li><Link to="/products" search={{ sort: "popular" }} className="transition hover:text-secondary">Popular Best Sellers</Link></li>
            <li><Link to="/orders" className="transition hover:text-secondary">Order Tracking</Link></li>
          </ul>
        </div>

        {/* Policies */}
        <div className="space-y-3 text-xs">
          <h4 className="font-display text-sm font-bold uppercase tracking-wider text-secondary">
            Customer Care
          </h4>
          <ul className="space-y-2 text-primary-foreground/80">
            <li><Link to="/policies/$slug" params={{ slug: "shipping" }} className="transition hover:text-secondary">Shipping & Delivery Policy</Link></li>
            <li><Link to="/policies/$slug" params={{ slug: "cancellation-refund" }} className="transition hover:text-secondary">Cancellation & 7-Day Refund</Link></li>
            <li><Link to="/policies/$slug" params={{ slug: "privacy" }} className="transition hover:text-secondary">Privacy Policy</Link></li>
            <li><Link to="/policies/$slug" params={{ slug: "terms" }} className="transition hover:text-secondary">Terms & Conditions</Link></li>
          </ul>
        </div>

        {/* Contact Info */}
        <div className="space-y-3 text-xs">
          <h4 className="font-display text-sm font-bold uppercase tracking-wider text-secondary">
            Contact Us
          </h4>
          <div className="space-y-2 text-primary-foreground/80">
            <a href={`tel:${BRAND.phoneRaw}`} className="flex items-center gap-2 transition hover:text-secondary">
              <Phone className="size-4 text-secondary" />
              <span>{BRAND.phone}</span>
            </a>
            <a href={`mailto:${BRAND.email}`} className="flex items-center gap-2 transition hover:text-secondary break-all">
              <Mail className="size-4 text-secondary" />
              <span>{BRAND.email}</span>
            </a>
            <a href={BRAND.instagram} target="_blank" rel="noreferrer" className="flex items-center gap-2 transition hover:text-secondary">
              <Instagram className="size-4 text-secondary" />
              <span>@{BRAND.instagramHandle}</span>
            </a>
          </div>
          <div className="pt-2">
            <span className="inline-block rounded-lg bg-primary-foreground/10 px-3 py-1.5 text-[11px] font-medium text-primary-foreground/90">
              ⚡ Support available Mon–Sat (10 AM – 7 PM IST)
            </span>
          </div>
        </div>
      </div>

      {/* Payment Methods & Copyright Strip */}
      <div className="border-t border-primary-foreground/10 px-4 py-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-xs text-primary-foreground/70 sm:flex-row">
          <p>© {new Date().getFullYear()} TrendyToyze. All rights reserved.</p>

          {/* Payment Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium text-primary-foreground/60 mr-1">Accepted Payments:</span>
            {["UPI", "RuPay", "Visa", "Mastercard", "NetBanking", "Cash on Delivery"].map((p) => (
              <span
                key={p}
                className="rounded-md border border-primary-foreground/20 bg-primary-foreground/5 px-2 py-0.5 text-[10px] font-semibold text-primary-foreground/80"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

export function WhatsAppButton() {
  return (
    <a
      href={`${BRAND.whatsapp}?text=${encodeURIComponent("Hi TrendyToyze! I have a question about your toys.")}`}
      target="_blank"
      rel="noreferrer"
      aria-label="Chat with TrendyToyze on WhatsApp"
      className="fixed bottom-20 right-5 z-40 grid size-13 place-items-center rounded-full bg-whatsapp text-white shadow-hover transition-transform hover:scale-110 md:bottom-6 md:size-14"
    >
      <svg viewBox="0 0 24 24" className="size-7 fill-current" aria-hidden>
        <path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3zM12 21.8c-1.8 0-3.5-.5-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4C2.6 15.6 2.2 13.8 2.2 12 2.2 6.6 6.6 2.2 12 2.2S21.8 6.6 21.8 12 17.4 21.8 12 21.8zM12 0C5.4 0 0 5.4 0 12c0 2.1.6 4.2 1.6 6L0 24l6.2-1.6c1.8 1 3.8 1.5 5.8 1.5 6.6 0 12-5.4 12-12S18.6 0 12 0z" />
      </svg>
    </a>
  );
}
