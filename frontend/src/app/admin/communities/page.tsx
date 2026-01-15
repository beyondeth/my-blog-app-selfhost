'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert, ArrowRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function AdminCommunitiesIndexPage() {
  const [slug, setSlug] = useState('');
  const router = useRouter();

  const handleNavigate = (event: React.FormEvent) => {
    event.preventDefault();
    if (!slug.trim()) {
      return;
    }
    router.push(`/admin/communities/${slug.trim()}/recovery`);
  };

  return (
    <div className="px-6 py-10">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" />
            커뮤니티 복구 콘솔
          </CardTitle>
          <CardDescription>
            복구가 필요한 커뮤니티 slug를 입력하고 해당 리커버리 페이지로 이동하세요. 잠금/스냅샷 기능은 사이트 Admin 권한에서만 사용 가능합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleNavigate} className="flex flex-col gap-4 sm:flex-row">
            <Input
              placeholder="예: luticek88"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
            />
            <Button type="submit" className="inline-flex items-center gap-2">
              이동하기
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
