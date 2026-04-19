import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFeedbackStore } from "@/stores/feedbackStore";
import { submitFeedback } from "@/lib/api/endpoints/feedback";

const feedbackTypeValues = [
  "BUG",
  "FEATURE",
  "INQUIRY",
  "BUSINESS",
  "REPORT",
  "PERFORMANCE",
  "CORRECTION",
  "OTHER",
] as const;

const feedbackSchema = z.object({
  mode: z.enum(["form", "free"]),
  type: z.enum(feedbackTypeValues).optional(),
  title: z.string().max(255).optional(),
  message: z.string().min(1, "Please enter a message.").max(5000, "Message is too long."),
});

type FeedbackFormValues = z.infer<typeof feedbackSchema>;

export function FeedbackModal() {
  const { isOpen, closeModal } = useFeedbackStore();
  const { resolvedTheme } = useTheme();
  const pathname = usePathname();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FeedbackFormValues>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: {
      mode: "form",
      type: "BUG",
      title: "",
      message: "",
    },
  });

  const mode = form.watch("mode");
  const isFreeMode = mode === "free";

  useEffect(() => {
    if (isOpen) {
      form.reset({
        mode: "form",
        type: "BUG",
        title: "",
        message: "",
      });
    }
  }, [isOpen, form]);

  const onSubmit = async (data: FeedbackFormValues) => {
    setIsSubmitting(true);
    try {
      await submitFeedback({
        ...data,
        pagePath: pathname,
        theme: resolvedTheme,
        userAgent: window.navigator.userAgent,
      });
      toast.success("Feedback submitted successfully. Thank you.");
      closeModal();
    } catch (error) {
      toast.error("Couldn't submit feedback. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Send feedback</DialogTitle>
          <DialogDescription>
            Share bugs, feature ideas, or anything blocking you while using Codebase.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="flex items-center space-x-2 pb-2">
            <Switch
              id="mode-toggle"
              checked={isFreeMode}
              onCheckedChange={(checked) => {
                form.setValue("mode", checked ? "free" : "form");
                if (checked) form.setValue("type", undefined);
                else form.setValue("type", "BUG");
              }}
            />
            <Label htmlFor="mode-toggle" className="cursor-pointer">Use free-form mode</Label>
          </div>

          {!isFreeMode && (
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={form.watch("type")}
                onValueChange={(val: any) => form.setValue("type", val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a category" />
                </SelectTrigger>
                <SelectContent className="z-[10005]">
                  <SelectItem value="BUG">Bug report</SelectItem>
                  <SelectItem value="FEATURE">Feature request</SelectItem>
                  <SelectItem value="INQUIRY">General question</SelectItem>
                  <SelectItem value="BUSINESS">Business inquiry</SelectItem>
                  <SelectItem value="REPORT">Content report</SelectItem>
                  <SelectItem value="PERFORMANCE">Performance issue</SelectItem>
                  <SelectItem value="CORRECTION">Correction request</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Title {isFreeMode && "(optional)"}</Label>
            <Input
              placeholder={isFreeMode ? "Add a title if helpful" : "Summarize the issue or request"}
              {...form.register("title")}
            />
            {form.formState.errors.title && (
              <p className="text-sm text-red-500">{form.formState.errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea
              placeholder={isFreeMode ? "Write anything you want us to review." : "Describe what happened, what you expected, and how we can reproduce it."}
              className="min-h-[120px] resize-none"
              {...form.register("message")}
            />
            {form.formState.errors.message && (
              <p className="text-sm text-red-500">{form.formState.errors.message.message}</p>
            )}
          </div>

          <div className="flex justify-end pt-4">
            <Button type="button" variant="outline" onClick={closeModal} className="mr-2">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Sending..." : "Send"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
