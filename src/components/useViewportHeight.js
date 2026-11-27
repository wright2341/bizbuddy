import { useEffect, useState } from "react";
export function useViewportHeight() {
  const [height, setHeight] = useState(() =>
    Math.round(window.visualViewport?.height || window.innerHeight),
  );
  useEffect(() => {
    const viewport = window.visualViewport;
    const resize = () =>
      setHeight(Math.round(viewport?.height || window.innerHeight));
    viewport?.addEventListener("resize", resize);
    window.addEventListener("resize", resize);
    return () => {
      viewport?.removeEventListener("resize", resize);
      window.removeEventListener("resize", resize);
    };
  }, []);
  return height;
}
