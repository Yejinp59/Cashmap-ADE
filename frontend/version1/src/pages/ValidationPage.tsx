import { BarChart3 } from "lucide-react";

export default function ValidationPage() {
  return (
    <div className="p-5">
      <div className="bg-card border border-dashed border-border rounded-xl p-10 text-center">
        <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
        <h3 className="text-base font-semibold mb-2">백테스팅 결과 (AI-B 산출 대기)</h3>
        <p className="text-sm text-muted-foreground">
          KOSDAQ 반도체 섹터 D-Score 선행 상관계수 r ≥ 0.65 시계열 차트로 교체됩니다.
        </p>
      </div>
    </div>
  );
}
