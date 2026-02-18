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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Mail, Copy, Send, Loader2, MessageSquare, Clock, Trash2, Check, ChevronDown, X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const MESSAGE_TYPES = [
  { value: "hiring_manager", label: "Hiring Manager Outreach", icon: "👋" },
  { value: "follow_up", label: "Follow-up After Application", icon: "📨" },
  { value: "thank_you", label: "Thank You After Interview", icon: "🙏" },
  { value: "referral_request", label: "Referral Request", icon: "🤝" },
  { value: "offer_negotiation", label: "Offer Negotiation", icon: "💼" },
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
}

const OutreachTab = ({ applicationId, userId, jobTitle, company, cvSummary }: OutreachTabProps) => {
  const [messages, setMessages] = useState<OutreachMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null); // null = generator, id = history item

  // Generator form state
  const [selectedType, setSelectedType] = useState("hiring_manager");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");
  const [generatedSubject, setGeneratedSubject] = useState("");
  const [generatedContent, setGeneratedContent] = useState("");
  const [showGenerator, setShowGenerator] = useState(false);

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
    setShowGenerator(true);
  };

  const generateMessage = async () => {
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
        },
      });

      if (error) throw error;

      setGeneratedSubject(data.subject || "");
      setGeneratedContent(data.content || "");

      // Log timeline event on generation
      await supabase.from("application_timeline").insert({
        application_id: applicationId,
        user_id: userId,
        event_type: "outreach_generated",
        note: `Generated ${MESSAGE_TYPES.find((t) => t.value === selectedType)?.label || selectedType}${recipientName ? ` for ${recipientName}` : ""}`,
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
        recipient_name: recipientName || null,
        recipient_email: recipientEmail || null,
        subject: generatedSubject || null,
        content: generatedContent,
      })
      .select()
      .single();

    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }

    setMessages((prev) => [data as OutreachMessage, ...prev]);
    setGeneratedContent("");
    setGeneratedSubject("");
    setRecipientName("");
    setRecipientEmail("");
    setAdditionalContext("");
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

  return (
    <div className="space-y-4">
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

            <div className="space-y-1.5">
              <Label>Additional Context (optional)</Label>
              <Textarea
                placeholder={
                  selectedType === "thank_you"
                    ? "Key topics discussed, specific things you liked..."
                    : selectedType === "offer_negotiation"
                    ? "Current offer details, competing offers, market data..."
                    : selectedType === "referral_request"
                    ? "How you know this person, what you're asking for..."
                    : "Any specific details to include..."
                }
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                className="min-h-[80px]"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={generateMessage} disabled={generating}>
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
                    <span className="text-xs text-muted-foreground">
                      {generatedContent.length} characters
                    </span>
                  </div>
                  <Textarea
                    value={generatedContent}
                    onChange={(e) => setGeneratedContent(e.target.value)}
                    className="min-h-[200px]"
                  />
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

export default OutreachTab;
