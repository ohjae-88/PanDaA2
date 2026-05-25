import { Card, CardContent } from "@/components/ui/card";

export function StubPage({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold">{title}</h1>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </div>
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <div className="text-4xl mb-3 opacity-50">🚧</div>
          <div className="text-sm">이 기능은 Ver.5.5.0에서 준비 중입니다.</div>
          <div className="text-xs mt-2">Ver.4.0.9의 동일 기능을 그대로 이식할 예정 — 진행 단계는 README 참고.</div>
        </CardContent>
      </Card>
    </div>
  );
}
