import { useEffect } from "react";

// 브라우저 페이지 줌 방지:
//   - Ctrl/Meta + 마우스 휠
//   - Ctrl/Meta + '+', '-', '=', '0' 키
// 단, NetworkView 같은 컴포넌트 내부의 일반 wheel은 막지 않음.
//   (그 컴포넌트가 자체적으로 native wheel listener를 등록해 preventDefault하면 됨)
export function usePreventPageZoom() {
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault();
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ["=", "+", "-", "0"].includes(e.key)) {
        e.preventDefault();
      }
    };
    // passive:false 명시 — Chrome 기본이 passive:true라 preventDefault 무시됨
    window.addEventListener("wheel",   onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("wheel",   onWheel);
      window.removeEventListener("keydown", onKey);
    };
  }, []);
}
