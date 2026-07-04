import { Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../useAuth";
import { roleKor } from "../permissions";

export default function ForbiddenPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  return (
    <div className="p-5">
      <div className="bg-card border border-dashed border-border rounded-xl p-10 text-center">
        <Lock className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
        <h3 className="text-base font-semibold mb-2">접근 권한이 없습니다</h3>
        <p className="text-sm text-muted-foreground mb-6">
          현재 역할({roleKor(user?.role!)})로는 이 페이지에 접근할 수 없습니다.
        </p>
        <button onClick={() => navigate("/dashboard")}
          className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
          대시보드로
        </button>
      </div>
    </div>
  );
}
