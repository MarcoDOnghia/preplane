import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface PatternRow {
  label: string;
  count: number;
  interviews: number;
  rate: number;
}

interface SuccessPatternsProps {
  toneData: PatternRow[];
}

const SuccessPatterns = ({ toneData }: SuccessPatternsProps) => {
  if (toneData.length === 0) return null;

  const best = toneData.reduce((b, t) => (t.rate > b.rate ? t : b), toneData[0]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Success Patterns by Tone</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Tone</TableHead>
              <TableHead className="text-xs text-right">Apps</TableHead>
              <TableHead className="text-xs text-right">Interviews</TableHead>
              <TableHead className="text-xs text-right">Rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {toneData.map((t) => (
              <TableRow key={t.label} className={t.label === best.label ? "bg-success/5" : ""}>
                <TableCell className="text-sm capitalize font-medium">{t.label}</TableCell>
                <TableCell className="text-sm text-right">{t.count}</TableCell>
                <TableCell className="text-sm text-right">{t.interviews}</TableCell>
                <TableCell className="text-sm text-right font-medium">{t.rate}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {best.rate > 0 && (
          <p className="text-sm text-success font-medium">
            🎯 Your "{best.label}" cover letters have the highest interview rate at {best.rate}%.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default SuccessPatterns;
