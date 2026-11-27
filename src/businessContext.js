import { createContext, useContext } from "react";
export const BusinessContext = createContext(null);
export function useBusiness() {
  const value = useContext(BusinessContext);
  if (!value) throw new Error("Business page requires a workspace.");
  return value;
}
