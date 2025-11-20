import { useState } from "react";
import { Copy } from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

export default function CopyCell({ value, size = 14 }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setOpen(true);

    setTimeout(() => {
      setCopied(false);
      setOpen(false);
    }, 1500);
  };

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button
          onClick={handleCopy}
          className="hover:text-blue-600 p-1"
          onMouseEnter={() => !copied && setOpen(true)}
          onMouseLeave={() => !copied && setOpen(false)}
        >
          <Copy size={size} />
        </button>
      </TooltipTrigger>

      <TooltipContent>
        {copied ? "Copied!" : "Copy"}
      </TooltipContent>
    </Tooltip>
  );
}