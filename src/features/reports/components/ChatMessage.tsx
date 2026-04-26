import type { ChatMessage as ChatMessageData } from "../lib/ui-types";
import type { ReceiptAction } from "../lib/params-diff";

interface Props {
  message: ChatMessageData;
}

const TAG_STYLES: Record<ReceiptAction["kind"], string> = {
  add: "bg-[#E4F2EA] text-[#2F7D50]",
  rem: "bg-[#FBE6E3] text-[#B84135]",
  mod: "bg-[#FDF4E6] text-[#8A5A0B]",
};

export default function ChatMessage({ message }: Props) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end w-full">
        <div className="max-w-[260px] rounded-2xl bg-plum px-3.5 py-2.5 text-[13px] font-medium text-white">
          {message.content}
        </div>
      </div>
    );
  }

  const bubbleClass = message.error
    ? "bg-[#fef1f0] border border-[#f58d85] text-[#b84135]"
    : "bg-[#F7F5FA] text-[#544A78]";

  const actions = message.receipt?.actions ?? [];

  return (
    <div className="flex w-full">
      <div className={`max-w-[300px] rounded-2xl px-3.5 py-3 text-[13px] ${bubbleClass}`}>
        <p className="font-normal">{message.content}</p>
        {actions.length > 0 && (
          <ul className="mt-2 rounded-lg border border-[#E2DEEC] bg-white px-2.5 py-2 space-y-1">
            {actions.map((a, i) => (
              <li
                key={`${a.kind}-${a.field}-${a.label}-${i}`}
                className="flex items-baseline gap-1.5 text-[11.5px] leading-[1.4] text-[#544A78]"
              >
                <span
                  className={`inline-flex shrink-0 px-1.5 py-[1px] rounded text-[9.5px] font-bold uppercase tracking-[0.3px] ${TAG_STYLES[a.kind]}`}
                >
                  {a.kind}
                </span>
                <span className="text-[10.5px] uppercase text-[#A69DC0] tracking-[0.3px] shrink-0">
                  {a.field}
                </span>
                <span className="font-medium break-words">{a.label}</span>
                {a.detail && (
                  <span className="text-[10.5px] text-[#A69DC0] break-words">
                    {a.detail}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
