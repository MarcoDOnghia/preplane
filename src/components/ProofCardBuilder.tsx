import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeInput } from "@/lib/sanitizeText";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, X, Copy, Check, AlertTriangle, Image as ImageIcon, ExternalLink } from "lucide-react";

interface ProofCardBuilderProps {
  campaignId: string;
  company: string;
  role: string;
  toast: any;
}

const ROLE_48H: Record<string, string> = {
  sdr: "If you reply, I'll send the full prospect list filtered to your top 5 highest-intent targets within 48 hours.",
  sales: "If you reply, I'll send the full prospect list filtered to your top 5 highest-intent targets within 48 hours.",
  bdr: "If you reply, I'll send the full prospect list filtered to your top 5 highest-intent targets within 48 hours.",
  marketing: "If you reply, I'll deliver 3 above-the-fold variants and a 7-day test plan within 48 hours.",
  growth: "If you reply, I'll deliver 3 above-the-fold variants and a 7-day test plan within 48 hours.",
  product: "If you reply, I'll send the full Figma file with 3 alternative versions within 48 hours.",
  design: "If you reply, I'll send the full Figma file with 3 alternative versions within 48 hours.",
  ux: "If you reply, I'll send the full Figma file with 3 alternative versions within 48 hours.",
  engineer: "If you reply, I'll send the full repo with documentation and a recorded demo within 48 hours.",
  developer: "If you reply, I'll send the full repo with documentation and a recorded demo within 48 hours.",
  software: "If you reply, I'll send the full repo with documentation and a recorded demo within 48 hours.",
  finance: "If you reply, I'll send the complete model with 3 scenario variations within 48 hours.",
  vc: "If you reply, I'll send the complete model with 3 scenario variations within 48 hours.",
  venture: "If you reply, I'll send the complete model with 3 scenario variations within 48 hours.",
};

const ROLE_ASSUMPTIONS: Record<string, string> = {
  sdr: "This works if {company} is currently prioritizing top-of-funnel volume over deal quality.",
  sales: "This works if {company} is currently prioritizing top-of-funnel volume over deal quality.",
  bdr: "This works if {company} is currently prioritizing top-of-funnel volume over deal quality.",
  marketing: "This works if the current hero is the primary conversion bottleneck.",
  growth: "This works if the current hero is the primary conversion bottleneck.",
  product: "This works if the friction point I identified is on the critical user path.",
  design: "This works if the friction point I identified is on the critical user path.",
  ux: "This works if the friction point I identified is on the critical user path.",
  engineer: "This works if this task is currently done manually by the team.",
  developer: "This works if this task is currently done manually by the team.",
  software: "This works if this task is currently done manually by the team.",
  finance: "This works if the assumptions in the model hold for your specific market.",
  vc: "This works if the assumptions in the model hold for your specific market.",
  venture: "This works if the assumptions in the model hold for your specific market.",
};

const ROLE_EXAMPLES: Record<string, string> = {
  sdr: 'e.g. "I built a 50-lead prospect list for JetHR to increase top-of-funnel pipeline."',
  sales: 'e.g. "I built a competitive teardown for Acme to reposition against their top 3 competitors."',
  marketing: 'e.g. "I built 3 landing page variants for Stripe to improve above-the-fold conversion."',
  product: 'e.g. "I redesigned the onboarding flow for Linear to reduce time-to-first-value."',
  design: 'e.g. "I created a component library for Figma to standardize the design system."',
  engineer: 'e.g. "I built an API integration for Notion to automate weekly reporting."',
  finance: 'e.g. "I built a financial model for Deel to forecast ARR under 3 growth scenarios."',
};

const DELIVERABLE_NOUNS = ["list", "variants", "sequence", "plan", "model", "repo", "file", "demo", "analysis", "report", "framework", "teardown", "audit", "dashboard", "template"];

function get48hDefault(role: string): string {
  const r = role.toLowerCase();
  for (const [key, val] of Object.entries(ROLE_48H)) {
    if (r.includes(key)) return val;
  }
  return "If you reply, I'll deliver [specific next step] within 48 hours.";
}

function getAssumptionDefault(role: string, company: string): string {
  const r = role.toLowerCase();
  for (const [key, val] of Object.entries(ROLE_ASSUMPTIONS)) {
    if (r.includes(key)) return val.replace("{company}", company);
  }
  return "This works if [your core assumption] holds.";
}

function getRoleExample(role: string): string {
  const r = role.toLowerCase();
  for (const [key, val] of Object.entries(ROLE_EXAMPLES)) {
    if (r.includes(key)) return val;
  }
  return 'e.g. "I built {deliverable} for {company} to {outcome}."';
}

function generateSlug(company: string, role: string, firstName: string): string {
  return `${company}-${role}-${firstName}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function ProofCardBuilder({ campaignId, company, role, toast }: ProofCardBuilderProps) {
  const { user } = useAuth();

  // Field states
  const [oneLiner, setOneLiner] = useState("");
  const [ask, setAsk] = useState("Could you reply with 1 piece of feedback — what's the biggest flaw or missing piece? A yes/no is enough.");
  const [findings, setFindings] = useState(["", "", ""]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loomUrl, setLoomUrl] = useState("");
  const [docUrl, setDocUrl] = useState("");
  const [assumption, setAssumption] = useState("");
  const [assumptionEditing, setAssumptionEditing] = useState(false);
  const [assumptionInitialized, setAssumptionInitialized] = useState(false);
  const [next48h, setNext48h] = useState(get48hDefault(role));
  const [next48hEditing, setNext48hEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [existingCard, setExistingCard] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [descCopied, setDescCopied] = useState(false);
  const [dmCopied, setDmCopied] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [loaded, setLoaded] = useState(false);

  // FIX 4 — Visual gating state
  const [showImageGate, setShowImageGate] = useState(false);
  const [imageGateChecked, setImageGateChecked] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageFieldRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const existingCardRef = useRef(existingCard);

  useEffect(() => { existingCardRef.current = existingCard; }, [existingCard]);

  // Auto-save draft to Supabase
  const saveDraft = useCallback(async (fields: {
    oneLiner: string; ask: string; findings: string[]; imageUrl: string | null;
    loomUrl: string; docUrl: string; assumption: string; next48h: string;
  }) => {
    if (!user) return;
    const card = existingCardRef.current;
    setSaveStatus("saving");
    try {
      const firstName = user.user_metadata?.display_name?.split(" ")[0] || user.email?.split("@")[0] || "user";
      const slug = card?.slug || generateSlug(company, role, firstName);

      const cardData = {
        campaign_id: campaignId,
        user_id: user.id,
        slug,
        one_liner: sanitizeInput(fields.oneLiner, 200),
        ask: sanitizeInput(fields.ask, 1000),
        insights: fields.findings.map(f => sanitizeInput(f, 500)),
        image_url: fields.imageUrl,
        loom_url: fields.loomUrl || null,
        doc_url: fields.docUrl || null,
        assumption: fields.assumption ? sanitizeInput(fields.assumption, 500) : null,
        next_48h: sanitizeInput(fields.next48h, 500),
        published: card?.published || false,
      };

      if (card) {
        const { data, error } = await supabase.from("proof_cards").update(cardData).eq("id", card.id).select().single();
        if (error) throw error;
        setExistingCard((prev: any) => ({ ...prev, ...data }));
      } else {
        // Check slug uniqueness for new card
        const { data: existingSlugs } = await supabase.from("proof_cards").select("slug").like("slug", `${slug}%`);
        let finalSlug = slug;
        if (existingSlugs && existingSlugs.length > 0) {
          const slugSet = new Set(existingSlugs.map((e: any) => e.slug));
          if (slugSet.has(slug)) {
            let i = 2;
            while (slugSet.has(`${slug}-${i}`)) i++;
            finalSlug = `${slug}-${i}`;
          }
        }
        const { data, error } = await supabase.from("proof_cards").insert({ ...cardData, slug: finalSlug }).select().single();
        if (error) throw error;
        setExistingCard(data);
      }

      setSaveStatus("saved");
      setTimeout(() => setSaveStatus((s) => s === "saved" ? "idle" : s), 3000);
    } catch {
      setSaveStatus("error");
    }
  }, [user, campaignId, company, role]);

  const scheduleSave = useCallback((fields: Parameters<typeof saveDraft>[0]) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => saveDraft(fields), 300);
  }, [saveDraft]);

  const getCurrentFields = () => ({ oneLiner, ask, findings, imageUrl, loomUrl, docUrl, assumption, next48h });

  const handleBlurSave = () => {
    if (!loaded) return;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    saveDraft(getCurrentFields());
  };

  // Wrapped setters that trigger debounced save
  const updateField = <T,>(setter: React.Dispatch<React.SetStateAction<T>>, value: T, overrides: Partial<ReturnType<typeof getCurrentFields>> = {}) => {
    setter(value);
    setTimeout(() => {
      const fields = { ...getCurrentFields(), ...overrides };
      scheduleSave(fields);
    }, 0);
  };

  // Load existing card
  useEffect(() => {
    if (!user) return;
    supabase
      .from("proof_cards")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setExistingCard(data);
          setOneLiner(data.one_liner || "");
          setAsk(data.ask || "Could you reply with 1 piece of feedback — what's the biggest flaw or missing piece? A yes/no is enough.");
          const ins = data.insights as string[] | null;
          if (ins && ins.length === 3) setFindings(ins);
          setImageUrl(data.image_url || null);
          setLoomUrl(data.loom_url || "");
          setDocUrl(data.doc_url || "");
          setAssumption(data.assumption || "");
          setAssumptionInitialized(true);
          setNext48h(data.next_48h || get48hDefault(role));
          if (data.published) {
            setPublishedUrl(`${window.location.origin}/p/${data.slug}`);
          }
        } else {
          // Pre-fill assumption for new cards
          setAssumption(getAssumptionDefault(role, company));
          setAssumptionInitialized(true);
        }
        setLoaded(true);
      });
  }, [campaignId, user]);

  // Validations
  const askValid = /feedback|flaw|thoughts/i.test(ask);
  const loomValid = !loomUrl || loomUrl.includes("loom.com");
  const docValid = !docUrl || /^https?:\/\/.+/.test(docUrl);
  const next48hValid = DELIVERABLE_NOUNS.some((n) => next48h.toLowerCase().includes(n));

  const canGenerate =
    oneLiner.trim().length > 0 &&
    ask.trim().length > 0 &&
    askValid &&
    findings.every((f) => f.trim().length > 0) &&
    docUrl.trim().length > 0 &&
    docValid &&
    next48h.trim().length > 0;

  const handleImageUpload = async (file: File) => {
    if (!user) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 10MB", variant: "destructive" });
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["png", "jpg", "jpeg", "webp"].includes(ext || "")) {
      toast({ title: "Invalid file type", description: "Use PNG, JPG, or WebP", variant: "destructive" });
      return;
    }
    setUploading(true);
    const path = `${user.id}/${campaignId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("proof-cards").upload(path, file);
    if (error) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("proof-cards").getPublicUrl(path);
    const newUrl = urlData.publicUrl;
    setImageUrl(newUrl);
    setUploading(false);
    setTimeout(() => saveDraft({ ...getCurrentFields(), imageUrl: newUrl }), 0);
  };

  const handleGenerate = async () => {
    if (!user || !canGenerate) return;
    setSaving(true);
    try {
      const firstName = user.user_metadata?.display_name?.split(" ")[0] || user.email?.split("@")[0] || "user";
      let slug = generateSlug(company, role, firstName);

      const { data: existing } = await supabase
        .from("proof_cards")
        .select("slug")
        .like("slug", `${slug}%`);
      if (existing && existing.length > 0 && !existingCard) {
        const existingSlugs = new Set(existing.map((e: any) => e.slug));
        if (existingSlugs.has(slug)) {
          let i = 2;
          while (existingSlugs.has(`${slug}-${i}`)) i++;
          slug = `${slug}-${i}`;
        }
      }

      const cardData = {
        campaign_id: campaignId,
        user_id: user.id,
        slug: existingCard?.slug || slug,
        one_liner: oneLiner,
        ask,
        insights: findings,
        image_url: imageUrl,
        loom_url: loomUrl || null,
        doc_url: docUrl,
        assumption: assumption || null,
        next_48h: next48h,
        published: false,
      };

      if (existingCard) {
        const { error } = await supabase
          .from("proof_cards")
          .update(cardData)
          .eq("id", existingCard.id);
        if (error) throw error;
        setExistingCard({ ...existingCard, ...cardData });
      } else {
        const { data, error } = await supabase
          .from("proof_cards")
          .insert(cardData)
          .select()
          .single();
        if (error) throw error;
        setExistingCard(data);
      }
      setShowPreview(true);
    } catch (e: any) {
      toast({ title: "Failed to save", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // FIX 4 — Gated publish
  const handlePublishClick = () => {
    if (!imageUrl) {
      setShowImageGate(true);
      setImageGateChecked(false);
    } else {
      handlePublish();
    }
  };

  const handlePublish = async () => {
    if (!existingCard) return;
    const { error } = await supabase
      .from("proof_cards")
      .update({ published: true })
      .eq("id", existingCard.id);
    if (error) {
      toast({ title: "Publish failed", description: error.message, variant: "destructive" });
      return;
    }
    setExistingCard({ ...existingCard, published: true });
    const url = `${window.location.origin}/p/${existingCard.slug}`;
    setPublishedUrl(url);
    setShowPreview(false);
    setShowImageGate(false);
    toast({ title: "Proof Card published!" });
  };

  const copyLink = () => {
    if (!publishedUrl) return;
    navigator.clipboard.writeText(publishedUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const copyLinkWithDesc = () => {
    if (!publishedUrl) return;
    navigator.clipboard.writeText(`60-sec proof card (no login): ${publishedUrl}`);
    setDescCopied(true);
    setTimeout(() => setDescCopied(false), 2000);
  };

  // FIX 5 — Copy LinkedIn DM
  const copyLinkedInDM = () => {
    if (!publishedUrl) return;
    const summary = oneLiner.slice(0, 60);
    const text = `Hey [Name] — I built ${summary}.\n\n60-sec proof card: ${publishedUrl}\n\nCould you reply with 1 piece of feedback — what's the biggest flaw or missing piece?\n\nIf irrelevant, I'll disappear.`;
    navigator.clipboard.writeText(text);
    setDmCopied(true);
    setTimeout(() => setDmCopied(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 style={{ color: '#ffffff', fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Your Proof Card</h2>
          <p style={{ color: '#94A3B8', fontSize: '14px', lineHeight: 1.6 }}>
            A founder scans this in 60 seconds. This is what you send — not your brief, not your Notion doc. Just this link.
          </p>
          <p style={{ color: '#64748B', fontSize: '12px', marginTop: '8px' }}>
            Public page. No login required. No downloads. Safe to send.
          </p>
        </div>
        {loaded && saveStatus !== "idle" && (
          <span style={{
            fontSize: '11px',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            color: saveStatus === "saving" ? '#64748B' : saveStatus === "saved" ? '#22c55e' : '#ef4444',
          }}>
            {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved ✓" : "Save failed"}
          </span>
        )}
      </div>

      {/* Published URL display */}
      {publishedUrl && (
        <div style={{ backgroundColor: '#1A1A1A', border: '1px solid #F97416', borderRadius: '8px', padding: '16px' }}>
          <p style={{ color: '#ffffff', fontSize: '14px', fontWeight: 700, marginBottom: '12px', wordBreak: 'break-all' }}>{publishedUrl}</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={copyLink} style={{ backgroundColor: '#F97416', borderRadius: '8px' }} className="text-white font-semibold">
              {linkCopied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
              {linkCopied ? "Copied!" : "Copy link"}
            </Button>
            <Button size="sm" variant="outline" onClick={copyLinkWithDesc} className="bg-transparent text-white border-white/15 hover:bg-white/5" style={{ borderRadius: '8px' }}>
              {descCopied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
              {descCopied ? "Copied!" : "Copy link + description"}
            </Button>
          </div>
          {/* FIX 5 — Copy LinkedIn DM button */}
          <button
            onClick={copyLinkedInDM}
            style={{
              width: '100%',
              marginTop: '10px',
              backgroundColor: 'transparent',
              border: '1px solid #F97416',
              color: '#F97416',
              fontWeight: 700,
              fontSize: '13px',
              borderRadius: '8px',
              padding: '10px 16px',
              cursor: 'pointer',
              position: 'relative',
            }}
          >
            {dmCopied ? "Copied — replace [Name] before sending" : "Copy LinkedIn DM →"}
          </button>
          {dmCopied && (
            <p style={{ color: '#22c55e', fontSize: '12px', marginTop: '6px', textAlign: 'center' }}>
              Copied — replace [Name] before sending
            </p>
          )}
          <p style={{ color: '#64748B', fontSize: '12px', marginTop: '10px' }}>
            Use 'Copy link + description' in LinkedIn DMs — gives context so founders know what to expect.
          </p>
        </div>
      )}

      {/* FIELD 1 — One-liner (FIX 3: max 100 chars) */}
      <FieldGroup label="What you built" helper='Format: I built {deliverable} for {company} to {outcome}.' required>
        <p style={{ color: '#64748B', fontSize: '11px', fontStyle: 'italic', marginBottom: '6px' }}>{getRoleExample(role)}</p>
        <Input
          value={oneLiner}
          onChange={(e) => { const v = e.target.value.slice(0, 100); updateField(setOneLiner, v, { oneLiner: v }); }}
          onBlur={handleBlurSave}
          placeholder={`I built ... for ${company} to ...`}
          maxLength={100}
          className="campaign-notes-textarea"
          style={{ backgroundColor: '#1A1A1A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white' }}
        />
        <p style={{ color: '#64748B', fontSize: '11px', marginTop: '4px' }}>
          Keep it under 15 words. Founders scan the first line in 2 seconds.
        </p>
        <p style={{ color: oneLiner.length > 100 ? '#ef4444' : '#64748B', fontSize: '11px', textAlign: 'right', marginTop: '2px' }}>{oneLiner.length}/100</p>
      </FieldGroup>

      {/* FIELD 2 — The Ask */}
      <FieldGroup label="Your feedback ask" helper="This is the CTA on the card. Small ask = more replies." required>
        <Textarea
          value={ask}
          onChange={(e) => { const v = e.target.value.slice(0, 160); updateField(setAsk, v, { ask: v }); }}
          onBlur={handleBlurSave}
          maxLength={160}
          rows={2}
          className="campaign-notes-textarea"
          style={{ backgroundColor: '#1A1A1A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white', fontSize: '14px' }}
        />
        <div className="flex justify-between mt-1">
          {!askValid && ask.length > 0 && (
            <p style={{ color: '#ef4444', fontSize: '12px' }}>Frame as a feedback ask, not a job ask</p>
          )}
          <p style={{ color: '#64748B', fontSize: '11px', marginLeft: 'auto' }}>{ask.length}/160</p>
        </div>
      </FieldGroup>

      {/* FIELD 3 — Three findings */}
      <FieldGroup label="What you found (3 bullets)" helper="Specific. Reference real artifacts and decisions. No vague claims." required>
        {findings.map((f, i) => (
          <div key={i} className="mb-2">
            <Input
              value={f}
              onChange={(e) => {
                const next = [...findings];
                next[i] = e.target.value.slice(0, 120);
                updateField(setFindings, next, { findings: next });
              }}
              onBlur={handleBlurSave}
              maxLength={120}
              placeholder={`Finding ${i + 1}`}
              className="campaign-notes-textarea"
              style={{ backgroundColor: '#1A1A1A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white' }}
            />
            <p style={{ color: '#64748B', fontSize: '11px', textAlign: 'right', marginTop: '2px' }}>{f.length}/120</p>
          </div>
        ))}
      </FieldGroup>

      {/* FIELD 4 — Visual upload */}
      <div ref={imageFieldRef}>
        <FieldGroup label="Your visual" helper="Before/after, table, or screenshot. Remove all personal data before uploading.">
          {imageUrl ? (
            <div className="space-y-2">
              <img src={imageUrl} alt="Proof visual" style={{ maxHeight: '200px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }} />
              <Button size="sm" variant="outline" onClick={() => { setImageUrl(null); fileInputRef.current?.click(); }} className="bg-transparent text-white border-white/15 hover:bg-white/5" style={{ borderRadius: '8px' }}>
                Replace image
              </Button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              style={{
                width: '100%',
                padding: '24px',
                border: '2px dashed rgba(255,255,255,0.15)',
                borderRadius: '8px',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {uploading ? (
                <p style={{ color: '#94A3B8', fontSize: '13px' }}>Uploading...</p>
              ) : (
                <>
                  <Upload style={{ color: '#64748B', width: '24px', height: '24px' }} />
                  <p style={{ color: '#94A3B8', fontSize: '13px' }}>Click to upload (PNG, JPG, WebP · Max 10MB)</p>
                </>
              )}
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageUpload(file);
            }}
          />
          {!imageUrl && (
            <p style={{ color: '#eab308', fontSize: '13px', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertTriangle style={{ width: '14px', height: '14px' }} />
              Cards with visuals get 2x more responses.
            </p>
          )}
        </FieldGroup>
      </div>

      {/* FIELD 5 — Loom link */}
      <FieldGroup label="Your Loom walkthrough (optional)" helper="45-90 seconds max. Free at loom.com.">
        <Input
          value={loomUrl}
          onChange={(e) => updateField(setLoomUrl, e.target.value, { loomUrl: e.target.value })}
          onBlur={handleBlurSave}
          placeholder="https://www.loom.com/share/..."
          className="campaign-notes-textarea"
          style={{ backgroundColor: '#1A1A1A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white' }}
        />
        {loomUrl && !loomValid && (
          <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>Must be a loom.com link</p>
        )}
        {loomUrl && loomValid && (
          <div style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '12px', marginTop: '8px' }}>
            <p style={{ color: '#ef4444', fontSize: '13px', fontWeight: 600 }}>Keep under 90 seconds. Founders won't watch longer.</p>
          </div>
        )}
      </FieldGroup>

      {/* FIELD 6 — Doc link */}
      <FieldGroup label="Your full deliverable" helper="Notion, Google Sheets, Figma, GitHub — link to the full work." required>
        <Input
          value={docUrl}
          onChange={(e) => updateField(setDocUrl, e.target.value, { docUrl: e.target.value })}
          onBlur={handleBlurSave}
          placeholder="https://..."
          className="campaign-notes-textarea"
          style={{ backgroundColor: '#1A1A1A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white' }}
        />
        {docUrl && !docValid && (
          <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>Enter a valid URL</p>
        )}
      </FieldGroup>

      {/* FIELD 7 — Key Assumption (FIX 1: role-based auto-gen with approve/edit) */}
      <div>
        <label style={{ color: '#ffffff', fontSize: '13px', fontWeight: 500, display: 'block', marginBottom: '4px' }}>
          Key assumption
        </label>
        <p style={{ color: '#64748B', fontSize: '12px', marginBottom: '8px', lineHeight: 1.5 }}>
          Shows judgment. Signals you've thought about where this could fail.
        </p>
        {!assumptionEditing ? (
          <div style={{ backgroundColor: '#242424', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '14px' }}>
            <p style={{ color: '#ffffff', fontSize: '14px', lineHeight: 1.6 }}>{assumption || getAssumptionDefault(role, company)}</p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => {
                  if (!assumption) {
                    const v = getAssumptionDefault(role, company);
                    updateField(setAssumption, v, { assumption: v });
                  }
                }}
                style={{
                  backgroundColor: 'rgba(34,197,94,0.15)',
                  border: '1px solid rgba(34,197,94,0.3)',
                  color: '#22c55e',
                  fontSize: '12px',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Looks good ✓
              </button>
              <button
                onClick={() => {
                  if (!assumption) {
                    setAssumption(getAssumptionDefault(role, company));
                  }
                  setAssumptionEditing(true);
                }}
                style={{
                  backgroundColor: 'transparent',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#ffffff',
                  fontSize: '12px',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Edit
              </button>
            </div>
          </div>
        ) : (
          <div>
            <Input
              value={assumption}
              onChange={(e) => { const v = e.target.value.slice(0, 140); updateField(setAssumption, v, { assumption: v }); }}
              onBlur={handleBlurSave}
              maxLength={140}
              placeholder={`This works if ${company} is prioritizing...`}
              className="campaign-notes-textarea"
              style={{ backgroundColor: '#1A1A1A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white' }}
            />
            <div className="flex justify-between mt-1">
              <Button size="sm" onClick={() => setAssumptionEditing(false)} variant="outline" style={{ borderRadius: '8px' }}>Done</Button>
              <p style={{ color: '#64748B', fontSize: '11px' }}>{assumption.length}/140</p>
            </div>
          </div>
        )}
      </div>

      {/* FIELD 8 — 48-hour CTA */}
      <FieldGroup label="Your next step offer" helper="Name a specific deliverable." required>
        {!next48hEditing ? (
          <div style={{ backgroundColor: '#242424', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '14px' }}>
            <p style={{ color: '#ffffff', fontSize: '14px', lineHeight: 1.6 }}>{next48h}</p>
            <div className="flex gap-2 mt-3">
              <span style={{ color: '#22c55e', fontSize: '13px', fontWeight: 600 }}>Looks good ✓</span>
              <button onClick={() => setNext48hEditing(true)} style={{ color: '#F97416', fontSize: '13px', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>Edit</button>
            </div>
          </div>
        ) : (
          <div>
            <Textarea
              value={next48h}
              onChange={(e) => updateField(setNext48h, e.target.value, { next48h: e.target.value })}
              onBlur={handleBlurSave}
              rows={3}
              className="campaign-notes-textarea"
              style={{ backgroundColor: '#1A1A1A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white', fontSize: '14px' }}
            />
            {!next48hValid && next48h.length > 0 && (
              <p style={{ color: '#eab308', fontSize: '12px', marginTop: '4px' }}>Include a specific deliverable (list, variants, plan, model, repo, file, demo, etc.)</p>
            )}
            <Button size="sm" onClick={() => setNext48hEditing(false)} className="mt-2" variant="outline" style={{ borderRadius: '8px' }}>Done editing</Button>
          </div>
        )}
      </FieldGroup>

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={!canGenerate || saving}
        style={{
          width: '100%',
          backgroundColor: canGenerate ? '#F97416' : '#64748B',
          color: '#ffffff',
          fontWeight: 700,
          borderRadius: '8px',
          padding: '16px',
          fontSize: '16px',
          border: 'none',
          cursor: canGenerate ? 'pointer' : 'not-allowed',
          opacity: saving ? 0.7 : 1,
        }}
      >
        {saving ? "Saving..." : "Generate my Proof Card →"}
      </button>

      {/* Preview modal */}
      {showPreview && existingCard && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowPreview(false); }}
        >
          <div style={{ maxWidth: '500px', width: '90%', maxHeight: '90vh', overflow: 'auto' }}>
            <div className="text-center mb-6">
              <h3 style={{ color: '#ffffff', fontSize: '20px', fontWeight: 700 }}>Preview your Proof Card</h3>
              <p style={{ color: '#94A3B8', fontSize: '14px', marginTop: '4px' }}>This is what the founder sees.</p>
            </div>

            {/* Mini preview */}
            <div style={{ transform: 'scale(0.8)', transformOrigin: 'top center' }}>
              <MiniPreview
                oneLiner={oneLiner}
                ask={ask}
                findings={findings}
                imageUrl={imageUrl}
                loomUrl={loomUrl}
                docUrl={docUrl}
                assumption={assumption}
                next48h={next48h}
              />
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handlePublishClick}
                style={{ flex: 1, backgroundColor: '#F97416', color: '#fff', fontWeight: 700, borderRadius: '8px', padding: '14px', border: 'none', cursor: 'pointer', fontSize: '15px' }}
              >
                Publish and get link →
              </button>
              <button
                onClick={() => setShowPreview(false)}
                style={{ flex: 1, backgroundColor: 'transparent', color: '#fff', fontWeight: 500, borderRadius: '8px', padding: '14px', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', fontSize: '15px' }}
              >
                Edit first
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FIX 4 — Image gating modal */}
      {showImageGate && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.9)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowImageGate(false); }}
        >
          <div style={{
            backgroundColor: '#1A1A1A',
            border: '1px solid #ef4444',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '420px',
            width: '90%',
          }}>
            <h3 style={{ color: '#ffffff', fontWeight: 700, fontSize: '20px', marginBottom: '12px' }}>
              Your card has no visual.
            </h3>
            <p style={{ color: '#94A3B8', fontSize: '14px', lineHeight: 1.7 }}>
              A screenshot, table, or before/after is what makes this feel like real work — not a well-written post.
            </p>
            <p style={{ color: '#94A3B8', fontSize: '14px', lineHeight: 1.7, marginTop: '12px' }}>
              Founders scan visuals in 2 seconds. Text takes 20.
            </p>

            <button
              onClick={() => {
                setShowImageGate(false);
                setShowPreview(false);
                setTimeout(() => {
                  imageFieldRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  fileInputRef.current?.click();
                }, 200);
              }}
              style={{
                width: '100%',
                marginTop: '24px',
                backgroundColor: '#F97416',
                color: '#ffffff',
                fontWeight: 700,
                borderRadius: '8px',
                padding: '14px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              Add image now →
            </button>

            <button
              onClick={() => setImageGateChecked((prev) => !prev ? true : prev)}
              style={{
                width: '100%',
                marginTop: '10px',
                backgroundColor: 'transparent',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#64748B',
                fontSize: '13px',
                borderRadius: '8px',
                padding: '10px',
                cursor: 'pointer',
              }}
            >
              I don't have a visual yet
            </button>

            {imageGateChecked && (
              <div style={{ marginTop: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
                  <Checkbox
                    checked={imageGateChecked}
                    onCheckedChange={(v) => setImageGateChecked(!!v)}
                    className="mt-0.5"
                  />
                  <span style={{ color: '#94A3B8', fontSize: '13px', lineHeight: 1.5 }}>
                    I understand this will reduce my reply rate significantly.
                  </span>
                </label>
                {imageGateChecked && (
                  <button
                    onClick={handlePublish}
                    style={{
                      width: '100%',
                      marginTop: '10px',
                      backgroundColor: 'transparent',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: '#64748B',
                      fontSize: '13px',
                      fontWeight: 500,
                      borderRadius: '8px',
                      padding: '10px',
                      cursor: 'pointer',
                    }}
                  >
                    Publish anyway
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FieldGroup({ label, helper, required, children }: { label: string; helper: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ color: '#ffffff', fontSize: '14px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
        {label}{required && <span style={{ color: '#F97416', marginLeft: '4px' }}>*</span>}
      </label>
      <p style={{ color: '#94A3B8', fontSize: '13px', marginBottom: '8px', lineHeight: 1.5 }}>{helper}</p>
      {children}
    </div>
  );
}

function MiniPreview({ oneLiner, ask, findings, imageUrl, loomUrl, docUrl, assumption, next48h }: any) {
  return (
    <div style={{ backgroundColor: '#111111', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
      {/* Trust bar */}
      <div style={{ backgroundColor: '#1A1A1A', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#64748B', fontSize: '12px' }}>🚀 PrepLane Proof of Work</span>
      </div>
      <p style={{ color: '#64748B', fontSize: '11px', textAlign: 'center', padding: '6px 0' }}>Public page · No login · No attachments · No downloads · ~45 sec read</p>

      {/* One-liner */}
      <p style={{ color: '#ffffff', fontSize: '18px', fontWeight: 700, lineHeight: 1.3, padding: '16px 20px 12px' }}>{oneLiner}</p>

      {/* Ask */}
      <div style={{ backgroundColor: 'rgba(249,116,22,0.08)', border: '1px solid rgba(249,116,22,0.2)', borderRadius: '8px', padding: '12px 16px', margin: '0 20px 16px' }}>
        <p style={{ color: '#ffffff', fontSize: '13px', lineHeight: 1.6 }}>{ask}</p>
      </div>

      {/* Findings */}
      <p style={{ color: '#F97416', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 20px', marginBottom: '8px' }}>WHAT I FOUND</p>
      {findings.map((f: string, i: number) => (
        <div key={i} style={{ backgroundColor: '#1A1A1A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '10px 12px', margin: '0 20px 6px' }}>
          <p style={{ color: '#ffffff', fontSize: '12px' }}><span style={{ color: '#F97416' }}>→ </span>{f}</p>
        </div>
      ))}

      {/* Footer */}
      <div style={{ padding: '16px 20px' }}>
        {assumption && <p style={{ color: '#94A3B8', fontSize: '11px', fontStyle: 'italic', marginBottom: '6px' }}>Assumption: {assumption}</p>}
        <p style={{ color: '#ffffff', fontSize: '12px', fontWeight: 500 }}>{next48h}</p>
      </div>
    </div>
  );
}
