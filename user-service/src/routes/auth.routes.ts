import { Router } from "express";
import { validate } from '@middlewares/validation';
import {
  companyAdminLogin,
  superAdminLoginRequest,
  superAdminVerifyOtp,
  resendSuperAdminOtp,
  forgotPassword,
  resetPassword,
  companyAdminVerifyOtp,
  resendCompanyAdminOtp,
  companyForgotPassword,
  companyResetPassword,
  companyProfileImage,
  superRefreshToken,
  companyRefreshToken,
  checkRolePermission,
  scanLogin
} from "@controllers/auth.controller";
import { authenticateWithSubdomainCheck } from "@middlewares/authentication";
import { validateForgotPassword, validateLogin,validateScanLogin } from "@validations/login.validations";

const router = Router();
router.post("/super-admin/login", validate(validateLogin), superAdminLoginRequest); //superAdminLogin
router.post("/super-admin/verfiy", superAdminVerifyOtp);
router.post("/super-admin/resend-otp", resendSuperAdminOtp)
router.post("/super-admin/forgot-password", forgotPassword)
router.post("/super-admin/reset-password",validate(validateForgotPassword), resetPassword)
router.post("/super-admin/refresh-token", superRefreshToken);


// Company Admin
router.post("/company-admin/login", validate(validateLogin),authenticateWithSubdomainCheck(false), companyAdminLogin);
router.post("/company-admin/verfiy", authenticateWithSubdomainCheck(false), companyAdminVerifyOtp);
router.post("/company-admin/resend-otp", authenticateWithSubdomainCheck(false), resendCompanyAdminOtp);
router.post("/company-admin/forgot-password", authenticateWithSubdomainCheck(false), companyForgotPassword);
router.post("/company-admin/reset-password", validate(validateForgotPassword),authenticateWithSubdomainCheck(false), companyResetPassword);
router.post("/company-admin/refresh-token", authenticateWithSubdomainCheck(false), companyRefreshToken);
router.get("/admin/image/:url", authenticateWithSubdomainCheck(false), companyProfileImage);

// Scan Login
router.post("/scan-login", validate(validateScanLogin), scanLogin);

router.post("/role-permission", checkRolePermission );

router.get("/test", (req, res) => {
  res.status(200).json("Ok");
});
// router.post("/super-admin/mail", superAdminLoginRequest);
// router.post("/super-admin/verfiy", superAdminVerifyOtp);
export default router;
