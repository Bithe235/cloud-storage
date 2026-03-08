"use client";

import Link from "next/link";
import { useAuth } from "./context/AuthContext";

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen grid-bg">
      {/* Navbar */}
      <nav className="border-b-[3px] border-[#1A1A1A] bg-white sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[var(--accent-coral)] border-[3px] border-[#1A1A1A] rotate-12 rounded-sm" />
            <span className="text-xl font-bold tracking-tight">Pentaract Cloud</span>
          </Link>
          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-4 font-bold text-sm">
              <Link href="#features" className="hover:text-[var(--accent-coral)] transition-colors">Features</Link>
              <Link href="#pricing" className="hover:text-[var(--accent-coral)] transition-colors">Pricing</Link>
            </div>
            <div className="flex items-center gap-3">
            {user ? (
              <Link href="/dashboard" className="brutalist-btn brutalist-btn-primary">
                Dashboard →
              </Link>
            ) : (
              <>
                <Link href="/login" className="brutalist-btn brutalist-btn-secondary">
                  Log In
                </Link>
                <Link href="/register" className="brutalist-btn brutalist-btn-primary">
                  Sign Up Free
                </Link>
              </>
            )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16">
        <div className="relative">
          {/* Decorative shapes */}
          <div className="floating-shape w-16 h-16 bg-[var(--accent-yellow)] rounded-full top-0 right-20 hidden md:block" />
          <div className="floating-shape w-12 h-12 bg-[var(--accent-mint)] top-24 right-8 rotate-45 hidden md:block" />
          <div className="floating-shape w-10 h-10 bg-[var(--accent-lavender)] rounded-full bottom-0 left-20 hidden md:block" />

          <div className="relative z-10 max-w-2xl">
            <div className="brutalist-badge bg-[var(--accent-yellow)] mb-6">
              🎓 Free for Students
            </div>
            <h1 className="text-5xl md:text-6xl font-bold leading-tight tracking-tight mb-6">
              Cloud Storage
              <br />
              <span className="text-[var(--accent-coral)]">Built for</span>
              <br />
              Developers
            </h1>
            <p className="text-lg text-[var(--text-secondary)] mb-8 max-w-lg leading-relaxed">
              Create buckets, upload files, generate API keys. Everything you need to learn cloud infrastructure — without the AWS bill.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/register" className="brutalist-btn brutalist-btn-primary brutalist-btn-lg">
                🚀 Get Started Free
              </Link>
              <Link href="#features" className="brutalist-btn brutalist-btn-secondary brutalist-btn-lg">
                Learn More ↓
              </Link>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16">
          {[
            { value: "5GB", label: "Free Storage" },
            { value: "∞", label: "API Calls" },
            { value: "S3", label: "Compatible" },
            { value: "0$", label: "For Students" },
          ].map((stat, i) => (
            <div key={i} className="brutalist-card-static p-5 text-center">
              <div className="text-3xl font-bold text-[var(--accent-coral)]">{stat.value}</div>
              <div className="text-sm text-[var(--text-muted)] mt-1 font-medium">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-[var(--bg-secondary)] border-y-[3px] border-[#1A1A1A] py-16">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12">
            Everything You Need to <span className="text-[var(--accent-sky)]">Learn Cloud</span>
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: "🪣",
                title: "Bucket Management",
                desc: "Create and manage storage buckets like AWS S3. Organize your data with familiar cloud patterns.",
                color: "var(--accent-coral)",
              },
              {
                icon: "📁",
                title: "File Browser",
                desc: "Visual file manager with drag-and-drop uploads, folder creation, and instant search.",
                color: "var(--accent-mint)",
              },
              {
                icon: "🔑",
                title: "API Keys",
                desc: "Generate API keys and integrate cloud storage into your own applications with our REST API.",
                color: "var(--accent-lavender)",
              },
              {
                icon: "📡",
                title: "REST API",
                desc: "Full REST API with code snippets in cURL, Python, and Node.js. Learn by building.",
                color: "var(--accent-sky)",
              },
              {
                icon: "🔒",
                title: "Access Control",
                desc: "Set read, write, or admin permissions per bucket. Learn IAM patterns hands-on.",
                color: "var(--accent-yellow)",
              },
              {
                icon: "⚡",
                title: "Zero Config",
                desc: "No credit card, no AWS account, no complex setup. Sign up and start building in seconds.",
                color: "var(--accent-orange)",
              },
            ].map((feature, i) => (
              <div key={i} className="brutalist-card p-6">
                <div
                  className="w-12 h-12 flex items-center justify-center text-2xl rounded-lg border-[3px] border-[#1A1A1A] mb-4"
                  style={{ background: feature.color }}
                >
                  {feature.icon}
                </div>
                <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Code Example */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div>
            <h2 className="text-3xl font-bold mb-4">
              Integrate in <span className="text-[var(--accent-mint)]">Minutes</span>
            </h2>
            <p className="text-[var(--text-secondary)] mb-6 leading-relaxed">
              Use our REST API to upload files, create buckets, and manage your cloud storage programmatically. Perfect for learning backend development.
            </p>
            <Link href="/register" className="brutalist-btn brutalist-btn-mint">
              Get Your API Key →
            </Link>
          </div>
          <div className="code-block">
            <pre className="whitespace-pre-wrap">
              <span className="comment">{"// Upload a file with Pentaract API"}</span>
              {"\n"}
              <span className="keyword">const</span> response = <span className="keyword">await</span> <span className="function">fetch</span>(
              {"\n"}  <span className="string">{`"https://api.pentaract.cloud/buckets/my-bucket/files"`}</span>,
              {"\n"}  {"{"}{"\n"}    method: <span className="string">{`"POST"`}</span>,
              {"\n"}    headers: {"{"}{"\n"}      Authorization: <span className="string">{`\`Bearer \${API_KEY}\``}</span>
              {"\n"}    {"}"},
              {"\n"}    body: formData
              {"\n"}  {"}"}
              {"\n"});
            </pre>
          </div>
        </div>
      </section>

      {/* Pricing Plans */}
      <section id="pricing" className="bg-[var(--bg-secondary)] border-t-[3px] border-[#1A1A1A] py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
            <p className="text-lg text-[var(--text-secondary)]">Start free, upgrade when you need more power.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                name: "Student Tier",
                storage: "100GB",
                price: "190",
                color: "var(--accent-sky)",
                features: ["Secure Redundant Storage", "Unlimited Buckets", "API Access"],
                highlight: false
              },
              {
                name: "Pro Builder",
                storage: "300GB",
                price: "399",
                color: "var(--accent-coral)",
                features: ["Secure Redundant Storage", "Unlimited Buckets", "API Access", "Priority Speed"],
                highlight: true
              },
              {
                name: "Cloud Master",
                storage: "1TB",
                price: "440",
                color: "var(--accent-lavender)",
                features: ["Secure Redundant Storage", "Unlimited Buckets", "API Access", "Priority Speed"],
                highlight: false
              }
            ].map((plan, i) => (
              <div 
                key={i} 
                className={`brutalist-card p-8 flex flex-col relative ${plan.highlight ? 'ring-4 ring-[var(--accent-coral)] ring-offset-4 scale-105 z-10' : ''}`}
                style={{ backgroundColor: 'white' }}
              >
                {plan.highlight && (
                  <div className="absolute top-0 right-0 translate-x-2 -translate-y-2 bg-[var(--accent-coral)] text-white text-xs font-bold px-3 py-1 border-[3px] border-[#1A1A1A] rotate-3">
                    MOST POPULAR
                  </div>
                )}
                
                <h3 className="text-2xl font-black mb-2">{plan.name}</h3>
                <div className="mb-6">
                  <span className="text-5xl font-black" style={{ color: plan.color }}>{plan.storage}</span>
                  <div className="text-[var(--text-muted)] font-bold mt-2">
                    <span className="text-xl">{plan.price} BDT</span> / month
                  </div>
                </div>
                
                <ul className="space-y-3 mb-8 flex-1 font-semibold text-sm">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-center gap-2">
                      <span>✅</span> {feature}
                    </li>
                  ))}
                </ul>

                <Link 
                  href={user ? "/dashboard/billing" : "/register"} 
                  className={`w-full brutalist-btn text-center ${plan.highlight ? 'brutalist-btn-primary' : 'brutalist-btn-secondary'}`}
                  style={plan.highlight ? { backgroundColor: plan.color } : {}}
                >
                  Purchase Now
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t-[3px] border-[#1A1A1A] bg-white py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[var(--accent-coral)] border-2 border-[#1A1A1A] rotate-12 rounded-sm" />
            <span className="font-bold">Pentaract Cloud</span>
          </div>
          <p className="text-sm text-[var(--text-muted)]">
            © 2026 Pentaract. Free cloud storage for students.
          </p>
        </div>
      </footer>
    </div>
  );
}
