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

const feedbackSchema = z.object({
  mode: z.enum(["form", "free"]),
  type: z.enum(["BUG", "FEATURE", "INQUIRY", "OTHER"]).optional(),
  title: z.string().max(255).optional(),
  message: z.string().min(1, "내용을 입력해주세요.").max(5000, "내용이 너무 깁니다."),
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
      toast.success("피드백이 성공적으로 제출되었습니다. 감사합니다!");
      closeModal();
    } catch (error) {
      toast.error("피드백 제출에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>고객의 소리 (피드백 제보)</DialogTitle>
          <DialogDescription>
            서비스 이용 중 불편한 점이나 개선 아이디어가 있다면 알려주세요!
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
            <Label htmlFor="mode-toggle" className="cursor-pointer">자유 형식으로 작성하기</Label>
          </div>

          {!isFreeMode && (
            <div className="space-y-2">
              <Label>유형</Label>
              <Select
                value={form.watch("type")}
                onValueChange={(val: any) => form.setValue("type", val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="분류를 선택해주세요" />
                </SelectTrigger>
                <SelectContent className="z-[10005]">
                  <SelectItem value="BUG">버그 제보</SelectItem>
                  <SelectItem value="FEATURE">기능 제안</SelectItem>
                  <SelectItem value="INQUIRY">단순 문의</SelectItem>
                  <SelectItem value="BUSINESS">제휴 문의</SelectItem>
                  <SelectItem value="REPORT">콘텐츠 신고</SelectItem>
                  <SelectItem value="PERFORMANCE">성능 이슈</SelectItem>
                  <SelectItem value="CORRECTION">정보 수정 요청</SelectItem>
                  <SelectItem value="OTHER">기타</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>제목 {isFreeMode && "(선택)"}</Label>
            <Input
              placeholder={isFreeMode ? "제목을 입력해주세요 (선택)" : "어떤 내용인지 제목을 남겨주세요"}
              {...form.register("title")}
            />
            {form.formState.errors.title && (
              <p className="text-sm text-red-500">{form.formState.errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>내용</Label>
            <Textarea
              placeholder={isFreeMode ? "원하시는 내용을 자유롭게 작성해주세요." : "상세한 내용을 작성해주세요. 확인 후 서비스 개선에 반영하겠습니다."}
              className="min-h-[120px] resize-none"
              {...form.register("message")}
            />
            {form.formState.errors.message && (
              <p className="text-sm text-red-500">{form.formState.errors.message.message}</p>
            )}
          </div>

          <div className="flex justify-end pt-4">
            <Button type="button" variant="outline" onClick={closeModal} className="mr-2">
              취소
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "제출 중..." : "제출하기"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
