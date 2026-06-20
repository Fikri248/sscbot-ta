
import { CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export type AlertType = "success" | "error" | "warning";

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type: AlertType;
  onConfirm?: () => void;
  confirmText?: string;
}

export function AlertModal({ isOpen, onClose, title, message, type, onConfirm, confirmText }: AlertModalProps) {
  if (!isOpen) return null;

  const Icon = {
    success: CheckCircle2,
    error: XCircle,
    warning: AlertCircle,
  }[type];

  const iconColor = {
    success: "text-green-500",
    error: "text-[#B31217]",
    warning: "text-yellow-500",
  }[type];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <Card className="w-full max-w-sm shadow-2xl border-0 rounded-2xl relative bg-white animate-in zoom-in-95 fade-in-0 duration-200">
        <CardHeader className="flex flex-col items-center pt-8 pb-2 space-y-4">
          <div className={`${iconColor} bg-gray-50 p-3 rounded-full`}>
            <Icon className="w-10 h-10" />
          </div>
          <CardTitle className="text-xl font-bold text-gray-900 text-center">
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6 pt-2">
          <p className="text-center text-gray-500 text-sm">
            {message}
          </p>
        </CardContent>
        <CardFooter className="px-6 pb-6 pt-0">
          <Button 
            onClick={() => {
              if (onConfirm) onConfirm();
              onClose();
            }}
            className="w-full rounded-xl bg-[#B31217] hover:bg-[#8B0E12] text-white font-medium py-5 transition-all"
          >
            {confirmText || "Tutup"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
