import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { color } from "@/theme";
import { api } from "@/api";
import { Icon } from "./Icon";
import { useRole } from "./RoleContext";

// A subscribe/unsubscribe toggle for a project, program or product. Subscribers
// receive that item's events (risk, date slip, status, approvals) per their
// notification preferences. Cosmetic per identity when auth is off.
interface Sub { id: number; targetType: string; targetId: string; }

export function SubscribeButton({ targetType, targetId }: { targetType: "project" | "program" | "product"; targetId: string }) {
  const { role } = useRole();
  const qc = useQueryClient();
  const { data: subs = [] } = useQuery({
    queryKey: ["subscriptions", role], retry: false,
    queryFn: async (): Promise<Sub[]> => (await api<Sub[]>("/subscriptions")) ?? [],
  });
  const subscribed = subs.some((s) => s.targetType === targetType && s.targetId === targetId);
  const toggle = useMutation({
    mutationFn: () => subscribed
      ? api(`/subscriptions/${targetType}/${targetId}`, { method: "DELETE" })
      : api("/subscriptions", { method: "POST", body: JSON.stringify({ targetType, targetId }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subscriptions"] }),
  });

  return (
    <button
      onClick={() => toggle.mutate()}
      disabled={toggle.isPending}
      title={subscribed ? "You're subscribed — click to stop" : "Subscribe to get updates about this item"}
      style={{
        display: "flex", alignItems: "center", gap: 7, borderRadius: 9, padding: "8px 13px",
        fontSize: 12.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer",
        border: `1px solid ${subscribed ? color.primary : color.border}`,
        background: subscribed ? color.primaryTint : "#fff", color: subscribed ? color.primary : color.subtle,
      }}
    >
      <Icon name="bell" size={15} />
      {subscribed ? "Subscribed" : "Subscribe"}
    </button>
  );
}
