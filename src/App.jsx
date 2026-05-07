import { useState, useEffect, useRef } from "react";
import {
  ShoppingBag,
  Menu,
  X,
  Coffee,
  Lock,
  Truck,
  RotateCcw,
  Star,
  ArrowRight,
  Plus,
  Minus,
  Check,
  Flame,
  Hammer,
  Award,
  Shield,
  Leaf,
} from "lucide-react";

const STRIPE_PRICE_IDS = {
  'sippers-whisper': 'price_1TUJ0FLAf4l1OXJTpwFigruL',
  'sippers-murmur': 'price_1TUJ0aLAf4l1OXJTnViQqXOZ',
};

/* ----- Brand colors (used inline; Tailwind core utilities elsewhere) ----- */
const COPPER = "#B87333";
const COPPER_DEEP = "#8B5A2B";
const CANVAS = "#F1EAD9";
const CANVAS_LIGHT = "#F8F3E7";
const INK = "#0E0D0B";
const MUTED = "#888888";

/* ----- Catalog ----- */
const PRODUCTS = [
  {
    id: "sippers-whisper",
    name: "Sipper's Whisper Espresso Blend",
    category: "coffee",
    tagline: "The everyday workhorse",
    roast: "Medium",
    origin: "Colombia · Guatemala",
    price: 22,
    weight: "12 oz",
    notes: ["Cocoa", "Brown sugar", "Toasted almond"],
    description:
      "Built for the long haul. Balanced, syrupy, and dependable — the cup that fuels the work, not the small talk.",
    image:
      "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&w=900&q=80",
    badge: "Best Seller",
    stock: "in",
    margin: "high",
    rating: 4.9,
    reviews: 1284,
  },
  {
    id: "daybreak-light",
    name: "Daybreak",
    category: "coffee",
    tagline: "Bright, clean, awake",
    roast: "Light",
    origin: "Ethiopia · Kenya",
    price: 24,
    weight: "12 oz",
    notes: ["Bergamot", "Stone fruit", "Honey"],
    description:
      "A floral, citrus-forward light roast. The first cup that earns its keep before the sun does.",
    image:
      "https://images.unsplash.com/photo-1497636577773-f1231844b336?auto=format&fit=crop&w=900&q=80",
    badge: null,
    stock: "low",
    margin: "high",
    rating: 4.8,
    reviews: 612,
  },
  {
    id: "forge-espresso",
    name: "Forge Espresso",
    category: "coffee",
    tagline: "Built for the lever",
    roast: "Dark",
    origin: "Brazil · Sumatra",
    price: 26,
    weight: "12 oz",
    notes: ["Dark chocolate", "Molasses", "Charred oak"],
    description:
      "Heavy body. Caramel crema. Designed to pull thick, push through milk, and not flinch.",
    image:
      "https://images.unsplash.com/photo-1559496417-e7f25cb247f3?auto=format&fit=crop&w=900&q=80",
    badge: "Staff Pick",
    stock: "in",
    margin: "high",
    rating: 4.9,
    reviews: 947,
  },
  {
    id: "midnight-shift",
    name: "Midnight Shift",
    category: "coffee",
    tagline: "For the late builds",
    roast: "Dark",
    origin: "Sumatra · Papua New Guinea",
    price: 23,
    weight: "12 oz",
    notes: ["Black cherry", "Cedar", "Bittersweet cocoa"],
    description:
      "Low and slow. The roast that earned its name from the people drinking it at 2am.",
    image:
      "https://images.unsplash.com/photo-1611854779393-1b2da9d400fe?auto=format&fit=crop&w=900&q=80",
    badge: null,
    stock: "in",
    margin: "mid",
    rating: 4.7,
    reviews: 421,
  },
  {
    id: "single-origin-ethiopia",
    name: "Yirgacheffe SO",
    category: "coffee",
    tagline: "Single origin, washed",
    roast: "Light",
    origin: "Yirgacheffe, Ethiopia",
    price: 28,
    weight: "10 oz",
    notes: ["Jasmine", "Lemon zest", "Black tea"],
    description:
      "A delicate, tea-like cup. Pour-over only. Treat it gently and it'll change your morning.",
    image:
      "https://images.unsplash.com/photo-1442550528053-c431ecb55509?auto=format&fit=crop&w=900&q=80",
    badge: "Limited",
    stock: "low",
    margin: "high",
    rating: 4.9,
    reviews: 188,
  },
  {
    id: "sippers-murmur",
    name: "Sipper's Murmur – Swiss Water® Decaf",
    category: "coffee",
    tagline: "Swiss water decaf",
    roast: "Medium",
    origin: "Colombia",
    price: 22,
    weight: "12 oz",
    notes: ["Milk chocolate", "Walnut", "Caramel"],
    description:
      "All the cup, none of the noise. Swiss water processed — no chemicals, no compromise.",
    image:
      "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80",
    badge: null,
    stock: "in",
    margin: "mid",
    rating: 4.6,
    reviews: 273,
  },
  /* ----- Gear ----- */
  {
    id: "v60-dripper",
    name: "V60 Ceramic Dripper",
    category: "gear",
    tagline: "The classic, refined",
    price: 32,
    description:
      "Ceramic V60 with spiral ribs and a single hole for clean, even extraction. The dripper most pros come back to.",
    image:
      "https://images.unsplash.com/photo-1497935586351-b67a49e012bf?auto=format&fit=crop&w=900&q=80",
    badge: null,
    stock: "in",
    margin: "high",
    rating: 4.8,
    reviews: 502,
  },
  {
    id: "burr-grinder-pro",
    name: "Forge Burr Grinder",
    category: "gear",
    tagline: "Stepless, conical, quiet",
    price: 289,
    description:
      "40mm conical burrs, stepless adjustment, low retention. The grind that makes everything else taste better.",
    image:
      "https://images.unsplash.com/photo-1517705008128-361805f42e86?auto=format&fit=crop&w=900&q=80",
    badge: "Pro Grade",
    stock: "in",
    margin: "high",
    rating: 4.9,
    reviews: 318,
  },
  {
    id: "moka-pot-6cup",
    name: "Moka Pot · 6 cup",
    category: "gear",
    tagline: "Stovetop, brushed steel",
    price: 58,
    description:
      "Brushed stainless steel moka pot. Thick, syrupy, espresso-style coffee on any burner.",
    image:
      "https://images.unsplash.com/photo-1606791422814-b32c705fa101?auto=format&fit=crop&w=900&q=80",
    badge: null,
    stock: "in",
    margin: "mid",
    rating: 4.7,
    reviews: 211,
  },
  {
    id: "kettle-gooseneck",
    name: "Gooseneck Kettle",
    category: "gear",
    tagline: "Variable temp, 1L",
    price: 124,
    description:
      "Precise pour, variable temperature, hold function. The kettle that turns pour-over from gamble to ritual.",
    image:
      "https://images.unsplash.com/photo-1497515114629-f71d768fd07c?auto=format&fit=crop&w=900&q=80",
    badge: null,
    stock: "in",
    margin: "high",
    rating: 4.8,
    reviews: 264,
  },
  {
    id: "scale-precision",
    name: "Brew Scale",
    category: "gear",
    tagline: "0.1g, built-in timer",
    price: 48,
    description:
      "0.1g resolution, built-in timer, fast response. Weighing your shot is the cheapest upgrade you can make.",
    image:
      "https://images.unsplash.com/photo-1572286258217-215cf8e667a1?auto=format&fit=crop&w=900&q=80",
    badge: null,
    stock: "in",
    margin: "mid",
    rating: 4.7,
    reviews: 189,
  },
  {
    id: "mug-matte-black",
    name: "Maker's Mug",
    category: "gear",
    tagline: "Matte black stoneware, 12oz",
    price: 22,
    description:
      "Heavy stoneware mug in matte black with a copper-stamped maker's seal. Built to outlast the desk it sits on.",
    image:
      "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=900&q=80",
    badge: null,
    stock: "in",
    margin: "high",
    rating: 4.8,
    reviews: 412,
  },
];

const findProduct = (id) => PRODUCTS.find((p) => p.id === id);

/* ===================== Helper components ===================== */
function CopperButton({ children, onClick, href, className = "", variant = "solid", size = "md", as = "button", ...rest }) {
  const sizes = {
    sm: "px-4 py-2 text-xs tracking-widest",
    md: "px-6 py-3 text-xs tracking-[0.2em]",
    lg: "px-8 py-4 text-sm tracking-[0.25em]",
  };
  const base = `inline-flex items-center justify-center gap-2 font-semibold uppercase transition-all duration-200 ${sizes[size]} ${className}`;
  const styles =
    variant === "solid"
      ? { backgroundColor: COPPER, color: CANVAS_LIGHT, border: `1px solid ${COPPER}` }
      : variant === "ink"
        ? { backgroundColor: INK, color: CANVAS_LIGHT, border: `1px solid ${INK}` }
        : { backgroundColor: "transparent", color: INK, border: `1px solid ${INK}` };
  if (href) {
    return (
      <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className={base} style={styles} onClick={onClick} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <button className={base} style={styles} onClick={onClick} {...rest}>
      {children}
    </button>
  );
}

function Stars({ rating, count }) {
  return (
    <div className="flex items-center gap-2 text-xs" style={{ color: COPPER_DEEP }}>
      <div className="flex">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            size={13}
            fill={i < Math.round(rating) ? COPPER : "transparent"}
            stroke={COPPER}
            strokeWidth={1.5}
          />
        ))}
      </div>
      <span className="text-neutral-600">{rating} · {count} reviews</span>
    </div>
  );
}

function StockPill({ stock }) {
  if (stock === "low")
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase tracking-widest" style={{ backgroundColor: "#7A2E1F", color: CANVAS_LIGHT }}>
        <span className="block h-1.5 w-1.5 rounded-full bg-orange-300 animate-pulse" />
        Low Stock
      </span>
    );
  if (stock === "out")
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase tracking-widest bg-neutral-700 text-neutral-200">
        Sold out
      </span>
    );
  return null;
}

/* ===================== Header / Nav ===================== */
function Header({ go, cartCount, openCart, view }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navItems = [
    { id: "shop-coffee", label: "Shop Coffee" },
    { id: "shop-gear", label: "Shop Gear" },
    { id: "story", label: "Our Story" },
    { id: "quiz", label: "Find Your Roast" },
  ];

  return (
    <>
      <div className="text-center text-[10px] tracking-[0.3em] uppercase py-2.5" style={{ backgroundColor: INK, color: COPPER }}>
        Free shipping over $40 · Roasted to order, weekly
      </div>
      <header
        className={`sticky top-0 z-40 transition-all ${scrolled ? "shadow-sm" : ""}`}
        style={{ backgroundColor: scrolled ? "rgba(248,243,231,0.96)" : CANVAS_LIGHT, backdropFilter: scrolled ? "blur(8px)" : "none" }}
      >
        <div className="max-w-7xl mx-auto px-5 lg:px-8 flex items-center justify-between h-16 lg:h-20">
          <button onClick={() => go({ name: "home" })} className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-full flex items-center justify-center" style={{ backgroundColor: INK }}>
              <Coffee size={18} color={COPPER} strokeWidth={2} />
            </div>
            <div className="text-left leading-none">
              <div className="text-base lg:text-lg font-black tracking-tight" style={{ color: INK }}>SIP HAVEN</div>
              <div className="text-[9px] tracking-[0.3em] uppercase" style={{ color: COPPER_DEEP }}>Maker not a Taker</div>
            </div>
          </button>

          <nav className="hidden lg:flex items-center gap-8">
            {navItems.map((n) => (
              <button
                key={n.id}
                onClick={() => go({ name: n.id })}
                className="text-xs tracking-[0.2em] uppercase font-semibold hover:opacity-60 transition"
                style={{ color: view.name === n.id ? COPPER : INK }}
              >
                {n.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={openCart}
              className="relative h-10 w-10 flex items-center justify-center rounded-full transition hover:scale-105"
              style={{ backgroundColor: INK, color: CANVAS_LIGHT }}
              aria-label="Open cart"
            >
              <ShoppingBag size={17} />
              {cartCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 h-5 w-5 rounded-full text-[10px] font-bold flex items-center justify-center"
                  style={{ backgroundColor: COPPER, color: INK }}
                >
                  {cartCount}
                </span>
              )}
            </button>
            <button onClick={() => setMenuOpen(true)} className="lg:hidden h-10 w-10 flex items-center justify-center" aria-label="Open menu">
              <Menu size={22} color={INK} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile slide-over nav */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMenuOpen(false)} />
          <div className="absolute top-0 right-0 h-full w-80 max-w-full p-6 flex flex-col" style={{ backgroundColor: CANVAS_LIGHT }}>
            <div className="flex items-center justify-between mb-10">
              <div className="text-base font-black tracking-tight" style={{ color: INK }}>SIP HAVEN</div>
              <button onClick={() => setMenuOpen(false)} className="h-10 w-10 flex items-center justify-center" aria-label="Close menu">
                <X size={22} color={INK} />
              </button>
            </div>
            <nav className="flex flex-col gap-1">
              {navItems.map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    go({ name: n.id });
                    setMenuOpen(false);
                  }}
                  className="text-left py-4 px-4 text-base font-semibold tracking-wide rounded-lg hover:bg-stone-100 transition"
                  style={{ color: INK }}
                >
                  {n.label}
                </button>
              ))}
            </nav>
            <div className="mt-auto pt-6 border-t border-stone-300/60 text-[10px] tracking-[0.25em] uppercase" style={{ color: COPPER_DEEP }}>
              Roasted in small batches · Shipped within 24h
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ===================== Footer ===================== */
function Footer({ go }) {
  return (
    <footer className="mt-24" style={{ backgroundColor: INK, color: CANVAS_LIGHT }}>
      <div className="max-w-7xl mx-auto px-5 lg:px-8 py-16 grid md:grid-cols-4 gap-10">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-9 w-9 rounded-full flex items-center justify-center" style={{ backgroundColor: COPPER }}>
              <Coffee size={18} color={INK} />
            </div>
            <div className="text-lg font-black tracking-tight">SIP HAVEN</div>
          </div>
          <p className="text-sm leading-relaxed text-stone-300 max-w-md">
            We roast coffee for the people who build things. Tools, software, businesses, themselves. Maker not a taker.
          </p>
          <div className="mt-6 flex gap-2">
            <input
              type="email"
              placeholder="your@email.com"
              className="flex-1 px-4 py-3 text-sm bg-transparent border border-stone-700 focus:outline-none focus:border-stone-300"
              style={{ color: CANVAS_LIGHT }}
            />
            <CopperButton size="sm" variant="solid" onClick={() => { }}>
              Subscribe
            </CopperButton>
          </div>
        </div>
        <div>
          <div className="text-[10px] tracking-[0.3em] uppercase mb-4" style={{ color: COPPER }}>Shop</div>
          <ul className="space-y-2 text-sm text-stone-300">
            <li><button onClick={() => go({ name: "shop-coffee" })} className="hover:text-white">All Coffee</button></li>
            <li><button onClick={() => go({ name: "shop-gear" })} className="hover:text-white">Brewing Gear</button></li>
            <li><button onClick={() => go({ name: "quiz" })} className="hover:text-white">Find Your Roast</button></li>
          </ul>
        </div>
        <div>
          <div className="text-[10px] tracking-[0.3em] uppercase mb-4" style={{ color: COPPER }}>Company</div>
          <ul className="space-y-2 text-sm text-stone-300">
            <li><button onClick={() => go({ name: "story" })} className="hover:text-white">Our Story</button></li>
            <li><button className="hover:text-white">Wholesale</button></li>
            <li><button className="hover:text-white">Contact</button></li>
            <li><button className="hover:text-white">Returns</button></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-stone-800 py-6 text-center text-[10px] tracking-[0.3em] uppercase text-stone-500">
        © Sip Haven Co. · Roasted in small batches
      </div>
    </footer>
  );
}

/* ===================== Home ===================== */
function Home({ go, addToCart }) {
  const featured = ["sippers-whisper", "forge-espresso", "daybreak-light"].map(findProduct);
  return (
    <div style={{ backgroundColor: CANVAS_LIGHT }}>
      {/* HERO */}
      <section className="relative overflow-hidden" style={{ backgroundColor: INK, color: CANVAS_LIGHT }}>
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1442550528053-c431ecb55509?auto=format&fit=crop&w=1800&q=80')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(120deg, ${INK}EE 0%, ${INK}99 50%, transparent 100%)` }}
        />
        <div className="relative max-w-7xl mx-auto px-5 lg:px-8 py-24 lg:py-36">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 border" style={{ borderColor: COPPER, color: COPPER }}>
              <Flame size={12} />
              <span className="text-[10px] tracking-[0.3em] uppercase font-bold">Roasted this week</span>
            </div>
            <h1 className="text-5xl lg:text-7xl font-black leading-[0.95] tracking-tight mb-6">
              Coffee for<br />
              the people who<br />
              <span style={{ color: COPPER }}>build things.</span>
            </h1>
            <p className="text-lg text-stone-300 mb-10 max-w-lg leading-relaxed">
              Single-origin and small-batch blends, roasted in-house and shipped within 24 hours. No fluff, no filler — just coffee that earns the cup.
            </p>
            <div className="flex flex-wrap gap-3">
              <CopperButton size="lg" variant="solid" onClick={() => go({ name: "shop-coffee" })}>
                Fuel Your Grind — Shop the Roasts <ArrowRight size={14} />
              </CopperButton>
              <CopperButton
                size="lg"
                onClick={() => go({ name: "quiz" })}
                className="!bg-transparent !border-stone-400"
                style={{ backgroundColor: "transparent", color: CANVAS_LIGHT, border: `1px solid ${CANVAS_LIGHT}40` }}
              >
                Take the 2-min Quiz
              </CopperButton>
            </div>
            <div className="mt-12 flex flex-wrap gap-x-8 gap-y-3 text-xs tracking-[0.2em] uppercase text-stone-400">
              <div className="flex items-center gap-2"><Truck size={14} color={COPPER} /> Free shipping over $40</div>
              <div className="flex items-center gap-2"><Leaf size={14} color={COPPER} /> Direct trade beans</div>
              <div className="flex items-center gap-2"><RotateCcw size={14} color={COPPER} /> 30-day return</div>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST STRIP */}
      <section className="py-8 border-y" style={{ backgroundColor: CANVAS, borderColor: "#E0D6BE" }}>
        <div className="max-w-7xl mx-auto px-5 lg:px-8 flex flex-wrap items-center justify-around gap-6">
          {[
            { icon: Award, label: "Speciality Coffee Assoc. 87+" },
            { icon: Shield, label: "Secure Shopify Checkout" },
            { icon: Hammer, label: "Roasted within 7 days" },
            { icon: Star, label: "4.8★ from 12,400+ makers" },
          ].map((t, i) => (
            <div key={i} className="flex items-center gap-2 text-xs tracking-[0.2em] uppercase font-semibold" style={{ color: INK }}>
              <t.icon size={16} color={COPPER_DEEP} />
              {t.label}
            </div>
          ))}
        </div>
      </section>

      {/* FEATURED PRODUCTS */}
      <section className="max-w-7xl mx-auto px-5 lg:px-8 py-20 lg:py-28">
        <div className="flex items-end justify-between mb-12">
          <div>
            <div className="text-[10px] tracking-[0.3em] uppercase font-bold mb-3" style={{ color: COPPER_DEEP }}>The Roasts</div>
            <h2 className="text-3xl lg:text-5xl font-black tracking-tight" style={{ color: INK }}>
              Built for the cup<br />you actually drink.
            </h2>
          </div>
          <button onClick={() => go({ name: "shop-coffee" })} className="hidden md:inline-flex items-center gap-2 text-xs tracking-[0.25em] uppercase font-bold hover:opacity-70" style={{ color: INK }}>
            View all coffee <ArrowRight size={14} />
          </button>
        </div>
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {featured.map((p) => (
            <ProductCard key={p.id} product={p} go={go} addToCart={addToCart} />
          ))}
        </div>
      </section>

      {/* MANIFESTO STRIP */}
      <section className="relative py-24 lg:py-32" style={{ backgroundColor: INK, color: CANVAS_LIGHT }}>
        <div className="max-w-4xl mx-auto px-5 lg:px-8 text-center">
          <div className="text-[10px] tracking-[0.3em] uppercase mb-6" style={{ color: COPPER }}>The Manifesto</div>
          <h2 className="text-3xl lg:text-5xl font-black leading-tight tracking-tight mb-6">
            "We don't sell coffee to people who want to feel busy.<br />
            <span style={{ color: COPPER }}>We sell it to people who actually do the work."</span>
          </h2>
          <CopperButton size="md" variant="solid" onClick={() => go({ name: "story" })} className="mt-6">
            Read our story <ArrowRight size={14} />
          </CopperButton>
        </div>
      </section>

      {/* QUIZ TEASER */}
      <section className="max-w-7xl mx-auto px-5 lg:px-8 py-20">
        <div className="grid lg:grid-cols-2 gap-10 items-center" style={{ backgroundColor: CANVAS }}>
          <div className="aspect-[4/3] lg:aspect-auto lg:h-full bg-stone-300" style={{
            backgroundImage: "url('https://images.unsplash.com/photo-1453614512568-c4024d13c247?auto=format&fit=crop&w=1200&q=80')",
            backgroundSize: "cover", backgroundPosition: "center"
          }} />
          <div className="p-8 lg:p-14">
            <div className="text-[10px] tracking-[0.3em] uppercase font-bold mb-3" style={{ color: COPPER_DEEP }}>2-min Quiz</div>
            <h3 className="text-3xl lg:text-4xl font-black tracking-tight mb-4" style={{ color: INK }}>
              Find your perfect roast.
            </h3>
            <p className="text-stone-700 mb-8 leading-relaxed">
              Four quick questions. We'll match you to a roast based on how you brew, what you like, and when you drink it. No spam — just a recommendation.
            </p>
            <CopperButton size="lg" variant="ink" onClick={() => go({ name: "quiz" })}>
              Start the quiz <ArrowRight size={14} />
            </CopperButton>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ===================== Product Card ===================== */
function ProductCard({ product, go, addToCart }) {
  const purchasable = Boolean(STRIPE_PRICE_IDS[product.id]);
  return (
    <div className="group cursor-pointer flex flex-col">
      <div
        className="relative aspect-square overflow-hidden mb-4"
        onClick={() => go({ name: "product", id: product.id })}
        style={{ backgroundColor: CANVAS }}
      >
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 items-start">
          {product.badge && (
            <span className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest" style={{ backgroundColor: INK, color: COPPER }}>
              {product.badge}
            </span>
          )}
          <StockPill stock={product.stock} />
        </div>
      </div>
      <div className="flex-1 flex flex-col">
        <button onClick={() => go({ name: "product", id: product.id })} className="text-left">
          {product.roast && (
            <div className="text-[10px] tracking-[0.3em] uppercase mb-1.5" style={{ color: COPPER_DEEP }}>
              {product.roast} Roast · {product.origin}
            </div>
          )}
          <h3 className="text-xl font-black tracking-tight mb-1" style={{ color: INK }}>{product.name}</h3>
          <p className="text-sm text-stone-600 mb-3">{product.tagline}</p>
        </button>
        {product.notes && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {product.notes.map((n) => (
              <span key={n} className="text-[10px] tracking-widest uppercase px-2 py-1 border" style={{ borderColor: "#D5C8A8", color: COPPER_DEEP }}>
                {n}
              </span>
            ))}
          </div>
        )}
        <div className="mt-auto flex items-center justify-between pt-2">
          <div className="text-lg font-black" style={{ color: INK }}>${product.price}</div>
          {purchasable ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                addToCart(product.id, 1);
              }}
              className="px-4 py-2.5 text-[10px] tracking-[0.25em] uppercase font-bold transition-colors hover:opacity-90"
              style={{ backgroundColor: INK, color: CANVAS_LIGHT }}
            >
              Add to cart
            </button>
          ) : (
            <span
              className="px-4 py-2.5 text-[10px] tracking-[0.25em] uppercase font-bold opacity-40 cursor-not-allowed"
              style={{ backgroundColor: MUTED, color: CANVAS_LIGHT }}
            >
              Coming soon
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ===================== Shop pages ===================== */
function ShopPage({ category, go, addToCart }) {
  const all = PRODUCTS.filter((p) => p.category === category);
  // High-margin / overstocked items pinned to top per project directive
  const sorted = [...all].sort((a, b) => {
    const score = (p) => (p.margin === "high" ? 2 : p.margin === "mid" ? 1 : 0) + (p.stock === "in" ? 0.5 : 0);
    return score(b) - score(a);
  });
  const [filter, setFilter] = useState("all");
  const filtered = category === "coffee"
    ? (filter === "all" ? sorted : sorted.filter((p) => p.roast?.toLowerCase() === filter))
    : sorted;

  return (
    <div style={{ backgroundColor: CANVAS_LIGHT }} className="min-h-screen">
      <section className="max-w-7xl mx-auto px-5 lg:px-8 pt-12 pb-8">
        <div className="text-[10px] tracking-[0.3em] uppercase font-bold mb-3" style={{ color: COPPER_DEEP }}>
          {category === "coffee" ? "Coffee" : "Brewing Gear"}
        </div>
        <h1 className="text-4xl lg:text-6xl font-black tracking-tight mb-4" style={{ color: INK }}>
          {category === "coffee" ? "Every roast. Built for the cup." : "Tools that earn their keep."}
        </h1>
        <p className="max-w-xl text-stone-700">
          {category === "coffee"
            ? "Six rotating roasts, all roasted within seven days of shipping. Subscribe to lock in 15% and shipping forever."
            : "The brewers, grinders, and accessories we actually use. Nothing on this page is here because of margin."}
        </p>
        {category === "coffee" && (
          <div className="mt-8 flex flex-wrap gap-2">
            {["all", "light", "medium", "dark"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-4 py-2 text-[11px] tracking-[0.2em] uppercase font-bold transition-colors"
                style={{
                  backgroundColor: filter === f ? INK : "transparent",
                  color: filter === f ? CANVAS_LIGHT : INK,
                  border: `1px solid ${INK}`,
                }}
              >
                {f === "all" ? "All Roasts" : `${f}`}
              </button>
            ))}
          </div>
        )}
      </section>
      <section className="max-w-7xl mx-auto px-5 lg:px-8 pb-24">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {filtered.map((p) => (
            <ProductCard key={p.id} product={p} go={go} addToCart={addToCart} />
          ))}
        </div>
      </section>
    </div>
  );
}

/* ===================== Product detail w/ sticky CTA ===================== */
function ProductDetail({ id, go, addToCart, openCart }) {
  const product = findProduct(id);
  const [grind, setGrind] = useState("Whole bean");
  const [qty, setQty] = useState(1);
  const [showSticky, setShowSticky] = useState(false);
  const ctaRef = useRef(null);

  useEffect(() => {
    if (!ctaRef.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => setShowSticky(!entry.isIntersecting),
      { rootMargin: "-100px 0px 0px 0px" }
    );
    obs.observe(ctaRef.current);
    return () => obs.disconnect();
  }, []);

  if (!product) return <div className="p-20 text-center">Not found.</div>;

  const related = PRODUCTS.filter((p) => p.id !== product.id && p.category === product.category).slice(0, 3);

  const handleAdd = () => {
    addToCart(product.id, qty);
    openCart();
  };

  return (
    <div style={{ backgroundColor: CANVAS_LIGHT }}>
      <div className="max-w-7xl mx-auto px-5 lg:px-8 pt-6">
        <button onClick={() => go({ name: product.category === "coffee" ? "shop-coffee" : "shop-gear" })} className="text-[11px] tracking-[0.2em] uppercase font-bold opacity-60 hover:opacity-100" style={{ color: INK }}>
          ← Back to {product.category === "coffee" ? "Coffee" : "Gear"}
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-5 lg:px-8 py-10 grid lg:grid-cols-2 gap-10 lg:gap-16">
        {/* Imagery */}
        <div>
          <div className="aspect-square mb-3 overflow-hidden" style={{ backgroundColor: CANVAS }}>
            <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
          </div>
          <div className="grid grid-cols-4 gap-3">
            {[product.image, product.image, product.image, product.image].map((src, i) => (
              <div key={i} className="aspect-square overflow-hidden cursor-pointer hover:opacity-80" style={{ backgroundColor: CANVAS }}>
                <img src={src} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>

        {/* Info */}
        <div ref={ctaRef}>
          <div className="text-[10px] tracking-[0.3em] uppercase font-bold mb-3" style={{ color: COPPER_DEEP }}>
            {product.roast ? `${product.roast} Roast · ${product.origin}` : "Brewing Gear"}
          </div>
          <h1 className="text-4xl lg:text-5xl font-black tracking-tight mb-3" style={{ color: INK }}>{product.name}</h1>
          <p className="text-lg text-stone-700 mb-4">{product.tagline}</p>
          <Stars rating={product.rating} count={product.reviews} />

          <div className="mt-6 flex items-center gap-4">
            <div className="text-3xl font-black" style={{ color: INK }}>${product.price}</div>
            {product.weight && <div className="text-sm text-stone-500">{product.weight}</div>}
            <StockPill stock={product.stock} />
          </div>

          <p className="mt-6 text-stone-700 leading-relaxed">{product.description}</p>

          {product.notes && (
            <div className="mt-6">
              <div className="text-[10px] tracking-[0.3em] uppercase font-bold mb-3" style={{ color: COPPER_DEEP }}>Tasting notes</div>
              <div className="flex flex-wrap gap-2">
                {product.notes.map((n) => (
                  <span key={n} className="text-xs tracking-widest uppercase px-3 py-1.5 border" style={{ borderColor: COPPER_DEEP, color: COPPER_DEEP }}>{n}</span>
                ))}
              </div>
            </div>
          )}

          {product.category === "coffee" && (
            <div className="mt-8">
              <div className="text-[10px] tracking-[0.3em] uppercase font-bold mb-3" style={{ color: COPPER_DEEP }}>Grind</div>
              <div className="grid grid-cols-3 gap-2">
                {["Whole bean", "Espresso", "French press"].map((g) => (
                  <button
                    key={g}
                    onClick={() => setGrind(g)}
                    className="py-3 text-[11px] tracking-[0.15em] uppercase font-semibold transition"
                    style={{
                      backgroundColor: grind === g ? INK : "transparent",
                      color: grind === g ? CANVAS_LIGHT : INK,
                      border: `1px solid ${INK}`,
                    }}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 flex items-center gap-3">
            <div className="flex items-center border" style={{ borderColor: INK }}>
              <button onClick={() => setQty(Math.max(1, qty - 1))} className="h-12 w-12 flex items-center justify-center hover:bg-stone-100" aria-label="Decrease">
                <Minus size={14} />
              </button>
              <span className="w-12 text-center font-bold">{qty}</span>
              <button onClick={() => setQty(qty + 1)} className="h-12 w-12 flex items-center justify-center hover:bg-stone-100" aria-label="Increase">
                <Plus size={14} />
              </button>
            </div>
            <CopperButton size="lg" variant="solid" onClick={handleAdd} className="flex-1">
              Add to cart · ${(product.price * qty).toFixed(2)}
            </CopperButton>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3 text-[10px] tracking-[0.2em] uppercase font-semibold text-stone-600">
            <div className="flex flex-col items-center text-center gap-1.5 py-3 border-t border-stone-300">
              <Truck size={16} color={COPPER_DEEP} /> Free over $40
            </div>
            <div className="flex flex-col items-center text-center gap-1.5 py-3 border-t border-stone-300">
              <Lock size={16} color={COPPER_DEEP} /> Secure checkout
            </div>
            <div className="flex flex-col items-center text-center gap-1.5 py-3 border-t border-stone-300">
              <RotateCcw size={16} color={COPPER_DEEP} /> 30-day return
            </div>
          </div>
        </div>
      </div>

      {/* Reviews */}
      <section className="max-w-7xl mx-auto px-5 lg:px-8 py-16 border-t border-stone-300">
        <h2 className="text-2xl lg:text-3xl font-black tracking-tight mb-8" style={{ color: INK }}>What makers say</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { name: "Marcus T.", text: "I switched from a big-name brand and never looked back. Forge Espresso pulls thick and the crema is unreal.", rating: 5 },
            { name: "Lena K.", text: "Daybreak is the cleanest pour-over I've made at home. Tastes like the cafe and saves me $7 a day.", rating: 5 },
            { name: "Sam J.", text: "Maker's Blend is a workhorse. I drink it black, with milk, cold brew — never a bad cup.", rating: 5 },
          ].map((r, i) => (
            <div key={i} className="p-6" style={{ backgroundColor: CANVAS }}>
              <Stars rating={r.rating} count="" />
              <p className="my-4 text-stone-800 leading-relaxed">"{r.text}"</p>
              <div className="text-xs tracking-[0.2em] uppercase font-bold" style={{ color: COPPER_DEEP }}>— {r.name}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Related */}
      <section className="max-w-7xl mx-auto px-5 lg:px-8 pb-20">
        <h2 className="text-2xl lg:text-3xl font-black tracking-tight mb-8" style={{ color: INK }}>You may also like</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {related.map((p) => (
            <ProductCard key={p.id} product={p} go={go} addToCart={addToCart} />
          ))}
        </div>
      </section>

      {/* Sticky add-to-cart bar */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-30 transition-transform duration-300 ${showSticky ? "translate-y-0" : "translate-y-full"}`}
        style={{ backgroundColor: INK, color: CANVAS_LIGHT, boxShadow: "0 -4px 24px rgba(0,0,0,0.2)" }}
      >
        <div className="max-w-7xl mx-auto px-5 lg:px-8 py-3 flex items-center gap-4">
          <img src={product.image} alt="" className="h-12 w-12 object-cover hidden sm:block" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold truncate">{product.name}</div>
            <div className="text-xs text-stone-400">${product.price}</div>
          </div>
          <CopperButton size="md" variant="solid" onClick={handleAdd}>
            Add to cart
          </CopperButton>
        </div>
      </div>
    </div>
  );
}

/* ===================== Roast Quiz ===================== */
function Quiz({ go, addToCart, openCart }) {
  const questions = [
    {
      q: "How do you brew most often?",
      key: "method",
      options: [
        { label: "Espresso machine", value: "espresso" },
        { label: "Pour-over / V60", value: "pourover" },
        { label: "French press", value: "press" },
        { label: "Drip / Moka pot", value: "drip" },
      ],
    },
    {
      q: "What flavor profile pulls you in?",
      key: "flavor",
      options: [
        { label: "Bright & fruity", value: "bright" },
        { label: "Balanced & nutty", value: "balanced" },
        { label: "Bold & chocolatey", value: "bold" },
        { label: "Dark & smoky", value: "smoky" },
      ],
    },
    {
      q: "When do you drink it?",
      key: "time",
      options: [
        { label: "First thing, sunrise", value: "morning" },
        { label: "Mid-morning ritual", value: "mid" },
        { label: "Afternoon focus", value: "afternoon" },
        { label: "Late nights, building", value: "late" },
      ],
    },
    {
      q: "Caffeine?",
      key: "caf",
      options: [
        { label: "All of it", value: "full" },
        { label: "Yeah, but not jittery", value: "balanced" },
        { label: "Decaf, please", value: "decaf" },
      ],
    },
  ];

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [done, setDone] = useState(false);

  const recommend = () => {
    if (answers.caf === "decaf") return findProduct("sippers-murmur");
    if (answers.flavor === "bright") return findProduct("daybreak-light");
    if (answers.method === "espresso" || answers.flavor === "bold") return findProduct("forge-espresso");
    if (answers.flavor === "smoky" || answers.time === "late") return findProduct("midnight-shift");
    if (answers.flavor === "balanced") return findProduct("sippers-whisper");
    return findProduct("sippers-whisper");
  };

  const onAnswer = (key, val) => {
    const next = { ...answers, [key]: val };
    setAnswers(next);
    if (step + 1 < questions.length) setStep(step + 1);
    else setDone(true);
  };

  const reset = () => {
    setStep(0);
    setAnswers({});
    setDone(false);
  };

  if (done) {
    const rec = recommend();
    return (
      <div style={{ backgroundColor: CANVAS_LIGHT }} className="min-h-screen py-16">
        <div className="max-w-3xl mx-auto px-5 lg:px-8">
          <div className="text-center mb-10">
            <div className="text-[10px] tracking-[0.3em] uppercase font-bold mb-3" style={{ color: COPPER_DEEP }}>Your Match</div>
            <h1 className="text-4xl lg:text-5xl font-black tracking-tight mb-4" style={{ color: INK }}>
              Meet your roast.
            </h1>
            <p className="text-stone-700">Based on your answers, this is the cup we'd hand you across the counter.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-0 overflow-hidden" style={{ backgroundColor: INK, color: CANVAS_LIGHT }}>
            <div className="aspect-square md:aspect-auto" style={{ backgroundImage: `url(${rec.image})`, backgroundSize: "cover", backgroundPosition: "center" }} />
            <div className="p-8 lg:p-10 flex flex-col">
              <div className="text-[10px] tracking-[0.3em] uppercase mb-3" style={{ color: COPPER }}>{rec.roast} Roast · {rec.origin}</div>
              <h2 className="text-3xl font-black tracking-tight mb-3">{rec.name}</h2>
              <p className="text-stone-300 mb-4">{rec.description}</p>
              <div className="flex flex-wrap gap-2 mb-6">
                {rec.notes?.map((n) => (
                  <span key={n} className="text-[10px] tracking-widest uppercase px-2 py-1 border" style={{ borderColor: COPPER, color: COPPER }}>{n}</span>
                ))}
              </div>
              <div className="text-2xl font-black mb-6">${rec.price}</div>
              <div className="flex flex-col gap-2 mt-auto">
                <CopperButton size="md" variant="solid" onClick={() => { addToCart(rec.id, 1); openCart(); }}>
                  Add to cart — ${rec.price}
                </CopperButton>
                <button onClick={() => go({ name: "product", id: rec.id })} className="text-[11px] tracking-[0.2em] uppercase font-bold hover:opacity-70" style={{ color: COPPER }}>
                  See full details →
                </button>
              </div>
            </div>
          </div>
          <div className="text-center mt-8">
            <button onClick={reset} className="text-xs tracking-[0.2em] uppercase font-bold opacity-70 hover:opacity-100" style={{ color: INK }}>
              Retake the quiz
            </button>
          </div>
        </div>
      </div>
    );
  }

  const q = questions[step];
  const progress = ((step) / questions.length) * 100;

  return (
    <div style={{ backgroundColor: CANVAS_LIGHT }} className="min-h-screen py-16">
      <div className="max-w-2xl mx-auto px-5 lg:px-8">
        <div className="text-[10px] tracking-[0.3em] uppercase font-bold mb-3 text-center" style={{ color: COPPER_DEEP }}>
          Find Your Perfect Roast · {step + 1} of {questions.length}
        </div>
        <div className="h-1 w-full mb-12" style={{ backgroundColor: "#E0D6BE" }}>
          <div className="h-full transition-all duration-500" style={{ width: `${progress}%`, backgroundColor: COPPER }} />
        </div>
        <h1 className="text-3xl lg:text-4xl font-black tracking-tight text-center mb-10" style={{ color: INK }}>
          {q.q}
        </h1>
        <div className="grid sm:grid-cols-2 gap-3">
          {q.options.map((o) => (
            <button
              key={o.value}
              onClick={() => onAnswer(q.key, o.value)}
              className="p-5 text-left transition hover:translate-y-[-2px] hover:shadow-lg"
              style={{
                backgroundColor: CANVAS,
                border: `1px solid ${INK}20`,
                color: INK,
              }}
            >
              <div className="text-base font-bold tracking-tight">{o.label}</div>
            </button>
          ))}
        </div>
        {step > 0 && (
          <div className="text-center mt-10">
            <button onClick={() => setStep(step - 1)} className="text-xs tracking-[0.2em] uppercase font-bold opacity-70 hover:opacity-100" style={{ color: INK }}>
              ← Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ===================== Our Story ===================== */
function Story({ go }) {
  return (
    <div style={{ backgroundColor: CANVAS_LIGHT }}>
      <section className="relative py-24 lg:py-36 overflow-hidden" style={{ backgroundColor: INK, color: CANVAS_LIGHT }}>
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: "url('https://images.unsplash.com/photo-1511537190424-bbbab87ac5eb?auto=format&fit=crop&w=1800&q=80')",
            backgroundSize: "cover", backgroundPosition: "center"
          }}
        />
        <div className="relative max-w-4xl mx-auto px-5 lg:px-8 text-center">
          <div className="text-[10px] tracking-[0.3em] uppercase mb-4" style={{ color: COPPER }}>Our Story</div>
          <h1 className="text-4xl lg:text-7xl font-black tracking-tight leading-[0.95]">
            Built by makers,<br />
            <span style={{ color: COPPER }}>for makers.</span>
          </h1>
        </div>
      </section>
      <section className="max-w-3xl mx-auto px-5 lg:px-8 py-20 space-y-8 text-lg leading-relaxed text-stone-800">
        <p>
          Sip Haven Co. started in a one-car garage with a Behmor 1600, a notebook full of failed batches, and a stubborn belief: most coffee on shelves was built for shelves, not for cups.
        </p>
        <p style={{ color: INK }} className="text-2xl font-black tracking-tight border-l-4 pl-6" >
          We're a roastery for the people who actually do the work. The builders, the fixers, the second-shifters, the early risers. Maker not a taker.
        </p>
        <p>
          Today we work directly with seven farms across Ethiopia, Colombia, Guatemala, and Sumatra. We pay above Fair Trade rates. We roast within seven days of shipping. We don't run sales because our prices are already fair.
        </p>
        <p>
          You won't find airy adjectives or marketing fluff on our bags. You'll find the farm, the elevation, the process, the roast date — and a cup that earns its keep.
        </p>
      </section>
      <section className="max-w-7xl mx-auto px-5 lg:px-8 py-12 grid md:grid-cols-3 gap-6">
        {[
          { n: "7", l: "Direct-trade farms" },
          { n: "12,400+", l: "Makers we serve" },
          { n: "<7 days", l: "Bean to your door" },
        ].map((s, i) => (
          <div key={i} className="p-8 lg:p-10 text-center" style={{ backgroundColor: INK, color: CANVAS_LIGHT }}>
            <div className="text-5xl lg:text-6xl font-black mb-2" style={{ color: COPPER }}>{s.n}</div>
            <div className="text-[10px] tracking-[0.3em] uppercase font-bold">{s.l}</div>
          </div>
        ))}
      </section>
      <section className="max-w-3xl mx-auto px-5 lg:px-8 py-20 text-center">
        <h2 className="text-3xl lg:text-4xl font-black tracking-tight mb-6" style={{ color: INK }}>Ready to find yours?</h2>
        <CopperButton size="lg" variant="ink" onClick={() => go({ name: "quiz" })}>
          Take the 2-min quiz <ArrowRight size={14} />
        </CopperButton>
      </section>
    </div>
  );
}

/* ===================== Cart Drawer ===================== */
function CartDrawer({ open, close, cart, setCart }) {
  const items = cart
    .map((c) => ({ ...c, product: findProduct(c.id) }))
    .filter((c) => c.product);
  const subtotal = items.reduce((s, i) => s + i.product.price * i.qty, 0);
  const free = subtotal >= 40;
  const remaining = Math.max(0, 40 - subtotal);
  const [checkingOut, setCheckingOut] = useState(false);

  const updateQty = (id, qty) => {
    if (qty <= 0) setCart(cart.filter((c) => c.id !== id));
    else setCart(cart.map((c) => (c.id === id ? { ...c, qty } : c)));
  };

  const checkout = async () => {
    if (!items.length || checkingOut) return;
    setCheckingOut(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((i) => ({ id: i.id, qty: i.qty })),
        }),
      });
      const { url, error } = await res.json();
      if (error) throw new Error(error);
      window.location.href = url;
    } catch (err) {
      console.error('Checkout failed:', err);
      setCheckingOut(false);
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={close} />
      <div
        className="absolute top-0 right-0 h-full w-full max-w-md flex flex-col"
        style={{ backgroundColor: CANVAS_LIGHT }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-stone-300">
          <div>
            <div className="text-[10px] tracking-[0.3em] uppercase font-bold" style={{ color: COPPER_DEEP }}>Your Cart</div>
            <div className="text-base font-black" style={{ color: INK }}>{items.length} item{items.length === 1 ? "" : "s"}</div>
          </div>
          <button onClick={close} className="h-10 w-10 flex items-center justify-center" aria-label="Close cart">
            <X size={20} color={INK} />
          </button>
        </div>

        {/* Free shipping progress */}
        <div className="px-5 py-4 border-b border-stone-300" style={{ backgroundColor: CANVAS }}>
          {free ? (
            <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: COPPER_DEEP }}>
              <Check size={16} /> Free shipping unlocked
            </div>
          ) : (
            <>
              <div className="text-xs mb-2" style={{ color: INK }}>
                Add <strong>${remaining.toFixed(2)}</strong> more for free shipping.
              </div>
              <div className="h-1.5 w-full" style={{ backgroundColor: "#E0D6BE" }}>
                <div className="h-full transition-all" style={{ width: `${Math.min(100, (subtotal / 40) * 100)}%`, backgroundColor: COPPER }} />
              </div>
            </>
          )}
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-5">
          {items.length === 0 ? (
            <div className="text-center py-16 text-stone-600">
              <ShoppingBag size={32} className="mx-auto mb-4 opacity-40" />
              <p className="text-sm">Your cart's empty.</p>
              <p className="text-xs text-stone-500 mt-1">The work doesn't fuel itself.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {items.map((i) => (
                <div key={i.id} className="flex gap-4">
                  <img src={i.product.image} alt="" className="h-20 w-20 object-cover" style={{ backgroundColor: CANVAS }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold tracking-tight" style={{ color: INK }}>{i.product.name}</div>
                    {i.product.roast && <div className="text-[10px] tracking-[0.2em] uppercase mt-0.5" style={{ color: COPPER_DEEP }}>{i.product.roast} · {i.product.weight}</div>}
                    <div className="text-sm font-bold mt-1" style={{ color: INK }}>${(i.product.price * i.qty).toFixed(2)}</div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center border" style={{ borderColor: INK }}>
                        <button onClick={() => updateQty(i.id, i.qty - 1)} className="h-7 w-7 flex items-center justify-center hover:bg-stone-100"><Minus size={11} /></button>
                        <span className="w-7 text-center text-xs font-bold">{i.qty}</span>
                        <button onClick={() => updateQty(i.id, i.qty + 1)} className="h-7 w-7 flex items-center justify-center hover:bg-stone-100"><Plus size={11} /></button>
                      </div>
                      <button onClick={() => updateQty(i.id, 0)} className="text-[10px] tracking-[0.2em] uppercase opacity-60 hover:opacity-100" style={{ color: INK }}>Remove</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer / Checkout */}
        {items.length > 0 && (
          <div className="border-t border-stone-300 p-5" style={{ backgroundColor: CANVAS_LIGHT }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs tracking-[0.2em] uppercase font-bold opacity-60" style={{ color: INK }}>Subtotal</span>
              <span className="text-2xl font-black" style={{ color: INK }}>${subtotal.toFixed(2)}</span>
            </div>
            <div className="text-[11px] text-stone-600 mb-4">Shipping & taxes calculated at checkout. {free ? "Shipping is on us." : ""}</div>
            <button
              onClick={checkout}
              disabled={checkingOut || !items.length}
              className="w-full py-4 text-sm tracking-[0.2em] uppercase font-bold transition-opacity disabled:opacity-50"
              style={{ backgroundColor: INK, color: CANVAS_LIGHT }}
            >
              <Lock size={14} className="inline mr-2" />
              {checkingOut ? 'Redirecting...' : 'Secure Checkout'}
            </button>
            <div className="mt-3 grid grid-cols-3 gap-2 text-[9px] tracking-[0.2em] uppercase font-bold text-stone-500 text-center">
              <div className="flex items-center gap-1.5 justify-center"><Lock size={11} /> Shopify</div>
              <div className="flex items-center gap-1.5 justify-center"><Truck size={11} /> 24h ship</div>
              <div className="flex items-center gap-1.5 justify-center"><RotateCcw size={11} /> 30-day</div>
            </div>
            <div className="mt-3 text-center text-[10px] tracking-[0.15em] uppercase opacity-50" style={{ color: INK }}>
              Powered by Shopify · PCI Secure
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ===================== Exit Intent Popup ===================== */
function ExitIntent({ shown, dismiss, accept }) {
  if (!shown) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={dismiss} />
      <div className="relative max-w-md w-full overflow-hidden" style={{ backgroundColor: CANVAS_LIGHT }}>
        <div className="aspect-[5/3]" style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&w=900&q=80')",
          backgroundSize: "cover", backgroundPosition: "center"
        }} />
        <button onClick={dismiss} className="absolute top-3 right-3 h-9 w-9 flex items-center justify-center rounded-full" style={{ backgroundColor: INK, color: CANVAS_LIGHT }} aria-label="Close">
          <X size={16} />
        </button>
        <div className="p-7">
          <div className="text-[10px] tracking-[0.3em] uppercase font-bold mb-3" style={{ color: COPPER_DEEP }}>The Espresso Dial-In Guide</div>
          <h3 className="text-2xl font-black tracking-tight mb-3" style={{ color: INK }}>
            Pulling thin shots? We can fix that.
          </h3>
          <p className="text-sm text-stone-700 mb-5 leading-relaxed">
            Drop your email — we'll send you our 12-page Espresso Dial-In Guide (the same one our roasters use) and 10% off your first bag.
          </p>
          <div className="flex flex-col gap-2">
            <input
              type="email"
              placeholder="your@email.com"
              className="w-full px-4 py-3 text-sm border focus:outline-none"
              style={{ borderColor: INK, backgroundColor: "transparent", color: INK }}
            />
            <CopperButton size="md" variant="ink" onClick={accept}>
              Send me the guide
            </CopperButton>
          </div>
          <button onClick={dismiss} className="block mx-auto mt-4 text-[10px] tracking-[0.2em] uppercase opacity-50 hover:opacity-80" style={{ color: INK }}>
            No thanks, I pull perfect shots
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===================== Root ===================== */
export default function SipHaven() {
  const [view, setView] = useState({ name: "home" });
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [exit, setExit] = useState({ shown: false, used: false });

  const go = (v) => {
    setView(v);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "instant" });
  };

  const addToCart = (id, qty = 1) => {
    setCart((cur) => {
      const existing = cur.find((c) => c.id === id);
      if (existing) return cur.map((c) => (c.id === id ? { ...c, qty: c.qty + qty } : c));
      return [...cur, { id, qty }];
    });
  };

  const cartCount = cart.reduce((s, c) => s + c.qty, 0);

  // Exit intent — fire once per session on cursor leaving viewport (desktop)
  useEffect(() => {
    if (exit.used) return;
    const handler = (e) => {
      if (e.clientY <= 5 && !exit.shown) setExit({ shown: true, used: true });
    };
    document.addEventListener("mouseleave", handler);
    // Mobile fallback: trigger after 25s of inactivity
    const t = setTimeout(() => {
      if (!exit.shown && !exit.used) setExit({ shown: true, used: true });
    }, 25000);
    return () => {
      document.removeEventListener("mouseleave", handler);
      clearTimeout(t);
    };
  }, [exit.shown, exit.used]);

  let content = null;
  if (view.name === "home") content = <Home go={go} addToCart={addToCart} />;
  else if (view.name === "shop-coffee") content = <ShopPage category="coffee" go={go} addToCart={addToCart} />;
  else if (view.name === "shop-gear") content = <ShopPage category="gear" go={go} addToCart={addToCart} />;
  else if (view.name === "product") content = <ProductDetail id={view.id} go={go} addToCart={addToCart} openCart={() => setCartOpen(true)} />;
  else if (view.name === "quiz") content = <Quiz go={go} addToCart={addToCart} openCart={() => setCartOpen(true)} />;
  else if (view.name === "story") content = <Story go={go} />;

  return (
    <div className="min-h-screen font-sans antialiased" style={{ backgroundColor: CANVAS_LIGHT, color: INK, fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Inter, sans-serif" }}>
      <Header go={go} cartCount={cartCount} openCart={() => setCartOpen(true)} view={view} />
      {content}
      <Footer go={go} />
      <CartDrawer open={cartOpen} close={() => setCartOpen(false)} cart={cart} setCart={setCart} />
      <ExitIntent
        shown={exit.shown}
        dismiss={() => setExit({ ...exit, shown: false })}
        accept={() => setExit({ ...exit, shown: false })}
      />
    </div>
  );
}