import { IconCircleX } from "@tabler/icons-react";
import type { ErrorResponse } from "@utils/api";
import { cn } from "@utils/helpers";
import classNames from "classnames";
import { AnimatePresence, motion } from "framer-motion";
import { CheckIcon, Loader2, XIcon } from "lucide-react";
import * as React from "react";
import { useEffect, useState } from "react";
import toast, { type Toast } from "react-hot-toast";

export interface NotifyProps<T> {
  title: string;
  description: string;
  promise?: Promise<T | ErrorResponse>;
  loadingTitle?: string;
  loadingMessage?: string;
  duration?: number;
  icon?: React.ReactNode;
  backgroundColor?: string;
  preventSuccessToast?: boolean;
  errorMessages?: ErrorResponse[];
}

interface NotificationProps<T> extends NotifyProps<T> {
  t: Toast;
}
export default function Notification<T>({
  title,
  description,
  icon,
  backgroundColor,
  t,
  promise,
  loadingTitle,
  loadingMessage,
  duration = 3500,
  preventSuccessToast = false,
  errorMessages,
}: NotificationProps<T>) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!!promise);

  const [toastDuration] = useState(duration);

  const [preventSuccess, setPreventSuccess] = useState(false);

  const closeToast = () => {
    setTimeout(() => {
      setLoading(false);
      toast.dismiss(t.id);
    }, toastDuration);
  };

  useEffect(() => {
    // Run the promise
    if (promise) {
      promise
        .then(() => {
          setLoading(false);
          closeToast();
          if (preventSuccessToast) setPreventSuccess(true);
        })
        .catch((e) => {
          const err = e as ErrorResponse;
          let message = err.message || "Something went wrong...";
          message = message.charAt(0).toUpperCase() + message.slice(1);
          const code: number = err.code || 418;

          if (errorMessages) {
            const errorMessage = errorMessages.find(
              (error) => error.code === code,
            );
            if (errorMessage) {
              setError(errorMessage.message);
            }
          } else {
            setError(`Code ${code}: ${message}`);
          }

          setLoading(false);
          closeToast();
        });
    } else {
      closeToast();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AnimatePresence>
      {t.visible && !preventSuccess && (
        <motion.div
          initial={{ opacity: 1, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          className={cn(
            "max-w-md w-full justify-between bg-white dark:bg-nb-gray-940 shadow-lg rounded-md px-4 py-2.5 pointer-events-auto flex border dark:border-nb-gray-900",
          )}
        >
          <div className={"flex items-center gap-4"}>
            <div
              className={classNames(
                "h-8 w-8  shadow-sm text-white flex items-center justify-center rounded-md shrink-0",
                loading
                  ? "bg-nb-gray-900"
                  : error
                  ? "bg-red-500"
                  : backgroundColor || "bg-green-500",
              )}
            >
              {loading ? (
                <Loader2 size={14} className={"animate-spin"} />
              ) : error ? (
                <IconCircleX size={24} />
              ) : (
                icon || <CheckIcon size={14} />
              )}
            </div>
            <div className={"flex flex-col text-sm"}>
              <p>
                <span className={"font-semibold"}>
                  {loading ? loadingTitle || title : title}
                </span>
              </p>
              <p
                className={"text-xs dark:text-nb-gray-300 text-gray-600 mt-0.5"}
              >
                {loading ? loadingMessage : error ? error : description}
              </p>
            </div>
          </div>

          <button
            className="flex dark:border-nb-gray-900 items-center cursor-pointer group"
            onClick={() => toast.dismiss(t.id)}
          >
            <div
              className={
                "p-2 hover:bg-nb-gray-900 rounded-md opacity-50 group-hover:opacity-100"
              }
            >
              <XIcon size={16} />
            </div>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function notify<T>(props: NotifyProps<T>) {
  return toast.custom((t) => <Notification {...props} t={t} />, {
    duration: Infinity,
  });
}
