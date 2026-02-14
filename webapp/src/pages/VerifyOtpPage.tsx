import { Navigate } from "react-router-dom";

// OTP flow removed — redirect to login
export default function VerifyOtpPage() {
  return <Navigate to="/login" replace />;
}
