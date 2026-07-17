import { combineReducers } from "@reduxjs/toolkit";

import { baseApi } from "./api/baseApi";
import authReducer from "./slices/auth-slice";

const rootReducer = combineReducers({
  [baseApi.reducerPath]: baseApi.reducer,
  auth: authReducer,
});

export default rootReducer;
