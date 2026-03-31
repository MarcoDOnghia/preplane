import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink, ChevronDown, ChevronUp, X } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { sanitizeInput } from "@/lib/sanitizeText";
import { Helmet } from "react-helmet-async";

interface ProofCardData {
  one_liner: string;
  ask: string;
  insights: string[];
  image_url: string | null;
  loom_url: string | null;
  doc_url: string;
  assumption: string | null;
  next_48h: string;
  published: boolean;
  user_id: string;
  slug: string;
}

export default function ProofCard() {
  const { slug } = useParams<{ slug: string }>();
  const [card, setCard] = useState<ProofCardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [zoomImage, setZoomImage] = useState(false);
  const [showWhatIsThis, setShowWhatIsThis] = useState(false);
  const [firstName, setFirstName] = useState("");

  useEffect(() => {
    if (!slug) return;
    supabase
      .from("public_proof_cards")
      .select("*")
      .eq("slug", slug)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!data || error) {
          setNotFound(true);
        } else {
          setCard(data as any);
          // Extract first name from slug: company-role-firstname
          const parts = slug.split("-");
          if (parts.length >= 3) {
            const fn = parts[parts.length - 1];
            setFirstName(fn.charAt(0).toUpperCase() + fn.slice(1));
          }
        }
        setLoading(false);
      });
  }, [slug]);

  if (loading) {
    return (
      <div style={{ backgroundColor: '#111111', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="animate-spin h-8 w-8 border-4 border-[#F97416] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (notFound || !card) {
    return (
      <div style={{ backgroundColor: '#111111', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#94A3B8', fontSize: '16px' }}>This proof card isn't published yet.</p>
      </div>
    );
  }

  const ogUrl = `https://preplane.co/p/${slug}`;

  return (
    <>
      <Helmet>
        <title>{`Proof of Work — ${card.one_liner}`}</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="description" content="60-second summary. Asking for 1 piece of feedback." />
        <meta property="og:title" content={`Proof of Work — ${card.one_liner}`} />
        <meta property="og:description" content="60-second summary. Asking for 1 piece of feedback." />
        {card.image_url && <meta property="og:image" content={card.image_url} />}
        <meta property="og:url" content={ogUrl} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`Proof of Work — ${card.one_liner}`} />
        <meta name="twitter:description" content="60-second summary. Asking for 1 piece of feedback." />
        {card.image_url && <meta name="twitter:image" content={card.image_url} />}
      </Helmet>

      <div style={{ backgroundColor: '#111111', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
        {/* TOP TRUST BAR */}
        <div style={{ backgroundColor: '#1A1A1A', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#64748B', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>🚀 PrepLane Proof of Work</span>
          <span style={{ color: '#64748B', fontSize: '12px' }}>Built by {firstName || "someone"}</span>
        </div>
        <p style={{ color: '#64748B', fontSize: '11px', textAlign: 'center', padding: '8px 0' }}>
          Public page · No login · No attachments · No downloads · ~45 sec read
        </p>

        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          {/* SECTION 1 — One-liner */}
          <h1 style={{ color: '#ffffff', fontSize: '22px', fontWeight: 700, lineHeight: 1.3, margin: '24px 0 16px', padding: '0 20px' }}>
            {card.one_liner}
          </h1>

          {/* SECTION 2 — The Ask */}
          <div style={{ backgroundColor: 'rgba(249,116,22,0.08)', border: '1px solid rgba(249,116,22,0.2)', borderRadius: '8px', padding: '16px 20px', margin: '0 20px 24px' }}>
            <p style={{ color: '#ffffff', fontSize: '15px', lineHeight: 1.6 }}>{card.ask}</p>
            <p style={{ color: '#94A3B8', fontSize: '12px', fontStyle: 'italic', marginTop: '8px' }}>A yes/no is enough.</p>
          </div>

          {/* SECTION 3 — Three findings */}
          <p style={{ color: '#F97416', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, padding: '0 20px', marginBottom: '12px' }}>
            WHAT I FOUND
          </p>
          {(card.insights || []).map((insight, i) => (
            <div key={i} style={{ backgroundColor: '#1A1A1A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '14px 16px', margin: '0 20px 8px' }}>
              <p style={{ color: '#ffffff', fontSize: '14px', lineHeight: 1.6 }}>
                <span style={{ color: '#F97416', marginRight: '8px' }}>→</span>{insight}
              </p>
            </div>
          ))}

          {/* SECTION 4 — Visual */}
          {card.image_url && (
            <div style={{ margin: '24px 0', cursor: 'pointer' }} onClick={() => setZoomImage(true)}>
              <img src={card.image_url} alt="Proof visual" style={{ width: '100%', borderRadius: 0 }} />
            </div>
          )}

          {/* SECTION 5 — Links row */}
          <div style={{ padding: '0 20px', display: 'flex', flexWrap: 'wrap', gap: '12px', margin: '24px 0' }}>
            {card.loom_url && (
              <a
                href={card.loom_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ backgroundColor: '#F97416', color: '#ffffff', fontWeight: 700, fontSize: '14px', borderRadius: '8px', padding: '12px 20px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                Watch 60-sec walkthrough →
              </a>
            )}
            <a
              href={card.doc_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ backgroundColor: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: '#ffffff', fontSize: '14px', borderRadius: '8px', padding: '12px 20px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              See full deliverable →
            </a>
          </div>

          {/* SECTION 6 — Credibility footer */}
          <div style={{ backgroundColor: '#1A1A1A', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '20px', margin: '24px 20px' }}>
            {card.assumption && (
              <p style={{ color: '#94A3B8', fontSize: '13px', fontStyle: 'italic', marginBottom: '8px' }}>Assumption: {card.assumption}</p>
            )}
            <p style={{ color: '#ffffff', fontSize: '14px', fontWeight: 500 }}>{card.next_48h}</p>
          </div>

          {/* SECTION 7 — Page footer */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '20px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
            <div>
              <span style={{ color: '#64748B', fontSize: '13px' }}>Built with PrepLane</span>
              <span style={{ color: '#64748B', fontSize: '13px', margin: '0 6px' }}>·</span>
              <button
                onClick={() => setShowWhatIsThis(!showWhatIsThis)}
                style={{ color: '#F97416', fontSize: '13px', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                What is this?
              </button>
              {showWhatIsThis && (
                <p style={{ color: '#94A3B8', fontSize: '12px', marginTop: '8px', lineHeight: 1.6 }}>
                  PrepLane helps students land startup internships through proof of work, not CVs.{" "}
                  <a href="https://preplane.co" target="_blank" rel="noopener noreferrer" style={{ color: '#F97416' }}>preplane.co</a>
                </p>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ color: '#64748B', fontSize: '13px' }}>Want to do this for your target company?</p>
              <a href="https://preplane.co" target="_blank" rel="noopener noreferrer" style={{ color: '#F97416', fontSize: '13px', fontWeight: 600 }}>Start free →</a>
            </div>
          </div>

          {/* Report abuse */}
          <div style={{ textAlign: 'center', padding: '0 20px 24px' }}>
            <a
              href={`mailto:marco@preplane.co?subject=${encodeURIComponent(`Report: preplane.co/p/${slug}`)}`}
              style={{ color: '#64748B', fontSize: '12px', textDecoration: 'none' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#94A3B8'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#64748B'; }}
            >
              Report abuse →
            </a>
          </div>
        </div>

        {/* Image zoom modal */}
        {zoomImage && card.image_url && (
          <div
            onClick={() => setZoomImage(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 50, backgroundColor: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <img src={card.image_url} alt="Proof visual zoomed" style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }} />
          </div>
        )}
      </div>
    </>
  );
}
