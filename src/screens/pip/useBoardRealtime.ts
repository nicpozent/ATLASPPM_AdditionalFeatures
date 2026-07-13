// ============================================================================
//  PI Program Board real-time (ADR-0061). A thin wrapper over the generic room
//  transport (src/realtime/useRoomRealtime): the board's room key is "pi:{id}".
//  Kept as its own hook so the board component reads in increment terms while the
//  transport stays surface-agnostic and shared with the demand funnel.
// ============================================================================
import { useRoomRealtime, type Peer, type PeerCursor } from "@/realtime/useRoomRealtime";

export type { Peer, PeerCursor };

export function useBoardRealtime(incrementId: number | null, myName: string, onChanged: () => void) {
  return useRoomRealtime(incrementId == null ? null : `pi:${incrementId}`, myName, onChanged);
}
