import { useEffect, useMemo, useState } from "react";
import { cn } from "../utils/cn";
import { Armchair, Loader2 } from "lucide-react";

export type SeatCell = {
  row: number;
  column: number;
  seat_number: string;
  occupied: boolean;
  student: { id: number; name: string; roll_no: string } | null;
};

export type RoomLayout = {
  room: string;
  room_name: string;
  rows: number;
  columns: number;
  layout: SeatCell[][];
};

type Props = {
  roomId: number | null;
  examId?: string;
  fetchLayout: (roomId: number, examId?: string) => Promise<RoomLayout>;
  refreshKey?: number | string;
  className?: string;
};

export default function RoomSeatMap({ roomId, examId, fetchLayout, refreshKey, className }: Props) {
  const [layout, setLayout] = useState<RoomLayout | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState<SeatCell | null>(null);

  useEffect(() => {
    if (!roomId) {
      setLayout(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchLayout(roomId, examId)
      .then((data) => {
        if (!cancelled) setLayout(data);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [roomId, examId, refreshKey, fetchLayout]);

  const stats = useMemo(() => {
    if (!layout) return null;
    const total = layout.rows * layout.columns;
    let occupied = 0;
    layout.layout.forEach((row) =>
      row.forEach((seat) => {
        if (seat.occupied) occupied++;
      })
    );
    return { total, occupied, available: total - occupied };
  }, [layout]);

  if (!roomId) {
    return (
      <div className={cn("flex items-center justify-center py-12 text-slate-500 text-sm", className)}>
        Select a hall/room to view seat availability
      </div>
    );
  }

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center py-12 text-slate-500 gap-2", className)}>
        <Loader2 className="w-4 h-4 animate-spin" /> Loading seat map…
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("py-8 text-center text-rose-600 dark:text-rose-400 text-sm", className)}>
        {error}
      </div>
    );
  }

  if (!layout || !stats) return null;

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="font-semibold">{layout.room_name}</h4>
          <p className="text-xs text-slate-500">{layout.room} • {layout.rows}×{layout.columns} grid</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 font-medium">
            {stats.available} available
          </span>
          <span className="px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 font-medium">
            {stats.occupied} occupied
          </span>
          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 font-medium">
            {stats.total} total
          </span>
        </div>
      </div>

      {/* Theatre screen / front */}
      <div className="mx-auto max-w-md">
        <div className="h-2 rounded-t-full bg-gradient-to-b from-slate-300 to-slate-400 dark:from-slate-600 dark:to-slate-700" />
        <div className="text-center text-[10px] uppercase tracking-widest text-slate-400 py-1.5 font-medium">
          Front / Board
        </div>
      </div>

      {/* Seat grid */}
      <div className="overflow-x-auto pb-2">
        <div className="inline-flex flex-col gap-1.5 min-w-full items-center">
          {layout.layout.map((row, rowIdx) => (
            <div key={rowIdx} className="flex items-center gap-1.5">
              <span className="w-5 text-[10px] font-semibold text-slate-400 text-right shrink-0">
                {String.fromCharCode(65 + rowIdx)}
              </span>
              <div className="flex gap-1">
                {row.map((seat) => (
                  <button
                    key={`${seat.row}-${seat.column}`}
                    type="button"
                    title={
                      seat.occupied && seat.student
                        ? `${seat.seat_number}: ${seat.student.name} (${seat.student.roll_no})`
                        : `${seat.seat_number}: Available`
                    }
                    onMouseEnter={() => setHovered(seat)}
                    onMouseLeave={() => setHovered(null)}
                    className={cn(
                      "w-7 h-7 sm:w-8 sm:h-8 rounded-md flex items-center justify-center transition-all",
                      seat.occupied
                        ? "bg-indigo-500 text-white shadow-sm hover:bg-indigo-600 ring-1 ring-indigo-600/30"
                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/60 ring-1 ring-emerald-300/50 dark:ring-emerald-700/50"
                    )}
                  >
                    <Armchair className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hover detail + legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
        <div className="text-xs text-slate-500 min-h-[1.25rem]">
          {hovered ? (
            hovered.occupied && hovered.student ? (
              <span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">{hovered.seat_number}</span>
                {" — "}
                {hovered.student.name} ({hovered.student.roll_no})
              </span>
            ) : (
              <span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">{hovered.seat_number}</span>
                {" — Available"}
              </span>
            )
          ) : (
            "Hover a seat for details"
          )}
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-emerald-100 dark:bg-emerald-900/40 ring-1 ring-emerald-300/50" />
            Available
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-indigo-500 ring-1 ring-indigo-600/30" />
            Occupied
          </span>
        </div>
      </div>
    </div>
  );
}
