import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Mail, Copy, Send, Loader2, MessageSquare, Clock, Trash2, Check,
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
  const [copied, setCopied] = useState(false);

  // Generator form state
  const [selectedType, setSelectedType] = useState("hiring_manager");
  const [recipientName, setRecipientName] = useState("");
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
    setShowGenerator(false);
    toast({ title: "Message saved" });

    // Record on timeline
    await supabase.from("application_timeline").insert({
      application_id: applicationId,
      user_id: userId,
      event_type: "outreach_sent",
      note: `${MESSAGE_TYPES.find((t) => t.value === selectedType)?.label || selectedType}${recipientName ? ` to ${recipientName}` : ""}`,
    });
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

  return (
    <div className="space-y-4">
      {/* Generate new message */}
      {!showGenerator ? (
        <Button onClick={() => setShowGenerator(true)} className="w-full">
          <MessageSquare className="h-4 w-4 mr-2" /> Generate Message
        </Button>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Generate Outreach Message
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Message Type</Label>
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MESSAGE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.icon} {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Recipient Name (optional)</Label>
                <Input
                  placeholder="e.g. Sarah Chen"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Additional Context (optional)</Label>
              <Textarea
                placeholder={
                  selectedType === "thank_you"
                    ? "Key topics discussed, interviewer name, specific things you liked..."
                    : selectedType === "offer_negotiation"
                    ? "Current offer details, competing offers, market data..."
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
                    <Check className="h-4 w-4 mr-1" /> Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(generatedContent)}
                  >
                    {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                    {copied ? "Copied!" : "Copy"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEmailClient(generatedSubject, generatedContent)}
                  >
                    <Mail className="h-4 w-4 mr-1" /> Open Email
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
                <div
                  key={msg.id}
                  className="border rounded-lg p-3 space-y-2"
                >
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
                          Sent
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
                  <p className="text-sm whitespace-pre-line line-clamp-4">{msg.content}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-xs px-2"
                      onClick={() => copyToClipboard(msg.content)}
                    >
                      <Copy className="h-3 w-3 mr-1" /> Copy
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-xs px-2"
                      onClick={() => openEmailClient(msg.subject || "", msg.content, msg.recipient_email || "")}
                    >
                      <Mail className="h-3 w-3 mr-1" /> Email
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
