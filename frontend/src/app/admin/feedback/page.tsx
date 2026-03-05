"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  getAdminFeedbackList,
  updateFeedbackStatus,
  FeedbackTicket,
  AdminFeedbackListParams,
} from "@/lib/api/endpoints/admin-feedback";

const STATUS_LABELS: Record<string, string> = {
  new: "신규 접수",
  in_progress: "처리 중",
  done: "처리 완료",
};

const STATUS_COLORS: Record<string, "default" | "secondary" | "outline"> = {
  new: "default",
  in_progress: "secondary",
  done: "outline",
};

const TYPE_LABELS: Record<string, string> = {
  BUG: "버그",
  FEATURE: "기능제안",
  INQUIRY: "단순문의",
  OTHER: "기타",
};

export default function AdminFeedbackPage() {
  const queryClient = useQueryClient();
  const [params, setParams] = useState<AdminFeedbackListParams>({
    page: 1,
    limit: 15,
  });
  const [selectedTicket, setSelectedTicket] = useState<FeedbackTicket | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-feedback", params],
    queryFn: () => getAdminFeedbackList(params),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "new" | "in_progress" | "done" }) =>
      updateFeedbackStatus(id, status),
    onSuccess: () => {
      toast.success("상태가 성공적으로 변경되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["admin-feedback"] });
      setSelectedTicket(null); // 모달이 닫히도록 처리는 나중에, 여기서는 새로고침용
    },
    onError: () => {
      toast.error("상태 변경에 실패했습니다.");
    },
  });

  const handleStatusChange = (status: string) => {
    if (status === "all") {
      const { status: _, ...rest } = params;
      setParams({ ...rest, page: 1 });
    } else {
      setParams({ ...params, status: status as any, page: 1 });
    }
  };

  const handleTypeChange = (type: string) => {
    if (type === "all") {
      const { type: _, ...rest } = params;
      setParams({ ...rest, page: 1 });
    } else {
      setParams({ ...params, type: type as any, page: 1 });
    }
  };

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const q = formData.get("q") as string;
    if (q) {
      setParams({ ...params, q, page: 1 });
    } else {
      const { q: _, ...rest } = params;
      setParams({ ...rest, page: 1 });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">고객의 소리 관리</h1>
      </div>

      <div className="flex items-center gap-4 bg-white dark:bg-[#1F1F1F] p-4 rounded-lg shadow-sm border border-gray-200 dark:border-[#2A2A2A]">
        <Select value={params.status || "all"} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="진행 상태" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 상태</SelectItem>
            <SelectItem value="new">신규 접수</SelectItem>
            <SelectItem value="in_progress">처리 중</SelectItem>
            <SelectItem value="done">처리 완료</SelectItem>
          </SelectContent>
        </Select>

        <Select value={params.type || "all"} onValueChange={handleTypeChange}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="피드백 유형" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 유형</SelectItem>
            <SelectItem value="BUG">버그 제보</SelectItem>
            <SelectItem value="FEATURE">기능 제안</SelectItem>
            <SelectItem value="INQUIRY">단순 문의</SelectItem>
            <SelectItem value="OTHER">기타</SelectItem>
          </SelectContent>
        </Select>

        <form onSubmit={handleSearch} className="flex-1 max-w-sm flex gap-2">
          <Input 
            name="q" 
            placeholder="제목, 내용 검색..." 
            defaultValue={params.q || ""} 
          />
          <Button type="submit" variant="secondary">검색</Button>
        </form>
      </div>

      <div className="bg-white dark:bg-[#1F1F1F] border border-gray-200 dark:border-[#2A2A2A] rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">ID</TableHead>
              <TableHead className="w-[100px]">유형</TableHead>
              <TableHead className="w-[120px]">상태</TableHead>
              <TableHead>제목</TableHead>
              <TableHead className="w-[150px]">작성자</TableHead>
              <TableHead className="w-[120px]">작성일</TableHead>
              <TableHead className="w-[100px] text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">로딩 중...</TableCell>
              </TableRow>
            ) : data?.items?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">접수된 피드백이 없습니다.</TableCell>
              </TableRow>
            ) : (
              data?.items.map((ticket) => (
                <TableRow key={ticket.id}>
                  <TableCell className="font-medium text-xs break-all">{ticket.id.split('-')[0]}</TableCell>
                  <TableCell>
                    {ticket.type ? TYPE_LABELS[ticket.type] : (ticket.mode === 'free' ? '자유분류' : '알수없음')}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_COLORS[ticket.status]}>
                      {STATUS_LABELS[ticket.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[300px] truncate" title={ticket.title}>
                    <span className="cursor-pointer hover:underline" onClick={() => setSelectedTicket(ticket)}>
                      {ticket.title}
                    </span>
                  </TableCell>
                  <TableCell className="truncate" title={ticket.user?.email || ticket.userId}>
                    {ticket.user?.name || "알수없음"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {format(new Date(ticket.createdAt), "yyyy-MM-dd HH:mm")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => setSelectedTicket(ticket)}>
                      상세
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-between items-center bg-white dark:bg-[#1F1F1F] p-4 rounded-lg border border-gray-200 dark:border-[#2A2A2A]">
        <div className="text-sm text-gray-500">
          총 {data?.total || 0}개
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setParams(prev => ({ ...prev, page: Math.max(1, prev.page! - 1) }))}
            disabled={!data || data.page <= 1}
          >
            이전
          </Button>
          <span className="text-sm px-2">
            {data?.page || 1} / {data?.totalPages || 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setParams(prev => ({ ...prev, page: Math.min(data!.totalPages, prev.page! + 1) }))}
            disabled={!data || data.page >= data.totalPages}
          >
            다음
          </Button>
        </div>
      </div>

      <Dialog open={!!selectedTicket} onOpenChange={(open) => !open && setSelectedTicket(null)}>
        {selectedTicket && (
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex justify-between items-center pt-2 pr-6">
                <span>상세 제보 내용</span>
                <Select
                  value={selectedTicket.status}
                  onValueChange={(val: any) => {
                    updateStatusMutation.mutate({ id: selectedTicket.id, status: val });
                    // 낙관적 업데이트
                    setSelectedTicket({ ...selectedTicket, status: val });
                  }}
                  disabled={updateStatusMutation.isPending}
                >
                  <SelectTrigger className="w-[130px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">신규 접수</SelectItem>
                    <SelectItem value="in_progress">처리 중</SelectItem>
                    <SelectItem value="done">처리 완료</SelectItem>
                  </SelectContent>
                </Select>
              </DialogTitle>
              <DialogDescription>
                제보 ID: {selectedTicket.id} | 접수 일시: {format(new Date(selectedTicket.createdAt), "yyyy-MM-dd HH:mm:ss")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 mt-4">
              <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-md text-sm border">
                <div>
                  <div className="font-semibold text-muted-foreground mb-1">작성자</div>
                  <div>{selectedTicket.user?.name} ({selectedTicket.user?.email})</div>
                </div>
                <div>
                  <div className="font-semibold text-muted-foreground mb-1">유형/모드</div>
                  <div>
                    {selectedTicket.type ? TYPE_LABELS[selectedTicket.type] : "미지정"} / {selectedTicket.mode === 'form' ? '폼 모드' : '자유 모드'}
                  </div>
                </div>
                <div>
                  <div className="font-semibold text-muted-foreground mb-1">발생 페이지</div>
                  <div className="break-words">{selectedTicket.pagePath}</div>
                </div>
                <div>
                  <div className="font-semibold text-muted-foreground mb-1">테마</div>
                  <div>{selectedTicket.theme}</div>
                </div>
                <div className="col-span-2">
                  <div className="font-semibold text-muted-foreground mb-1">User Agent (사용 환경)</div>
                  <div className="text-xs break-all">{selectedTicket.userAgent}</div>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-lg mb-2">{selectedTicket.title}</h3>
                <div className="whitespace-pre-wrap bg-muted p-4 rounded-md border text-sm min-h-[150px]">
                  {selectedTicket.message}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 mt-4 border-t">
              <span className={`text-xs mr-auto my-auto ${selectedTicket.emailSent ? 'text-green-500' : 'text-red-500'}`}>
                메일 발송 상태: {selectedTicket.emailSent ? '성공' : '실패'}
              </span>
              <Button onClick={() => setSelectedTicket(null)}>닫기</Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
