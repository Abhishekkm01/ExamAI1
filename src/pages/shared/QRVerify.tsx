import { useState } from "react";
import { Card, Button, Badge, TextInput } from "../../components/Layout";
import { QrCode, Scan, CheckCircle2, XCircle, Camera, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "../../utils/cn";
import { api } from "../../data/api";

function mapVerification(data: any) {
  return {
    valid: data.valid,
    student: data.student,
    hallTicketNo: data.hall_ticket_no,
    exam: data.exam,
    subjectCode: data.subject_code,
    date: data.date,
    time: data.time,
    room: data.room,
    seatNumber: data.seat_number,
  };
}

export function QRVerify() {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const navigate = useNavigate();

  const verify = async (ticketNo: string) => {
    const code = ticketNo.trim().toUpperCase();
    if (!code) return;
    setError(null);
    setResult(null);
    try {
      const data = await api.verifyHallTicket(code);
      setResult(mapVerification(data));
    } catch (e: any) {
      setError(e?.message || "Could not verify hall ticket");
      setResult({ valid: false });
    }
  };

  const scan = async () => {
    if (!manual.trim()) {
      setError("Enter a hall ticket number below, then tap Scan.");
      return;
    }
    setScanning(true);
    await verify(manual);
    setScanning(false);
  };

  const lookup = async () => verify(manual);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-2xl font-bold">QR Hall Ticket Verification</h2>
          <p className="text-sm text-slate-500">Scan or enter hall ticket number to verify</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <Scan className="w-5 h-5 text-indigo-600" /> QR Scanner
          </h3>
          <div className="aspect-video rounded-xl bg-slate-900 relative overflow-hidden flex items-center justify-center">
            {scanning ? (
              <div className="text-center">
                <div className="w-48 h-48 relative mx-auto">
                  <div className="absolute inset-0 border-4 border-indigo-500 rounded-lg">
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-indigo-400 rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-indigo-400 rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-indigo-400 rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-indigo-400 rounded-br-lg" />
                  </div>
                  <div className="absolute left-0 right-0 h-0.5 bg-indigo-400 animate-pulse" style={{ top: "50%" }} />
                </div>
                <p className="text-white mt-4 animate-pulse">Verifying hall ticket...</p>
              </div>
            ) : (
              <div className="text-center">
                <QrCode className="w-16 h-16 text-slate-500 mx-auto" />
                <p className="text-slate-400 mt-4">Enter hall ticket number below</p>
              </div>
            )}
            <div className="absolute top-3 left-3 px-2 py-1 rounded-md bg-rose-500 text-white text-xs font-semibold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" /> LIVE
            </div>
          </div>
          {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
          <Button variant="primary" className="w-full mt-4" onClick={scan} disabled={scanning}>
            <Camera className="w-4 h-4" /> {scanning ? "Verifying..." : "Verify Ticket"}
          </Button>

          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
            <span className="text-xs text-slate-400">Or enter manually</span>
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
          </div>

          <div className="flex gap-2">
            <TextInput value={manual} onChange={(e) => setManual(e.target.value)} placeholder="HT2026..." />
            <Button variant="secondary" onClick={lookup}>Lookup</Button>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-bold mb-4">Verification Result</h3>
          {!result ? (
            <div className="h-full min-h-[400px] flex items-center justify-center text-slate-400 text-sm">
              Enter a hall ticket number to verify
            </div>
          ) : result.valid ? (
            <div className="p-6 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-200 dark:border-emerald-800">
              <div className="flex items-center gap-4 mb-4 pb-4 border-b border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="w-16 h-16 text-emerald-600" />
                <div>
                  <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">VALID HALL TICKET</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">Authenticity verified successfully</p>
                </div>
              </div>
              <div className="flex items-center gap-4 mb-4 pb-4 border-b border-emerald-200 dark:border-emerald-800">
                <img src={result.student.photo} alt="" className="w-16 h-16 rounded-full bg-slate-200 border-2 border-emerald-300" />
                <div>
                  <p className="font-bold text-lg">{result.student.name}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{result.student.roll_no || result.student.rollNo}</p>
                  <Badge variant="green">Verified</Badge>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Info label="Hall Ticket No" value={result.hallTicketNo} />
                <Info label="Department" value={result.student.department} />
                <Info label="Subject" value={result.exam} />
                <Info label="Code" value={result.subjectCode} />
                <Info label="Date" value={result.date} />
                <Info label="Time" value={result.time} />
                <Info label="Room" value={result.room} />
                <Info label="Seat Number" value={result.seatNumber} bold />
              </div>
              <div className="mt-4 p-3 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-sm text-emerald-800 dark:text-emerald-300 font-medium text-center">
                ✓ Admit this candidate to the examination hall
              </div>
            </div>
          ) : (
            <div className="p-6 rounded-xl bg-rose-50 dark:bg-rose-900/20 border-2 border-rose-200 dark:border-rose-800 text-center">
              <XCircle className="w-20 h-20 text-rose-600 mx-auto" />
              <p className="text-2xl font-bold text-rose-700 dark:text-rose-300 mt-3">INVALID HALL TICKET</p>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">This ticket does not match any registered hall ticket in MySQL.</p>
              <p className="text-xs text-slate-500 mt-4">Please contact the examination cell if this is an error.</p>
              <div className="mt-4 p-3 rounded-lg bg-rose-100 dark:bg-rose-900/40 text-sm text-rose-800 dark:text-rose-300 font-medium">
                ✗ Do NOT admit this candidate
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Info({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="p-3 rounded-lg bg-white dark:bg-slate-900">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={cn("font-semibold mt-0.5", bold ? "text-emerald-700 dark:text-emerald-300" : "text-slate-800 dark:text-white")}>{value}</p>
    </div>
  );
}
