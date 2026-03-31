import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeInput } from "@/lib/sanitizeText";
import {
  Mail, Copy, Send, Loader2, MessageSquare, Clock, Trash2, Check, ChevronDown, X, UserPlus, Info, Settings, RefreshCw,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDistanceToNow } from "date-fns";

const MESSAGE_TYPES = [
  { value: "hiring_manager", label: "Hiring Manager Outreach", icon: "👋" },
  { value: "follow_up", label: "Follow-up After Application", icon: "📨" },
  { value: "thank_you", label: "Thank You After Interview", icon: "🙏" },
  { value: "referral_request", label: "Referral Request", icon: "🤝" },
  { value: "offer_negotiation", label: "Offer Negotiation", icon: "💼" },
];

const REFERRAL_RELATIONSHIPS = [
  { value: "former_colleague", label: "Former colleague" },
  { value: "friend", label: "Friend" },
  { value: "classmate", label: "Classmate" },
  { value: "met_at_event", label: "Met at event" },
  { value: "linkedin", label: "LinkedIn connection" },
  { value: "other", label: "Other" },
];

const NEGOTIATION_REASONS = [
  { value: "market_data", label: "Market data for this role/location" },
  { value: "competing_offer", label: "Competing offer" },
  { value: "experience_level", label: "My experience level" },
  { value: "cost_of_living", label: "Cost of living" },
  { value: "other", label: "Other" },
];

const TONE_OPTIONS = [
  { value: "more_formal", label: "More Formal", description: "Less contractions, slightly more professional" },
  { value: "balanced", label: "Balanced", description: "Conversational but professional" },
  { value: "more_casual", label: "More Casual", description: "Very conversational, friendly" },
];

interface OutreachMessage {
  id: string;
  message_type: string;
  recipient_name: string | null;
  recipient_email: string | null;
  subject: string | null;
  content: string;
  sent_at: string | null;
  created_at: string;
}

interface OutreachTabProps {
  applicationId: string;
  userId: string;
  jobTitle: string;
  company: string;
  cvSummary?: string;
  appliedDate?: string | null;
}

const OutreachTab = ({ applicationId, userId, jobTitle, company, cvSummary, appliedDate }: OutreachTabProps) => {
  const [messages, setMessages] = useState<OutreachMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Generator form state
  const [selectedType, setSelectedType] = useState("hiring_manager");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");
  const [roleInterest, setRoleInterest] = useState("");
  const [showPersonalTouch, setShowPersonalTouch] = useState(false);
  const [strongestFit, setStrongestFit] = useState("");
  const [showStrongestFit, setShowStrongestFit] = useState(false);
  const [interviewTopics, setInterviewTopics] = useState("");
  const [interviewType, setInterviewType] = useState("video");
  const [referralRelationship, setReferralRelationship] = useState("former_colleague");
  const [referralRelationshipOther, setReferralRelationshipOther] = useState("");
  const [referralQualification, setReferralQualification] = useState("");
  const [referralAsked, setReferralAsked] = useState(false);
  const [generatedSubject, setGeneratedSubject] = useState("");
  const [generatedContent, setGeneratedContent] = useState("");
  const [showGenerator, setShowGenerator] = useState(false);
  const [toneOverride, setToneOverride] = useState<string | undefined>(undefined);

  // Offer negotiation state
  const [offeredSalary, setOfferedSalary] = useState("");
  const [targetSalary, setTargetSalary] = useState("");
  const [salaryCurrency, setSalaryCurrency] = useState("USD");
  const [negotiationReason, setNegotiationReason] = useState("market_data");
  const [otherConsiderations, setOtherConsiderations] = useState("");

  // System-wide tone setting
  const [defaultTone, setDefaultTone] = useState("balanced");
  const [showToneSettings, setShowToneSettings] = useState(false);

  // Compute days since applied
  const daysSinceApplied = appliedDate
    ? Math.floor((Date.now() - new Date(appliedDate).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const { toast } = useToast();

  useEffect(() => {
    fetchMessages();
  }, [applicationId]);

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from("outreach_messages")
      .select("*")
      .eq("application_id", applicationId)
      .order("created_at", { ascending: false });

    if (!error && data) setMessages(data as OutreachMessage[]);
    setLoading(false);
  };

  const openGeneratorWith = (type: string) => {
    setSelectedType(type);
    setGeneratedContent("");
    setGeneratedSubject("");
    setRoleInterest("");
    setShowPersonalTouch(false);
    setStrongestFit("");
    setShowStrongestFit(false);
    setInterviewTopics("");
    setInterviewType("video");
    setReferralRelationship("former_colleague");
    setReferralRelationshipOther("");
    setReferralQualification("");
    setReferralAsked(false);
    setToneOverride(undefined);
    setOfferedSalary("");
    setTargetSalary("");
    setSalaryCurrency("USD");
    setNegotiationReason("market_data");
    setOtherConsiderations("");
    setShowGenerator(true);
  };

  const getEffectiveTone = (explicitHint?: string) => {
    if (explicitHint) return explicitHint;
    if (toneOverride) return toneOverride;
    if (defaultTone !== "balanced") return defaultTone;
    return undefined;
  };

  const generateMessage = async (toneHint?: string) => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-outreach", {
        body: {
          messageType: selectedType,
          jobTitle,
          company,
          cvSummary: cvSummary?.slice(0, 3000),
          recipientName: recipientName || undefined,
          additionalContext: additionalContext || undefined,
          roleInterest: roleInterest.trim() || undefined,
          strongestFit: strongestFit.trim() || undefined,
          appliedDate: appliedDate || undefined,
          daysAgo: daysSinceApplied ?? undefined,
          toneHint: getEffectiveTone(toneHint),
          interviewTopics: interviewTopics.trim() || undefined,
          interviewType: selectedType === "thank_you" ? interviewType : undefined,
          referralRelationship: selectedType === "referral_request"
            ? (referralRelationship === "other" ? referralRelationshipOther.trim() : REFERRAL_RELATIONSHIPS.find(r => r.value === referralRelationship)?.label)
            : undefined,
          referralQualification: referralQualification.trim() || undefined,
          // Offer negotiation fields
          offeredSalary: selectedType === "offer_negotiation" ? offeredSalary || undefined : undefined,
          targetSalary: selectedType === "offer_negotiation" ? targetSalary || undefined : undefined,
          salaryCurrency: selectedType === "offer_negotiation" ? salaryCurrency : undefined,
          negotiationReason: selectedType === "offer_negotiation"
            ? NEGOTIATION_REASONS.find(r => r.value === negotiationReason)?.label
            : undefined,
          otherConsiderations: selectedType === "offer_negotiation" ? otherConsiderations.trim() || undefined : undefined,
        },
      });

      if (error) throw error;

      setGeneratedSubject(data.subject || "");
      setGeneratedContent(data.content || "");

      // Log timeline event on generation
      const timelineNote = `Generated ${MESSAGE_TYPES.find((t) => t.value === selectedType)?.label || selectedType}${recipientName ? ` for ${recipientName}` : ""}`;
      await supabase.from("application_timeline").insert({
        application_id: applicationId,
        user_id: userId,
        event_type: "outreach_generated",
        note: timelineNote,
        metadata: selectedType === "thank_you" && interviewTopics.trim()
          ? { interview_topics: interviewTopics.trim(), interview_type: interviewType }
          : undefined,
      });
    } catch (e: any) {
      toast({
        title: "Generation failed",
        description: e.message || "Could not generate message. Try again.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const saveMessage = async () => {
    if (!generatedContent.trim()) return;

    const { data, error } = await supabase
      .from("outreach_messages")
      .insert({
        user_id: userId,
        application_id: applicationId,
        message_type: selectedType,
        recipient_name: recipientName ? sanitizeInput(recipientName) : null,
        recipient_email: recipientEmail ? sanitizeInput(recipientEmail) : null,
        subject: generatedSubject ? sanitizeInput(generatedSubject) : null,
        content: sanitizeInput(generatedContent),
      })
      .select()
      .single();

    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }

    setMessages((prev) => [data as OutreachMessage, ...prev]);

    // If referral request with "asked" checked, log timeline + create reminder
    if (selectedType === "referral_request" && referralAsked && recipientName.trim()) {
      await supabase.from("application_timeline").insert({
        application_id: applicationId,
        user_id: userId,
        event_type: "referral_requested",
        note: `Asked ${recipientName.trim()} for a referral`,
        metadata: { contact_name: recipientName.trim(), relationship: referralRelationship === "other" ? referralRelationshipOther : referralRelationship },
      });

      // Create follow-up reminder in 4 days
      const followUpDate = new Date();
      followUpDate.setDate(followUpDate.getDate() + 4);
      await supabase.from("application_reminders").insert({
        application_id: applicationId,
        user_id: userId,
        title: `Follow up with ${recipientName.trim()} about referral`,
        reminder_type: "follow_up",
        due_date: followUpDate.toISOString(),
      });
    }

    setGeneratedContent("");
    setGeneratedSubject("");
    setRecipientName("");
    setRecipientEmail("");
    setAdditionalContext("");
    setRoleInterest("");
    setShowPersonalTouch(false);
    setReferralAsked(false);
    setShowGenerator(false);
    toast({ title: "Message saved to history" });
  };

  const copyToClipboard = async (text: string, id: string | null = null) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id ?? "generator");
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: "Copied to clipboard" });
  };

  const openEmailClient = (subject: string, body: string, email?: string) => {
    const mailto = `mailto:${email || ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailto);
  };

  const markAsSent = async (id: string) => {
    const { error } = await supabase
      .from("outreach_messages")
      .update({ sent_at: new Date().toISOString() })
      .eq("id", id);

    if (!error) {
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, sent_at: new Date().toISOString() } : m))
      );
    }
  };

  const deleteMessage = async (id: string) => {
    const { error } = await supabase.from("outreach_messages").delete().eq("id", id);
    if (!error) {
      setMessages((prev) => prev.filter((m) => m.id !== id));
    }
  };

  const typeLabel = (type: string) =>
    MESSAGE_TYPES.find((t) => t.value === type)?.label || type;
  const typeIcon = (type: string) =>
    MESSAGE_TYPES.find((t) => t.value === type)?.icon || "✉️";

  const selectedTypeInfo = MESSAGE_TYPES.find((t) => t.value === selectedType);

  const getWordTarget = (): [number, number] => {
    switch (selectedType) {
      case "follow_up": return [80, 120];
      case "referral_request": return [120, 150];
      case "offer_negotiation": return [150, 180];
      default: return [100, 150];
    }
  };

  const canGenerate = () => {
    if (selectedType === "thank_you" && !recipientName.trim()) return false;
    if (selectedType === "referral_request" && !recipientName.trim()) return false;
    return true;
  };

  return (
    <div className="space-y-4">
      {/* Tone Settings */}
      <Collapsible open={showToneSettings} onOpenChange={setShowToneSettings}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground text-xs gap-1.5">
            <Settings className="h-3.5 w-3.5" />
            Message Tone Settings
            <ChevronDown className={`h-3 w-3 ml-auto transition-transform ${showToneSettings ? "rotate-180" : ""}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2 pb-1">
          <Card className="border-dashed">
            <CardContent className="pt-3 pb-3">
              <Label className="text-xs font-medium">Default Tone for All Messages</Label>
              <div className="mt-2 space-y-1.5">
                {TONE_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="default-tone"
                      value={opt.value}
                      checked={defaultTone === opt.value}
                      onChange={() => setDefaultTone(opt.value)}
                      className="mt-0.5 accent-primary"
                    />
                    <div>
                      <span className="text-sm font-medium">{opt.label}</span>
                      <p className="text-[10px] text-muted-foreground">{opt.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Generate new message — dropdown trigger */}
      {!showGenerator ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="w-full">
              <MessageSquare className="h-4 w-4 mr-2" />
              Generate Message
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64 bg-popover border shadow-lg z-50">
            {MESSAGE_TYPES.map((t) => (
              <DropdownMenuItem
                key={t.value}
                onClick={() => openGeneratorWith(t.value)}
                className="cursor-pointer"
              >
                <span className="mr-2">{t.icon}</span>
                {t.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <span>{selectedTypeInfo?.icon}</span>
                {selectedTypeInfo?.label}
              </CardTitle>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={() => setShowGenerator(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Generic recipient fields — hide for types with their own */}
            {selectedType !== "thank_you" && selectedType !== "referral_request" && selectedType !== "offer_negotiation" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Recipient Name (optional)</Label>
                <Input
                  placeholder="e.g. Sarah Chen"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Recipient Email (optional)</Label>
                <Input
                  type="email"
                  placeholder="sarah@company.com"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                />
              </div>
            </div>
            )}

            {/* Personal touch — hiring manager only */}
            {selectedType === "hiring_manager" && (
              <div className="space-y-1.5">
                {!showPersonalTouch ? (
                  <button
                    type="button"
                    onClick={() => setShowPersonalTouch(true)}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    + Add personal touch
                  </button>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">What specifically interests you about this role?</Label>
                      <span className={`text-xs ${roleInterest.length > 100 ? "text-destructive" : "text-muted-foreground"}`}>
                        {roleInterest.length}/100
                      </span>
                    </div>
                    <Input
                      placeholder="e.g., excited about the product roadmap work, company's approach to AI, etc."
                      value={roleInterest}
                      maxLength={100}
                      onChange={(e) => setRoleInterest(e.target.value)}
                    />
                    <p className="text-[10px] text-muted-foreground">Optional · 1 sentence max · makes your message stand out</p>
                  </div>
                )}
              </div>
            )}

            {/* Follow-up: days since applied + strongest fit */}
            {selectedType === "follow_up" && (
              <div className="space-y-3">
                {daysSinceApplied !== null && (
                  <div className={`text-sm rounded-md px-3 py-2 border ${
                    daysSinceApplied < 7
                      ? "bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-950 dark:border-yellow-800 dark:text-yellow-200"
                      : daysSinceApplied <= 14
                      ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-200"
                      : "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-200"
                  }`}>
                    <p className="font-medium">You applied {daysSinceApplied} days ago</p>
                    <p className="text-xs mt-0.5">
                      {daysSinceApplied < 7
                        ? "Consider waiting at least 1-2 weeks before following up"
                        : daysSinceApplied <= 14
                        ? "Good timing for a follow-up!"
                        : "Definitely time to follow up!"}
                    </p>
                  </div>
                )}
                {!showStrongestFit ? (
                  <button
                    type="button"
                    onClick={() => setShowStrongestFit(true)}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    + Add your strongest fit
                  </button>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">What's your strongest fit for this role?</Label>
                      <span className={`text-xs ${strongestFit.length > 120 ? "text-destructive" : "text-muted-foreground"}`}>
                        {strongestFit.length}/120
                      </span>
                    </div>
                    <Input
                      placeholder="e.g., 5 years PM experience in B2B SaaS, shipped similar features, etc."
                      value={strongestFit}
                      maxLength={120}
                      onChange={(e) => setStrongestFit(e.target.value)}
                    />
                    <p className="text-[10px] text-muted-foreground">Optional · 1 sentence · reinforces why you're a great fit</p>
                  </div>
                )}
              </div>
            )}

            {/* Thank you: interviewer name (required), topics, interview type */}
            {selectedType === "thank_you" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Interviewer's Name <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="e.g. Sarah Chen"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Interview Type</Label>
                  <Select value={interviewType} onValueChange={setInterviewType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="phone">Phone</SelectItem>
                      <SelectItem value="video">Video</SelectItem>
                      <SelectItem value="in_person">In-person</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>What were 2-3 key topics you discussed?</Label>
                  <Textarea
                    placeholder={"• Their approach to product discovery\n• The team structure\n• Upcoming roadmap priorities"}
                    value={interviewTopics}
                    onChange={(e) => setInterviewTopics(e.target.value)}
                    className="min-h-[80px]"
                  />
                </div>
              </div>
            )}

            {/* Referral request: contact name (required), relationship, qualification */}
            {selectedType === "referral_request" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Contact's Name <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="e.g. Alex Johnson"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>How do you know them?</Label>
                  <Select value={referralRelationship} onValueChange={setReferralRelationship}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REFERRAL_RELATIONSHIPS.map((r) => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {referralRelationship === "other" && (
                    <Input
                      placeholder="How do you know them?"
                      value={referralRelationshipOther}
                      onChange={(e) => setReferralRelationshipOther(e.target.value)}
                      className="mt-1.5"
                    />
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Your strongest qualification for this role</Label>
                  <Input
                    placeholder="e.g., 5 years PM experience in B2B SaaS, shipped similar products"
                    value={referralQualification}
                    onChange={(e) => setReferralQualification(e.target.value)}
                    maxLength={150}
                  />
                  <p className="text-[10px] text-muted-foreground">1 sentence · helps your contact advocate for you</p>
                </div>
              </div>
            )}

            {/* Offer negotiation: structured inputs */}
            {selectedType === "offer_negotiation" && (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Recipient Name (optional)</Label>
                    <Input
                      placeholder="e.g. Sarah Chen"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Recipient Email (optional)</Label>
                    <Input
                      type="email"
                      placeholder="sarah@company.com"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>Currency</Label>
                    <Select value={salaryCurrency} onValueChange={setSalaryCurrency}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="GBP">GBP</SelectItem>
                        <SelectItem value="CAD">CAD</SelectItem>
                        <SelectItem value="AUD">AUD</SelectItem>
                        <SelectItem value="INR">INR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Offered Salary</Label>
                    <Input
                      type="number"
                      placeholder="e.g. 120000"
                      value={offeredSalary}
                      onChange={(e) => setOfferedSalary(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Your Target Salary</Label>
                    <Input
                      type="number"
                      placeholder="e.g. 140000"
                      value={targetSalary}
                      onChange={(e) => setTargetSalary(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Reason for Target</Label>
                  <Select value={negotiationReason} onValueChange={setNegotiationReason}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {NEGOTIATION_REASONS.map((r) => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Other Considerations (optional)</Label>
                  <Textarea
                    placeholder="e.g., equity, remote flexibility, benefits, signing bonus"
                    value={otherConsiderations}
                    onChange={(e) => setOtherConsiderations(e.target.value)}
                    className="min-h-[60px]"
                  />
                </div>
              </div>
            )}

            {/* Additional context for remaining types */}
            {selectedType !== "hiring_manager" && selectedType !== "follow_up" && selectedType !== "thank_you" && selectedType !== "referral_request" && selectedType !== "offer_negotiation" && (
              <div className="space-y-1.5">
                <Label>Additional Context (optional)</Label>
                <Textarea
                  placeholder="Any specific details to include..."
                  value={additionalContext}
                  onChange={(e) => setAdditionalContext(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={() => generateMessage()}
                disabled={generating || !canGenerate()}
              >
                {generating ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...</>
                ) : (
                  "Generate"
                )}
              </Button>
              <Button variant="ghost" onClick={() => setShowGenerator(false)}>
                Cancel
              </Button>
            </div>

            {/* Generated result */}
            {generatedContent && (
              <div className="space-y-3 border-t pt-4">
                {/* AI disclaimer */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 shrink-0 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[240px]">
                        <p>These messages are AI-generated starting points. Always review and personalize before sending!</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <span>AI-generated draft — review before sending</span>
                </div>

                {generatedSubject && (
                  <div className="space-y-1.5">
                    <Label>Subject Line</Label>
                    <Input
                      value={generatedSubject}
                      onChange={(e) => setGeneratedSubject(e.target.value)}
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>Message</Label>
                    <WordCountBadge text={generatedContent} target={getWordTarget()} />
                  </div>
                  <Textarea
                    value={generatedContent}
                    onChange={(e) => setGeneratedContent(e.target.value)}
                    className="min-h-[200px]"
                  />
                </div>

                {/* Thank you tip */}
                {selectedType === "thank_you" && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Send within 24 hours of your interview for best results
                  </p>
                )}

                {/* Referral: mark as asked checkbox */}
                {selectedType === "referral_request" && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="referral-asked"
                        checked={referralAsked}
                        onCheckedChange={(checked) => setReferralAsked(checked === true)}
                      />
                      <label htmlFor="referral-asked" className="text-sm cursor-pointer flex items-center gap-1">
                        <UserPlus className="h-3 w-3" />
                        Mark as "Asked for referral"
                      </label>
                    </div>
                    {referralAsked && (
                      <p className="text-xs text-muted-foreground ml-6">
                        Will log to timeline and create a reminder to follow up in 3-5 days
                      </p>
                    )}
                  </div>
                )}

                {/* Tone regeneration buttons — all message types */}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={generating}
                    onClick={() => generateMessage("more_casual")}
                  >
                    {generating ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                    ↻ Make More Casual
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={generating}
                    onClick={() => generateMessage("more_formal")}
                  >
                    {generating ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                    ↻ Make More Formal
                  </Button>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" onClick={saveMessage}>
                    <Check className="h-4 w-4 mr-1" /> Save to History
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(generatedContent, null)}
                  >
                    {copiedId === "generator" ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                    {copiedId === "generator" ? "Copied!" : "Copy"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEmailClient(generatedSubject, generatedContent, recipientEmail)}
                  >
                    <Mail className="h-4 w-4 mr-1" /> Open in Email
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Message history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            Message History ({messages.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No messages yet. Generate your first outreach message above.
            </p>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => (
                <div key={msg.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span>{typeIcon(msg.message_type)}</span>
                      <span className="text-sm font-medium">{typeLabel(msg.message_type)}</span>
                      {msg.recipient_name && (
                        <span className="text-xs text-muted-foreground">→ {msg.recipient_name}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {msg.sent_at ? (
                        <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                          ✓ Sent
                        </Badge>
                      ) : (
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => markAsSent(msg.id)}>
                          <Send className="h-3 w-3 mr-1" /> Mark Sent
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteMessage(msg.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  {msg.subject && (
                    <p className="text-xs font-medium text-muted-foreground">
                      Subject: {msg.subject}
                    </p>
                  )}
                  {msg.recipient_email && (
                    <p className="text-xs text-muted-foreground">
                      To: {msg.recipient_email}
                    </p>
                  )}
                  <p className="text-sm whitespace-pre-line line-clamp-4">{msg.content}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                    <span>{formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-xs px-2"
                      onClick={() => copyToClipboard(msg.content, msg.id)}
                    >
                      {copiedId === msg.id ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                      {copiedId === msg.id ? "Copied!" : "Copy"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-xs px-2"
                      onClick={() => openEmailClient(msg.subject || "", msg.content, msg.recipient_email || "")}
                    >
                      <Mail className="h-3 w-3 mr-1" /> Open in Email
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

function WordCountBadge({ text, target = [100, 150] }: { text: string; target?: [number, number] }) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const [low, high] = target;
  const colorClass =
    words >= low && words <= high
      ? "text-green-600"
      : words <= high + 50
      ? "text-yellow-600"
      : "text-destructive";
  return (
    <span className={`text-xs flex items-center gap-1 ${colorClass}`} title="Shorter messages get better response rates">
      {words} words
      {words > high && ` · aim for under ${high}`}
    </span>
  );
}

export default OutreachTab;
