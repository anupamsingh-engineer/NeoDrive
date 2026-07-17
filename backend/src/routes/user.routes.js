import express from "express";
import * as userController from "../controllers/user.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/rbac.middleware.js";
import { verifyCsrf } from "../middlewares/csrf.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { validateObjectId } from "../middlewares/validateObjectId.middleware.js";
import { paginationSchema } from "../validators/pagination.schema.js";
import { ROLES } from "../config/constants.js";

const router = express.Router();

router.param("userId", validateObjectId);

router.get("/users/me", requireAuth, userController.getCurrentUser);

router.get(
  "/users",
  requireAuth,
  authorizeRoles(ROLES.ADMIN, ROLES.MANAGER),
  validate(paginationSchema, "query"),
  userController.getAllUsers
);

router.post(
  "/users/:userId/logout",
  requireAuth,
  verifyCsrf,
  authorizeRoles(ROLES.ADMIN, ROLES.MANAGER),
  userController.logoutUserById
);

router.delete(
  "/users/:userId",
  requireAuth,
  verifyCsrf,
  authorizeRoles(ROLES.ADMIN),
  userController.deleteUser
);

export default router;
