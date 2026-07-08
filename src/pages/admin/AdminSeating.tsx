import { useState, useEffect, useMemo } from "react";
import { Card, PageHeader, Button, Badge, TextInput, Select } from "../../components/Layout";
import { fetchAdminExams } from "../../data/apiData";
import type { Exam } from "../../data/types";
import { Armchair, RefreshCw, Save, MapPin, Users, CheckCircle2, TicketCheck } from "lucide-react";
import { cn } from "../../utils/cn";

import { API_BASE } from "../../data/api";
const token = () => localStorage.getItem("examshield_token") || "";

type Room = {
  id: number;
  room_code: string;
  room_name: string;
  building?: string;
  rows: number;
  columns: number;
  capacity: number;
  is_active: boolean;
};

type Arrangement = {
  id: number;
  exam_id: number;
  exam_name: string;
  room_id: number;
  room_code: string;
  room_name: string;
  student_id: number;
  student_name: string;
  roll_no: string;
  seat_row: number;
  seat_column: number;
  seat_number: string;
  is_confirmed: boolean;
};

async function apiFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.detail || `Request failed (${res.status})`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export default function AdminSeating() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [arrangements, setArrangements] = useState<Arrangement[]>([]);
  const [examId, setExamId] = useState("");
  const [selectedRooms, setSelectedRooms] = useState<number[]>([]);
  const [strategy, setStrategy] = useState("sequential");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<number, { seat_number: string; room_id: number }>>({});
  const [newRoom, setNewRoom] = useState({ room_code: "", room_name: "", rows: 8, columns: 6 });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ex, rm] = await Promise.all([
        fetchAdminExams(),
        apiFetch("/api/admin/seating/rooms"),
      ]);
      setExams(ex);
      setRooms(rm);
      if (!examId && ex.length) setExamId(String(parseInt(ex[0].id.replace(/\D/g, ""), 10) || ex[0].id));
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  const loadArrangements = async (id: string) => {
    if (!id) return;
    try {
      const data = await apiFetch(`/api/admin/seating/arrangements?exam_id=${id}`);
      setArrangements(data);
      const next: Record<number, { seat_number: string; room_id: number }> = {};
      data.forEach((a: Arrangement) => {
        next[a.id] = { seat_number: a.seat_number, room_id: a.room_id };
      });
      setEdits(next);
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { if (examId) loadArrangements(examId); }, [examId]);

  const selectedExam = useMemo(
    () => exams.find((e) => String(parseInt(e.id.replace(/\D/g, ""), 10) || e.id) === examId),
    [exams, examId]
  );

  const toggleRoom = (id: number) => {
    setSelectedRooms((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));
  };

  const autoArrange = async () => {
    if (!examId || selectedRooms.length === 0) {
      setError("Select an exam and at least one hall/room");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await apiFetch("/api/admin/seating/arrangements/auto", {
        method: "POST",
        body: JSON.stringify({
          exam_id: +examId,
          room_ids: selectedRooms,
          arrangement_strategy: strategy,
        }),
      });
      setMessage(`Seated ${result.students_seated} students across ${result.rooms_used} hall(s)`);
      await loadArrangements(examId);
    } catch (e: any) {
      setError(e.message);
    }
    setBusy(false);
  };

  const saveRow = async (arr: Arrangement) => {
    const edit = edits[arr.id];
    if (!edit) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/admin/seating/arrangements/${arr.id}/update`, {
        method: "PUT",
        body: JSON.stringify({ seat_number: edit.seat_number, room_id: edit.room_id }),
      });
      setMessage(`Updated seating for ${arr.student_name}`);
      await loadArrangements(examId);
    } catch (e: any) {
      setError(e.message);
    }
    setBusy(false);
  };

  const syncHallTickets = async () => {
    if (!examId) return;
    setBusy(true);
    setError(null);
    try {
      const result = await apiFetch("/api/admin/seating/sync-halltickets", {
        method: "POST",
        body: JSON.stringify({ exam_id: +examId }),
      });
      setMessage(result.message);
    } catch (e: any) {
      setError(e.message);
    }
    setBusy(false);
  };

  const createRoom = async () => {
    if (!newRoom.room_code || !newRoom.room_name) {
      setError("Room code and name are required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/admin/seating/rooms/create", {
        method: "POST",
        body: JSON.stringify(newRoom),
      });
      setNewRoom({ room_code: "", room_name: "", rows: 8, columns: 6 });
      setMessage("Hall/room added");
      const rm = await apiFetch("/api/admin/seating/rooms");
      setRooms(rm);
    } catch (e: any) {
      setError(e.message);
    }
    setBusy(false);
  };

  if (loading) return <div className="p-10 text-center text-slate-500">Loading seating system…</div>;

  return (
    <div>
      <PageHeader
        title="Seating Arrangement"
        subtitle="Assign halls and seat numbers, then sync to hall tickets"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => { load(); if (examId) loadArrangements(examId); }}>
              <RefreshCw className="w-4 h-4" /> Refresh
            </Button>
            <Button variant="primary" onClick={syncHallTickets} disabled={busy || arrangements.length === 0}>
              <TicketCheck className="w-4 h-4" /> Sync to Hall Tickets
            </Button>
          </div>
        }
      />

      {(message || error) && (
        <div className={cn("mb-4 p-3 rounded-lg text-sm", error ? "bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300")}>
          {error || message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="p-5 lg:col-span-1">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><MapPin className="w-4 h-4" /> Exam & Auto Arrange</h3>
          <label className="block text-xs font-medium text-slate-500 mb-1">Examination</label>
          <Select value={examId} onChange={(e) => setExamId(e.target.value)} className="mb-3">
            {exams.map((e) => {
              const id = String(parseInt(e.id.replace(/\D/g, ""), 10) || e.id);
              return <option key={e.id} value={id}>{e.subjectName} • {e.department} • Sem {e.semester}</option>;
            })}
          </Select>
          {selectedExam && (
            <p className="text-xs text-slate-500 mb-3">Default hall from exam: <span className="font-medium">{selectedExam.room}</span></p>
          )}
          <label className="block text-xs font-medium text-slate-500 mb-1">Strategy</label>
          <Select value={strategy} onChange={(e) => setStrategy(e.target.value)} className="mb-3">
            <option value="sequential">Sequential (roll order)</option>
            <option value="alphabetical">Alphabetical (name)</option>
            <option value="department">By department</option>
            <option value="random">Random</option>
          </Select>
          <label className="block text-xs font-medium text-slate-500 mb-2">Select hall(s)</label>
          <div className="space-y-2 max-h-48 overflow-y-auto mb-4">
            {rooms.map((r) => (
              <label key={r.id} className={cn("flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-sm",
                selectedRooms.includes(r.id) ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20" : "border-slate-200 dark:border-slate-700")}>
                <input type="checkbox" checked={selectedRooms.includes(r.id)} onChange={() => toggleRoom(r.id)} />
                <span className="font-medium">{r.room_name}</span>
                <span className="text-xs text-slate-500">({r.room_code}) • {r.rows}×{r.columns}</span>
              </label>
            ))}
            {rooms.length === 0 && <p className="text-sm text-slate-500">Add a hall/room below first.</p>}
          </div>
          <Button variant="primary" className="w-full" onClick={autoArrange} disabled={busy}>
            <Armchair className="w-4 h-4" /> Auto Arrange Seats
          </Button>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h3 className="font-semibold mb-3">Add Exam Hall / Room</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <TextInput placeholder="Code e.g. A101" value={newRoom.room_code} onChange={(e) => setNewRoom({ ...newRoom, room_code: e.target.value.toUpperCase() })} />
            <TextInput placeholder="Hall name" value={newRoom.room_name} onChange={(e) => setNewRoom({ ...newRoom, room_name: e.target.value })} />
            <TextInput type="number" placeholder="Rows" value={newRoom.rows} onChange={(e) => setNewRoom({ ...newRoom, rows: +e.target.value })} />
            <TextInput type="number" placeholder="Columns" value={newRoom.columns} onChange={(e) => setNewRoom({ ...newRoom, columns: +e.target.value })} />
          </div>
          <Button variant="secondary" className="mt-3" onClick={createRoom} disabled={busy}>Add Hall</Button>

          <div className="mt-6 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <Users className="w-4 h-4" />
            {arrangements.length} seating assignment{arrangements.length !== 1 ? "s" : ""} for selected exam
            {arrangements.some((a) => a.is_confirmed) && (
              <Badge variant="green"><CheckCircle2 className="w-3 h-3 inline mr-1" />Confirmed</Badge>
            )}
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr className="text-left text-slate-600 dark:text-slate-300">
                <th className="p-4 font-medium">Student</th>
                <th className="p-4 font-medium">Roll No</th>
                <th className="p-4 font-medium">Hall / Room</th>
                <th className="p-4 font-medium">Seat Number</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {arrangements.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="p-4 font-medium">{a.student_name}</td>
                  <td className="p-4 text-slate-500">{a.roll_no}</td>
                  <td className="p-4">
                    <Select
                      value={String(edits[a.id]?.room_id ?? a.room_id)}
                      onChange={(e) => setEdits({ ...edits, [a.id]: { ...edits[a.id], room_id: +e.target.value, seat_number: edits[a.id]?.seat_number ?? a.seat_number } })}
                      className="min-w-[180px]"
                    >
                      {rooms.map((r) => (
                        <option key={r.id} value={r.id}>{r.room_name} ({r.room_code})</option>
                      ))}
                    </Select>
                  </td>
                  <td className="p-4">
                    <TextInput
                      value={edits[a.id]?.seat_number ?? a.seat_number}
                      onChange={(e) => setEdits({ ...edits, [a.id]: { ...edits[a.id], seat_number: e.target.value, room_id: edits[a.id]?.room_id ?? a.room_id } })}
                      className="w-24"
                    />
                  </td>
                  <td className="p-4 text-right">
                    <Button variant="secondary" onClick={() => saveRow(a)} disabled={busy}>
                      <Save className="w-3.5 h-3.5" /> Save
                    </Button>
                  </td>
                </tr>
              ))}
              {arrangements.length === 0 && (
                <tr><td colSpan={5} className="p-10 text-center text-slate-500">No seating yet — select halls and run Auto Arrange</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
