import { asyncHandler } from "../errors/asyncHandler.js";
import * as userService from "../services/user.service.js";

export const getCurrentUser = asyncHandler(async (req, res) => {
  const data = await userService.getCurrentUser(req.user._id);
  res.status(200).json({ success: true, data });
});

export const getAllUsers = asyncHandler(async (req, res) => {
  const data = await userService.getAllUsers(req.query);
  res.status(200).json({ success: true, data });
});

export const logoutUserById = asyncHandler(async (req, res) => {
  await userService.logoutUserById(req.params.userId);
  res.status(204).end();
});

export const deleteUser = asyncHandler(async (req, res) => {
  await userService.deleteUser(req.params.userId, req.user._id);
  res.status(204).end();
});
