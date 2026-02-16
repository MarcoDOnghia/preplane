import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, HelpCircle, Building2 } from "lucide-react";
import type { InterviewQuestion } from "@/lib/types";

interface InterviewPrepTabProps {
  interviewQuestions: InterviewQuestion[];
  questionsToAsk: string[];
  companyBrief: string;
}

const InterviewPrepTab = ({ interviewQuestions, questionsToAsk, companyBrief }: InterviewPrepTabProps) => {
  const [editedAnswers, setEditedAnswers] = useState<Record<number, string>>(
    Object.fromEntries(interviewQuestions.map((q, i) => [i, q.suggestedAnswer]))
  );

  return (
    <div className="space-y-6">
      {/* Interview Questions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Likely Interview Questions ({interviewQuestions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {interviewQuestions.map((q, i) => (
              <AccordionItem key={i} value={`q-${i}`}>
                <AccordionTrigger className="text-sm text-left">
                  <span className="flex items-center gap-2">
                    <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
                      {i + 1}
                    </span>
                    {q.question}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pl-8">
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1">STAR Framework Guidance</p>
                    <p className="text-sm">{q.starGuidance}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Your Answer (editable)</p>
                    <Textarea
                      value={editedAnswers[i] || ""}
                      onChange={(e) =>
                        setEditedAnswers((prev) => ({ ...prev, [i]: e.target.value }))
                      }
                      className="min-h-[100px] text-sm"
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      {/* Questions to Ask */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            Questions to Ask Them
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {questionsToAsk.map((q, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className="h-6 w-6 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-xs font-bold shrink-0">
                  {i + 1}
                </span>
                {q}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* Company Brief */}
      {companyBrief && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Company Research Brief
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm leading-relaxed whitespace-pre-line">{companyBrief}</div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default InterviewPrepTab;
