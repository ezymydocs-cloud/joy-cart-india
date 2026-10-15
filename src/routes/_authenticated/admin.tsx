import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { LayoutDashboard, ShoppingCart, Package, Tags, Image, Users, Truck, Settings, Menu, X, Store, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data } = await supabase.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
    if (!data) throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [
      { title: "Admin Panel | TrendyToyz" },
      { name: "description", content: "TrendyToyz store administration." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/orders", label: "Orders", icon: ShoppingCart },
  { to: "/admin/products", label: "Products", icon: Package },
  { to: "/admin/categories", label: "Categories", icon: Tags },
  { to: "/admin/banners", label: "Banners", icon: Image },
  { to: "/admin/customers", label: "Customers", icon: Users },
  { to: "/admin/couriers", label: "Couriers", icon: Truck },
  { to: "/admin/settings", label: "Settings", icon: Settings },
] as const;

function AdminLayout() {
  const [open, setOpen] = useState(false);
  const { signOut, user } = useAuth();
  const side = (
    <div className="flex h-full flex-col">
      <div className="m-3 rounded-2xl bg-background p-2"><img src="/logo-sm.png" alt="TrendyToyz" className="mx-auto h-16 w-auto" /></div>
      <nav className="flex-1 space-y-1 px-3">
        {NAV.map((n) => (
          <Link key={n.to} to={n.to} onClick={() => setOpen(false)} activeOptions={{ exact: "exact" in n }}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-sidebar-foreground hover:bg-sidebar-accent"
            activeProps={{ className: "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary" }}>
            <n.icon className="size-4" /> {n.label}
          </Link>
        ))}
      </nav>
      <div className="space-y-1 p-3 text-sm">
        <Link to="/" className="flex items-center gap-3 rounded-xl px-3 py-2 font-bold text-sidebar-foreground hover:bg-sidebar-accent"><Store className="size-4" /> View store</Link>
        <button onClick={signOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 font-bold text-sidebar-foreground hover:bg-sidebar-accent"><LogOut className="size-4" /> Sign out</button>
        <div className="truncate px-3 text-xs text-sidebar-foreground/60">{user?.email}</div>
      </div>
    </div>
  );
  return (
    <div className="min-h-screen bg-muted">
      <aside className="fixed inset-y-0 left-0 hidden w-60 bg-sidebar md:block">{side}</aside>
      {open && <div className="fixed inset-0 z-50 md:hidden"><div className="absolute inset-0 bg-foreground/40" onClick={() => setOpen(false)} /><aside className="absolute inset-y-0 left-0 w-64 bg-sidebar">{side}</aside></div>}
      <div className="md:pl-60">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-background px-4 py-3 md:hidden">
          <button onClick={() => setOpen(true)} aria-label="Menu">{open ? <X /> : <Menu />}</button>
          <span className="font-display text-lg">TrendyToyz Admin</span>
        </header>
        <main className="mx-auto max-w-7xl p-4 md:p-6"><Outlet /></main>
      </div>
    </div>
  );
}
