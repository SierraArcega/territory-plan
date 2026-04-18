import type { ChatMessage as ChatMessageData } from "../lib/ui-types";

interface Props {
  message: ChatMessageData;
}

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

  return (
    <div className="flex w-full">
      <div className={`max-w-[300px] rounded-2xl px-3.5 py-3 text-[13px] ${bubbleClass}`}>
        <p className="font-normal">{message.content}</p>
        {message.receipt && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-[#E2DEEC] bg-white px-2.5 py-1.5">
            <span className="size-[6px] rounded-full bg-coral" aria-hidden />
            <p className="text-[11px] font-medium text-[#6E6390]">
              {message.receipt.summary}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
