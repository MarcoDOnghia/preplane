import { useState } from "react";
import { Check, ChevronLeft, ChevronRight, Copy, ArrowRight } from "lucide-react";

const SECTION_LABELS = ["Your Hook", "The Mission", "How to Build It", "The Output", "The Insight"];

/** Parse a build step string to extract numbered sub-points (e.g. "1. ...", "2. ...") */
function parseStepWithSubPoints(step: string): { main: string; subPoints: string[] } {
  // Match patterns like "1. text 2. text 3. text" within the step
  const numberedPattern = /(?:^|\s)(\d+)\.\s+/g;
  const matches = [...step.matchAll(numberedPattern)];
  if (matches.length < 2) return { main: step, subPoints: [] };

  // The main text is everything before the first numbered item
  const firstIdx = matches[0].index! + (matches[0][0].startsWith(' ') ? 1 : 0);
  const main = step.slice(0, firstIdx).trim();

  const subPoints: string[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index! + matches[i][0].length;
    const end = i < matches.length - 1 ? matches[i + 1].index! : step.length;
    const text = step.slice(start, end).trim();
    if (text) subPoints.push(text);
  }

  return { main: main || subPoints.shift() || step, subPoints };
}
const NEXT_LABELS = ["See the project →", "How to build it →", "See the output →", "The key insight →", ""];

interface BriefNavigatorProps {
  proofBrief: {
    outreach_hook: string;
    project: string;
    why_this_works: string;
    build_steps: string[];
    final_output: string;
    effort_guide?: { minimum: string; impressive: string };
    key_insight: string;
  };
  company?: string;
  toast: any;
  onStartBuilding?: () => void;
  onContinueCampaign?: () => void;
}

const BriefNavigator = ({ proofBrief, company, onStartBuilding, onContinueCampaign, toast }: BriefNavigatorProps) => {
  const [currentSection, setCurrentSection] = useState(0);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const [animating, setAnimating] = useState(false);
  const totalSections = 5;

  const goTo = (idx: number) => {
    if (idx === currentSection || animating) return;
    setDirection(idx > currentSection ? 'next' : 'prev');
    setAnimating(true);
    setTimeout(() => {
      setCurrentSection(idx);
      setAnimating(false);
    }, 200);
  };

  const next = () => { if (currentSection < totalSections - 1) goTo(currentSection + 1); };
  const prev = () => { if (currentSection > 0) goTo(currentSection - 1); };

  const sectionStyle: React.CSSProperties = {
    opacity: animating ? 0 : 1,
    transform: animating
      ? direction === 'next' ? 'translateX(30px)' : 'translateX(-30px)'
      : 'translateX(0)',
    transition: 'opacity 0.2s ease-out, transform 0.2s ease-out',
  };

  const showFinalButtons = onStartBuilding || onContinueCampaign;

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h1 style={{ color: '#FFFFFF', fontSize: '28px', fontWeight: 900, letterSpacing: '-0.02em', marginBottom: '8px' }}>
          Your proof-of-work brief
        </h1>
        <p style={{ color: '#94A3B8', fontSize: '15px' }}>
          This is what will set you apart from every other applicant
          {company ? ` at ${company}` : ""}.
        </p>
      </div>

      {/* Progress pills */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
        {SECTION_LABELS.map((label, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            style={{
              background: i === currentSection ? '#F97316' : i < currentSection ? '#22c55e' : '#242424',
              color: i === currentSection || i < currentSection ? '#FFFFFF' : '#64748B',
              fontSize: '12px',
              fontWeight: 600,
              padding: '6px 14px',
              borderRadius: '999px',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
            }}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>
      <p style={{ color: '#64748B', fontSize: '13px', textAlign: 'center', marginBottom: '32px' }}>
        Section {currentSection + 1} of {totalSections}
      </p>

      {/* Section content */}
      <div style={sectionStyle}>
        {/* Section 1: Your Hook */}
        {currentSection === 0 && (
          <div>
            <div style={{
              borderLeft: '4px solid #F97316',
              background: '#1A1A1A',
              padding: '32px',
              borderRadius: '0 12px 12px 0',
              position: 'relative',
            }}>
              <p style={{
                color: '#FFFFFF',
                fontSize: '22px',
                fontWeight: 600,
                lineHeight: 1.5,
                fontStyle: 'italic',
                paddingRight: '80px',
              }}>
                {proofBrief.outreach_hook}
              </p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(proofBrief.outreach_hook);
                  toast({ title: "Hook copied!" });
                }}
                style={{
                  position: 'absolute',
                  top: '28px',
                  right: '24px',
                  background: '#F97316',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '14px',
                  padding: '8px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Copy className="h-4 w-4" /> Copy
              </button>
            </div>
            <p style={{ color: '#64748B', fontSize: '14px', marginTop: '16px', lineHeight: 1.6 }}>
              This is what you're working toward. Everything that follows is how you earn the right to send it.
            </p>
          </div>
        )}

        {/* Section 2: The Mission */}
        {currentSection === 1 && (
          <div style={{
            background: '#1A1A1A',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            padding: '32px',
          }}>
            <div style={{ marginBottom: '24px' }}>
              <p style={{ color: '#F97316', fontSize: '11px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '8px' }}>The Project</p>
              <p style={{ color: '#FFFFFF', fontSize: '18px', fontWeight: 700, lineHeight: 1.5 }}>{proofBrief.project}</p>
            </div>
            <div>
              <p style={{ color: '#F97316', fontSize: '11px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '8px' }}>Why This Works</p>
              <p style={{ color: '#94A3B8', fontSize: '15px', lineHeight: 1.7 }}>{proofBrief.why_this_works}</p>
            </div>
          </div>
        )}

        {/* Section 3: How to Build It */}
        {currentSection === 2 && (
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {(proofBrief.build_steps as string[]).map((step: string, i: number) => {
                const parsed = parseStepWithSubPoints(step);
                return (
                  <div key={i} style={{
                    background: '#1C1C1C',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '8px',
                    padding: '20px 24px',
                    display: 'flex',
                    gap: '14px',
                  }}>
                    <span style={{ color: '#F97316', fontWeight: 900, fontSize: '24px', flexShrink: 0, lineHeight: 1.2 }}>{i + 1}</span>
                    <div style={{ flex: 1 }}>
                      <span style={{ color: '#E2E8F0', fontSize: '14px', lineHeight: 1.8 }}>{parsed.main}</span>
                      {parsed.subPoints.length > 0 && (
                        <div style={{ marginTop: '12px', marginLeft: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {parsed.subPoints.map((sp, j) => (
                            <div key={j} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                              <span style={{ color: '#F97316', fontSize: '13px', lineHeight: 1.6, flexShrink: 0 }}>→</span>
                              <span style={{ color: '#94A3B8', fontSize: '13px', lineHeight: 1.6 }}>{sp}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Loom explainer card */}
            <div style={{
              background: '#242424',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '8px',
              padding: '16px',
              marginTop: '12px',
            }}>
              <p style={{ color: '#FFFFFF', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>What is Loom?</p>
              <p style={{ color: '#94A3B8', fontSize: '13px', lineHeight: 1.6 }}>
                Loom is a free screen recording tool. You record your screen while talking through what you built. It takes 2 minutes and gives you a link to share instantly — no editing needed.
              </p>
              <p style={{ color: '#94A3B8', fontSize: '13px', lineHeight: 1.6, marginTop: '8px' }}>
                Why it works: a founder watching you explain your thinking is 10x more compelling than a document they have to open and read.
              </p>
              <p style={{ color: '#94A3B8', fontSize: '13px', lineHeight: 1.6, marginTop: '8px' }}>
                → Get Loom free at{' '}
                <a href="https://www.loom.com" target="_blank" rel="noopener noreferrer" style={{ color: '#F97316', fontWeight: 600, textDecoration: 'none' }}>loom.com</a>
              </p>
            </div>
            <p style={{ color: '#22c55e', fontSize: '13px', marginTop: '20px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Check className="h-3.5 w-3.5" style={{ color: '#22c55e' }} />
              All tools listed are free or freemium — no budget needed.
            </p>
          </div>
        )}

        {/* Section 4: The Output */}
        {currentSection === 3 && (
          <div>
            <div style={{
              background: '#1A1A1A',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '12px',
              padding: '28px',
            }}>
              <p style={{ color: '#F97316', fontSize: '11px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '8px' }}>What the Final Output Should Look Like</p>
              <p style={{ color: '#94A3B8', fontSize: '15px', lineHeight: 1.7 }}>{proofBrief.final_output}</p>
            </div>
            {proofBrief.effort_guide && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '24px' }}>
                <div style={{ background: '#1C1C1C', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '20px' }}>
                  <p style={{ color: '#F97316', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Minimum (gets noticed)</p>
                  <p style={{ color: '#E2E8F0', fontSize: '14px', lineHeight: 1.6 }}>{proofBrief.effort_guide.minimum}</p>
                </div>
                <div style={{ background: '#1C1C1C', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '20px' }}>
                  <p style={{ color: '#F97316', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Impressive (gets forwarded)</p>
                  <p style={{ color: '#E2E8F0', fontSize: '14px', lineHeight: 1.6 }}>{proofBrief.effort_guide.impressive}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Section 5: The Insight */}
        {currentSection === 4 && (
          <div>
            <div style={{
              background: '#1A1A1A',
              borderLeft: '3px solid rgba(249,116,22,0.4)',
              borderRadius: '0 12px 12px 0',
              padding: '32px',
            }}>
              <p style={{ color: '#F97316', fontSize: '11px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '12px' }}>The Insight to Include</p>
              <p style={{ color: '#94A3B8', fontSize: '17px', lineHeight: 1.8, fontStyle: 'italic' }}>{proofBrief.key_insight}</p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '32px', gap: '12px' }}>
        {currentSection > 0 ? (
          <button
            onClick={prev}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#FFFFFF',
              borderRadius: '8px',
              padding: '12px 24px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'border-color 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            onMouseEnter={(e) => (e.target as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.3)'}
            onMouseLeave={(e) => (e.target as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.15)'}
          >
            <ChevronLeft className="h-4 w-4" /> Previous
          </button>
        ) : <div />}

        {currentSection < totalSections - 1 ? (
          <button
            onClick={next}
            style={{
              background: '#F97316',
              color: '#FFFFFF',
              fontWeight: 700,
              borderRadius: '8px',
              padding: '12px 28px',
              fontSize: '14px',
              border: 'none',
              cursor: 'pointer',
              transition: 'background 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            onMouseEnter={(e) => (e.target as HTMLButtonElement).style.background = '#EA6C0A'}
            onMouseLeave={(e) => (e.target as HTMLButtonElement).style.background = '#F97316'}
          >
            {NEXT_LABELS[currentSection]} <ChevronRight className="h-4 w-4" />
          </button>
        ) : showFinalButtons ? (
          <div style={{ display: 'flex', gap: '12px', marginLeft: 'auto' }}>
            {onStartBuilding && (
              <button
                onClick={onStartBuilding}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#FFFFFF',
                  borderRadius: '8px',
                  padding: '12px 24px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'border-color 0.2s',
                }}
                onMouseEnter={(e) => (e.target as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.3)'}
                onMouseLeave={(e) => (e.target as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.15)'}
              >
                Start building — I'll be back
              </button>
            )}
            {onContinueCampaign && (
              <button
                onClick={onContinueCampaign}
                style={{
                  background: '#F97316',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  borderRadius: '8px',
                  padding: '12px 28px',
                  fontSize: '14px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
                onMouseEnter={(e) => (e.target as HTMLButtonElement).style.background = '#EA6C0A'}
                onMouseLeave={(e) => (e.target as HTMLButtonElement).style.background = '#F97316'}
              >
                Set up my outreach → <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        ) : <div />}
      </div>
    </div>
  );
};

export default BriefNavigator;
