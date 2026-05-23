import React, { useState } from "react";
import { GlassCard } from "./design-system/glass-card";
import { NeuralLoader } from "./design-system/neural-loader";
import { NavButton } from "./design-system/nav-button";
import { Input } from "./design-system/atoms/input";
import { Badge } from "./design-system/atoms/badge";
import "./index.css";

// ============================================================================
// NavCloud Premium — Dashboard Shell
// ============================================================================

type View = "dashboard" | "search" | "billing";

export default function App() {
  const [view, setView] = useState<View>("dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  return (
    <div style={{ minHeight: "100vh", display: "flex" }}>
      {/* Sidebar */}
      <Sidebar currentView={view} onNavigate={setView} />

      {/* Main Content */}
      <main style={{ flex: 1, padding: "2rem", overflowY: "auto" }}>
        {view === "dashboard" && (
          <DashboardView
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            isSearching={isSearching}
            onSearch={() => {
              setIsSearching(true);
              setTimeout(() => setIsSearching(false), 2000);
            }}
          />
        )}
        {view === "search" && <SearchView />}
        {view === "billing" && <BillingView />}
      </main>
    </div>
  );
}

// ============================================================================
// Sidebar
// ============================================================================

function Sidebar({ currentView, onNavigate }: { currentView: View; onNavigate: (v: View) => void }) {
  const navItems: { id: View; label: string; icon: string }[] = [
    { id: "dashboard", label: "Drive", icon: "☁️" },
    { id: "search", label: "AI Search", icon: "🔍" },
    { id: "billing", label: "Billing", icon: "💳" },
  ];

  return (
    <aside
      style={{
        width: 260,
        background: "hsla(222, 30%, 7%, 0.9)",
        backdropFilter: "blur(20px)",
        borderRight: "1px solid hsla(220, 40%, 20%, 0.3)",
        padding: "1.5rem 1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
      }}
    >
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.5rem", marginBottom: "1.5rem" }}>
        <div
          style={{
            width: 36, height: 36, borderRadius: "10px",
            background: "linear-gradient(135deg, hsl(185, 90%, 55%), hsl(220, 75%, 55%))",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1.1rem", fontWeight: 700, color: "hsl(220, 30%, 8%)",
            boxShadow: "0 0 20px hsla(185, 90%, 55%, 0.3)",
          }}
        >
          N
        </div>
        <div>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "1.1rem", color: "hsl(220, 20%, 95%)" }}>
            NavCloud
          </div>
          <div style={{ fontSize: "0.6875rem", color: "hsl(220, 15%, 50%)", letterSpacing: "0.08em", textTransform: "uppercase" as const }}>
            Premium
          </div>
        </div>
      </div>

      {/* Navigation */}
      {navItems.map((item) => {
        const isActive = currentView === item.id;
        return (
          <button
            key={item.id}
            id={`nav-${item.id}`}
            onClick={() => onNavigate(item.id)}
            style={{
              display: "flex", alignItems: "center", gap: "0.75rem",
              padding: "0.625rem 0.875rem", borderRadius: "10px",
              background: isActive ? "hsla(185, 90%, 55%, 0.1)" : "transparent",
              border: isActive ? "1px solid hsla(185, 90%, 55%, 0.2)" : "1px solid transparent",
              color: isActive ? "hsl(185, 90%, 55%)" : "hsl(220, 15%, 60%)",
              cursor: "pointer", fontSize: "0.875rem", fontWeight: isActive ? 500 : 400,
              fontFamily: "'Inter', sans-serif", textAlign: "left" as const,
              transition: "all 200ms ease",
            }}
          >
            <span>{item.icon}</span>
            {item.label}
          </button>
        );
      })}

      {/* Plan Badge */}
      <div style={{ marginTop: "auto", padding: "0.5rem" }}>
        <GlassCard variant="accent">
          <div style={{ fontSize: "0.75rem", color: "hsl(185, 70%, 60%)", marginBottom: "0.25rem" }}>Current Plan</div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Badge variant="accent" glow>PRO</Badge>
            <span style={{ fontSize: "0.8125rem", color: "hsl(220, 20%, 85%)" }}>5 GB / 500 GB</span>
          </div>
        </GlassCard>
      </div>
    </aside>
  );
}

// ============================================================================
// Dashboard View
// ============================================================================

function DashboardView({
  searchQuery, setSearchQuery, isSearching, onSearch,
}: {
  searchQuery: string; setSearchQuery: (v: string) => void;
  isSearching: boolean; onSearch: () => void;
}) {
  const mockFiles = [
    { name: "Q4 Revenue Report.pdf", type: "application/pdf", size: "2.4 MB", tags: ["finance", "quarterly", "revenue"], summary: "Quarterly revenue analysis showing 23% YoY growth." },
    { name: "Product Roadmap 2026.pptx", type: "presentation", size: "8.1 MB", tags: ["strategy", "product", "roadmap"], summary: "Strategic product roadmap with 6 major feature releases planned." },
    { name: "Team Photo - Offsite.jpg", type: "image/jpeg", size: "4.2 MB", tags: ["team", "event", "photo"], summary: "Group photo from the annual company offsite in March 2026." },
    { name: "API Integration Guide.md", type: "text/markdown", size: "156 KB", tags: ["documentation", "api", "technical"], summary: "Step-by-step guide for integrating NavCloud REST API." },
    { name: "Invoice #4821.pdf", type: "application/pdf", size: "340 KB", tags: ["invoice", "billing", "legal"], summary: "Service invoice from legal counsel dated March 15, 2026." },
    { name: "ML Model Weights.h5", type: "application/x-hdf5", size: "1.2 GB", tags: ["machine-learning", "model", "ai"], summary: "Trained neural network weights for image classification." },
  ];

  return (
    <div className="nc-animate-fade-in">
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.75rem", fontWeight: 700, color: "hsl(220, 20%, 95%)", marginBottom: "0.5rem" }}>
          My Drive
        </h1>
        <p style={{ color: "hsl(220, 15%, 55%)", fontSize: "0.9rem" }}>
          6 files · 1.22 GB used · AI insights enabled
        </p>
      </div>

      {/* Semantic Search Bar */}
      <GlassCard variant="default" style={{ marginBottom: "1.5rem", padding: "1rem 1.25rem" }}>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <span style={{ fontSize: "1.1rem" }}>🔍</span>
          <Input
            id="semantic-search"
            placeholder='Try: "the paper I signed with the lawyer in March"'
            value={searchQuery}
            onChange={setSearchQuery}
          />
          <NavButton variant="accent" size="sm" onClick={onSearch} loading={isSearching}>
            Search
          </NavButton>
        </div>
        {isSearching && (
          <div style={{ marginTop: "1rem", display: "flex", justifyContent: "center" }}>
            <NeuralLoader size="sm" label="Searching with AI..." variant="wave" />
          </div>
        )}
      </GlassCard>

      {/* Live Folders */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1rem", fontWeight: 600, color: "hsl(220, 15%, 65%)", marginBottom: "0.75rem", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
          Live Folders
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "0.75rem" }}>
          {[
            { icon: "📄", name: "Tax Documents", count: 12, rule: "tag:tax" },
            { icon: "🖼️", name: "Photos & Media", count: 48, rule: "type:image/*" },
            { icon: "⚖️", name: "Legal Papers", count: 7, rule: "tag:legal" },
          ].map((folder) => (
            <GlassCard key={folder.name} variant="interactive" style={{ padding: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.375rem" }}>
                <span style={{ fontSize: "1.25rem" }}>{folder.icon}</span>
                <span style={{ fontWeight: 500, fontSize: "0.875rem", color: "hsl(220, 20%, 90%)" }}>{folder.name}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.75rem", color: "hsl(220, 15%, 50%)" }}>{folder.count} files</span>
                <Badge variant="default" size="sm">{folder.rule}</Badge>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>

      {/* File Grid */}
      <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1rem", fontWeight: 600, color: "hsl(220, 15%, 65%)", marginBottom: "0.75rem", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
        Recent Files
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "0.875rem" }}>
        {mockFiles.map((file) => (
          <GlassCard key={file.name} variant="interactive" style={{ padding: "1.125rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
              <div style={{ fontWeight: 500, fontSize: "0.875rem", color: "hsl(220, 20%, 92%)", maxWidth: "75%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                {file.name}
              </div>
              <span style={{ fontSize: "0.75rem", color: "hsl(220, 15%, 45%)" }}>{file.size}</span>
            </div>
            <p style={{ fontSize: "0.8125rem", color: "hsl(220, 15%, 55%)", marginBottom: "0.625rem", lineHeight: 1.4 }}>
              {file.summary}
            </p>
            <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" as const }}>
              {file.tags.map((tag) => (
                <Badge key={tag} variant="accent" size="sm">{tag}</Badge>
              ))}
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Search View
// ============================================================================

function SearchView() {
  return (
    <div className="nc-animate-fade-in">
      <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.75rem", fontWeight: 700, color: "hsl(220, 20%, 95%)", marginBottom: "0.5rem" }}>
        <span className="nc-gradient-text">AI-Powered</span> Semantic Search
      </h1>
      <p style={{ color: "hsl(220, 15%, 55%)", fontSize: "0.9rem", marginBottom: "2rem" }}>
        Search your files using natural language. Powered by Gemini embeddings & pgvector.
      </p>

      <GlassCard variant="elevated" glow style={{ maxWidth: 600, margin: "0 auto", textAlign: "center" as const }}>
        <NeuralLoader size="lg" label="Vector search ready" variant="orbit" />
        <div style={{ marginTop: "1.5rem" }}>
          <NavButton variant="accent" size="lg">
            Start Searching
          </NavButton>
        </div>
      </GlassCard>
    </div>
  );
}

// ============================================================================
// Billing View
// ============================================================================

function BillingView() {
  return (
    <div className="nc-animate-fade-in">
      <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.75rem", fontWeight: 700, color: "hsl(220, 20%, 95%)", marginBottom: "0.5rem" }}>
        Usage & Billing
      </h1>
      <p style={{ color: "hsl(220, 15%, 55%)", fontSize: "0.9rem", marginBottom: "2rem" }}>
        Real-time consumption tracking. Usage-based pricing.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
        {/* Storage Card */}
        <GlassCard variant="default">
          <div style={{ fontSize: "0.8125rem", color: "hsl(220, 15%, 55%)", marginBottom: "0.5rem" }}>Storage Used</div>
          <div style={{ fontSize: "2rem", fontFamily: "'Outfit', sans-serif", fontWeight: 700, color: "hsl(220, 20%, 95%)" }}>
            5.2 <span style={{ fontSize: "1rem", color: "hsl(220, 15%, 50%)" }}>GB</span>
          </div>
          <div style={{ marginTop: "0.75rem", height: 6, background: "hsla(220, 25%, 18%, 0.8)", borderRadius: 100, overflow: "hidden" }}>
            <div style={{ width: "10.4%", height: "100%", background: "linear-gradient(90deg, hsl(185, 90%, 55%), hsl(220, 75%, 55%))", borderRadius: 100, transition: "width 1s ease" }} />
          </div>
          <div style={{ fontSize: "0.75rem", color: "hsl(220, 15%, 45%)", marginTop: "0.375rem" }}>10.4% of 50 GB</div>
        </GlassCard>

        {/* AI Credits Card */}
        <GlassCard variant="default">
          <div style={{ fontSize: "0.8125rem", color: "hsl(220, 15%, 55%)", marginBottom: "0.5rem" }}>AI Credits</div>
          <div style={{ fontSize: "2rem", fontFamily: "'Outfit', sans-serif", fontWeight: 700, color: "hsl(220, 20%, 95%)" }}>
            127 <span style={{ fontSize: "1rem", color: "hsl(220, 15%, 50%)" }}>/ 500</span>
          </div>
          <div style={{ marginTop: "0.75rem", height: 6, background: "hsla(220, 25%, 18%, 0.8)", borderRadius: 100, overflow: "hidden" }}>
            <div style={{ width: "25.4%", height: "100%", background: "linear-gradient(90deg, hsl(155, 75%, 50%), hsl(185, 90%, 55%))", borderRadius: 100 }} />
          </div>
          <div style={{ fontSize: "0.75rem", color: "hsl(220, 15%, 45%)", marginTop: "0.375rem" }}>25.4% used this month</div>
        </GlassCard>

        {/* Plan Card */}
        <GlassCard variant="accent" glow>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <span style={{ fontSize: "0.8125rem", color: "hsl(185, 70%, 65%)" }}>Current Plan</span>
            <Badge variant="accent" glow>PRO</Badge>
          </div>
          <div style={{ fontSize: "1.5rem", fontFamily: "'Outfit', sans-serif", fontWeight: 700, color: "hsl(220, 20%, 95%)" }}>
            $12<span style={{ fontSize: "0.875rem", color: "hsl(220, 15%, 55%)" }}>/mo</span>
          </div>
          <NavButton variant="secondary" size="sm" fullWidth style={{ marginTop: "1rem" }}>
            Manage Subscription
          </NavButton>
        </GlassCard>
      </div>
    </div>
  );
}
